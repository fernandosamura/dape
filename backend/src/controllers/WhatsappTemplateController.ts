import { Request, Response } from "express";
import WhatsappTemplate from "../models/WhatsappTemplate";
import AppError from "../errors/AppError";
import { syncWhatsappTemplates } from "../services/MetaCloudServices/SyncWhatsappTemplatesService";

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
