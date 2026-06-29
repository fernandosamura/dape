import Whatsapp from "../../models/Whatsapp";
import { logger } from "../../utils/logger";
import { getIO } from "../../libs/socket";

interface MetaCloudWebhookEntry {
  id: string;
  changes: Array<{
    value: {
      messaging_product: string;
      metadata: { display_phone_number: string; phone_number_id: string };
      contacts?: Array<{ profile: { name: string }; wa_id: string }>;
      messages?: Array<{
        from: string;
        id: string;
        timestamp: string;
        type: string;
        text?: { body: string };
        image?: { id: string; mime_type: string; sha256: string };
        audio?: { id: string; mime_type: string };
        document?: { id: string; filename: string; mime_type: string };
      }>;
      statuses?: Array<{
        id: string;
        status: string;
        timestamp: string;
        recipient_id: string;
      }>;
    };
    field: string;
  }>;
}

export const processMetaCloudWebhook = async (body: {
  entry?: MetaCloudWebhookEntry[];
}): Promise<void> => {
  try {
    if (!body.entry || !Array.isArray(body.entry)) return;

    for (const entry of body.entry) {
      for (const change of entry.changes || []) {
        if (change.field !== "messages") continue;
        const value = change.value;
        const phoneNumberId = value?.metadata?.phone_number_id;
        if (!phoneNumberId) continue;

        const whatsapp = await Whatsapp.findOne({ where: { phoneNumberId } });
        if (!whatsapp) {
          logger.warn(
            `[MetaCloud] Webhook: conexão não encontrada para phoneNumberId=${phoneNumberId}`
          );
          continue;
        }

        // Process incoming messages
        if (value.messages) {
          for (const msg of value.messages) {
            try {
              logger.info(
                `[MetaCloud] Mensagem recebida de ${msg.from} — tipo: ${msg.type}`
              );
              // Emit socket event for real-time notification
              const io = getIO();
              io.to(`company-${whatsapp.companyId}-mainchannel`).emit(
                `company-${whatsapp.companyId}-ticket`,
                {
                  action: "update",
                  ticket: {
                    whatsappId: whatsapp.id,
                    lastMessage: msg.text?.body || `[${msg.type}]`,
                  },
                }
              );
            } catch (msgErr) {
              logger.error(
                { msgErr },
                `[MetaCloud] Erro ao processar mensagem ${msg.id}`
              );
            }
          }
        }

        // Process status updates
        if (value.statuses) {
          for (const status of value.statuses) {
            const ackMap: Record<string, number> = {
              sent: 1,
              delivered: 2,
              read: 3,
              failed: -1,
            };
            const ack = ackMap[status.status];
            if (ack !== undefined) {
              logger.info(
                `[MetaCloud] Status ${status.status} para mensagem ${status.id}`
              );
            }
          }
        }
      }
    }
  } catch (err) {
    logger.error({ err }, "[MetaCloud] Erro ao processar webhook");
  }
};
