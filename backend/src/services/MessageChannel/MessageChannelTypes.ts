import Ticket from "../../models/Ticket";

// Tipos normalizados usados pela camada de abstração de mensagens (#031/Meta
// Cloud API - Fase A). O objetivo e permitir que o motor de negocio (menu,
// IA, Flow Builder, campanhas - fases B em diante) opere sobre um formato
// unico, independente do transporte real ser Baileys (QR Code) ou a Cloud
// API oficial da Meta. Sem isso, cada motor precisaria de dois caminhos
// paralelos de logica (a "duas frentes" que o plano evita de proposito).

export type NormalizedMessageType =
  | "text"
  | "image"
  | "audio"
  | "video"
  | "document"
  | "sticker"
  | "location"
  | "button"
  | "interactive"
  | "unknown";

export interface NormalizedIncomingMessage {
  // ID da mensagem no provedor de origem (Baileys: key.id / Cloud API: msg.id)
  externalId: string;
  fromMe: boolean;
  type: NormalizedMessageType;
  // Texto ou legenda - "" quando a mensagem e so midia sem legenda
  body: string;
  // Payload original do provedor, preservado pra quem for baixar midia ou
  // gravar dataJson/debug precisar dos detalhes especificos do transporte.
  raw: unknown;
}

export interface NormalizedMediaResult {
  filename: string;
  mimetype: string;
}

export interface SendResult {
  // ID da mensagem enviada, no formato do provedor - usado como chave
  // primaria ao gravar em Messages, igual ja se fazia so com Baileys.
  externalId: string;
}

// Contrato que qualquer transporte de mensagens do WhatsApp precisa
// implementar. As fases B-D (motor de menu, IA, Flow Builder) passam a
// depender so desta interface, nunca de `wbot`/Baileys ou da Graph API
// diretamente.
export interface MessageChannel {
  readonly providerType: "session" | "meta_cloud";
  sendText(ticket: Ticket, body: string): Promise<SendResult>;
  sendMedia(
    ticket: Ticket,
    mediaUrl: string,
    mediaType: string,
    caption?: string
  ): Promise<SendResult>;
  // Baixa e armazena (R2 ou public/ local) a midia de uma mensagem recebida.
  // Retorna null se a mensagem nao tem midia ou o download falhar - quem
  // chama deve cair num corpo textual placeholder nesse caso.
  downloadIncomingMedia(
    msg: NormalizedIncomingMessage
  ): Promise<NormalizedMediaResult | null>;
}
