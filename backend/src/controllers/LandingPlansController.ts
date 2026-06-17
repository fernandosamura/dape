import { Request, Response } from "express";
import { QueryTypes } from "sequelize";
import sequelize from "../database";

export const landingPlans = async (req: Request, res: Response): Promise<Response> => {
  try {
    const plans = await sequelize.query(`
      SELECT 
        dp.id, dp.name, dp.description, dp.price_monthly,
        dp.max_users, dp.max_connections, dp.max_queues, dp.max_contacts,
        dp.use_campaigns, dp.use_schedules, dp.use_internal_chat,
        dp.use_external_api, dp.use_kanban, dp.use_openai, dp.use_integrations,
        dp.use_facebook, dp.use_instagram,
        COALESCE(
          json_agg(dpm.module_key) FILTER (WHERE dpm.is_enabled = true),
          '[]'
        ) as modules
      FROM dape_plans dp
      LEFT JOIN dape_plan_modules dpm ON dpm.plan_id = dp.id
      WHERE dp.is_master = false 
        AND dp.name NOT IN ('Master', 'Bundle')
        AND dp.is_active = true
      GROUP BY dp.id
      ORDER BY dp.price_monthly ASC
    `, { type: QueryTypes.SELECT });

    return res.status(200).json(plans);
  } catch (err) {
    console.error("LandingPlans error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};
