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

interface Request {
  media: Express.Multer.File;
  ticket: Ticket;
  body?: string;
}

const publicFolder = path.resolve(__dirname, "..", "..", "..", "public");

const processAudio = async (audio: string): Promise<string> => {
  const outputAudio = `${publicFolder}/${new Date().getTime()}.ogg`;
  return new Promise((resolve, reject) => {
    exec(
      `ffmpeg -i ${audio} -c:a libopus -b:a 32k -vbr on -compression_level 10 ${outputAudio} -y`,
      (error, _stdout, _stderr) => {
        if (error) reject(error);
        fs.unlinkSync(audio);
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
        fs.unlinkSync(audio);
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
  const mimeType = lookup(pathMedia) || "";
  const typeMessage = mimeType.split("/")[0];

  try {
    if (!mimeType) {
      throw new Error("Invalid mimetype");
    }
    let options: AnyMessageContent;

    if (typeMessage === "video") {
      options = {
        video: fs.readFileSync(pathMedia),
        caption: body ? body : "",
        fileName: fileName
      };
    } else if (typeMessage === "audio") {
      const convert = await processAudio(pathMedia);
      options = {
        audio: fs.readFileSync(convert),
        mimetype: "audio/ogg; codecs=opus",
        caption: body ? body : null,
        ptt: true
      };
    } else if (typeMessage === "document") {
      options = {
        document: fs.readFileSync(pathMedia),
        caption: body ? body : null,
        fileName: fileName,
        mimetype: mimeType
      };
    } else if (typeMessage === "application") {
      options = {
        document: fs.readFileSync(pathMedia),
        caption: body ? body : null,
        fileName: fileName,
        mimetype: mimeType
      };
    } else {
      options = {
        image: fs.readFileSync(pathMedia),
        caption: body ? body : null
      };
    }

    return options;
  } catch (e) {
    Sentry.captureException(e);
    console.log(e);
    return null;
  }
};

const SendWhatsAppMedia = async ({
  media,
  ticket,
  body
}: Request): Promise<WAMessage> => {
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

    const pathMedia = media.path;
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
        const convert = await processAudio(media.path);
        options = {
          audio: fs.readFileSync(convert),
          mimetype: "audio/ogg; codecs=opus",
          ptt: true
        };
      } else {
        const convert = await processAudioFile(media.path);
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
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendWhatsAppMedia;
