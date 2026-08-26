import { QueryTypes } from "sequelize";
import crypto from "crypto";
import sequelize from "../../database";
import Whatsapp from "../../models/Whatsapp";
import { logger } from "../../utils/logger";

// Camada de OBSERVACAO dos webhooks de Coexistence (history,
// smb_app_state_sync, smb_message_echoes) - fase inicial: reconhecer,
// identificar a conexao, deduplicar e registrar metadata tecnica minima.
// NAO cria Message/Ticket, NAO dispara IA/automacao, NAO renova janela de
// 24h - integracao com o motor de negocio real fica pra uma fase futura,
// com nova autorizacao.

export type CoexistenceEventType =
  | "history"
  | "smb_app_state_sync"
  | "smb_message_echoes";

interface ObserveParams {
  wabaId: string;
  eventType: CoexistenceEventType;
  rawValue: unknown;
}

// ALLOWLIST explicita de campos tecnicos seguros - constroi payloadMeta
// CAMPO A CAMPO a partir do payload bruto, nunca salva o payload inteiro.
// Proibido por regra: corpo/texto de mensagem, midia, token, authorization
// code, CPF/CNPJ, nome ou telefone do contato. So o estritamente
// necessario pra identificar o evento, deduplicar e diagnosticar.
const buildPayloadMeta = (
  eventType: CoexistenceEventType,
  rawValue: any
): Record<string, unknown> => {
  const meta: Record<string, unknown> = {};

  if (typeof rawValue?.messaging_product === "string") {
    meta.messagingProduct = rawValue.messaging_product;
  }
  if (typeof rawValue?.metadata?.phone_number_id === "string") {
    meta.phoneNumberId = rawValue.metadata.phone_number_id;
  }

  if (eventType === "smb_message_echoes") {
    // So o TIPO da mensagem (image/text/audio/...) e timestamp - nunca o
    // corpo/legenda/midia em si.
    const echo = rawValue?.message ?? rawValue?.messages?.[0];
    if (typeof echo?.type === "string") meta.messageType = echo.type;
    if (typeof echo?.timestamp === "string") meta.timestamp = echo.timestamp;
  }

  if (eventType === "history") {
    // PRECISA SER VALIDADO com payload real - por ora so registra que o
    // evento chegou, sem assumir estrutura de conteudo.
    if (typeof rawValue?.type === "string") meta.historyType = rawValue.type;
  }

  if (eventType === "smb_app_state_sync") {
    // PRECISA SER VALIDADO com payload real.
    if (typeof rawValue?.type === "string") meta.syncType = rawValue.type;
  }

  return meta;
};

// Extrai um identificador oficial do evento quando disponivel. A doc da
// Meta nao confirma com certeza absoluta o campo exato pra cada um dos 3
// eventos - por isso tenta os candidatos mais prováveis e cai num fallback
// deterministico (hash do payload bruto, nunca persistido) quando nenhum
// for encontrado. O algoritmo do fallback fica sujeito a revisao assim que
// os primeiros payloads reais forem observados (registrar como pendencia,
// nao presumir que esta correto).
const extractDedupKey = (
  rawValue: any
): { externalEventId: string | null; dedupKey: string } => {
  const officialId =
    rawValue?.id ??
    rawValue?.message_id ??
    rawValue?.message?.id ??
    rawValue?.messages?.[0]?.id ??
    null;

  if (officialId) {
    return { externalEventId: String(officialId), dedupKey: String(officialId) };
  }

  const hash = crypto
    .createHash("sha256")
    .update(JSON.stringify(rawValue ?? {}))
    .digest("hex");
  return { externalEventId: null, dedupKey: `fallback:${hash}` };
};

export const observeCoexistenceEvent = async ({
  wabaId,
  eventType,
  rawValue
}: ObserveParams): Promise<void> => {
  // So processa pra conexoes Coexistence de verdade - nunca confia em
  // nenhum campo do payload externo pra decidir isolamento multi-tenant.
  // companyId sempre vem da conexao encontrada no NOSSO banco (Whatsapp),
  // nunca de qualquer dado recebido da Meta.
  const whatsapp = await Whatsapp.findOne({
    where: { wabaId, providerType: "meta_cloud_coexistence" }
  });

  if (!whatsapp) {
    logger.warn(
      `[Coexistence] Evento ${eventType} recebido pra WABA ${wabaId} sem conexão Coexistence correspondente — ignorado`
    );
    return;
  }

  const { externalEventId, dedupKey } = extractDedupKey(rawValue);
  const payloadMeta = buildPayloadMeta(eventType, rawValue);

  try {
    await sequelize.query(
      `INSERT INTO dape_coexistence_events
         ("companyId", "whatsappId", "eventType", "externalEventId", "dedupKey", "payloadMeta", "createdAt")
       VALUES (:companyId, :whatsappId, :eventType, :externalEventId, :dedupKey, :payloadMeta, NOW())
       ON CONFLICT ("whatsappId", "eventType", "dedupKey") DO NOTHING`,
      {
        replacements: {
          companyId: whatsapp.companyId,
          whatsappId: whatsapp.id,
          eventType,
          externalEventId,
          dedupKey,
          payloadMeta: JSON.stringify(payloadMeta)
        },
        type: QueryTypes.INSERT
      }
    );
    logger.info(
      `[Coexistence] Evento observado: ${eventType} whatsapp=${whatsapp.id} dedupKey=${dedupKey}`
    );
  } catch (err) {
    logger.error(
      { err },
      `[Coexistence] Erro ao registrar evento observacional ${eventType}`
    );
  }
};
