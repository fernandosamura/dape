import { Router } from "express";
import isAuth from "../../middleware/isAuth";
import { moduleGuard } from "../shared/dapeModuleGuard.middleware";
import * as ctrl from "./dapeRadar.controller";

const router = Router();
router.use(isAuth);
router.use(moduleGuard("dape_radar"));

router.get("/summary", ctrl.getSummary);
router.get("/", ctrl.listOpportunities);
router.get("/:id", ctrl.getOpportunity);
router.post("/", ctrl.createOpportunity);
router.post("/bulk-import", ctrl.bulkImport);
router.post("/:id/convert", ctrl.convertToContact);
router.patch("/:id/status", ctrl.updateStatus);
router.put("/:id", ctrl.updateOpportunity);
router.delete("/:id", ctrl.deleteOpportunity);

export default router;
