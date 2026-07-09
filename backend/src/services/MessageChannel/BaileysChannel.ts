import { join } from "path";
import { promisify } from "util";
import { writeFile } from "fs";
import { proto } from "baileys";
import { extension as mimeExtension } from "mime-types";
import Ticket from "../../models/Ticket";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import { downloadMedia } from "../WbotServices/wbotMessageMedia";
import { uploadToR2 } from "../StorageServices/R2Service";
import { logger } from "../../utils/logger";
import {
  MessageChannel,
  NormalizedIncomingMessage,
  NormalizedMediaResult,
  SendResult
} from "./MessageChannelTypes";

const fs = require("fs");
const writeFileAsync = promisify(writeFile);

const jidFor = (ticket: Ticket): string =>
  `${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`;

// Adaptador que implementa MessageChannel usando o Baileys (sessao via QR
// Code) - o transporte nao-oficial usado hoje por 100% dos numeros da
// plataforma. Encapsula GetTicketWbot + wbot.sendMessage, que antes eram
// chamados diretamente e de forma espalhada pelo motor de menu/IA/Flow
// Builder.
export class BaileysChannel implements MessageChannel {
  readonly providerType = "session" as const;

  async sendText(ticket: Ticket, body: string): Promise<SendResult> {
    const wbot = await GetTicketWbot(ticket);
    const sentMessage = await wbot.sendMessage(jidFor(ticket), { text: body });
    return { externalId: sentMessage.key.id! };
  }

  async sendMedia(
    ticket: Ticket,
    mediaUrl: string,
    mediaType: string,
    caption?: string
  ): Promise<SendResult> {
    const wbot = await GetTicketWbot(ticket);
    const content: Record<string, unknown> = { caption };

    if (mediaType === "image") {
      content.image = { url: mediaUrl };
    } else if (mediaType === "video") {
      content.video = { url: mediaUrl };
    } else if (mediaType === "audio") {
      content.audio = { url: mediaUrl };
      content.mimetype = "audio/mp4";
    } else {
      content.document = { url: mediaUrl };
      content.mimetype = "application/octet-stream";
      content.fileName = caption || "arquivo";
    }

    const sentMessage = await wbot.sendMessage(jidFor(ticket), content as never);
    return { externalId: sentMessage.key.id! };
  }

  async downloadIncomingMedia(
    msg: NormalizedIncomingMessage
  ): Promise<NormalizedMediaResult | null> {
    try {
      const waMsg = msg.raw as proto.IWebMessageInfo;
      const media = await downloadMedia(waMsg);
      if (!media?.data) return null;

      let filename = media.filename;
      if (!filename) {
        const ext = mimeExtension(media.mimetype) || "bin";
        filename = `${new Date().getTime()}.${ext}`;
      }

      const fileBuffer = Buffer.isBuffer(media.data)
        ? media.data
        : Buffer.from(media.data, "base64");

      if (process.env.CLOUDFLARE_R2_ENABLED === "true") {
        const tempPath = join(__dirname, "..", "..", "..", "public", "temp", filename);
        await writeFileAsync(tempPath, fileBuffer);
        await uploadToR2(tempPath, filename, media.mimetype);
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      } else {
        await writeFileAsync(
          join(__dirname, "..", "..", "..", "public", filename),
          fileBuffer
        );
      }

      return { filename, mimetype: media.mimetype };
    } catch (err) {
      logger.error({ err }, "[BaileysChannel] Erro ao baixar mídia");
      return null;
    }
  }
}
