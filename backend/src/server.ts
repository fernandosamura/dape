import gracefulShutdown from "http-graceful-shutdown";
import pLimit from "p-limit";
import app from "./app";
import { initIO } from "./libs/socket";
import { logger } from "./utils/logger";
import { StartAllWhatsAppsSessions } from "./services/WbotServices/StartAllWhatsAppsSessions";
import Company from "./models/Company";
import { startQueueProcess } from "./queues";
import { TransferTicketQueue } from "./wbotTransferTicketQueue";
import cron from "node-cron";
import { startAnalyticsCron } from "./dape/analytics/dapeAnalytics.cron";
import { startDapeAutomation } from "./dape/dapeAutomation.cron";
import { startBillingCrons } from "./dape/billing/billing.cron";

const BOOT_TIMEOUT_MS = 60_000;

const server = app.listen(process.env.PORT, async () => {
  try {
    const companies = await Company.findAll();
    const limit = pLimit(5);
    const allPromises = companies.map(c =>
      limit(() =>
        StartAllWhatsAppsSessions(c.id).catch(err =>
          logger.error({ err }, `Failed to start sessions for company ${c.id}`)
        )
      )
    );

    await Promise.race([
      Promise.all(allPromises),
      new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error("WhatsApp boot timeout (60s)")), BOOT_TIMEOUT_MS)
      )
    ]).catch(err => logger.warn({ err }, "Boot WA sessions did not complete within timeout"));

    startQueueProcess();
  } catch (err) {
    logger.error({ err }, "Critical error during server initialization");
  }
  logger.info(`Server started on port: ${process.env.PORT}`);
});

cron.schedule("* * * * *", async () => {
  try {
    logger.info("Servico de transferencia de tickets iniciado");
    await TransferTicketQueue();
  }
  catch (error) {
    logger.error(error);
  }
});

startAnalyticsCron();
startDapeAutomation();
startBillingCrons();
initIO(server);
gracefulShutdown(server);
