import https from "https";
import http from "http";
import { URL } from "url";

/**
 * Cliente HTTP para a API do Asaas.
 * Usa o módulo nativo `https` do Node.js — sem dependências externas.
 *
 * Variáveis de ambiente:
 *   ASAAS_API_KEY   — chave de API do Asaas (obrigatória)
 *   ASAAS_ENV       — "sandbox" para homologação, qualquer outro valor = produção
 */

const ASAAS_BASE_URL =
  process.env.ASAAS_ENV === "sandbox"
    ? "https://sandbox.asaas.com/api/v3"
    : "https://api.asaas.com/v3";

// ─── Helper HTTP ──────────────────────────────────────────────────────────────

function asaasRequest<T = any>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  body?: object
): Promise<T> {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.ASAAS_API_KEY;
    if (!apiKey) {
      return reject(new Error("[DAPLE Billing] ASAAS_API_KEY não configurada no ambiente."));
    }

    const url = new URL(`${ASAAS_BASE_URL}${path}`);
    const bodyStr = body ? JSON.stringify(body) : undefined;

    const options: https.RequestOptions = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        "access_token": apiKey,
        "Content-Type": "application/json",
        "Accept": "application/json",
        ...(bodyStr ? { "Content-Length": Buffer.byteLength(bodyStr) } : {}),
      },
      timeout: 15000,
    };

    const transport = url.protocol === "https:" ? https : http;

    const req = transport.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          if (res.statusCode && res.statusCode >= 400) {
            const errMsg = (parsed as any)?.errors?.[0]?.description || `HTTP ${res.statusCode}`;
            reject(new Error(`[DAPLE Billing Asaas] ${errMsg}`));
          } else {
            resolve(parsed as T);
          }
        } catch (e) {
          reject(new Error(`[DAPLE Billing Asaas] Resposta inválida: ${data}`));
        }
      });
    });

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("[DAPLE Billing Asaas] Timeout na requisição"));
    });

    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ─── Tipos básicos do Asaas ───────────────────────────────────────────────────

export interface AsaasCustomer {
  id: string;
  name: string;
  email: string;
  cpfCnpj?: string;
  phone?: string;
}

export interface AsaasSubscription {
  id: string;
  customer: string;
  billingType: "CREDIT_CARD" | "PIX" | "BOLETO";
  value: number;
  nextDueDate: string;
  cycle: "MONTHLY";
  status: string;
  externalReference?: string;
}

export interface AsaasPayment {
  id: string;
  subscription?: string;
  status: string;
  value: number;
  netValue?: number;
  billingType: string;
  dueDate: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  pixQrCodeId?: string;
  pixCopiaECola?: string;
  confirmedDate?: string;
  paymentDate?: string;
}

// ─── Funções de Customer ──────────────────────────────────────────────────────

export async function createAsaasCustomer(data: {
  name: string;
  email: string;
  cpfCnpj?: string;
  phone?: string;
  externalReference?: string;
}): Promise<AsaasCustomer> {
  return asaasRequest<AsaasCustomer>("POST", "/customers", {
    name: data.name,
    email: data.email,
    cpfCnpj: data.cpfCnpj || undefined,
    phone: data.phone || undefined,
    externalReference: data.externalReference || undefined,
  });
}

export async function findAsaasCustomerByEmail(email: string): Promise<AsaasCustomer | null> {
  const result = await asaasRequest<{ data: AsaasCustomer[] }>(
    "GET",
    `/customers?email=${encodeURIComponent(email)}&limit=1`
  );
  return result?.data?.length > 0 ? result.data[0] : null;
}

// ─── Funções de Subscription ──────────────────────────────────────────────────

export async function createAsaasSubscription(data: {
  customerId: string;
  billingType: "CREDIT_CARD" | "PIX" | "BOLETO";
  value: number;
  nextDueDate: string;
  description?: string;
  externalReference?: string;
}): Promise<AsaasSubscription> {
  return asaasRequest<AsaasSubscription>("POST", "/subscriptions", {
    customer: data.customerId,
    billingType: data.billingType,
    value: data.value,
    nextDueDate: data.nextDueDate,
    cycle: "MONTHLY",
    description: data.description || "Assinatura DAPLE",
    externalReference: data.externalReference || undefined,
  });
}

export async function updateAsaasSubscriptionValue(
  asaasSubscriptionId: string,
  newValue: number
): Promise<AsaasSubscription> {
  return asaasRequest<AsaasSubscription>("PUT", `/subscriptions/${asaasSubscriptionId}`, {
    value: newValue,
  });
}

export async function cancelAsaasSubscription(asaasSubscriptionId: string): Promise<void> {
  await asaasRequest("DELETE", `/subscriptions/${asaasSubscriptionId}`);
}

// ─── Funções de Payment ───────────────────────────────────────────────────────

export async function getAsaasPayment(asaasPaymentId: string): Promise<AsaasPayment> {
  return asaasRequest<AsaasPayment>("GET", `/payments/${asaasPaymentId}`);
}

export async function getSubscriptionPayments(
  asaasSubscriptionId: string,
  status?: string
): Promise<AsaasPayment[]> {
  const qs = `subscription=${asaasSubscriptionId}&limit=10${status ? `&status=${status}` : ""}`;
  const result = await asaasRequest<{ data: AsaasPayment[] }>("GET", `/payments?${qs}`);
  return result?.data || [];
}

export async function getPixQrCode(
  asaasPaymentId: string
): Promise<{ encodedImage: string; payload: string }> {
  return asaasRequest("GET", `/payments/${asaasPaymentId}/pixQrCode`);
}
