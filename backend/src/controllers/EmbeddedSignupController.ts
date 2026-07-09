import { Request, Response } from "express";
import axios from "axios";
import Whatsapp from "../models/Whatsapp";
import AppError from "../errors/AppError";
import { encrypt } from "../helpers/cryptoHelper";
import { logger } from "../utils/logger";

const GRAPH_API_URL = "https://graph.facebook.com/v20.0";

export const embeddedSignup = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { code, whatsappId, wabaId: wabaIdFromClient, phoneNumberId: phoneNumberIdFromClient } = req.body;
  const { companyId } = req.user;

  if (!code || !whatsappId) throw new AppError("ERR_MISSING_PARAMS");

  const whatsapp = await Whatsapp.findOne({ where: { id: whatsappId, companyId } });
  if (!whatsapp) throw new AppError("ERR_WHATSAPP_NOT_FOUND", 404);

  try {
    // Exchange code for token
    const tokenResponse = await axios.get(`${GRAPH_API_URL}/oauth/access_token`, {
      params: {
        client_id: process.env.META_APP_ID,
        client_secret: process.env.META_APP_SECRET,
        code,
      },
    });

    const accessToken: string = tokenResponse.data.access_token;
    const expiresIn: number = tokenResponse.data.expires_in;

    // O Embedded Signup (com config_id) envia o waba_id exato escolhido pelo
    // usuario via postMessage no frontend. So caimos no /me/businesses (que
    // pega so a primeira conta) se o frontend nao tiver enviado — ex: fluxo
    // antigo sem config_id, ou usuario com uma unica conta.
    let wabaId = wabaIdFromClient;
    let businessName: string | undefined;
    if (!wabaId) {
      const wabaResponse = await axios.get(`${GRAPH_API_URL}/me/businesses`, {
        params: { access_token: accessToken, fields: "id,name" },
      });
      wabaId = wabaResponse.data?.data?.[0]?.id;
      businessName = wabaResponse.data?.data?.[0]?.name;
    }

    // Mesma logica pro numero: usa o phone_number_id exato do postMessage
    // quando disponivel, senao cai no primeiro numero da WABA.
    let phoneNumberId = phoneNumberIdFromClient;
    let phoneNumber: string | undefined;
    let verifiedName: string | undefined;
    if (phoneNumberId) {
      const phoneResponse = await axios.get(`${GRAPH_API_URL}/${phoneNumberId}`, {
        params: { access_token: accessToken, fields: "display_phone_number,verified_name" },
      });
      phoneNumber = phoneResponse.data?.display_phone_number;
      verifiedName = phoneResponse.data?.verified_name || businessName;
    } else {
      const phoneResponse = await axios.get(
        `${GRAPH_API_URL}/${wabaId}/phone_numbers`,
        {
          params: {
            access_token: accessToken,
            fields: "id,display_phone_number,verified_name",
          },
        }
      );
      const phoneData = phoneResponse.data?.data?.[0];
      phoneNumberId = phoneData?.id;
      phoneNumber = phoneData?.display_phone_number;
      verifiedName = phoneData?.verified_name || businessName;
    }

    // Encrypt token before saving — NEVER store plaintext
    const encryptedToken = encrypt(accessToken);
    const tokenExpiresAt = expiresIn
      ? new Date(Date.now() + expiresIn * 1000)
      : null;

    await whatsapp.update({
      providerType: "meta_cloud",
      wabaId,
      phoneNumberId,
      metaAccessToken: encryptedToken,
      tokenExpiresAt,
      migrationStatus: "completed",
      previousProviderType: whatsapp.providerType || "session",
    });

    logger.info(
      `[MetaCloud] Embedded signup OK — empresa ${companyId}, whatsapp ${whatsappId}`
    );

    // Never return token, phoneNumberId, wabaId in response
    return res.json({
      success: true,
      businessName: verifiedName,
      phoneNumber,
      status: "connected",
    });
  } catch (err: any) {
    await whatsapp.update({ migrationStatus: "failed" }).catch(() => {});
    logger.error({ err }, "[MetaCloud] Erro no embedded signup");
    throw new AppError("ERR_META_CLOUD_SIGNUP_FAILED");
  }
};

export const rollback = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { whatsappId } = req.body;
  const { companyId } = req.user;

  const whatsapp = await Whatsapp.findOne({
    where: { id: whatsappId, companyId },
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
  });

  logger.info(
    `[MetaCloud] Rollback OK — empresa ${companyId}, whatsapp ${whatsappId}, revertido para ${prevType}`
  );

  return res.json({ success: true, providerType: prevType });
};
