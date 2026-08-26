import axios from "axios";
import { logger } from "../../utils/logger";

const GRAPH_API_URL = "https://graph.facebook.com/v20.0";

// Helpers reutilizaveis pra qualquer fluxo de Embedded Signup da Meta
// (troca code->token, resolucao de WABA/phone, subscribed_apps). Extraidos
// como funcoes NOVAS e independentes - o EmbeddedSignupController.ts do
// fluxo Cloud API tradicional (ja aprovado pela Meta) continua com seu
// proprio codigo inline intocado, sem depender destes helpers. So o novo
// CoexistenceSignupController usa isto, para nao criar nenhum acoplamento
// entre o fluxo aprovado e o novo.

export interface TokenExchangeResult {
  accessToken: string;
  expiresIn: number;
}

// Troca o "code" do OAuth por um access token - chamada HTTP pura, sem
// nenhum side-effect no banco.
export const exchangeCodeForToken = async (
  code: string
): Promise<TokenExchangeResult> => {
  const tokenResponse = await axios.get(`${GRAPH_API_URL}/oauth/access_token`, {
    params: {
      client_id: process.env.META_APP_ID,
      client_secret: process.env.META_APP_SECRET,
      code
    }
  });

  return {
    accessToken: tokenResponse.data.access_token,
    expiresIn: tokenResponse.data.expires_in
  };
};

export interface WabaResolution {
  wabaId: string;
  businessName?: string;
}

// Resolve a WABA: usa a que veio do postMessage do frontend quando
// disponivel, senao cai em /me/businesses (primeira conta encontrada).
export const resolveWaba = async (
  accessToken: string,
  wabaIdFromClient?: string | null
): Promise<WabaResolution> => {
  if (wabaIdFromClient) {
    return { wabaId: wabaIdFromClient };
  }

  const wabaResponse = await axios.get(`${GRAPH_API_URL}/me/businesses`, {
    params: { access_token: accessToken, fields: "id,name" }
  });

  return {
    wabaId: wabaResponse.data?.data?.[0]?.id,
    businessName: wabaResponse.data?.data?.[0]?.name
  };
};

export interface PhoneNumberResolution {
  phoneNumberId: string;
  phoneNumber?: string;
  verifiedName?: string;
}

// Resolve o Phone Number ID: usa o que veio do postMessage do frontend
// quando disponivel (busca so os detalhes), senao cai no primeiro numero
// da WABA.
export const resolvePhoneNumber = async (
  accessToken: string,
  wabaId: string,
  phoneNumberIdFromClient: string | null | undefined,
  fallbackBusinessName?: string
): Promise<PhoneNumberResolution> => {
  if (phoneNumberIdFromClient) {
    const phoneResponse = await axios.get(
      `${GRAPH_API_URL}/${phoneNumberIdFromClient}`,
      {
        params: {
          access_token: accessToken,
          fields: "display_phone_number,verified_name"
        }
      }
    );
    return {
      phoneNumberId: phoneNumberIdFromClient,
      phoneNumber: phoneResponse.data?.display_phone_number,
      verifiedName: phoneResponse.data?.verified_name || fallbackBusinessName
    };
  }

  const phoneResponse = await axios.get(
    `${GRAPH_API_URL}/${wabaId}/phone_numbers`,
    {
      params: {
        access_token: accessToken,
        fields: "id,display_phone_number,verified_name"
      }
    }
  );
  const phoneData = phoneResponse.data?.data?.[0];
  return {
    phoneNumberId: phoneData?.id,
    phoneNumber: phoneData?.display_phone_number,
    verifiedName: phoneData?.verified_name || fallbackBusinessName
  };
};

// Assina o app nos eventos de webhook da WABA - sem isso, mensagens
// recebidas nunca chegam. Nao lanca erro pro chamador (loga e segue) -
// mesmo comportamento tolerante que o fluxo tradicional ja usa.
export const subscribeWebhookApp = async (
  accessToken: string,
  wabaId: string,
  logPrefix: string
): Promise<void> => {
  try {
    await axios.post(`${GRAPH_API_URL}/${wabaId}/subscribed_apps`, null, {
      params: { access_token: accessToken }
    });
  } catch (subErr: any) {
    logger.error(
      { subErr },
      `${logPrefix} Falha ao assinar webhook da WABA ${wabaId} — mensagens recebidas nao vao chegar ate isso ser corrigido manualmente`
    );
  }
};

export interface PhoneNumberCoexistenceInfo {
  isOnBizApp: boolean | null;
  platformType: string | null;
}

// Consulta os campos especificos de Coexistence no Phone Number - a propria
// Meta confirma is_on_biz_app/platform_type depois do onboarding. Se a
// consulta falhar, retorna null nos dois campos (nao bloqueia o signup por
// isso - o dado fica pra ser re-sincronizado depois).
export const fetchPhoneNumberCoexistenceInfo = async (
  accessToken: string,
  phoneNumberId: string
): Promise<PhoneNumberCoexistenceInfo> => {
  try {
    const response = await axios.get(`${GRAPH_API_URL}/${phoneNumberId}`, {
      params: {
        access_token: accessToken,
        fields: "is_on_biz_app,platform_type"
      }
    });
    return {
      isOnBizApp:
        typeof response.data?.is_on_biz_app === "boolean"
          ? response.data.is_on_biz_app
          : null,
      platformType: response.data?.platform_type || null
    };
  } catch (err) {
    logger.warn(
      { err },
      `[Coexistence] Nao foi possivel consultar is_on_biz_app/platform_type do phone ${phoneNumberId} - seguindo sem esse dado`
    );
    return { isOnBizApp: null, platformType: null };
  }
};
