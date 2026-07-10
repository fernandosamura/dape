import { Request, Response } from "express";
import WhatsappTemplate from "../models/WhatsappTemplate";
import Whatsapp from "../models/Whatsapp";
import AppError from "../errors/AppError";
import { syncWhatsappTemplates } from "../services/MetaCloudServices/SyncWhatsappTemplatesService";
import SendMetaCloudTemplate from "../services/MetaCloudServices/SendMetaCloudTemplate";

export const sync = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const { companyId } = req.user;

  const templates = await syncWhatsappTemplates(
    parseInt(whatsappId, 10),
    companyId
  );

  return res.json(templates);
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const { companyId } = req.user;
  const { status } = req.query;

  if (!whatsappId) throw new AppError("ERR_MISSING_PARAMS");

  const where: Record<string, unknown> = {
    whatsappId: parseInt(whatsappId, 10),
    companyId
  };
  if (status) where.status = status;

  const templates = await WhatsappTemplate.findAll({
    where,
    order: [["name", "ASC"]]
  });

  return res.json(templates);
};

// Envio avulso (teste manual pra um numero qualquer) - usado pela tela de
// gestao de Modelos, diferente do envio dentro de um ticket (que passa pelo
// TicketController.sendTemplate e persiste no historico da conversa).
export const send = async (req: Request, res: Response): Promise<Response> => {
  const { templateId } = req.params;
  const { to, bodyParams, headerMediaUrl } = req.body;
  const { companyId } = req.user;

  if (!to) throw new AppError("ERR_META_CLOUD_TEMPLATE_MISSING_RECIPIENT");

  const template = await WhatsappTemplate.findOne({
    where: { id: parseInt(templateId, 10), companyId }
  });
  if (!template) throw new AppError("ERR_TEMPLATE_NOT_FOUND", 404);
  if (template.status !== "APPROVED") {
    throw new AppError("ERR_META_CLOUD_TEMPLATE_NOT_APPROVED");
  }

  const whatsapp = await Whatsapp.findOne({
    where: { id: template.whatsappId, companyId }
  });
  if (!whatsapp) throw new AppError("ERR_WHATSAPP_NOT_FOUND", 404);

  const result = await SendMetaCloudTemplate({
    whatsapp,
    to: String(to).replace(/\D/g, ""),
    template,
    bodyParams,
    headerMediaUrl
  });

  return res.json(result);
};
