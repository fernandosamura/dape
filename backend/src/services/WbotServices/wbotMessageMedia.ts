import { join } from "path";
import { promisify } from "util";
import { writeFile } from "fs";
import * as Sentry from "@sentry/node";
import { extension as mimeExtension } from "mime-types";
import { execSync } from "child_process";
import {
  SpeechConfig,
  SpeechSynthesizer,
  AudioConfig
} from "microsoft-cognitiveservices-speech-sdk";
import { downloadMediaMessage, proto } from "baileys";

import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import Message from "../../models/Message";
import TicketTraking from "../../models/TicketTraking";
import Queue from "../../models/Queue";
import User from "../../models/User";

import { getIO } from "../../libs/socket";
import { logger } from "../../utils/logger";
import { uploadToR2 } from "../StorageServices/R2Service";
import CreateMessageService from "../MessageServices/CreateMessageService";
import CreateOrUpdateContactService from "../ContactServices/CreateOrUpdateContactService";
import formatBody from "../../helpers/Mustache";
import { makeid } from "../../utils/generalHelpers";
import {
  getBodyMessage,
  getTypeMessage,
  hasCaption,
  getQuotedMessageId
} from "./wbotMessageParsers";
import type { Session, IMe } from "./wbotMessageListener";

const fs = require("fs");
const writeFileAsync = promisify(writeFile);

export const sendMessageImage = async (
  wbot: Session,
  contact,
  ticket: Ticket,
  url: string,
  caption: string
) => {
  let sentMessage;
  try {
    sentMessage = await wbot.sendMessage(
      `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
      {
        image: url
          ? { url }
          : fs.readFileSync(`public/temp/${caption}-${makeid(10)}`),
        fileName: caption,
        caption: caption,
        mimetype: "image/jpeg"
      }
    );
  } catch (error) {
    sentMessage = await wbot.sendMessage(
      `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
      {
        text: formatBody(
          "Não consegui enviar a imagem, tente novamente!",
          contact
        )
      }
    );
  }
  verifyMessage(sentMessage, ticket, contact);
};

export const sendMessageLink = async (
  wbot: Session,
  contact: Contact,
  ticket: Ticket,
  url: string,
  caption: string
) => {
  let sentMessage;
  try {
    sentMessage = await wbot.sendMessage(
      `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
      {
        document: url
          ? { url }
          : fs.readFileSync(`public/temp/${caption}-${makeid(10)}`),
        fileName: caption,
        caption: caption,
        mimetype: "application/pdf"
      }
    );
  } catch (error) {
    sentMessage = await wbot.sendMessage(
      `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
      {
        text: formatBody("Não consegui enviar o PDF, tente novamente!", contact)
      }
    );
  }
  verifyMessage(sentMessage, ticket, contact);
};

export const downloadMedia = async (msg: proto.IWebMessageInfo) => {
  let buffer;
  try {
    buffer = await downloadMediaMessage(msg, "buffer", {});
  } catch (err) {
    console.error("Erro ao baixar mídia:", err);

    // Trate o erro de acordo com as suas necessidades
  }

  let filename = msg.message?.documentMessage?.fileName || "";

  const mineType =
    msg.message?.imageMessage ||
    msg.message?.audioMessage ||
    msg.message?.videoMessage ||
    msg.message?.stickerMessage ||
    msg.message?.documentMessage ||
    msg.message?.documentWithCaptionMessage?.message?.documentMessage ||
    msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
      ?.imageMessage ||
    msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage;

  if (!mineType) console.log(msg);

  if (!filename) {
    const ext = mimeExtension(mineType.mimetype);
    filename = `${new Date().getTime()}.${ext}`;
  } else {
    filename = `${new Date().getTime()}_${filename}`;
  }

  const media = {
    data: buffer,
    mimetype: mineType.mimetype,
    filename
  };

  return media;
};

export const resolveLidToPhone = async (lidJid: string, whatsappId: number): Promise<string> => {
  try {
    const Baileys = require("../../models/Baileys").default;
    const baileysRecord = await Baileys.findOne({ where: { whatsappId } });
    if (baileysRecord?.contacts) {
      const contacts = JSON.parse(baileysRecord.contacts);
      const lidNumber = lidJid.replace(/[^0-9]/g, "");
      // Procura contato onde lid corresponde ao lidJid
      const match = contacts.find((c: any) =>
        c.lid && c.lid.replace(/[^0-9]/g, "") === lidNumber && c.id && !c.id.includes("@lid")
      );
      if (match) {
        return match.id.replace(/[^0-9]/g, "");
      }
    }
  } catch (_) {}
  return lidJid.replace(/[^0-9]/g, "");
};

