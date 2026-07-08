import { uploadToR2, downloadFromR2 } from "../StorageServices/R2Service";
import path, { join } from "path";
import { promisify } from "util";
import { readFile, writeFile } from "fs";
import * as Sentry from "@sentry/node";
import { isNil, isNull, head } from "lodash";
import { extension as mimeExtension } from "mime-types";

import {
  downloadMediaMessage,
  extractMessageContent,
  getContentType,
  jidNormalizedUser,
  MessageUpsertType,
  proto,
  WAMessage,
  WAMessageStubType,
  WAMessageUpdate,
  WASocket
} from "baileys";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import Message from "../../models/Message";

import { getIO } from "../../libs/socket";
import CreateMessageService from "../MessageServices/CreateMessageService";
import { logger } from "../../utils/logger";
import { moduleAccessService as moduleAccess } from "../../dape/shared/moduleAccess.service";
import CreateOrUpdateContactService from "../ContactServices/CreateOrUpdateContactService";
import FindOrCreateTicketService from "../TicketServices/FindOrCreateTicketService";
import ShowWhatsAppService from "../WhatsappService/ShowWhatsAppService";
import UpdateTicketService from "../TicketServices/UpdateTicketService";
import formatBody from "../../helpers/Mustache";
import { Store } from "../../libs/store";
import TicketTraking from "../../models/TicketTraking";
import UserRating from "../../models/UserRating";
import SendWhatsAppMessage from "./SendWhatsAppMessage";
import moment from "moment";
import Queue from "../../models/Queue";
import QueueOption from "../../models/QueueOption";
import FindOrCreateATicketTrakingService from "../TicketServices/FindOrCreateATicketTrakingService";
import VerifyCurrentSchedule from "../CompanyService/VerifyCurrentSchedule";
import Campaign from "../../models/Campaign";
import CampaignShipping from "../../models/CampaignShipping";
import { Op } from "sequelize";
import { campaignQueue, parseToMilliseconds, randomValue } from "../../queues";
import User from "../../models/User";
import Setting from "../../models/Setting";
import { cacheLayer } from "../../libs/cache";
import { provider } from "./providers";
import { debounce } from "../../helpers/Debounce";
import { Configuration, OpenAIApi } from "openai";
import { callAIProvider, AIProvider, AIMessage } from "../AIProviderService/AIProviderRouter";
import ffmpeg from "fluent-ffmpeg";
import {
  SpeechConfig,
  SpeechSynthesizer,
  AudioConfig
} from "microsoft-cognitiveservices-speech-sdk";
import { execSync } from "child_process";
import typebotListener from "../TypebotServices/typebotListener";
import QueueIntegrations from "../../models/QueueIntegrations";
import ShowQueueIntegrationService from "../QueueIntegrationServices/ShowQueueIntegrationService";

import { FlowBuilderModel } from "../../models/FlowBuilder";
import { FlowDefaultModel } from "../../models/FlowDefault";
import { FlowCampaignModel } from "../../models/FlowCampaign";
import { IOpenAi } from "../../@types/openai";
import { dapleShield } from "../../dape/shield/dapleShield.service";

import { IConnections, INodes } from "../WebhookService/DispatchWebHookService";
import { ActionsWebhookService } from "../WebhookService/ActionsWebhookService";
import { WebhookModel } from "../../models/Webhook";

import {differenceInMilliseconds} from "date-fns";
import Whatsapp from "../../models/Whatsapp";
import {
  isNumeric,
  validaCpfCnpj,
  sleep,
  makeid,
  sanitizeName,
  keepOnlySpecifiedChars
} from "../../utils/generalHelpers";
import {
  getTypeMessage,
  hasCaption,
  getBodyButton,
  msgLocation,
  getBodyMessage,
  getQuotedMessage,
  getQuotedMessageId,
  getMeSocket,
  getSenderMessage,
  getContactMessage,
  isValidMsg,
  filterMessages
} from "./wbotMessageParsers";

const request = require("request");

const fs = require("fs");

export type Session = WASocket & {
  id?: number;
  store?: Store;
};



interface ImessageUpsert {
  messages: proto.IWebMessageInfo[];
  type: MessageUpsertType;
}

export interface IMe {
  name: string;
  id: string;
}

interface IMessage {
  messages: WAMessage[];
  isLatest: boolean;
}

const writeFileAsync = promisify(writeFile);

/**
 * Envia mensagem de texto com digitando... humanizado.
 * Delay = clamp(words * 60ms + rand(0,400), 800, 4000) ms
 */
async function sendWithTypingDelay(
  wbot: Session,
  jid: string,
  text: string,
  ticket: Ticket,
  contact: Contact
): Promise<void> {
  const words = text.trim().split(/\s+/).length;
  const base = Math.min(words * 60, 3600);
  const jitter = Math.floor(Math.random() * 400);
  const delayMs = Math.max(800, Math.min(base + jitter, 4000));

  await wbot.presenceSubscribe(jid);
  await wbot.sendPresenceUpdate("composing", jid);
  await new Promise(resolve => setTimeout(resolve, delayMs));
  await wbot.sendPresenceUpdate("paused", jid);

  const sent = await wbot.sendMessage(jid, { text });
  await verifyMessage(sent!, ticket, contact);
}
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

