import axios from "axios";
import cron from "node-cron";
import { Op } from "sequelize";
import Whatsapp from "../../models/Whatsapp";
import AppError from "../../errors/AppError";
import { decrypt } from "../../helpers/cryptoHelper";
import { logger } from "../../utils/logger";
import { sanitizeAxiosError } from "../../helpers/sanitizeAxiosError";
import {
  isMetaCloudProvider,
  META_CLOUD_PROVIDER_TYPES
} from "../../helpers/isMetaCloudProvider";

const GRAPH_API_URL = "https://graph.facebook.com/v20.0";

// Busca a saude real do numero direto na Meta - #031 Fase F. Campos
// confirmados na documentacao oficial (quality_rating e name_status sao
// estaveis; o campo de limite de mensagens foi renomeado pela Meta em 2026
// de messaging_limit_tier pra whatsapp_business_manager_messaging_limit -
// usamos o novo nome).
export const syncWhatsappHealth = async (
  whatsappId: number
): Promise<Whatsapp> => {
  const whatsapp = await Whatsapp.findByPk(whatsappId);
  if (!whatsapp) throw new AppError("ERR_WHATSAPP_NOT_FOUND", 404);
  if (
    !isMetaCloudProvider(whatsapp.providerType) ||
    !whatsapp.metaAccessToken ||
    !whatsapp.phoneNumberId
  ) {
    throw new AppError("ERR_META_CLOUD_NOT_CONFIGURED");
  }

  let token: string;
  try {
    token = decrypt(whatsapp.metaAccessToken);
  } catch {
    throw new AppError("ERR_META_CLOUD_TOKEN_DECRYPT");
  }

  try {
    const response = await axios.get(
      `${GRAPH_API_URL}/${whatsapp.phoneNumberId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          fields: "quality_rating,whatsapp_business_manager_messaging_limit,name_status"
        }
      }
    );

    const {
      quality_rating,
      whatsapp_business_manager_messaging_limit,
      name_status
    } = response.data;

    await whatsapp.update({
      metaQualityRating: quality_rating || whatsapp.metaQualityRating,
      metaMessagingLimit:
        whatsapp_business_manager_messaging_limit || whatsapp.metaMessagingLimit,
      metaNameStatus: name_status || whatsapp.metaNameStatus,
      metaHealthSyncedAt: new Date()
    });

    logger.info(
      `[MetaCloud] Saúde sincronizada — whatsapp ${whatsappId}: quality=${quality_rating}, limit=${whatsapp_business_manager_messaging_limit}, name=${name_status}`
    );

    return whatsapp;
  } catch (err) {
    logger.error(
      { err },
      `[MetaCloud] Erro ao sincronizar saúde do whatsapp ${whatsappId}`
    );
    throw new AppError("ERR_META_CLOUD_HEALTH_SYNC_FAILED");
  }
};

// Re-sincroniza todos os numeros de uma mesma WABA - usado quando um
// webhook de conta (business_capability_update, phone_number_quality_update
// etc) chega sem trazer todos os detalhes que precisamos: em vez de tentar
// adivinhar o formato exato do payload (que varia e nao e totalmente
// documentado), tratamos o webhook so como um gatilho e buscamos o estado
// atual direto na Meta - fonte da verdade mais confiavel.
export const resyncWabaHealth = async (wabaId: string): Promise<void> => {
  const whatsapps = await Whatsapp.findAll({
    where: { wabaId, providerType: { [Op.in]: META_CLOUD_PROVIDER_TYPES } }
  });

  for (const wa of whatsapps) {
    try {
      await syncWhatsappHealth(wa.id);
    } catch (err) {
      logger.error(
        { err },
        `[MetaCloud] Erro ao re-sincronizar saúde de ${wa.id} após webhook de conta`
      );
    }
  }
};

// Sincroniza todos os numeros Cloud API de todas as empresas - usado pelo
// cron periodico (a Meta reavalia a qualidade a cada 6h, entao rodar a
// cada poucas horas e suficiente pra nao perder mudancas por muito tempo).
export const syncAllWhatsappsHealth = async (): Promise<void> => {
  const whatsapps = await Whatsapp.findAll({
    where: { providerType: { [Op.in]: META_CLOUD_PROVIDER_TYPES } }
  });

  for (const wa of whatsapps) {
    try {
      await syncWhatsappHealth(wa.id);
    } catch (err) {
      logger.error(
        { err },
        `[MetaCloud] Erro no sync periódico de saúde do whatsapp ${wa.id}`
      );
    }
  }
};

// A cada 2 horas - a Meta reavalia a qualidade a cada 6h, entao esse
// intervalo pega mudanca sem perder muito tempo, sem sobrecarregar a Graph
// API. Roda automaticamente assim que este modulo e carregado (mesmo
// padrao usado no cron de limpeza do dapleShield.service.ts).
cron.schedule("0 */2 * * *", async () => {
  try {
    await syncAllWhatsappsHealth();
  } catch (err) {
    logger.error({ err: sanitizeAxiosError(err) }, "[MetaCloud] Sync periódico de saúde falhou");
  }
});