export const verifyContact = async (
  msgContact: IMe,
  wbot: Session,
  companyId: number
): Promise<Contact> => {
  let profilePicUrl: string;
  try {
    profilePicUrl = await wbot.profilePictureUrl(msgContact.id);
  } catch (e) {
    Sentry.captureException(e);
    profilePicUrl = `${process.env.FRONTEND_URL}/nopicture.png`;
  }

  const isLid = msgContact.id.includes("@lid");
  const resolvedNumber = isLid
    ? await resolveLidToPhone(msgContact.id, wbot.id!)
    : msgContact.id.replace(/\D/g, "");

  const contactData = {
    name: msgContact?.name || resolvedNumber,
    number: resolvedNumber,
    profilePicUrl,
    isGroup: msgContact.id.includes("g.us"),
    companyId,
    whatsappId: wbot.id,
    isLid
  };

  const contact = CreateOrUpdateContactService(contactData);

  return contact;
};

export const verifyQuotedMessage = async (
  msg: proto.IWebMessageInfo
): Promise<Message | null> => {
  if (!msg) return null;
  const quoted = getQuotedMessageId(msg);

  if (!quoted) return null;

  const quotedMsg = await Message.findOne({
    where: { id: quoted }
  });

  if (!quotedMsg) return null;

  return quotedMsg;
};

// ── Converte qualquer áudio para OGG/Opus (exigido pelo WhatsApp Web/Baileys)
export const convertToOggOpus = (inputPath: string, outputPath: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      execSync(
        `ffmpeg -i "${inputPath}" -c:a libopus -b:a 32k -vbr on -compression_level 10 "${outputPath}" -y`,
        { stdio: "pipe" }
      );
      resolve();
    } catch (err) {
      reject(new Error(`Erro ao converter para OGG/Opus: ${err}`));
    }
  });
};

// ── Azure Cognitive Services TTS ───────────────────────────────────────────
export const convertTextToSpeechAzure = (
  text: string,
  filename: string,
  subscriptionKey: string,
  serviceRegion: string,
  voice: string
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const speechConfig = SpeechConfig.fromSubscription(subscriptionKey, serviceRegion);
    speechConfig.speechSynthesisVoiceName = voice;
    const audioConfig = AudioConfig.fromAudioFileOutput(`${filename}.wav`);
    const synthesizer = new SpeechSynthesizer(speechConfig, audioConfig);
    synthesizer.speakTextAsync(
      text,
      result => {
        synthesizer.close();
        if (result) {
          resolve();
        } else {
          reject(new Error("Azure TTS: sem resultado do sintetizador"));
        }
      },
      error => {
        synthesizer.close();
        reject(new Error(`Azure TTS erro: ${error}`));
      }
    );
  });
};

// ── Google Cloud TTS ───────────────────────────────────────────────────────
export const convertTextToSpeechGoogle = async (
  text: string,
  filename: string,
  apiKey: string,
  voice: string
): Promise<void> => {
  const textToSpeech = require("@google-cloud/text-to-speech");
  const client = new textToSpeech.TextToSpeechClient({ apiKey });

  // Detecta languageCode a partir do nome da voz (ex: pt-BR-Wavenet-A → pt-BR)
  const langMatch = voice.match(/^([a-z]{2}-[A-Z]{2})/);
  const languageCode = langMatch ? langMatch[1] : "pt-BR";

  const [response] = await client.synthesizeSpeech({
    input: { text },
    voice: { languageCode, name: voice },
    audioConfig: { audioEncoding: "LINEAR16" } // retorna WAV
  });

  fs.writeFileSync(`${filename}.wav`, response.audioContent, "binary");
};

// ── Função principal exportada ─────────────────────────────────────────────
// Gera áudio via TTS (Azure ou Google) e converte para OGG/Opus (WhatsApp)
export const convertTextToSpeechAndSaveToFile = async (
  text: string,
  filename: string,
  voiceKey: string,
  voiceRegion: string,
  voice: string = "pt-BR-FabioNeural",
  ttsProvider: string = "azure"
): Promise<void> => {
  // Etapa 1: gerar WAV via provider TTS
  if (ttsProvider === "google") {
    await convertTextToSpeechGoogle(text, filename, voiceKey, voice);
  } else {
    // Azure (padrão)
    await convertTextToSpeechAzure(text, filename, voiceKey, voiceRegion, voice);
  }

  // Etapa 2: converter WAV → OGG/Opus (exigido pelo WhatsApp Web/Baileys)
  await convertToOggOpus(`${filename}.wav`, `${filename}.ogg`);
};

export const deleteFileSync = (path: string): void => {
  try {
    fs.unlinkSync(path);
  } catch (error) {
    console.error("Erro ao deletar o arquivo:", error);
  }
};

