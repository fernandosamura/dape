import { Request, Response } from "express";
import crypto from "crypto";
import { processMetaCloudWebhook } from "../services/MetaCloudServices/MetaCloudWebhookService";
import { logger } from "../utils/logger";

export const verifyWebhook = (req: Request, res: Response): void => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
};

export const receiveWebhook = async (
  req: Request,
  res: Response
): Promise<Response> => {
  // Verify X-Hub-Signature-256
  const signature = req.headers["x-hub-signature-256"] as string;
  if (signature && process.env.META_APP_SECRET) {
    const expectedSig =
      "sha256=" +
      crypto
        .createHmac("sha256", process.env.META_APP_SECRET)
        .update(JSON.stringify(req.body))
        .digest("hex");
    if (signature !== expectedSig) {
      logger.warn("[MetaCloud] Webhook signature inválida");
      return res.sendStatus(401);
    }
  }

  // Respond immediately (Meta requires fast response)
  res.sendStatus(200);

  // Process asynchronously
  processMetaCloudWebhook(req.body).catch(err =>
    logger.error({ err }, "[MetaCloud] Erro no webhook")
  );

  return res;
};
