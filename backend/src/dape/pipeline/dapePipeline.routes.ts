import { Router } from "express";
import { moduleGuard } from "../shared/dapeModuleGuard.middleware";
import isAuth from "../../middleware/isAuth";
import * as PipelineController from "./dapePipeline.controller";
import * as DealsController from "./dapeDeals.controller";
import * as SourcesController from "./dapeLeadSources.controller";

const router = Router();

router.use(isAuth);
router.use(moduleGuard("dape_pipeline"));

// GET /api/dape/pipeline/scores — lista todos os scores com filtro
router.get("/scores", PipelineController.listScores);

// GET /api/dape/pipeline/summary — resumo hot/warm/cold
router.get("/summary", PipelineController.getPipelineSummary);

// GET /api/dape/pipeline/score/:contactId — score de um contato
router.get("/score/:contactId", PipelineController.getScore);

// GET /api/dape/pipeline/score/:contactId/events — histórico de eventos
router.get("/score/:contactId/events", PipelineController.getContactEvents);

// POST /api/dape/pipeline/score/event — registra evento
router.post("/score/event", PipelineController.registerEvent);

// PUT /api/dape/pipeline/score/:id/value — atualiza valor estimado
router.put("/score/:id/value", PipelineController.updateValue);

// Deals
router.get("/deals", DealsController.list);
router.post("/deals", DealsController.create);
router.put("/deals/:id", DealsController.update);
router.delete("/deals/:id", DealsController.deleteDeal);

// Lead Sources
router.get("/sources", SourcesController.list);
router.post("/sources", SourcesController.create);
router.put("/sources/:id", SourcesController.update);
router.delete("/sources/:id", SourcesController.deleteLeadSource);

export default router;