const downloadMedia = async (msg: proto.IWebMessageInfo) => {
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

const resolveLidToPhone = async (lidJid: string, whatsappId: number): Promise<string> => {
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

const verifyContact = async (
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

const verifyQuotedMessage = async (
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
const convertToOggOpus = (inputPath: string, outputPath: string): Promise<void> => {
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
const convertTextToSpeechAzure = (
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
const convertTextToSpeechGoogle = async (
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

const deleteFileSync = (path: string): void => {
  try {
    fs.unlinkSync(path);
  } catch (error) {
    console.error("Erro ao deletar o arquivo:", error);
  }
};


const handleOpenAi = async (
  msg: proto.IWebMessageInfo,
  wbot: Session,
  ticket: Ticket,
  contact: Contact,
  mediaSent: Message | undefined,
  ticketTraking: TicketTraking = null,
  openAiSettings = null
): Promise<void> => {

  // REGRA PARA DESABILITAR O BOT PARA ALGUM CONTATO
  if (contact.disableBot) {
    return;
  }

  // Verificação de acesso ao módulo de IA por plano
  const hasIaAccess = await moduleAccess.checkAccess(ticket.companyId, 'dape_ia');
  if (!hasIaAccess) {
    logger.info(
      `[handleOpenAi] Empresa ${ticket.companyId} sem módulo dape_ia ativo — chatbot bloqueado para ticket ${ticket.id}`
    );
    return;
  }

  // DAPLE Shield — AI auto-responses are blocking
  const shieldResultAi = await dapleShield.evaluate({
    companyId: ticket.companyId,
    whatsappId: ticket.whatsappId,
    source: "bot",
    ticketId: ticket.id,
  });
  if (!shieldResultAi.allowed) {
    logger.warn(`[DAPLE Shield] AI response blocked for ticket ${ticket.id}: ${shieldResultAi.reason}`);
    return;
  }

  const bodyMessage = getBodyMessage(msg);

  if (!bodyMessage) return;

  let { prompt } = await ShowWhatsAppService(wbot.id, ticket.companyId);

  if( openAiSettings )
    prompt = openAiSettings;

  if (!prompt && !isNil(ticket?.queue?.prompt)) {
    prompt = ticket.queue.prompt;
  }

  if (!prompt) return;

  if (msg.messageStubType) return;

  const whatsapp = await Whatsapp.findByPk(ticket.whatsappId);

  const publicFolder: string = path.resolve(
    __dirname,
    "..",
    "..",
    "..",
    "public"
  );

  const aiProvider = (prompt.provider || "openai") as AIProvider;
  const aiModel = prompt.model || "gpt-3.5-turbo-1106";
  let maxMessages = prompt.maxMessages;

  const messages = await Message.findAll({
    where: { ticketId: ticket.id },
    order: [["createdAt", "DESC"]],
    limit: maxMessages
  });

  const queues = await Queue.findAll({ where: { companyId: ticket.companyId } });
  const queuesInfo = queues.map(q => `${q.id}=${q.name}`).join(", ");

  const promptSystem = `Nas respostas utilize o nome ${sanitizeName(
    contact.name || "Amigo(a)"
  )} para identificar o cliente.\nSua resposta deve usar no máximo ${
    prompt.maxTokens
  } tokens e cuide para não truncar o final.\nSempre que possível, mencione o nome dele para ser mais personalizado o atendimento e mais educado. Filas disponíveis: ${queuesInfo}. Quando precisar transferir o cliente, inicie sua resposta com 'Ação: Transferir para [ID]' onde [ID] é o número da fila correta para o assunto.\n
  ${prompt.prompt}\n`;

  let messagesAI: AIMessage[] = [];

  if (msg.message?.conversation || msg.message?.extendedTextMessage?.text) {
    messagesAI = [];
    messagesAI.push({ role: "system", content: promptSystem });
    for (let i = 0; i < Math.min(maxMessages, messages.length); i++) {
      const message = messages[i];
      if (
        message.mediaType === "conversation" ||
        message.mediaType === "extendedTextMessage"
      ) {
        if (message.fromMe) {
          messagesAI.push({ role: "assistant", content: message.body });
        } else {
          messagesAI.push({ role: "user", content: message.body });
        }
      }
    }
    messagesAI.push({ role: "user", content: bodyMessage! });

    let response = await callAIProvider({
      provider: aiProvider,
      apiKey: prompt.apiKey,
      model: aiModel,
      messages: messagesAI,
      maxTokens: prompt.maxTokens,
      temperature: prompt.temperature,
      baseUrl: prompt.baseUrl
    });

    let transferToQueue1 = false;
    let targetQueueId1: number | null = null;
    const transferMatch1 = response?.match(/Ação: Transferir para (\d+)/);
    if (transferMatch1) {
      transferToQueue1 = true;
      targetQueueId1 = parseInt(transferMatch1[1]);
      response = response.replace(/Ação: Transferir para \d+/, "").trim();
    }

    if (!prompt.voice || prompt.voice === "texto") {
      // Resposta em texto com delay humanizado (typing indicator)
      await sendWithTypingDelay(wbot, msg.key.remoteJid!, response!, ticket, contact);
    } else {
      // Resposta em áudio OGG/Opus (compatível com WhatsApp Web/Baileys)
      const fileNameWithOutExtension = `${ticket.id}_${Date.now()}`;
      try {
        await convertTextToSpeechAndSaveToFile(
          keepOnlySpecifiedChars(response!),
          `${publicFolder}/${fileNameWithOutExtension}`,
          prompt.voiceKey || "",
          prompt.voiceRegion || "",
          prompt.voice,
          prompt.ttsProvider || "azure"
        );
        const oggPath = `${publicFolder}/${fileNameWithOutExtension}.ogg`;
        const audioBuffer = fs.readFileSync(oggPath);
        const sendMessage = await wbot.sendMessage(msg.key.remoteJid!, {
          audio: audioBuffer,
          mimetype: "audio/ogg; codecs=opus",
          ptt: true
        });
        await verifyMediaMessage(sendMessage!, ticket, contact, ticketTraking, false, false, wbot);
        if (process.env.CLOUDFLARE_R2_ENABLED === "true") {
          await uploadToR2(
            `${publicFolder}/${fileNameWithOutExtension}.ogg`,
            `${fileNameWithOutExtension}.ogg`,
            "audio/ogg"
          );
        }
        deleteFileSync(`${publicFolder}/${fileNameWithOutExtension}.ogg`);
        deleteFileSync(`${publicFolder}/${fileNameWithOutExtension}.wav`);
      } catch (error) {
        logger.error(`[AI] Erro ao gerar resposta de áudio: ${error}`);
        // Fallback: envia como texto se TTS falhar
        const sentMessage = await wbot.sendMessage(msg.key.remoteJid!, {
          text: response!
        });
        await verifyMessage(sentMessage!, ticket, contact);
      }
    }

    if (transferToQueue1 && targetQueueId1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      await transferQueue(targetQueueId1, ticket, contact);
    }

  } else if (msg.message?.audioMessage) {
    // Transcrição de áudio: Whisper (OpenAI/Manus) ou Gemini Multimodal
    const mediaUrl = mediaSent!.mediaUrl!.split("/").pop();
    const audioFilePath = `${publicFolder}/${mediaUrl}`;
    let transcribedText = "";
    let r2AudioDownloaded = false;

    // Se R2 ativo, o arquivo foi deletado do disco — baixa temporariamente
    if (process.env.CLOUDFLARE_R2_ENABLED === "true") {
      try {
        await downloadFromR2(mediaUrl, audioFilePath);
        r2AudioDownloaded = true;
      } catch (err) {
        logger.error(`[R2] Erro ao baixar áudio para transcrição: ${err}`);
        const fallbackMsg = "Desculpe, não consegui processar o áudio enviado. Poderia escrever sua mensagem em texto? 😊";
        await sendWithTypingDelay(wbot, msg.key.remoteJid!, fallbackMsg, ticket, contact);
        return;
      }
    }

    if (aiProvider === "gemini") {
      // Gemini: transcrição via API Multimodal (base64 inline)
      try {
        const { GoogleGenerativeAI } = require("@google/generative-ai");
        const audioBuffer = fs.readFileSync(audioFilePath);
        const audioBase64 = audioBuffer.toString("base64");
        const mimeType = mediaSent!.mediaType === "audioMessage" ? "audio/ogg" : "audio/mpeg";

        const genAI = new GoogleGenerativeAI(prompt.apiKey);
        const geminiModel = genAI.getGenerativeModel({ model: aiModel });
        const result = await geminiModel.generateContent([
          { text: "Transcreva o áudio a seguir. Retorne apenas o texto transcrito, sem explicações adicionais." },
          { inlineData: { mimeType, data: audioBase64 } }
        ]);
        transcribedText = result.response.text().trim();
        logger.info(`[AI] Gemini transcreveu áudio: "${transcribedText.slice(0, 80)}..."`);
      } catch (err) {
        logger.error(`[AI] Erro na transcrição Gemini: ${err}`);
        return;
      }
    } else if (aiProvider === "openai" || aiProvider === "manus") {
      // OpenAI / Manus: transcrição via Whisper
      try {
        const file = fs.createReadStream(audioFilePath) as any;
        const whisperConfig = new Configuration({
          apiKey: prompt.apiKey,
          ...(aiProvider === "manus" && prompt.baseUrl ? { basePath: prompt.baseUrl } : {})
        });
        const openaiWhisper = new OpenAIApi(whisperConfig);
        const transcription = await openaiWhisper.createTranscription(file, "whisper-1");
        transcribedText = transcription.data.text;
      } catch (err) {
        logger.error(`[AI] Erro na transcrição Whisper: ${err}`);
        transcribedText = "";
      }
    } else {
      // Anthropic não suporta transcrição de áudio nativa
      logger.info(`[AI] Transcrição de áudio não suportada para provider: ${aiProvider}`);
      return;
    }

    // Fallback: se transcrição falhou ou retornou vazio, avisar o usuário
    if (!transcribedText || transcribedText.trim() === "") {
      const fallbackMsg = "Desculpe, não consegui ouvir o áudio enviado. Poderia escrever sua mensagem em texto para que eu possa te ajudar? 😊";
      await sendWithTypingDelay(wbot, msg.key.remoteJid!, fallbackMsg, ticket, contact);
      if (r2AudioDownloaded) deleteFileSync(audioFilePath);
      return;
    }

    messagesAI = [];
    messagesAI.push({ role: "system", content: promptSystem });
    for (let i = 0; i < Math.min(maxMessages, messages.length); i++) {
      const message = messages[i];
      if (
        message.mediaType === "conversation" ||
        message.mediaType === "extendedTextMessage"
      ) {
        if (message.fromMe) {
          messagesAI.push({ role: "assistant", content: message.body });
        } else {
          messagesAI.push({ role: "user", content: message.body });
        }
      }
    }
    messagesAI.push({ role: "user", content: transcribedText });

    // Remove o arquivo baixado do R2 após leitura
    if (r2AudioDownloaded) {
      deleteFileSync(audioFilePath);
    }

    let response = await callAIProvider({
      provider: aiProvider,
      apiKey: prompt.apiKey,
      model: aiModel,
      messages: messagesAI,
      maxTokens: prompt.maxTokens,
      temperature: prompt.temperature,
      baseUrl: prompt.baseUrl
    });

    let transferToQueue2 = false;
    let targetQueueId2: number | null = null;
    const transferMatch2 = response?.match(/Ação: Transferir para (\d+)/);
    if (transferMatch2) {
      transferToQueue2 = true;
      targetQueueId2 = parseInt(transferMatch2[1]);
      response = response.replace(/Ação: Transferir para \d+/, "").trim();
    }

    if (!prompt.voice || prompt.voice === "texto") {
      // Resposta em texto com delay humanizado (typing indicator)
      await sendWithTypingDelay(wbot, msg.key.remoteJid!, response!, ticket, contact);
    } else {
      const fileNameWithOutExtension = `${ticket.id}_${Date.now()}`;
      try {
        await convertTextToSpeechAndSaveToFile(
          keepOnlySpecifiedChars(response!),
          `${publicFolder}/${fileNameWithOutExtension}`,
          prompt.voiceKey || "",
          prompt.voiceRegion || "",
          prompt.voice,
          prompt.ttsProvider || "azure"
        );
        const oggPath = `${publicFolder}/${fileNameWithOutExtension}.ogg`;
        const audioBuffer = fs.readFileSync(oggPath);
        const sendMessage = await wbot.sendMessage(msg.key.remoteJid!, {
          audio: audioBuffer,
          mimetype: "audio/ogg; codecs=opus",
          ptt: true
        });
        await verifyMediaMessage(sendMessage!, ticket, contact, ticketTraking, false, false, wbot);
        if (process.env.CLOUDFLARE_R2_ENABLED === "true") {
          await uploadToR2(
            `${publicFolder}/${fileNameWithOutExtension}.ogg`,
            `${fileNameWithOutExtension}.ogg`,
            "audio/ogg"
          );
        }
        deleteFileSync(`${publicFolder}/${fileNameWithOutExtension}.ogg`);
        deleteFileSync(`${publicFolder}/${fileNameWithOutExtension}.wav`);
      } catch (error) {
        logger.error(`[AI] Erro ao gerar resposta de áudio: ${error}`);
        const sentMessage = await wbot.sendMessage(msg.key.remoteJid!, {
          text: response!
        });
        await verifyMessage(sentMessage!, ticket, contact);
      }
    }

    if (transferToQueue2 && targetQueueId2) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      await transferQueue(targetQueueId2!, ticket, contact);
    }
  } else if (msg.message?.imageMessage || msg.message?.videoMessage) {
    // Análise de imagem/vídeo: Gemini (vision nativo) ou OpenAI GPT-4V
    const mediaUrl = mediaSent?.mediaUrl?.split("/").pop();
    const mediaFilePath = mediaUrl ? `${publicFolder}/${mediaUrl}` : null;
    let visionDescription = "";

    if (mediaFilePath && fs.existsSync(mediaFilePath)) {
      try {
        if (aiProvider === "gemini") {
          const { GoogleGenerativeAI } = require("@google/generative-ai");
          const fileBuffer = fs.readFileSync(mediaFilePath);
          const fileBase64 = fileBuffer.toString("base64");
          const mimeType = msg.message?.imageMessage ? "image/jpeg" : "video/mp4";
          const genAI = new GoogleGenerativeAI(prompt.apiKey);
          const geminiModel = genAI.getGenerativeModel({ model: aiModel });
          const result = await geminiModel.generateContent([
            { text: "Descreva o conteúdo desta mídia de forma objetiva para contexto de atendimento ao cliente." },
            { inlineData: { mimeType, data: fileBase64 } }
          ]);
          visionDescription = result.response.text().trim();
          logger.info(`[AI] Gemini descreveu mídia: "${visionDescription.slice(0, 80)}..."`);
        } else if (aiProvider === "openai" || aiProvider === "manus") {
          // GPT-4V / GPT-4o via image_url (base64)
          const fileBuffer = fs.readFileSync(mediaFilePath);
          const fileBase64 = fileBuffer.toString("base64");
          const config = new Configuration({
            apiKey: prompt.apiKey,
            ...(aiProvider === "manus" && prompt.baseUrl ? { basePath: prompt.baseUrl } : {})
          });
          const openaiVision = new OpenAIApi(config);
          const visionResponse = await openaiVision.createChatCompletion({
            model: aiModel,
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: "Descreva o conteúdo desta imagem de forma objetiva para contexto de atendimento ao cliente." },
                  { type: "image_url", image_url: { url: `data:image/jpeg;base64,${fileBase64}` } }
                ] as any
              }
            ],
            max_tokens: 300
          });
          visionDescription = visionResponse.data.choices[0]?.message?.content ?? "";
        }
      } catch (err) {
        logger.error(`[AI] Erro na análise de imagem/vídeo: ${err}`);
        visionDescription = "";
      }
    }

    // Fallback se análise falhou ou arquivo não existe
    if (!visionDescription) {
      const mediaType = msg.message?.imageMessage ? "imagem" : "vídeo";
      const fallbackMsg = `Desculpe, não consegui visualizar a ${mediaType} enviada. Poderia descrever o que precisa em texto para que eu possa te ajudar? 😊`;
      await sendWithTypingDelay(wbot, msg.key.remoteJid!, fallbackMsg, ticket, contact);
      return;
    }

    // Contexto com descrição da mídia + histórico de texto
    const caption = msg.message?.imageMessage?.caption || msg.message?.videoMessage?.caption || "";
    const userContent = caption
      ? `[Imagem/vídeo enviado — descrição: ${visionDescription}]\nLegenda do usuário: ${caption}`
      : `[Imagem/vídeo enviado — descrição: ${visionDescription}]`;

    messagesAI = [];
    messagesAI.push({ role: "system", content: promptSystem });
    for (let i = 0; i < Math.min(maxMessages, messages.length); i++) {
      const message = messages[i];
      if (message.mediaType === "conversation" || message.mediaType === "extendedTextMessage") {
        messagesAI.push({ role: message.fromMe ? "assistant" : "user", content: message.body });
      }
    }
    messagesAI.push({ role: "user", content: userContent });

    let response = await callAIProvider({
      provider: aiProvider,
      apiKey: prompt.apiKey,
      model: aiModel,
      messages: messagesAI,
      maxTokens: prompt.maxTokens,
      temperature: prompt.temperature,
      baseUrl: prompt.baseUrl
    });

    const transferMatchImg = response?.match(/Ação: Transferir para (\d+)/);
    if (transferMatchImg) {
      const targetQueueIdImg = parseInt(transferMatchImg[1]);
      response = response.replace(/Ação: Transferir para \d+/, "").trim();
      await sendWithTypingDelay(wbot, msg.key.remoteJid!, response!, ticket, contact);
      await new Promise(resolve => setTimeout(resolve, 1000));
      await transferQueue(targetQueueIdImg, ticket, contact);
    } else {
      await sendWithTypingDelay(wbot, msg.key.remoteJid!, response!, ticket, contact);
    }
  }
  messagesAI = [];
};

export const transferQueue = async (
  queueId: number,
  ticket: Ticket,
  contact: Contact
): Promise<void> => {
  await UpdateTicketService({
    ticketData: { queueId: queueId, status: "pending", userId: null, chatbot: false },
    ticketId: ticket.id,
    companyId: ticket.companyId
  });
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

const Push = (msg: proto.IWebMessageInfo) => {
  return msg.pushName;
};

const verifyQueue = async (
  wbot: Session,
  msg: proto.IWebMessageInfo,
  ticket: Ticket,
  contact: Contact,
  mediaSent?: Message | undefined
) => {

  const companyId = ticket.companyId;

  // DAPLE Shield — automated queue/greeting messages are blocking
  const shieldResultQueue = await dapleShield.evaluate({
    companyId: ticket.companyId,
    whatsappId: ticket.whatsappId,
    source: "bot",
    ticketId: ticket.id,
  });
  if (!shieldResultQueue.allowed) {
    logger.warn(`[DAPLE Shield] Queue/greeting message blocked for ticket ${ticket.id}: ${shieldResultQueue.reason}`);
    return;
  }

  const { queues, greetingMessage, maxUseBotQueues, timeUseBotQueues } =
    await ShowWhatsAppService(wbot.id!, ticket.companyId);

  if (queues.length === 1) {
    const sendGreetingMessageOneQueues = await Setting.findOne({
      where: {
        key: "sendGreetingMessageOneQueues",
        companyId: ticket.companyId
      }
    });

    if (
      greetingMessage.length > 1 &&
      sendGreetingMessageOneQueues?.value === "enabled"
    ) {
      const body = formatBody(`${greetingMessage}`, contact);

      await wbot.sendMessage(
        `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
        {
          text: body
        }
      );
    }

    const firstQueue = head(queues);
    let chatbot = false;
    if (firstQueue?.options) {
      chatbot = firstQueue.options.length > 0;
    }

    //inicia integração dialogflow/n8n
    if (
      !msg.key.fromMe &&
      !ticket.isGroup &&
      !isNil(queues[0]?.integrationId)
    ) {
      const integrations = await ShowQueueIntegrationService(
        queues[0].integrationId,
        companyId
      );

      await handleMessageIntegration(
        msg,
        wbot,
        integrations,
        ticket,
        companyId
      );

      await ticket.update({
        useIntegration: true,
        integrationId: integrations.id
      });
      // return;
    }
    //inicia integração openai
    if (!msg.key.fromMe && !ticket.isGroup && !isNil(queues[0]?.promptId)) {
      await handleOpenAi(msg, wbot, ticket, contact, mediaSent);

      await ticket.update({
        useIntegration: true,
        promptId: queues[0]?.promptId
      });
      // return;
    }

    await UpdateTicketService({
      ticketData: { queueId: firstQueue.id, chatbot, status: "pending" },
      ticketId: ticket.id,
      companyId: ticket.companyId
    });

    return;
  }

  const selectedOption = getBodyMessage(msg);
  const choosenQueue = queues[+selectedOption - 1];

  const buttonActive = await Setting.findOne({
    where: {
      key: "chatBotType",
      companyId
    }
  });

  const botText = async () => {
    let options = "";

    queues.forEach((queue, index) => {
      options += `*[ ${index + 1} ]* - ${queue.name}\n`;
    });

    const textMessage = {
      text: formatBody(`\u200e${greetingMessage}\n\n${options}`, contact)
    };

    const sendMsg = await wbot.sendMessage(
      `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
      textMessage
    );

    await verifyMessage(sendMsg, ticket, ticket.contact);
  };

  if (choosenQueue) {
    let chatbot = false;
    if (choosenQueue?.options) {
      chatbot = choosenQueue.options.length > 0;
    }

    await UpdateTicketService({
      ticketData: { queueId: choosenQueue.id, chatbot },
      ticketId: ticket.id,
      companyId: ticket.companyId
    });

    /* Tratamento para envio de mensagem quando a fila está fora do expediente */
    if (choosenQueue.options.length === 0) {
      const queue = await Queue.findByPk(choosenQueue.id);
      const { schedules }: any = queue;
      const now = moment();
      const weekday = now.format("dddd").toLowerCase();
      let schedule;
      if (Array.isArray(schedules) && schedules.length > 0) {
        schedule = schedules.find(
          s =>
            s.weekdayEn === weekday &&
            s.startTime !== "" &&
            s.startTime !== null &&
            s.endTime !== "" &&
            s.endTime !== null
        );
      }

      if (
        queue.outOfHoursMessage !== null &&
        queue.outOfHoursMessage !== "" &&
        !isNil(schedule)
      ) {
        const startTime = moment(schedule.startTime, "HH:mm");
        const endTime = moment(schedule.endTime, "HH:mm");

        if (now.isBefore(startTime) || now.isAfter(endTime)) {
          const body = formatBody(
            `\u200e ${queue.outOfHoursMessage}\n\n*[ # ]* - Voltar ao Menu Principal`,
            ticket.contact
          );
          const sentMessage = await wbot.sendMessage(
            `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
            {
              text: body
            }
          );
          await verifyMessage(sentMessage, ticket, contact);
          await UpdateTicketService({
            ticketData: { queueId: null, chatbot },
            ticketId: ticket.id,
            companyId: ticket.companyId
          });
          return;
        }
      }

      //inicia integração dialogflow/n8n
      if (!msg.key.fromMe && !ticket.isGroup && choosenQueue.integrationId) {
        const integrations = await ShowQueueIntegrationService(
          choosenQueue.integrationId,
          companyId
        );

        await handleMessageIntegration(
          msg,
          wbot,
          integrations,
          ticket,
          companyId
        );

        await ticket.update({
          useIntegration: true,
          integrationId: integrations.id
        });
        // return;
      }

      //inicia integração openai
      if (
        !msg.key.fromMe &&
        !ticket.isGroup &&
        !isNil(choosenQueue?.promptId)
      ) {
        await handleOpenAi(msg, wbot, ticket, contact, mediaSent);

        await ticket.update({
          useIntegration: true,
          promptId: choosenQueue?.promptId
        });
        // return;
      }

      const body = formatBody(
        `\u200e${choosenQueue.greetingMessage}`,
        ticket.contact
      );
      if (choosenQueue.greetingMessage) {
        const sentMessage = await wbot.sendMessage(
          `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
          {
            text: body
          }
        );
        await verifyMessage(sentMessage, ticket, contact);
      }
    }
  } else {
    if (
      maxUseBotQueues &&
      maxUseBotQueues !== 0 &&
      ticket.amountUsedBotQueues >= maxUseBotQueues
    ) {
      // await UpdateTicketService({
      //   ticketData: { queueId: queues[0].id },
      //   ticketId: ticket.id
      // });

      return;
    }

    //Regra para desabilitar o chatbot por x minutos/horas após o primeiro envio
    const ticketTraking = await FindOrCreateATicketTrakingService({
      ticketId: ticket.id,
      companyId
    });
    let dataLimite = new Date();
    let Agora = new Date();

    if (ticketTraking.chatbotAt !== null) {
      dataLimite.setMinutes(
        ticketTraking.chatbotAt.getMinutes() + Number(timeUseBotQueues)
      );

      if (
        ticketTraking.chatbotAt !== null &&
        Agora < dataLimite &&
        timeUseBotQueues !== "0" &&
        ticket.amountUsedBotQueues !== 0
      ) {
        return;
      }
    }
    await ticketTraking.update({
      chatbotAt: null
    });

    if (buttonActive.value === "text") {
      return botText();
    }
  }
};

export const verifyRating = (ticketTraking: TicketTraking) => {
  if (
    ticketTraking &&
    ticketTraking.finishedAt === null &&
    ticketTraking.userId !== null &&
    ticketTraking.ratingAt !== null
  ) {
    return true;
  }
  return false;
};

export const handleRating = async (
  rate: number,
  ticket: Ticket,
  ticketTraking: TicketTraking
) => {
  const io = getIO();

  const { complationMessage } = await ShowWhatsAppService(
    ticket.whatsappId,
    ticket.companyId
  );

  let finalRate = rate;

  if (rate < 1) {
    finalRate = 1;
  }
  if (rate > 5) {
    finalRate = 5;
  }

  await UserRating.create({
    ticketId: ticketTraking.ticketId,
    companyId: ticketTraking.companyId,
    userId: ticketTraking.userId,
    rate: finalRate
  });

  if (complationMessage) {
    const body = formatBody(`\u200e${complationMessage}`, ticket.contact);
    await SendWhatsAppMessage({ body, ticket });
  }

  await ticketTraking.update({
    finishedAt: moment().toDate(),
    rated: true
  });

  await ticket.update({
    queueId: null,
    chatbot: null,
    queueOptionId: null,
    userId: null,
    status: "closed"
  });

  io.to(`company-${ticket.companyId}-open`)
    .to(`queue-${ticket.queueId}-open`)
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
};

const handleChartbot = async (
  ticket: Ticket,
  msg: WAMessage,
  wbot: Session,
  dontReadTheFirstQuestion: boolean = false
) => {
  // DAPLE Shield — chatbot responses are blocking
  const shieldResultBot = await dapleShield.evaluate({
    companyId: ticket.companyId,
    whatsappId: ticket.whatsappId,
    source: "bot",
    ticketId: ticket.id,
  });
  if (!shieldResultBot.allowed) {
    logger.warn(`[DAPLE Shield] Chatbot response blocked for ticket ${ticket.id}: ${shieldResultBot.reason}`);
    return;
  }

  const queue = await Queue.findByPk(ticket.queueId, {
    include: [
      {
        model: QueueOption,
        as: "options",
        where: { parentId: null },
        order: [
          ["option", "ASC"],
          ["createdAt", "ASC"]
        ]
      }
    ]
  });

  const messageBody = getBodyMessage(msg);

  if (messageBody == "#") {
    // voltar para o menu inicial
    await ticket.update({ queueOptionId: null, chatbot: false, queueId: null });
    await verifyQueue(wbot, msg, ticket, ticket.contact);
    return;
  }

  // voltar para o menu anterior
  if (!isNil(queue) && !isNil(ticket.queueOptionId) && messageBody == "0") {
    const option = await QueueOption.findByPk(ticket.queueOptionId);
    await ticket.update({ queueOptionId: option?.parentId });

    // escolheu uma opção
  } else if (!isNil(queue) && !isNil(ticket.queueOptionId)) {
    const count = await QueueOption.count({
      where: { parentId: ticket.queueOptionId }
    });
    let option: any = {};
    if (count == 1) {
      option = await QueueOption.findOne({
        where: { parentId: ticket.queueOptionId }
      });
    } else {
      option = await QueueOption.findOne({
        where: {
          option: messageBody || "",
          parentId: ticket.queueOptionId
        }
      });
    }
    if (option) {
      await ticket.update({ queueOptionId: option?.id });
    }

    // não linha a primeira pergunta
  } else if (
    !isNil(queue) &&
    isNil(ticket.queueOptionId) &&
    !dontReadTheFirstQuestion
  ) {
    const option = queue?.options.find(o => o.option == messageBody);
    if (option) {
      await ticket.update({ queueOptionId: option?.id });
    }
  }

  await ticket.reload();

  if (!isNil(queue) && isNil(ticket.queueOptionId)) {
    const queueOptions = await QueueOption.findAll({
      where: { queueId: ticket.queueId, parentId: null },
      order: [
        ["option", "ASC"],
        ["createdAt", "ASC"]
      ]
    });

    const companyId = ticket.companyId;

    const buttonActive = await Setting.findOne({
      where: {
        key: "chatBotType",
        companyId
      }
    });

    // const botList = async () => {
    // const sectionsRows = [];

    // queues.forEach((queue, index) => {
    //   sectionsRows.push({
    //     title: queue.name,
    //     rowId: `${index + 1}`
    //   });
    // });

    // const sections = [
    //   {
    //     rows: sectionsRows
    //   }
    // ];

    //   const listMessage = {
    //     text: formatBody(`\u200e${queue.greetingMessage}`, ticket.contact),
    //     buttonText: "Escolha uma opção",
    //     sections
    //   };

    //   const sendMsg = await wbot.sendMessage(
    //     `${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
    //     listMessage
    //   );

    //   await verifyMessage(sendMsg, ticket, ticket.contact);
    // }

    const botButton = async () => {
      const buttons = [];
      queueOptions.forEach((option, i) => {
        buttons.push({
          buttonId: `${option.option}`,
          buttonText: { displayText: option.title },
          type: 4
        });
      });
      buttons.push({
        buttonId: `#`,
        buttonText: { displayText: "Menu inicial *[ 0 ]* Menu anterior" },
        type: 4
      });

      const buttonMessage = {
        text: formatBody(`\u200e${queue.greetingMessage}`, ticket.contact),
        buttons,
        headerType: 4
      };

      const sendMsg = await wbot.sendMessage(
        `${ticket.contact.number}@${
          ticket.isGroup ? "g.us" : "s.whatsapp.net"
        }`,
        buttonMessage
      );

      await verifyMessage(sendMsg, ticket, ticket.contact);
    };

    const botText = async () => {
      let options = "";

      queueOptions.forEach((option, i) => {
        options += `*[ ${option.option} ]* - ${option.title}\n`;
      });
      //options += `\n*[ 0 ]* - Menu anterior`;
      options += `\n*[ # ]* - Menu inicial`;

      const textMessage = {
        text: formatBody(
          `\u200e${queue.greetingMessage}\n\n${options}`,
          ticket.contact
        )
      };

      const sendMsg = await wbot.sendMessage(
        `${ticket.contact.number}@${
          ticket.isGroup ? "g.us" : "s.whatsapp.net"
        }`,
        textMessage
      );

      await verifyMessage(sendMsg, ticket, ticket.contact);
    };

    // if (buttonActive.value === "list") {
    //   return botList();
    // };

    if (buttonActive.value === "button" && QueueOption.length <= 4) {
      return botButton();
    }

    if (buttonActive.value === "text") {
      return botText();
    }

    if (buttonActive.value === "button" && QueueOption.length > 4) {
      return botText();
    }
  } else if (!isNil(queue) && !isNil(ticket.queueOptionId)) {
    const currentOption = await QueueOption.findByPk(ticket.queueOptionId);
    const queueOptions = await QueueOption.findAll({
      where: { parentId: ticket.queueOptionId },
      order: [
        ["option", "ASC"],
        ["createdAt", "ASC"]
      ]
    });

    if (queueOptions.length > -1) {
      const companyId = ticket.companyId;
      const buttonActive = await Setting.findOne({
        where: {
          key: "chatBotType",
          companyId
        }
      });

      const botList = async () => {
        const sectionsRows = [];

        queueOptions.forEach((option, i) => {
          sectionsRows.push({
            title: option.title,
            rowId: `${option.option}`
          });
        });
        sectionsRows.push({
          title: "Menu inicial *[ 0 ]* Menu anterior",
          rowId: `#`
        });
        const sections = [
          {
            rows: sectionsRows
          }
        ];

        const listMessage = {
          text: formatBody(`\u200e${currentOption.message}`, ticket.contact),
          buttonText: "Escolha uma opção",
          sections
        };

        const sendMsg = await wbot.sendMessage(
          `${ticket.contact.number}@${
            ticket.isGroup ? "g.us" : "s.whatsapp.net"
          }`,
          listMessage
        );

        await verifyMessage(sendMsg, ticket, ticket.contact);
      };

      const botButton = async () => {
        const buttons = [];
        queueOptions.forEach((option, i) => {
          buttons.push({
            buttonId: `${option.option}`,
            buttonText: { displayText: option.title },
            type: 4
          });
        });
        buttons.push({
          buttonId: `#`,
          buttonText: { displayText: "Menu inicial *[ 0 ]* Menu anterior" },
          type: 4
        });

        const buttonMessage = {
          text: formatBody(`\u200e${currentOption.message}`, ticket.contact),
          buttons,
          headerType: 4
        };

        const sendMsg = await wbot.sendMessage(
          `${ticket.contact.number}@${
            ticket.isGroup ? "g.us" : "s.whatsapp.net"
          }`,
          buttonMessage
        );

        await verifyMessage(sendMsg, ticket, ticket.contact);
      };

      const botText = async () => {
        let options = "";

        queueOptions.forEach((option, i) => {
          options += `*[ ${option.option} ]* - ${option.title}\n`;
        });
        options += `\n*[ 0 ]* - Menu anterior`;
        options += `\n*[ # ]* - Menu inicial`;
        const textMessage = {
          text: formatBody(
            `\u200e${currentOption.message}\n\n${options}`,
            ticket.contact
          )
        };

        const sendMsg = await wbot.sendMessage(
          `${ticket.contact.number}@${
            ticket.isGroup ? "g.us" : "s.whatsapp.net"
          }`,
          textMessage
        );

        await verifyMessage(sendMsg, ticket, ticket.contact);
      };

      if (buttonActive.value === "list") {
        return botList();
      }

      if (buttonActive.value === "button" && QueueOption.length <= 4) {
        return botButton();
      }

      if (buttonActive.value === "text") {
        return botText();
      }

      if (buttonActive.value === "button" && QueueOption.length > 4) {
        return botText();
      }
    }
  }
};

const flowbuilderIntegration = async (
  msg: proto.IWebMessageInfo,
  wbot: Session,
  companyId: number,
  queueIntegration: QueueIntegrations,
  ticket: Ticket,
  contact: Contact,
  isFirstMsg?: Ticket,
  isTranfered?: boolean
) => {
  const io = getIO();
  const quotedMsg = await verifyQuotedMessage(msg);
  const body = getBodyMessage(msg);

  /*
  const messageData = {
    wid: msg.key.id,
    ticketId: ticket.id,
    contactId: msg.key.fromMe ? undefined : contact.id,
    body: body,
    fromMe: msg.key.fromMe,
    read: msg.key.fromMe,
    quotedMsgId: quotedMsg?.id,
    ack: Number(String(msg.status).replace('PENDING', '2').replace('NaN', '1')) || 2,
    remoteJid: msg.key.remoteJid,
    participant: msg.key.participant,
    dataJson: JSON.stringify(msg),
    createdAt: new Date(
      Math.floor(getTimestampMessage(msg.messageTimestamp) * 1000)
    ).toISOString(),
    ticketImported: ticket.imported,
  };


  await CreateMessageService({ messageData, companyId: ticket.companyId });

  */

  if (!msg.key.fromMe && ticket.status === "closed") {

    console.log("===== CHANGE =====");
    await ticket.update({ status: "pending" });
    await ticket.reload({
      include: [
        { model: Queue, as: "queue" },
        { model: User, as: "user" },
        { model: Contact, as: "contact" }
      ]
    });
    await UpdateTicketService({
      ticketData: { status: "pending", integrationId: ticket.integrationId },
      ticketId: ticket.id,
      companyId
    });

    io.of(String(companyId)).emit(`company-${companyId}-ticket`, {
      action: "delete",
      ticket,
      ticketId: ticket.id
    });

    io.to(ticket.status).emit(`company-${companyId}-ticket`, {
      action: "update",
      ticket,
      ticketId: ticket.id
    });
  }

  if (msg.key.fromMe) {
    return;
  }

  const whatsapp = await ShowWhatsAppService(wbot.id!, companyId);

  const listPhrase = await FlowCampaignModel.findAll({
    where: {
      whatsappId: whatsapp.id
    }
  });

  // Welcome flow
  if (
    !isFirstMsg &&
    listPhrase.filter(item => item.phrase.toLowerCase() === body.toLowerCase()).length === 0
  ) {
    const flow = await FlowBuilderModel.findOne({
      where: {
        id: whatsapp.flowIdWelcome
      }
    });
    if (flow) {
      const nodes: INodes[] = flow.flow["nodes"];
      const connections: IConnections[] = flow.flow["connections"];

      const mountDataContact = {
        number: contact.number,
        name: contact.name,
        email: contact.email
      };

      // const worker = new Worker("./src/services/WebhookService/WorkerAction.ts");

      // // Enviar as variáveis como parte da mensagem para o Worker
      // console.log('DISPARO1')
      // const data = {
      //   idFlowDb: flowUse.flowIdWelcome,
      //   companyId: ticketUpdate.companyId,
      //   nodes: nodes,
      //   connects: connections,
      //   nextStage: flow.flow["nodes"][0].id,
      //   dataWebhook: null,
      //   details: "",
      //   hashWebhookId: "",
      //   pressKey: null,
      //   idTicket: ticketUpdate.id,
      //   numberPhrase: mountDataContact
      // };
      // worker.postMessage(data);
      // worker.on("message", message => {
      //   console.log(`Mensagem do worker: ${message}`);
      // });

      await ActionsWebhookService(
        whatsapp.id,
        whatsapp.flowIdWelcome,
        ticket.companyId,
        nodes,
        connections,
        flow.flow["nodes"][0].id,
        null,
        "",
        "",
        null,
        ticket.id,
        mountDataContact,
        msg
      );
    }
  }

  const dateTicket = new Date(
    isFirstMsg?.updatedAt ? isFirstMsg.updatedAt : ""
  );

  const dateNow = new Date();
  const diferencaEmMilissegundos = Math.abs(
    differenceInMilliseconds(dateTicket, dateNow)
  );
  //const seisHorasEmMilissegundos = 21600000;
  const seisHorasEmMilissegundos = 0;

  logger.info(listPhrase.filter(item => item.phrase.toLowerCase()));
  logger.info(isFirstMsg);

  // Flow with not found phrase
  if (
    listPhrase.filter(item => item.phrase.toLowerCase() === body.toLowerCase()).length === 0 &&
    diferencaEmMilissegundos >= seisHorasEmMilissegundos &&
    isFirstMsg
  ) {
    console.log("2427", "handleMessageIntegration");

    const flow = await FlowBuilderModel.findOne({
      where: {
        id: whatsapp.flowIdNotPhrase
      }
    });

    if (flow) {
      const nodes: INodes[] = flow.flow["nodes"];
      const connections: IConnections[] = flow.flow["connections"];

      const mountDataContact = {
        number: contact.number,
        name: contact.name,
        email: contact.email
      };

      await ActionsWebhookService(
        whatsapp.id,
        whatsapp.flowIdNotPhrase,
        ticket.companyId,
        nodes,
        connections,
        flow.flow["nodes"][0].id,
        null,
        "",
        "",
        null,
        ticket.id,
        mountDataContact,
        msg
      );
    }
  }

  // Campaign fluxo
  if (listPhrase.filter(item => item.phrase.toLowerCase() === body.toLowerCase()).length !== 0) {

    const flowDispar = listPhrase.filter(item => item.phrase.toLowerCase() === body.toLowerCase())[0];
    const flow = await FlowBuilderModel.findOne({
      where: {
        id: flowDispar.flowId
      }
    });
    const nodes: INodes[] = flow.flow["nodes"];
    const connections: IConnections[] = flow.flow["connections"];

    const mountDataContact = {
      number: contact.number,
      name: contact.name,
      email: contact.email
    };

    //const worker = new Worker("./src/services/WebhookService/WorkerAction.ts");

    //console.log('DISPARO3')
    // Enviar as variáveis como parte da mensagem para o Worker
    // const data = {
    //   idFlowDb: flowDispar.flowId,
    //   companyId: ticketUpdate.companyId,
    //   nodes: nodes,
    //   connects: connections,
    //   nextStage: flow.flow["nodes"][0].id,
    //   dataWebhook: null,
    //   details: "",
    //   hashWebhookId: "",
    //   pressKey: null,
    //   idTicket: ticketUpdate.id,
    //   numberPhrase: mountDataContact
    // };
    // worker.postMessage(data);

    // worker.on("message", message => {
    //   console.log(`Mensagem do worker: ${message}`);
    // });

    await ActionsWebhookService(
      whatsapp.id,
      flowDispar.flowId,
      ticket.companyId,
      nodes,
      connections,
      flow.flow["nodes"][0].id,
      null,
      "",
      "",
      null,
      ticket.id,
      mountDataContact
    );
    return;
  }

  if (ticket.flowWebhook) {
    const webhook = await WebhookModel.findOne({
      where: {
        company_id: ticket.companyId,
        hash_id: ticket.hashFlowId
      }
    });

    if (webhook && webhook.config["details"]) {
      const flow = await FlowBuilderModel.findOne({
        where: {
          id: webhook.config["details"].idFlow
        }
      });
      const nodes: INodes[] = flow.flow["nodes"];
      const connections: IConnections[] = flow.flow["connections"];

      // const worker = new Worker("./src/services/WebhookService/WorkerAction.ts");

      // console.log('DISPARO4')
      // // Enviar as variáveis como parte da mensagem para o Worker
      // const data = {
      //   idFlowDb: webhook.config["details"].idFlow,
      //   companyId: ticketUpdate.companyId,
      //   nodes: nodes,
      //   connects: connections,
      //   nextStage: ticketUpdate.lastFlowId,
      //   dataWebhook: ticketUpdate.dataWebhook,
      //   details: webhook.config["details"],
      //   hashWebhookId: ticketUpdate.hashFlowId,
      //   pressKey: body,
      //   idTicket: ticketUpdate.id,
      //   numberPhrase: ""
      // };
      // worker.postMessage(data);

      // worker.on("message", message => {
      //   console.log(`Mensagem do worker: ${message}`);
      // });

      await ActionsWebhookService(
        whatsapp.id,
        webhook.config["details"].idFlow,
        ticket.companyId,
        nodes,
        connections,
        ticket.lastFlowId,
        ticket.dataWebhook,
        webhook.config["details"],
        ticket.hashFlowId,
        body,
        ticket.id
      );
    } else {
      const flow = await FlowBuilderModel.findOne({
        where: {
          id: ticket.flowStopped
        }
      });

      const nodes: INodes[] = flow.flow["nodes"];
      const connections: IConnections[] = flow.flow["connections"];

      if (!ticket.lastFlowId) {
        return;
      }

      const mountDataContact = {
        number: contact.number,
        name: contact.name,
        email: contact.email
      };

      // const worker = new Worker("./src/services/WebhookService/WorkerAction.ts");

      // console.log('DISPARO5')
      // // Enviar as variáveis como parte da mensagem para o Worker
      // const data = {
      //   idFlowDb: parseInt(ticketUpdate.flowStopped),
      //   companyId: ticketUpdate.companyId,
      //   nodes: nodes,
      //   connects: connections,
      //   nextStage: ticketUpdate.lastFlowId,
      //   dataWebhook: null,
      //   details: "",
      //   hashWebhookId: "",
      //   pressKey: body,
      //   idTicket: ticketUpdate.id,
      //   numberPhrase: mountDataContact
      // };
      // worker.postMessage(data);
      // worker.on("message", message => {
      //   console.log(`Mensagem do worker: ${message}`);
      // });

      await ActionsWebhookService(
        whatsapp.id,
        parseInt(ticket.flowStopped),
        ticket.companyId,
        nodes,
        connections,
        ticket.lastFlowId,
        null,
        "",
        "",
        body,
        ticket.id,
        mountDataContact,
        msg
      );
    }
  }
};

export const handleMessageIntegration = async (
  msg: proto.IWebMessageInfo,
  wbot: Session,
  queueIntegration: QueueIntegrations,
  ticket: Ticket,
  companyId: number,
  isMenu: boolean = null,
  whatsapp: Whatsapp = null,
  contact: Contact = null,
  isFirstMsg: Ticket | null = null,
): Promise<void> => {
  const msgType = getTypeMessage(msg);

  if (queueIntegration.type === "n8n" || queueIntegration.type === "webhook") {
    if (queueIntegration?.urlN8N) {
      const options = {
        method: "POST",
        url: queueIntegration?.urlN8N,
        headers: {
          "Content-Type": "application/json"
        },
        json: msg
      };
      try {
        request(options, function (error, response) {
          if (error) {
            throw new Error(error);
          } else {
            console.log(response.body);
          }
        });
      } catch (error) {
        throw new Error(error);
      }
    }
  } else if (queueIntegration.type === "typebot") {
    console.log("entrou no typebot");
    // await typebots(ticket, msg, wbot, queueIntegration);
    await typebotListener({ ticket, msg, wbot, typebot: queueIntegration });
  } else if(queueIntegration.type === "flowbuilder") {
    if (!isMenu) {

      await flowbuilderIntegration(
        msg,
        wbot,
        companyId,
        queueIntegration,
        ticket,
        contact,
        isFirstMsg
      );
    } else {

      if (
        !isNaN(parseInt(ticket.lastMessage)) &&
        ticket.status !== "open" &&
        ticket.status !== "closed"
      ) {
        await flowBuilderQueue(
          ticket,
          msg,
          wbot,
          whatsapp,
          companyId,
          contact,
          isFirstMsg
        );
      }
    }
  }
};

const flowBuilderQueue = async (
  ticket: Ticket,
  msg: proto.IWebMessageInfo,
  wbot: Session,
  whatsapp: Whatsapp,
  companyId: number,
  contact: Contact,
  isFirstMsg: Ticket
) => {
  const body = getBodyMessage(msg);

  const flow = await FlowBuilderModel.findOne({
    where: {
      id: ticket.flowStopped
    }
  });

  const mountDataContact = {
    number: contact.number,
    name: contact.name,
    email: contact.email
  };

  const nodes: INodes[] = flow.flow["nodes"];
  const connections: IConnections[] = flow.flow["connections"];

  if (!ticket.lastFlowId) {
    return;
  }

  if (
    ticket.status === "closed" ||
    ticket.status === "interrupted" ||
    ticket.status === "open"
  ) {
    return;
  }

  await ActionsWebhookService(
    whatsapp.id,
    parseInt(ticket.flowStopped),
    ticket.companyId,
    nodes,
    connections,
    ticket.lastFlowId,
    null,
    "",
    "",
    body,
    ticket.id,
    mountDataContact,
    msg
  );

  //const integrations = await ShowQueueIntegrationService(whatsapp.integrationId, companyId);
  //await handleMessageIntegration(msg, wbot, integrations, ticket, companyId, true, whatsapp);
};


const handleMessage = async (
  msg: proto.IWebMessageInfo,
  wbot: Session,
  companyId: number
): Promise<void> => {
  let mediaSent: Message | undefined;

  if (!isValidMsg(msg)) return;

  try {
    let msgContact: IMe;
    let groupContact: Contact | undefined;

    const isGroup = msg.key.remoteJid?.endsWith("@g.us");

    const msgIsGroupBlock = await Setting.findOne({
      where: {
        companyId,
        key: "CheckMsgIsGroup"
      }
    });

    const bodyMessage = getBodyMessage(msg);
    const msgType = getTypeMessage(msg);

    const hasMedia =
      msg.message?.audioMessage ||
      msg.message?.imageMessage ||
      msg.message?.videoMessage ||
      msg.message?.documentMessage ||
      msg.message?.documentWithCaptionMessage ||
      msg.message.stickerMessage;
    if (msg.key.fromMe) {
      if (/\u200e/.test(bodyMessage)) return;

      if (
        !hasMedia &&
        msgType !== "conversation" &&
        msgType !== "extendedTextMessage" &&
        msgType !== "vcard"
      )
        return;
      msgContact = await getContactMessage(msg, wbot);
    } else {
      msgContact = await getContactMessage(msg, wbot);
    }

    if (msgIsGroupBlock?.value === "enabled" && isGroup) return;

    if (isGroup) {
      const grupoMeta = await wbot.groupMetadata(msg.key.remoteJid);
      const msgGroupContact = {
        id: grupoMeta.id,
        name: grupoMeta.subject
      };
      groupContact = await verifyContact(msgGroupContact, wbot, companyId);
    }

    const whatsapp = await ShowWhatsAppService(wbot.id!, companyId);
    const contact = await verifyContact(msgContact, wbot, companyId);

    let unreadMessages = 0;

    if (msg.key.fromMe) {
      await cacheLayer.set(`contacts:${contact.id}:unreads`, "0");
    } else {
      const unreads = await cacheLayer.get(`contacts:${contact.id}:unreads`);
      unreadMessages = +unreads + 1;
      await cacheLayer.set(
        `contacts:${contact.id}:unreads`,
        `${unreadMessages}`
      );
    }

    const lastMessage = await Message.findOne({
      where: {
        contactId: contact.id,
        companyId
      },
      order: [["createdAt", "DESC"]]
    });

    if (
      unreadMessages === 0 &&
      whatsapp.complationMessage &&
      formatBody(whatsapp.complationMessage, contact).trim().toLowerCase() ===
        lastMessage?.body.trim().toLowerCase()
    ) {
      return;
    }

    const ticket = await FindOrCreateTicketService(
      contact,
      wbot.id!,
      unreadMessages,
      companyId,
      groupContact
    );

    await provider(ticket, msg, companyId, contact, wbot as WASocket);

    // voltar para o menu inicial

    if (bodyMessage == "#") {
      await ticket.update({
        queueOptionId: null,
        chatbot: false,
        queueId: null
      });
      await verifyQueue(wbot, msg, ticket, ticket.contact);
      return;
    }

    const ticketTraking = await FindOrCreateATicketTrakingService({
      ticketId: ticket.id,
      companyId,
      whatsappId: whatsapp?.id
    });

    try {
      if (!msg.key.fromMe) {

        if (ticketTraking !== null && verifyRating(ticketTraking)) {
          handleRating(parseFloat(bodyMessage), ticket, ticketTraking);
          return;
        }
      }
    } catch (e) {
      Sentry.captureException(e);
      console.log(e);
    }

    // Atualiza o ticket se a ultima mensagem foi enviada por mim, para que possa ser finalizado.
    try {
      await ticket.update({
        fromMe: msg.key.fromMe
      });
    } catch (e) {
      Sentry.captureException(e);
      console.log(e);
    }

    if (hasMedia) {
      mediaSent = await verifyMediaMessage(msg, ticket, contact);
    } else {
      await verifyMessage(msg, ticket, contact);
    }

    // Non-blocking SDR qualification for first message from a contact
    if (!msg.key.fromMe && unreadMessages === 1) {
      try {
        const { SDRAgent } = await import('../../dape/agents/SDRAgent');
        const sdrAgent = new SDRAgent(companyId);
        const msgBody = getBodyMessage(msg) || '';
        sdrAgent.qualifyLead(contact.id, msgBody).then(result => {
          if (result) {
            console.log(`[wbotMessageListener] SDR qualification for contact ${contact.id}:`, result);
          }
        }).catch(err => {
          console.error('[wbotMessageListener] SDR qualification error (non-blocking):', err);
        });
      } catch (err) {
        // completely non-blocking — never throw
      }
    }

    // Non-blocking Pipeline stage analysis every 5 inbound messages
    if (!msg.key.fromMe && unreadMessages > 0 && unreadMessages % 5 === 0) {
      (async () => {
        try {
          const { PipelineAgent } = await import('../../dape/agents/PipelineAgent');
          const agent = new PipelineAgent(companyId);
          const result = await agent.analyzeConversationAndSuggestStage(
            contact.id,
            ticket.id,
            companyId
          );

          if (result && result.shouldAdvance && result.confidence === 'high') {
            // Auto-advance the deal stage
            const DapeDeal = (await import('../../models/DapeDeal')).default;
            await DapeDeal.update(
              { stage: result.suggestedStage },
              { where: { id: result.dealId, companyId, status: 'open' } }
            );
            console.log(
              `[PipelineAgent] Auto-advanced deal ${result.dealId} from "${result.currentStage}" to "${result.suggestedStage}" — ${result.reasoning}`
            );
          } else if (result && result.shouldAdvance && result.confidence === 'medium') {
            // Log suggestion for human review (don't auto-update)
            console.log(
              `[PipelineAgent] Stage suggestion (medium confidence) for deal ${result.dealId}: "${result.currentStage}" → "${result.suggestedStage}" — ${result.reasoning} [human review needed]`
            );
          }
        } catch (err) {
          console.error('[wbotMessageListener] PipelineAgent error (non-blocking):', err);
        }
      })();
    }

    const currentSchedule = await VerifyCurrentSchedule(companyId);
    const scheduleType = await Setting.findOne({
      where: {
        companyId,
        key: "scheduleType"
      }
    });

    // DAPLE Shield — non-blocking check for out-of-hours / greeting auto-responses
    const shieldAutoResponse = await dapleShield.evaluate({
      companyId: ticket.companyId,
      whatsappId: ticket.whatsappId,
      source: "bot",
      ticketId: ticket.id,
      contactNumber: contact.number
    });
    if (!shieldAutoResponse.allowed) {
      logger.warn(`[DapleShield] Alerta Shield (saudação/fora-horário, envio permitido): ${shieldAutoResponse.reason}`);
      // non-blocking: continue execution
    }

    try {
      if (!msg.key.fromMe && scheduleType) {
        /**
         * Tratamento para envio de mensagem quando a empresa está fora do expediente
         */
        if (
          scheduleType.value === "company" &&
          !isNil(currentSchedule) &&
          (!currentSchedule || currentSchedule.inActivity === false)
        ) {
          const body = `\u200e ${whatsapp.outOfHoursMessage}`;

          const debouncedSentMessage = debounce(
            async () => {
              await wbot.sendMessage(
                `${ticket.contact.number}@${
                  ticket.isGroup ? "g.us" : "s.whatsapp.net"
                }`,
                {
                  text: body
                }
              );
            },
            3000,
            ticket.id
          );
          debouncedSentMessage();
          return;
        }

        if (scheduleType.value === "queue" && ticket.queueId !== null) {
          /**
           * Tratamento para envio de mensagem quando a fila está fora do expediente
           */
          const queue = await Queue.findByPk(ticket.queueId);

          const { schedules }: any = queue;
          const now = moment();
          const weekday = now.format("dddd").toLowerCase();
          let schedule = null;

          if (Array.isArray(schedules) && schedules.length > 0) {
            schedule = schedules.find(
              s =>
                s.weekdayEn === weekday &&
                s.startTime !== "" &&
                s.startTime !== null &&
                s.endTime !== "" &&
                s.endTime !== null
            );
          }

          if (
            scheduleType.value === "queue" &&
            queue.outOfHoursMessage !== null &&
            queue.outOfHoursMessage !== "" &&
            !isNil(schedule)
          ) {
            const startTime = moment(schedule.startTime, "HH:mm");
            const endTime = moment(schedule.endTime, "HH:mm");

            if (now.isBefore(startTime) || now.isAfter(endTime)) {
              const body = `${queue.outOfHoursMessage}`;
              const debouncedSentMessage = debounce(
                async () => {
                  await wbot.sendMessage(
                    `${ticket.contact.number}@${
                      ticket.isGroup ? "g.us" : "s.whatsapp.net"
                    }`,
                    {
                      text: body
                    }
                  );
                },
                3000,
                ticket.id
              );
              debouncedSentMessage();
              return;
            }
          }
        }
      }
    } catch (e) {
      Sentry.captureException(e);
      console.log(e);
    }

    const flow = await FlowBuilderModel.findOne({
      where: {
        id: ticket.flowStopped
      }
    });

    let isMenu = false;
    let isOpenai = false;
    let isQuestion = false;

    if (flow) {
      isMenu =
        flow.flow["nodes"].find((node: any) => node.id === ticket.lastFlowId)
          ?.type === "menu";
      isOpenai =
        flow.flow["nodes"].find((node: any) => node.id === ticket.lastFlowId)
          ?.type === "openai";
      isQuestion =
        flow.flow["nodes"].find((node: any) => node.id === ticket.lastFlowId)
          ?.type === "question";
    }

    if (!isNil(flow) && isQuestion && !msg.key.fromMe) {
      console.log(
        "|============= QUESTION =============|",
        JSON.stringify(flow, null, 4)
      );
      const body = getBodyMessage(msg);
      if (body) {
        const nodes: INodes[] = flow.flow["nodes"];
        const nodeSelected = flow.flow["nodes"].find(
          (node: any) => node.id === ticket.lastFlowId
        );

        const connections: IConnections[] = flow.flow["connections"];

        const { message, answerKey } = nodeSelected.data.typebotIntegration;
        const oldDataWebhook = ticket.dataWebhook;

        const nodeIndex = nodes.findIndex(node => node.id === nodeSelected.id);

        const lastFlowId = nodes[nodeIndex + 1].id;
        await ticket.update({
          lastFlowId: lastFlowId,
          dataWebhook: {
            variables: {
              [answerKey]: body
            }
          }
        });

        await ticket.save();

        const mountDataContact = {
          number: contact.number,
          name: contact.name,
          email: contact.email
        };

        await ActionsWebhookService(
          whatsapp.id,
          parseInt(ticket.flowStopped),
          ticket.companyId,
          nodes,
          connections,
          lastFlowId,
          null,
          "",
          "",
          "",
          ticket.id,
          mountDataContact,
          msg
        );
      }

      return;
    }

    if (isOpenai && !isNil(flow) && !ticket.queue) {
      const nodeSelected = flow.flow["nodes"].find(
        (node: any) => node.id === ticket.lastFlowId
      );
      let {
        name,
        prompt,
        voice,
        voiceKey,
        voiceRegion,
        maxTokens,
        temperature,
        apiKey,
        queueId,
        maxMessages
      } = nodeSelected.data.typebotIntegration as IOpenAi;

      let openAiSettings = {
        name,
        prompt,
        voice,
        voiceKey,
        voiceRegion,
        maxTokens: parseInt(maxTokens),
        temperature: parseInt(temperature),
        apiKey,
        queueId: parseInt(queueId),
        maxMessages: parseInt(maxMessages)
      };

      await handleOpenAi(
        msg,
        wbot,
        ticket,
        contact,
        mediaSent,
        ticketTraking,
        openAiSettings,
      );

      return;
    }

    //openai na conexao
    if (
      !ticket.queue &&
      !isGroup &&
      !msg.key.fromMe &&
      !ticket.userId &&
      !isNil(whatsapp.promptId)
    ) {
      await handleOpenAi(msg, wbot, ticket, contact, mediaSent);
    }

    //integraçao na conexao
    if (
      !msg.key.fromMe &&
      !ticket.isGroup &&
      !ticket.queue &&
      !ticket.user &&
      ticket.chatbot &&
      !isNil(whatsapp.integrationId) &&
      !ticket.useIntegration
    ) {

      const integrations = await ShowQueueIntegrationService(
        whatsapp.integrationId,
        companyId
      );

      await handleMessageIntegration(
        msg,
        wbot,
        integrations,
        ticket,
        companyId,
        isMenu
      );

      return;
    }

    //openai na fila
    if (
      !isGroup &&
      !msg.key.fromMe &&
      !ticket.userId &&
      !isNil(ticket.promptId) &&
      ticket.useIntegration &&
      ticket.queueId
    ) {
      await handleOpenAi(msg, wbot, ticket, contact, mediaSent);
    }

    if (
      !msg.key.fromMe &&
      !ticket.isGroup &&
      !ticket.userId &&
      ticket.integrationId &&
      ticket.useIntegration &&
      ticket.queue
    ) {
      console.log("entrou no type 1974");
      const integrations = await ShowQueueIntegrationService(
        ticket.integrationId,
        companyId
      );

      const isFirstMsg = await Ticket.findOne({
        where: {
          contactId: groupContact ? groupContact.id : contact.id,
          companyId,
          whatsappId: whatsapp.id
        },
        order: [["id", "DESC"]]
      });

      await handleMessageIntegration(
        msg,
        wbot,
        integrations,
        ticket,
        companyId,
        isMenu,
        whatsapp,
        contact,
        isFirstMsg
      );
    }

    if (
      !ticket.queue &&
      !ticket.isGroup &&
      !msg.key.fromMe &&
      !ticket.userId &&
      whatsapp.queues.length >= 1 &&
      !ticket.useIntegration
    ) {
      await verifyQueue(wbot, msg, ticket, contact);

      if (ticketTraking && ticketTraking.chatbotAt === null) {
        await ticketTraking.update({
          chatbotAt: moment().toDate()
        });
      }
    }

    const isFirstMsg = await Ticket.findOne({
      where: {
        contactId: groupContact ? groupContact.id : contact.id,
        companyId,
        whatsappId: whatsapp.id
      },
      order: [["id", "DESC"]]
    });

    // integração flowbuilder
    if (
      !msg.key.fromMe &&
      !ticket.isGroup &&
      !ticket.queue &&
      !ticket.user &&
      !isNil(whatsapp.integrationId) &&
      !ticket.useIntegration
    ) {

      const integrations = await ShowQueueIntegrationService(
        whatsapp.integrationId,
        companyId
      );

      await handleMessageIntegration(
        msg,
        wbot,
        integrations,
        ticket,
        companyId,
        isMenu,
        whatsapp,
        contact,
        isFirstMsg
      );
    }

    const dontReadTheFirstQuestion = ticket.queue === null;

    await ticket.reload();

    try {
      //Fluxo fora do expediente
      if (!msg.key.fromMe && scheduleType && ticket.queueId !== null) {
        /**
         * Tratamento para envio de mensagem quando a fila está fora do expediente
         */
        const queue = await Queue.findByPk(ticket.queueId);

        const { schedules }: any = queue;
        const now = moment();
        const weekday = now.format("dddd").toLowerCase();
        let schedule = null;

        if (Array.isArray(schedules) && schedules.length > 0) {
          schedule = schedules.find(
            s =>
              s.weekdayEn === weekday &&
              s.startTime !== "" &&
              s.startTime !== null &&
              s.endTime !== "" &&
              s.endTime !== null
          );
        }

        if (
          scheduleType.value === "queue" &&
          queue.outOfHoursMessage !== null &&
          queue.outOfHoursMessage !== "" &&
          !isNil(schedule)
        ) {
          const startTime = moment(schedule.startTime, "HH:mm");
          const endTime = moment(schedule.endTime, "HH:mm");

          if (now.isBefore(startTime) || now.isAfter(endTime)) {
            const body = queue.outOfHoursMessage;
            const debouncedSentMessage = debounce(
              async () => {
                await wbot.sendMessage(
                  `${ticket.contact.number}@${
                    ticket.isGroup ? "g.us" : "s.whatsapp.net"
                  }`,
                  {
                    text: body
                  }
                );
              },
              3000,
              ticket.id
            );
            debouncedSentMessage();
            return;
          }
        }
      }
    } catch (e) {
      Sentry.captureException(e);
      console.log(e);
    }

    if (
      !whatsapp?.queues?.length &&
      !ticket.userId &&
      !isGroup &&
      !msg.key.fromMe
    ) {
      const lastMessage = await Message.findOne({
        where: {
          ticketId: ticket.id,
          fromMe: true
        },
        order: [["createdAt", "DESC"]]
      });

      if (lastMessage && lastMessage.body.includes(whatsapp.greetingMessage)) {
        return;
      }

      if (whatsapp.greetingMessage) {
        const debouncedSentMessage = debounce(
          async () => {
            await wbot.sendMessage(
              `${ticket.contact.number}@${
                ticket.isGroup ? "g.us" : "s.whatsapp.net"
              }`,
              {
                text: whatsapp.greetingMessage
              }
            );
          },
          1000,
          ticket.id
        );
        debouncedSentMessage();
        return;
      }
    }

    if (whatsapp.queues.length == 1 && ticket.queue) {
      if (ticket.chatbot && !msg.key.fromMe) {
        await handleChartbot(ticket, msg, wbot);
      }
    }

    if (whatsapp.queues.length > 1 && ticket.queue) {
      if (ticket.chatbot && !msg.key.fromMe) {
        await handleChartbot(ticket, msg, wbot, dontReadTheFirstQuestion);
      }
    }

  } catch (err) {
    console.log(err);
    Sentry.captureException(err);
    logger.error(`Error handling whatsapp message: Err: ${err}`);
  }
};

const handleMsgAck = async (
  msg: WAMessage,
  chat: number | null | undefined
) => {
  await new Promise(r => setTimeout(r, 500));
  const io = getIO();

  try {
    const messageToUpdate = await Message.findByPk(msg.key.id, {
      include: [
        "contact",
        {
          model: Message,
          as: "quotedMsg",
          include: ["contact"]
        }
      ]
    });

    if (!messageToUpdate) return;
    await messageToUpdate.update({ ack: chat });
    io.to(messageToUpdate.ticketId.toString()).emit(
      `company-${messageToUpdate.companyId}-appMessage`,
      {
        action: "update",
        message: messageToUpdate
      }
    );
  } catch (err) {
    Sentry.captureException(err);
    logger.error(`Error handling message ack. Err: ${err}`);
  }
};

const verifyCampaignMessageAndCloseTicket = async (
  message: proto.IWebMessageInfo,
  companyId: number
) => {
  const io = getIO();
  const body = getBodyMessage(message);
  const isCampaign = /\u200c/.test(body);
  if (message.key.fromMe && isCampaign) {
    const messageRecord = await Message.findOne({
      where: { id: message.key.id!, companyId }
    });
    const ticket = await Ticket.findByPk(messageRecord.ticketId);
    await ticket.update({ status: "closed" });

    io.to(`company-${ticket.companyId}-open`)
      .to(`queue-${ticket.queueId}-open`)
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
};

const wbotMessageListener = async (
  wbot: Session,
  companyId: number
): Promise<void> => {
  try {
    wbot.ev.on("messages.upsert", async (messageUpsert: ImessageUpsert) => {
      const messages = messageUpsert.messages
        .filter(filterMessages)
        .map(msg => msg);

      if (!messages) return;

      for (const message of messages) {
        const messageExists = await Message.count({
          where: { id: message.key.id!, companyId }
        });

        if (!messageExists) {
          await handleMessage(message, wbot, companyId);
          await verifyCampaignMessageAndCloseTicket(message, companyId);
        }
      }
    });

    wbot.ev.on("messages.update", (messageUpdate: WAMessageUpdate[]) => {
      if (messageUpdate.length === 0) return;
      messageUpdate.forEach(async (message: WAMessageUpdate) => {
        (wbot as WASocket)!.readMessages([message.key]);

        handleMsgAck(message, message.update.status);
      });
    });

    // wbot.ev.on("messages.set", async (messageSet: IMessage) => {
    //   messageSet.messages.filter(filterMessages).map(msg => msg);
    // });
  } catch (error) {
    Sentry.captureException(error);
    logger.error(`Error handling wbot message listener. Err: ${error}`);
  }
};

// Re-exportadas aqui pra nao quebrar os imports externos existentes
// (isNumeric, sleep, validaCpfCnpj, makeid, sanitizeName, keepOnlySpecifiedChars
// agora moram em utils/generalHelpers.ts - ver #031 Fase 1)
export {
  isNumeric,
  validaCpfCnpj,
  sleep,
  makeid,
  sanitizeName,
  keepOnlySpecifiedChars
};

// idem para as funcoes de parsing de mensagem - #031 Fase 2
// (getBodyMessage e usada por providers.ts, typebotListener.ts e OpenAiService.ts;
// as demais nao tem consumidor externo hoje, mas ja estavam exportadas)
export {
  getTypeMessage,
  hasCaption,
  getBodyButton,
  msgLocation,
  getBodyMessage,
  getQuotedMessage,
  getQuotedMessageId,
  getMeSocket,
  getSenderMessage,
  getContactMessage,
  isValidMsg,
  filterMessages
};

export { wbotMessageListener, handleMessage };
