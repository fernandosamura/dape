import { WAMessage, AnyMessageContent } from "baileys";
import * as Sentry from "@sentry/node";
import fs from "fs";
import { exec } from "child_process";
import path from "path";
import AppError from "../../errors/AppError";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import Ticket from "../../models/Ticket";
import Message from "../../models/Message";
import { lookup } from "mime-types";
import formatBody from "../../helpers/Mustache";
import { downloadFromR2 } from "../StorageServices/R2Service";
import { dapleShield } from "../../dape/shield/dapleShield.service";
import { logger } from "../../utils/logger";

interface Request {
  media: Express.Multer.File;
  ticket: Ticket;
  body?: string;
}

const publicFolder = path.resolve(__dirname, "..", "..", "..", "public");
const tempFolder = path.resolve(publicFolder, "temp");

const ensureTempFolder = () => {
  if (!fs.existsSync(tempFolder)) {
    fs.mkdirSync(tempFolder, { recursive: true });
  }
};

/**
 * Se R2 está ativo e o arquivo não existe localmente,
 * faz o download para public/temp e retorna o caminho temporário.
 * Retorna null se o arquivo existe localmente ou R2 não está ativo.
 */
const resolveLocalPath = async (
  mediaPath: string,
  mediaFilename: string
): Promise<{ localPath: string; isTempDownload: boolean }> => {
  if (
    process.env.CLOUDFLARE_R2_ENABLED === "true" &&
    !fs.existsSync(mediaPath)
  ) {
    ensureTempFolder();
    const tempPath = path.join(
      tempFolder,
      `r2_${Date.now()}_${path.basename(mediaFilename)}`
    );
    await downloadFromR2(mediaFilename, tempPath);
    return { localPath: tempPath, isTempDownload: true };
  }
  return { localPath: mediaPath, isTempDownload: false };
};

const processAudio = async (audio: string): Promise<string> => {
  const outputAudio = `${publicFolder}/${new Date().getTime()}.ogg`;
  return new Promise((resolve, reject) => {
    exec(
      `ffmpeg -i ${audio} -c:a libopus -b:a 32k -vbr on -compression_level 10 ${outputAudio} -y`,
      (error, _stdout, _stderr) => {
        if (error) reject(error);
        if (fs.existsSync(audio)) fs.unlinkSync(audio);
        resolve(outputAudio);
      }
    );
  });
};

const processAudioFile = async (audio: string): Promise<string> => {
  const outputAudio = `${publicFolder}/${new Date().getTime()}.ogg`;
  return new Promise((resolve, reject) => {
    exec(
      `ffmpeg -i ${audio} -c:a libopus -b:a 32k -vbr on -compression_level 10 ${outputAudio} -y`,
      (error, _stdout, _stderr) => {
        if (error) reject(error);
        if (fs.existsSync(audio)) fs.unlinkSync(audio);
        resolve(outputAudio);
      }
    );
  });
};

export const getMessageOptions = async (
  fileName: string,
  pathMedia: string,
  body?: string
): Promise<any> => {
  // Se R2 ativo e arquivo não existe localmente, baixa do R2
  let { localPath, isTempDownload } = await resolveLocalPath(
    pathMedia,
    path.basename(pathMedia)
  );

  const mimeType = lookup(localPath) || "";
  const typeMessage = mimeType.split("/")[0];

  try {
    if (!mimeType) {
      throw new Error("Invalid mimetype");
    }
    let options: AnyMessageContent;

    if (typeMessage === "video") {
      options = {
        video: fs.readFileSync(localPath),
        caption: body ? body : "",
        fileName: fileName
      };
    } else if (typeMessage === "audio") {
      // processAudio deleta o input automaticamente (isTempDownload já é tratado)
      const convert = await processAudio(localPath);
      isTempDownload = false; // já deletado pelo processAudio
      options = {
        audio: fs.readFileSync(convert),
        mimetype: "audio/ogg; codecs=opus",
        caption: body ? body : null,
        ptt: true
      };
    } else if (typeMessage === "document") {
      options = {
        document: fs.readFileSync(localPath),
        caption: body ? body : null,
        fileName: fileName,
        mimetype: mimeType
      };
    } else if (typeMessage === "application") {
      options = {
        document: fs.readFileSync(localPath),
        caption: body ? body : null,
        fileName: fileName,
        mimetype: mimeType
      };
    } else {
      options = {
        image: fs.readFileSync(localPath),
        caption: body ? body : null
      };
    }

    return options;
  } catch (e) {
    Sentry.captureException(e);
    console.log(e);
    return null;
  } finally {
    if (isTempDownload && fs.existsSync(localPath)) {
      fs.unlinkSync(localPath);
    }
  }
};

