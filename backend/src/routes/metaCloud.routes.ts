import { Router } from "express";
import isAuth from "../middleware/isAuth";
import { embeddedSignup, rollback } from "../controllers/EmbeddedSignupController";
import { verifyWebhook, receiveWebhook } from "../controllers/MetaCloudWebhookController";
import { sync as syncTemplates, index as listTemplates } from "../controllers/WhatsappTemplateController";
import { sync as syncHealth, show as showHealth } from "../controllers/WhatsappHealthController";

const metaCloudRoutes = Router();

// Authenticated routes
metaCloudRoutes.post("/meta-cloud/embedded-signup", isAuth, embeddedSignup);
metaCloudRoutes.post("/meta-cloud/rollback", isAuth, rollback);

// Templates (Fase E)
metaCloudRoutes.post("/meta-cloud/templates/:whatsappId/sync", isAuth, syncTemplates);
metaCloudRoutes.get("/meta-cloud/templates/:whatsappId", isAuth, listTemplates);

// Saude do numero (Fase F)
metaCloudRoutes.post("/meta-cloud/health/:whatsappId/sync", isAuth, syncHealth);
metaCloudRoutes.get("/meta-cloud/health/:whatsappId", isAuth, showHealth);

// Webhook routes (no auth — called directly by Meta)
metaCloudRoutes.get("/meta-cloud/webhook", verifyWebhook);
metaCloudRoutes.post("/meta-cloud/webhook", receiveWebhook);

export default metaCloudRoutes;
