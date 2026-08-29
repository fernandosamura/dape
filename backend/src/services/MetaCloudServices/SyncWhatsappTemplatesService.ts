import axios from "axios";
import Whatsapp from "../../models/Whatsapp";
import WhatsappTemplate from "../../models/WhatsappTemplate";
import AppError from "../../errors/AppError";
import { decrypt } from "../../helpers/cryptoHelper";
import { logger } from "../../utils/logger";
import { isMetaCloudProvider } from "../../helpers/isMetaCloudProvider";
import { sanitizeAxiosError } from "../../helpers/sanitizeAxiosError";

const GRAPH_API_URL = "https://graph.facebook.com/v20.0";

interface MetaTemplateComponent {
  type: string;
  format?: string;
  text?: string;
  buttons?: unknown[];
}

interface MetaTemplate {
  id: string;
  name: string;
  language: string;
  category: string;
  status: string;
  components: MetaTemplateComponent[];
}

const extractBodyText = (components: MetaTemplateComponent[]): string => {
  const body = components?.find(c => c.type === "BODY");
  return body?.text || "";
};

// Busca os templates cadastrados na Meta (normalmente criados direto no
// WhatsApp Manager) e sincroniza no banco local - #031 Fase E. Idempotente:
// pode ser chamado quantas vezes for preciso pra atualizar status/conteudo.
export const syncWhatsappTemplates = async (
  whatsappId: number,
  companyId: number
): Promise<WhatsappTemplate[]> => {
  const whatsapp = await Whatsapp.findOne({
    where: { id: whatsappId, companyId }
  });
  if (!whatsapp) throw new AppError("ERR_WHATSAPP_NOT_FOUND", 404);
  if (
    !isMetaCloudProvider(whatsapp.providerType) ||
    !whatsapp.metaAccessToken ||
    !whatsapp.wabaId
  ) {
    throw new AppError("ERR_META_CLOUD_NOT_CONFIGURED");
  }

  let token: string;
  try {
    token = decrypt(whatsapp.metaAccessToken);
  } catch {
    throw new AppError("ERR_META_CLOUD_TOKEN_DECRYPT");
  }

  let templates: MetaTemplate[];
  try {
    const response = await axios.get(
      `${GRAPH_API_URL}/${whatsapp.wabaId}/message_templates`,
      {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          fields: "id,name,language,category,status,components",
          limit: 100
        }
      }
    );
    templates = response.data?.data || [];
  } catch (err) {
    logger.error({ err: sanitizeAxiosError(err) }, "[MetaCloud] Erro ao buscar templates na Meta");
    throw new AppError("ERR_META_CLOUD_TEMPLATE_SYNC_FAILED");
  }

  for (const t of templates) {
    const [record] = await WhatsappTemplate.findOrCreate({
      where: { whatsappId, metaTemplateId: t.id },
      defaults: {
        companyId,
        whatsappId,
        metaTemplateId: t.id,
        name: t.name,
        language: t.language,
        category: t.category,
        status: t.status,
        bodyText: extractBodyText(t.components),
        components: t.components
      } as WhatsappTemplate
    });

    await record.update({
      name: t.name,
      language: t.language,
      category: t.category,
      status: t.status,
      bodyText: extractBodyText(t.components),
      components: t.components
    });
  }

  logger.info(
    `[MetaCloud] Sincronizados ${templates.length} templates para whatsapp ${whatsappId}`
  );

  return WhatsappTemplate.findAll({
    where: { whatsappId, companyId },
    order: [["name", "ASC"]]
  });
};

export default syncWhatsappTemplates;
