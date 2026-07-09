import { Request, Response } from "express";
import Whatsapp from "../models/Whatsapp";
import AppError from "../errors/AppError";
import { syncWhatsappHealth } from "../services/MetaCloudServices/SyncWhatsappHealthService";

export const sync = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const { companyId } = req.user;

  const whatsapp = await Whatsapp.findOne({
    where: { id: whatsappId, companyId }
  });
  if (!whatsapp) throw new AppError("ERR_WHATSAPP_NOT_FOUND", 404);

  const updated = await syncWhatsappHealth(parseInt(whatsappId, 10));

  return res.json({
    metaQualityRating: updated.metaQualityRating,
    metaMessagingLimit: updated.metaMessagingLimit,
    metaNameStatus: updated.metaNameStatus,
    metaHealthSyncedAt: updated.metaHealthSyncedAt
  });
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const { companyId } = req.user;

  const whatsapp = await Whatsapp.findOne({
    where: { id: whatsappId, companyId },
    attributes: [
      "id",
      "name",
      "providerType",
      "metaQualityRating",
      "metaMessagingLimit",
      "metaNameStatus",
      "metaHealthSyncedAt"
    ]
  });
  if (!whatsapp) throw new AppError("ERR_WHATSAPP_NOT_FOUND", 404);

  return res.json(whatsapp);
};
