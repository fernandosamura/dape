import { Request, Response } from "express";
import Whatsapp from "../models/Whatsapp";
import AppError from "../errors/AppError";
import { encrypt } from "../helpers/cryptoHelper";
import { logger } from "../utils/logger";
import {
  exchangeCodeForToken,
  resolveWaba,
  resolvePhoneNumber,
  subscribeWebhookApp,
  fetchPhoneNumberCoexistenceInfo
} from "../services/MetaCloudServices/MetaCloudSignupShared";

// Fluxo de onboarding NOVO e SEPARADO para WhatsApp Business App
// Coexistence - config_id 2305329230296796 (coexistencedaple), distinto do
// fluxo Cloud API tradicional (config_id 917113721410373, aprovado pela
// Meta). Nao reutiliza EmbeddedSignupController.ts - so os helpers
// genericos de MetaCloudSignupShared.ts, pra nao criar nenhum acoplamento
// com o controller ja aprovado.
export const coexistenceSignup = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const {
    code,
    whatsappId,
    wabaId: wabaIdFromClient,
    phoneNumberId: phoneNumberIdFromClient
  } = req.body;
  const { companyId } = req.user;

  if (!code || !whatsappId) throw new AppError("ERR_MISSING_PARAMS");

  const whatsapp = await Whatsapp.findOne({
    where: { id: whatsappId, companyId }
  });
  if (!whatsapp) throw new AppError("ERR_WHATSAPP_NOT_FOUND", 404);

  try {
    const { accessToken, expiresIn } = await exchangeCodeForToken(code);

    const { wabaId, businessName } = await resolveWaba(
      accessToken,
      wabaIdFromClient
    );

    const { phoneNumberId, phoneNumber, verifiedName } =
      await resolvePhoneNumber(
        accessToken,
        wabaId,
        phoneNumberIdFromClient,
        businessName
      );

    await subscribeWebhookApp(accessToken, wabaId, "[Coexistence]");

    const { isOnBizApp, platformType } = await fetchPhoneNumberCoexistenceInfo(
      accessToken,
      phoneNumberId
    );

    const encryptedToken = encrypt(accessToken);
    const tokenExpiresAt = expiresIn
      ? new Date(Date.now() + expiresIn * 1000)
      : null;

    await whatsapp.update({
      providerType: "meta_cloud_coexistence",
      wabaId,
      phoneNumberId,
      metaAccessToken: encryptedToken,
      tokenExpiresAt,
      migrationStatus: "completed",
      previousProviderType: whatsapp.providerType || "session",
      status: "CONNECTED",
      isOnBizApp,
      platformType
    });

    logger.info(
      `[Coexistence] Signup OK — empresa ${companyId}, whatsapp ${whatsappId}, isOnBizApp=${isOnBizApp}, platformType=${platformType}`
    );

    // Nunca retorna token/wabaId/phoneNumberId - mesmo padrao do fluxo
    // tradicional.
    return res.json({
      success: true,
      businessName: verifiedName,
      phoneNumber,
      status: "connected",
      connectionMode: "coexistence"
    });
  } catch (err: any) {
    await whatsapp.update({ migrationStatus: "failed" }).catch(() => {});
    logger.error({ err }, "[Coexistence] Erro no signup");
    throw new AppError("ERR_META_CLOUD_SIGNUP_FAILED");
  }
};

// Rollback especifico de Coexistence - reaproveita a mesma logica generica
// do fluxo tradicional (reverter pra previousProviderType, limpar
// credenciais), mas ADICIONALMENTE limpa isOnBizApp/platformType, que sao
// exclusivos de Coexistence e nao existiam quando o rollback generico foi
// escrito. Nao chama/importa o rollback do EmbeddedSignupController.ts (que
// e um handler Express completo, nao uma funcao utilitaria) - reimplementa
// a mesma logica curta aqui, evitando qualquer acoplamento com o fluxo
// aprovado.
export const coexistenceRollback = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { whatsappId } = req.body;
  const { companyId } = req.user;

  const whatsapp = await Whatsapp.findOne({
    where: { id: whatsappId, companyId }
  });
  if (!whatsapp) throw new AppError("ERR_WHATSAPP_NOT_FOUND", 404);

  const prevType = whatsapp.previousProviderType || "session";

  await whatsapp.update({
    providerType: prevType,
    metaAccessToken: null,
    wabaId: null,
    phoneNumberId: null,
    tokenExpiresAt: null,
    migrationStatus: "none",
    previousProviderType: null,
    status: "DISCONNECTED",
    isOnBizApp: null,
    platformType: null
  });

  logger.info(
    `[Coexistence] Rollback OK — empresa ${companyId}, whatsapp ${whatsappId}, revertido para ${prevType}`
  );

  return res.json({ success: true, providerType: prevType });
};
