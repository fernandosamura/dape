import { Router } from "express";
import { moduleGuard } from "../shared/dapeModuleGuard.middleware";
import isAuth from "../../middleware/isAuth";
import * as IAController from "./dapeIA.controller";

const router = Router();

router.use(isAuth);
router.use(moduleGuard("dape_ia"));

// POST /api/dape/ia/summarize/:ticketId — gera resumo
router.post("/summarize/:ticketId", IAController.summarize);

// GET  /api/dape/ia/summary/:ticketId — busca último resumo salvo
router.get("/summary/:ticketId", IAController.getSummary);

// POST /api/dape/ia/suggest-reply/:ticketId — sugestões de resposta
router.post("/suggest-reply/:ticketId", IAController.suggestReply);

// POST /api/dape/ia/next-action/:ticketId — próxima ação recomendada
router.post("/next-action/:ticketId", IAController.suggestNextAction);

// PUT  /api/dape/ia/suggestion/:suggestionId/used — marca sugestão como usada
router.put("/suggestion/:suggestionId/used", IAController.markUsed);

// POST /api/dape/ia/generate-audio-reply/:ticketId — gera áudio TTS da resposta
router.post("/generate-audio-reply/:ticketId", IAController.generateAudioReply);

export default router;
