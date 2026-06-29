import { Router } from "express";
import isAuth from "../../middleware/isAuth";
import {
  getShieldConfig, upsertShieldConfig,
  getShieldAuditLog, getShieldStats,
  getShieldStatus, releaseQuarantine,
} from "./dapleShield.controller";

const router = Router();
router.use(isAuth);

router.get("/shield/stats", getShieldStats);
router.get("/shield/:whatsappId/status", getShieldStatus);
router.get("/shield/:whatsappId/config", getShieldConfig);
router.put("/shield/:whatsappId/config", upsertShieldConfig);
router.get("/shield/:whatsappId/audit", getShieldAuditLog);
router.delete("/shield/:whatsappId/quarantine", releaseQuarantine);

export default router;
