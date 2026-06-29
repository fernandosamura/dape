import { Router } from "express";
import isAuth from "../middleware/isAuth";
import { embeddedSignup, rollback } from "../controllers/EmbeddedSignupController";
import { verifyWebhook, receiveWebhook } from "../controllers/MetaCloudWebhookController";

const metaCloudRoutes = Router();

// Authenticated routes
metaCloudRoutes.post("/meta-cloud/embedded-signup", isAuth, embeddedSignup);
metaCloudRoutes.post("/meta-cloud/rollback", isAuth, rollback);

// Webhook routes (no auth — called directly by Meta)
metaCloudRoutes.get("/meta-cloud/webhook", verifyWebhook);
metaCloudRoutes.post("/meta-cloud/webhook", receiveWebhook);

export default metaCloudRoutes;