export const verifyMessage = async (
  msg: proto.IWebMessageInfo,
  ticket: Ticket,
  contact: Contact
) => {
  const io = getIO();
  const quotedMsg = await verifyQuotedMessage(msg);
  const body = getBodyMessage(msg);
  const isEdited = getTypeMessage(msg) == "editedMessage";

  const messageData = {
    id: isEdited
      ? msg?.message?.editedMessage?.message?.protocolMessage?.key?.id
      : msg.key.id,
    ticketId: ticket.id,
    contactId: msg.key.fromMe ? undefined : contact.id,
    body,
    fromMe: msg.key.fromMe,
    mediaType: getTypeMessage(msg),
    read: msg.key.fromMe,
    quotedMsgId: quotedMsg?.id,
    ack: msg.status,
    remoteJid: msg.key.remoteJid,
    participant: msg.key.participant,
    dataJson: JSON.stringify(msg),
    isEdited: isEdited
  };

  await ticket.update({
    lastMessage: body
  });

  await CreateMessageService({ messageData, companyId: ticket.companyId });

  if (!msg.key.fromMe && ticket.status === "closed") {
    await ticket.update({ status: "pending" });
    await ticket.reload({
      include: [
        { model: Queue, as: "queue" },
        { model: User, as: "user" },
        { model: Contact, as: "contact" }
      ]
    });

    io.to(`company-${ticket.companyId}-closed`)
      .to(`queue-${ticket.queueId}-closed`)
      .emit(`company-${ticket.companyId}-ticket`, {
        action: "delete",
        ticket,
        ticketId: ticket.id
      });

    io.to(`company-${ticket.companyId}-${ticket.status}`)
      .to(`queue-${ticket.queueId}-${ticket.status}`)
      .emit(`company-${ticket.companyId}-ticket`, {
        action: "update",
        ticket,
        ticketId: ticket.id
      });
  }
};

export const verifyMediaMessage = async (
  msg: proto.IWebMessageInfo,
  ticket: Ticket,
  contact: Contact,
  ticketTraking: TicketTraking = null,
  isForwarded: boolean = false,
  isPrivate: boolean = false,
  wbot: Session = null
): Promise<Message> => {
  const io = getIO();
  const quotedMsg = await verifyQuotedMessage(msg);
  const media = await downloadMedia(msg);

  if (!media) {
    throw new Error("ERR_WAPP_DOWNLOAD_MEDIA");
  }

  if (!media.filename) {
    const ext = mimeExtension(media.mimetype);
    media.filename = `${new Date().getTime()}.${ext}`;
  }

  try {
    // media.data já é um Buffer retornado pelo downloadMediaMessage
    const fileBuffer = Buffer.isBuffer(media.data) ? media.data : Buffer.from(media.data, 'base64');
    if (process.env.CLOUDFLARE_R2_ENABLED === "true") {
      const fs = require("fs");
      const tempPath = join(__dirname, "..", "..", "..", "public", "temp", media.filename);
      await writeFileAsync(tempPath, fileBuffer);
      await uploadToR2(tempPath, media.filename, media.mimetype);
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    } else {
      await writeFileAsync(
        join(__dirname, "..", "..", "..", "public", media.filename),
        fileBuffer
      );
    }
  } catch (err) {
    Sentry.captureException(err);
    logger.error(err);
  }

  const body = getBodyMessage(msg);

  const hasCap = hasCaption(body, media.filename);
  const bodyMessage = body ? hasCap ? formatBody(body, ticket.contact) : "-" : "-";

  const messageData = {
    id: msg.key.id,
    ticketId: ticket.id,
    contactId: msg.key.fromMe ? undefined : contact.id,
    body: bodyMessage,
    fromMe: msg.key.fromMe,
    read: msg.key.fromMe,
    mediaUrl: media.filename,
    mediaType: media.mimetype.split("/")[0],
    quotedMsgId: quotedMsg?.id,
    ack: msg.status,
    remoteJid: msg.key.remoteJid,
    participant: msg.key.participant,
    dataJson: JSON.stringify(msg),
    ticketTrakingId: ticketTraking?.id,
  };

  await ticket.update({
    lastMessage: body || "Arquivo de mídia"
  });

  const newMessage = await CreateMessageService({
    messageData,
    companyId: ticket.companyId
  });

  if (!msg.key.fromMe && ticket.status === "closed") {
    await ticket.update({ status: "pending" });
    await ticket.reload({
      include: [
        { model: Queue, as: "queue" },
        { model: User, as: "user" },
        { model: Contact, as: "contact" }
      ]
    });

    io.to(`company-${ticket.companyId}-closed`)
      .to(`queue-${ticket.queueId}-closed`)
      .emit(`company-${ticket.companyId}-ticket`, {
        action: "delete",
        ticket,
        ticketId: ticket.id
      });

    io.to(`company-${ticket.companyId}-${ticket.status}`)
      .to(`queue-${ticket.queueId}-${ticket.status}`)
      .to(ticket.id.toString())
      .emit(`company-${ticket.companyId}-ticket`, {
        action: "update",
        ticket,
        ticketId: ticket.id
      });
  }

  return newMessage;
};
