import gracefulShutdown from "http-graceful-shutdown";
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

const server = app.listen(process.env.PORT, async () => {
  try {
    const companies = await Company.findAll();
    const allPromises = companies.map(c =>
      StartAllWhatsAppsSessions(c.id).catch(err =>
        logger.error({ err }, `Failed to start sessions for company ${c.id}`)
      )
    );
    await Promise.all(allPromises);
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
