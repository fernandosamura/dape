import { Router } from "express";
import { moduleGuard } from "../shared/dapeModuleGuard.middleware";
import isAuth from "../../middleware/isAuth";
import * as IntelligenceController from "./dapeIntelligence.controller";

const router = Router();

router.use(isAuth);
router.use(moduleGuard("dape_intelligence"));

// GET  /api/dape/intelligence/profiles — lista todos os perfis
router.get("/profiles", IntelligenceController.listProfiles);

// GET  /api/dape/intelligence/profile/:contactId — perfil de um contato
router.get("/profile/:contactId", IntelligenceController.getProfile);

// POST /api/dape/intelligence/analyze/:contactId — roda a análise/recalcula score
router.post("/analyze/:contactId", IntelligenceController.analyzeContact);

// PUT  /api/dape/intelligence/profile/:contactId — atualiza dados do perfil
router.put("/profile/:contactId", IntelligenceController.updateProfile);

export default router;
