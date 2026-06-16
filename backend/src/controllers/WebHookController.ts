import { Request, Response } from "express";
import Whatsapp from "../models/Whatsapp";
import { handleMessage } from "../services/FacebookServices/FacebookMessageListener";
import { logger } from "../utils/logger";

export const index = async (req: Request, res: Response): Promise<Response> => {
  const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "dape_webhook_2024";

  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token) {
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      logger.info(`[Webhook] Verified successfully`);
      return res.status(200).send(challenge);
    }
  }

  return res.status(403).json({ message: "Forbidden" });
};

export const webHook = async (
  req: Request,
  res: Response
): Promise<Response> => {
  // Must respond 200 immediately to Meta
  res.status(200).json({ message: "EVENT_RECEIVED" });

  try {
    const { body } = req;

    if (body.object === "page" || body.object === "instagram") {
      const channel = body.object === "page" ? "facebook" : "instagram";

      const entries: any[] = body.entry || [];

      for (const entry of entries) {
        const pageId = entry.id;

        const whatsapp = await Whatsapp.findOne({
          where: { facebookPageUserId: pageId, channel }
        });

        if (!whatsapp) {
          logger.warn(`[Webhook] No connection found for pageId=${pageId} channel=${channel}`);
          continue;
        }

        const messagingEvents: any[] = entry.messaging || [];

        for (const messaging of messagingEvents) {
          await handleMessage(whatsapp, messaging, channel, whatsapp.companyId);
        }
      }
    }
  } catch (error) {
    logger.error(`[WebHookController] Error processing webhook: ${error}`);
  }

  return; // already sent response above
};