const SendWhatsAppMedia = async ({
  media,
  ticket,
  body
}: Request): Promise<WAMessage> => {
  let tempR2File: string | null = null;

  // DAPLE Shield — manual media sends are non-blocking (log only)
  try {
    const shieldMedia = await dapleShield.evaluate({
      companyId: ticket.companyId,
      whatsappId: ticket.whatsappId,
      source: "manual",
      ticketId: ticket.id,
      messagePreview: body ? body.substring(0, 200) : media?.originalname ?? "",
    });
    if (!shieldMedia.allowed) {
      logger.warn(`[DAPLE Shield] Alert (manual media send allowed) for ticket ${ticket.id}: ${shieldMedia.reason}`);
    }
  } catch (_shieldErr) { /* shield errors must never block manual sends */ }

  try {
    const wbot = await GetTicketWbot(ticket);

    // --- DETECÇÃO DE DOMÍNIO @lid ---
    let jidDomain = ticket.isGroup ? "g.us" : "s.whatsapp.net";
    if (!ticket.isGroup) {
      const lastContactMsg = await Message.findOne({
        where: { ticketId: ticket.id, fromMe: false },
        order: [["createdAt", "DESC"]]
      });
      if (lastContactMsg?.dataJson) {
        try {
          const parsedMsg = JSON.parse(lastContactMsg.dataJson);
          const remoteJid: string = parsedMsg?.key?.remoteJid || "";
          if (remoteJid.includes("@lid")) {
            jidDomain = "lid";
          }
        } catch (_) {}
      }
    }
    const number = `${ticket.contact.number}@${jidDomain}`;
    // --- FIM DETECÇÃO JID ---

    // Resolve o caminho local (baixa do R2 se necessário)
    const resolved = await resolveLocalPath(media.path, media.filename);
    const pathMedia = resolved.localPath;
    if (resolved.isTempDownload) {
      tempR2File = pathMedia;
    }

    const typeMessage = media.mimetype.split("/")[0];
    let options: AnyMessageContent;
    const bodyMessage = formatBody(body, ticket.contact);

    if (typeMessage === "video") {
      options = {
        video: fs.readFileSync(pathMedia),
        caption: bodyMessage,
        fileName: media.originalname
      };
    } else if (typeMessage === "audio") {
      const typeAudio = media.originalname.includes("audio-record-site");
      if (typeAudio) {
        const convert = await processAudio(pathMedia);
        tempR2File = null; // processAudio já deletou
        options = {
          audio: fs.readFileSync(convert),
          mimetype: "audio/ogg; codecs=opus",
          ptt: true
        };
      } else {
        const convert = await processAudioFile(pathMedia);
        tempR2File = null; // processAudioFile já deletou
        options = {
          audio: fs.readFileSync(convert),
          mimetype: "audio/ogg; codecs=opus",
          ptt: false
        };
      }
    } else if (typeMessage === "document" || typeMessage === "text") {
      options = {
        document: fs.readFileSync(pathMedia),
        caption: bodyMessage,
        fileName: media.originalname,
        mimetype: media.mimetype
      };
    } else if (typeMessage === "application") {
      options = {
        document: fs.readFileSync(pathMedia),
        caption: bodyMessage,
        fileName: media.originalname,
        mimetype: media.mimetype
      };
    } else {
      options = {
        image: fs.readFileSync(pathMedia),
        caption: bodyMessage
      };
    }

    const sentMessage = await wbot.sendMessage(number, { ...options });

    await ticket.update({ lastMessage: bodyMessage });

    return sentMessage;
  } catch (err) {
    Sentry.captureException(err);
    console.log(err);
    await dapleShield.reportSendError(ticket.whatsappId, ticket.companyId, String(err));
    throw new AppError("ERR_SENDING_WAPP_MSG");
  } finally {
    // Garante limpeza do arquivo temporário baixado do R2
    if (tempR2File && fs.existsSync(tempR2File)) {
      fs.unlinkSync(tempR2File);
    }
  }
};

export default SendWhatsAppMedia;
