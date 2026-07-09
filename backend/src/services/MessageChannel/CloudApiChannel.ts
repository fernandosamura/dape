import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import { decrypt } from "../../helpers/cryptoHelper";
import SendMetaCloudMessage from "../MetaCloudServices/SendMetaCloudMessage";
import { downloadAndStoreMetaCloudMedia } from "../MetaCloudServices/DownloadMetaCloudMedia";
import {
  MessageChannel,
  NormalizedIncomingMessage,
  NormalizedMediaResult,
  SendResult
} from "./MessageChannelTypes";

// Adaptador que implementa MessageChannel usando a Meta Cloud API (WhatsApp
// Business Platform oficial). A logica de envio/download real ja existia
// desde as Fases 1-3; esta classe so empacota o que ja existe atras do
// contrato comum usado pelo motor de negocio.
export class CloudApiChannel implements MessageChannel {
  readonly providerType = "meta_cloud" as const;

  constructor(private whatsapp: Whatsapp) {}

  async sendText(ticket: Ticket, body: string): Promise<SendResult> {
    return SendMetaCloudMessage({ body, ticket, source: "bot" });
  }

  async sendMedia(
    ticket: Ticket,
    mediaUrl: string,
    mediaType: string,
    caption?: string
  ): Promise<SendResult> {
    return SendMetaCloudMessage({
      body: caption || "",
      ticket,
      mediaUrl,
      mediaType,
      source: "bot"
    });
  }

  async downloadIncomingMedia(
    msg: NormalizedIncomingMessage
  ): Promise<NormalizedMediaResult | null> {
    const raw = msg.raw as {
      type: string;
      [key: string]: unknown;
    };
    const mediaField = raw[raw.type] as { id?: string; filename?: string } | undefined;
    const mediaId = mediaField?.id;
    if (!mediaId || !this.whatsapp.metaAccessToken) return null;

    let accessToken: string;
    try {
      accessToken = decrypt(this.whatsapp.metaAccessToken);
    } catch {
      return null;
    }

    return downloadAndStoreMetaCloudMedia(
      mediaId,
      accessToken,
      raw.type === "document" ? mediaField?.filename : undefined
    );
  }
}
