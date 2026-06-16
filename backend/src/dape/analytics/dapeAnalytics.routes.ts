import { Router } from "express";
import { moduleGuard } from "../shared/dapeModuleGuard.middleware";
import isAuth from "../../middleware/isAuth";
import * as AnalyticsController from "./dapeAnalytics.controller";

const router = Router();

router.use(isAuth);
router.use(moduleGuard("dape_analytics"));

// GET /api/dape/analytics/overview?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get("/overview", AnalyticsController.getOverview);

// GET /api/dape/analytics/by-channel?from=&to=
router.get("/by-channel", AnalyticsController.getByChannel);

// GET /api/dape/analytics/funnel
router.get("/funnel", AnalyticsController.getFunnel);

// GET /api/dape/analytics/summary/today
router.get("/summary/today", AnalyticsController.getSummaryToday);

// GET /api/dape/analytics/daily?from=&to=
router.get("/daily", AnalyticsController.getDailyTickets);

// POST /api/dape/analytics/snapshot (uso interno / admin)
router.post("/snapshot", AnalyticsController.triggerSnapshot);

export default router;
