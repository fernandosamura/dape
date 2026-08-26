import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import { CloudApiChannel } from "./CloudApiChannel";
import {
  MessageChannel,
  NormalizedIncomingMessage,
  NormalizedMediaResult,
  SendResult
} from "./MessageChannelTypes";

// Adaptador pra WhatsApp Business App Coexistence. O envio/recebimento via
// Graph API e IDENTICO ao Cloud API tradicional (mesmo endpoint, mesma
// forma de autenticacao) - por isso delega (composicao) pra uma instancia
// interna de CloudApiChannel em vez de reimplementar sendText/sendMedia/
// downloadIncomingMedia. Nao usa heranca porque `providerType` e uma
// propriedade readonly com tipo literal proprio em cada classe - estender
// CloudApiChannel exigiria alargar o tipo dela pra aceitar os dois valores,
// o que essa classe nao deveria precisar saber. Qualquer comportamento
// realmente exclusivo de Coexistence (ex: tratamento de smb_message_echoes)
// fica em outra camada (webhook handlers, BLOCO E), nao aqui - esta classe
// e so o transporte de envio/recebimento normal.
export class CoexistenceChannel implements MessageChannel {
  readonly providerType = "meta_cloud_coexistence" as const;

  private inner: CloudApiChannel;

  constructor(whatsapp: Whatsapp) {
    this.inner = new CloudApiChannel(whatsapp);
  }

  sendText(ticket: Ticket, body: string): Promise<SendResult> {
    return this.inner.sendText(ticket, body);
  }

  sendMedia(
    ticket: Ticket,
    mediaUrl: string,
    mediaType: string,
    caption?: string
  ): Promise<SendResult> {
    return this.inner.sendMedia(ticket, mediaUrl, mediaType, caption);
  }

  downloadIncomingMedia(
    msg: NormalizedIncomingMessage
  ): Promise<NormalizedMediaResult | null> {
    return this.inner.downloadIncomingMedia(msg);
  }
}
