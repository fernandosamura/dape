import { Router } from "express";
import { moduleGuard } from "../shared/dapeModuleGuard.middleware";
import isAuth from "../../middleware/isAuth";
import * as GrowthController from "./dapeGrowth.controller";

const router = Router();

router.use(isAuth);
router.use(moduleGuard("dape_growth"));

router.get("/dashboard",          GrowthController.getDashboard);
router.get("/campaigns",          GrowthController.listCampaigns);
router.post("/campaigns",         GrowthController.createCampaign);
router.get("/campaigns/:id",      GrowthController.getCampaign);
router.put("/campaigns/:id",      GrowthController.updateCampaign);
router.delete("/campaigns/:id",   GrowthController.deleteCampaign);
router.get("/campaigns/:id/results",  GrowthController.getCampaignResults);
router.post("/campaigns/:id/results", GrowthController.upsertCampaignResult);
router.get("/goals",              GrowthController.listGoals);
router.post("/goals",             GrowthController.upsertGoal);
router.put("/goals/:id",          GrowthController.updateGoalProgress);

export default router;
