import { QueryTypes } from "sequelize";
import sequelize from "../../database";

// ── Types ────────────────────────────────────────────────────────────────────
export interface Campaign {
  id: number; companyId: number; name: string; description?: string;
  targetSegment?: string; goalLeads: number; goalMeetings: number;
  goalContracts: number; goalRevenue: number; startDate?: string;
  endDate?: string; status: "draft" | "active" | "paused" | "finished";
  createdAt: Date; updatedAt: Date;
}

export interface CampaignWithProgress extends Campaign {
  totalLeads: number; totalMeetings: number; totalContracts: number; totalRevenue: number;
  progressLeads: number; progressMeetings: number; progressContracts: number; progressRevenue: number;
}

export interface CampaignResult {
  id: number; campaignId: number; metricDate: string;
  leadsGenerated: number; meetingsDone: number; contractsClosed: number;
  revenueGenerated: number; notes?: string;
}

export interface Goal {
  id: number; companyId: number; periodType: string; periodRef: string;
  metric: string; targetValue: number; currentValue: number; updatedAt: Date;
}

// ── Campaigns ────────────────────────────────────────────────────────────────
export async function listCampaigns(companyId: number, status?: string): Promise<CampaignWithProgress[]> {
  const whereStatus = status ? `AND c.status = :status` : "";
  const rows = await sequelize.query<any>(
    `SELECT c.*,
       COALESCE(SUM(r.leads_generated), 0)   AS total_leads,
       COALESCE(SUM(r.meetings_done), 0)     AS total_meetings,
       COALESCE(SUM(r.contracts_closed), 0)  AS total_contracts,
       COALESCE(SUM(r.revenue_generated), 0) AS total_revenue
     FROM dape_campaigns c
     LEFT JOIN dape_campaign_results r ON r.campaign_id = c.id
     WHERE c.company_id = :companyId ${whereStatus}
     GROUP BY c.id
     ORDER BY c.created_at DESC`,
    { replacements: { companyId, status: status || null }, type: QueryTypes.SELECT }
  );

  return rows.map((r) => ({
    ...r,
    totalLeads: Number(r.total_leads),
    totalMeetings: Number(r.total_meetings),
    totalContracts: Number(r.total_contracts),
    totalRevenue: Number(r.total_revenue),
    goalLeads: Number(r.goal_leads),
    goalMeetings: Number(r.goal_meetings),
    goalContracts: Number(r.goal_contracts),
    goalRevenue: Number(r.goal_revenue),
    progressLeads: r.goal_leads > 0 ? Math.min(100, Math.round((Number(r.total_leads) / r.goal_leads) * 100)) : 0,
    progressMeetings: r.goal_meetings > 0 ? Math.min(100, Math.round((Number(r.total_meetings) / r.goal_meetings) * 100)) : 0,
    progressContracts: r.goal_contracts > 0 ? Math.min(100, Math.round((Number(r.total_contracts) / r.goal_contracts) * 100)) : 0,
    progressRevenue: r.goal_revenue > 0 ? Math.min(100, Math.round((Number(r.total_revenue) / r.goal_revenue) * 100)) : 0,
  }));
}

export async function getCampaign(id: number, companyId: number): Promise<CampaignWithProgress | null> {
  const all = await listCampaigns(companyId);
  return all.find((c) => c.id === id) || null;
}

export async function createCampaign(companyId: number, data: Partial<Campaign>): Promise<Campaign> {
  const result = await sequelize.query<Campaign>(
    `INSERT INTO dape_campaigns
       (company_id, name, description, target_segment, goal_leads, goal_meetings, goal_contracts, goal_revenue, start_date, end_date, status)
     VALUES (:companyId, :name, :description, :targetSegment, :goalLeads, :goalMeetings, :goalContracts, :goalRevenue, :startDate, :endDate, :status)
     RETURNING *`,
    {
      replacements: {
        companyId, name: data.name, description: data.description || null,
        targetSegment: data.targetSegment || null,
        goalLeads: data.goalLeads || 0, goalMeetings: data.goalMeetings || 0,
        goalContracts: data.goalContracts || 0, goalRevenue: data.goalRevenue || 0,
        startDate: data.startDate || null, endDate: data.endDate || null,
        status: data.status || "draft",
      },
      type: QueryTypes.SELECT,
    }
  );
  return result[0];
}

export async function updateCampaign(id: number, companyId: number, data: Partial<Campaign>): Promise<Campaign | null> {
  const result = await sequelize.query<Campaign>(
    `UPDATE dape_campaigns SET
       name = COALESCE(:name, name),
       description = COALESCE(:description, description),
       target_segment = COALESCE(:targetSegment, target_segment),
       goal_leads = COALESCE(:goalLeads, goal_leads),
       goal_meetings = COALESCE(:goalMeetings, goal_meetings),
       goal_contracts = COALESCE(:goalContracts, goal_contracts),
       goal_revenue = COALESCE(:goalRevenue, goal_revenue),
       start_date = COALESCE(:startDate, start_date),
       end_date = COALESCE(:endDate, end_date),
       status = COALESCE(:status, status),
       updated_at = NOW()
     WHERE id = :id AND company_id = :companyId RETURNING *`,
    {
      replacements: {
        id, companyId,
        name: data.name || null, description: data.description || null,
        targetSegment: data.targetSegment || null,
        goalLeads: data.goalLeads ?? null, goalMeetings: data.goalMeetings ?? null,
        goalContracts: data.goalContracts ?? null, goalRevenue: data.goalRevenue ?? null,
        startDate: data.startDate || null, endDate: data.endDate || null,
        status: data.status || null,
      },
      type: QueryTypes.SELECT,
    }
  );
  return result[0] || null;
}

export async function deleteCampaign(id: number, companyId: number): Promise<boolean> {
  const result = await sequelize.query(
    `DELETE FROM dape_campaigns WHERE id = :id AND company_id = :companyId`,
    { replacements: { id, companyId }, type: QueryTypes.DELETE }
  );
  return (result[1] as number) > 0;
}

// ── Campaign Results ─────────────────────────────────────────────────────────
export async function getCampaignResults(campaignId: number, companyId: number): Promise<CampaignResult[]> {
  // Verify campaign belongs to company
  const owns = await sequelize.query<{ id: number }>(
    `SELECT id FROM dape_campaigns WHERE id = :campaignId AND company_id = :companyId`,
    { replacements: { campaignId, companyId }, type: QueryTypes.SELECT }
  );
  if (!owns[0]) return [];

  return sequelize.query<CampaignResult>(
    `SELECT * FROM dape_campaign_results WHERE campaign_id = :campaignId ORDER BY metric_date DESC`,
    { replacements: { campaignId }, type: QueryTypes.SELECT }
  );
}

export async function upsertCampaignResult(
  campaignId: number, companyId: number, data: Partial<CampaignResult>
): Promise<CampaignResult> {
  const owns = await sequelize.query<{ id: number }>(
    `SELECT id FROM dape_campaigns WHERE id = :campaignId AND company_id = :companyId`,
    { replacements: { campaignId, companyId }, type: QueryTypes.SELECT }
  );
  if (!owns[0]) throw new Error("CAMPAIGN_NOT_FOUND");

  const today = data.metricDate || new Date().toISOString().split("T")[0];
  const result = await sequelize.query<CampaignResult>(
    `INSERT INTO dape_campaign_results
       (campaign_id, company_id, metric_date, leads_generated, meetings_done, contracts_closed, revenue_generated, notes)
     VALUES (:campaignId, :companyId, :metricDate, :leads, :meetings, :contracts, :revenue, :notes)
     ON CONFLICT (campaign_id, metric_date)
     DO UPDATE SET
       leads_generated = EXCLUDED.leads_generated,
       meetings_done = EXCLUDED.meetings_done,
       contracts_closed = EXCLUDED.contracts_closed,
       revenue_generated = EXCLUDED.revenue_generated,
       notes = EXCLUDED.notes
     RETURNING *`,
    {
      replacements: {
        campaignId, companyId, metricDate: today,
        leads: data.leadsGenerated || 0, meetings: data.meetingsDone || 0,
        contracts: data.contractsClosed || 0, revenue: data.revenueGenerated || 0,
        notes: data.notes || null,
      },
      type: QueryTypes.SELECT,
    }
  );
  return result[0];
}

// ── Goals ────────────────────────────────────────────────────────────────────
export async function listGoals(companyId: number, periodType?: string, periodRef?: string): Promise<Goal[]> {
  const filters = [
    periodType ? `AND period_type = :periodType` : "",
    periodRef ? `AND period_ref = :periodRef` : "",
  ].join(" ");
  return sequelize.query<Goal>(
    `SELECT * FROM dape_goals WHERE company_id = :companyId ${filters} ORDER BY period_type, period_ref, metric`,
    { replacements: { companyId, periodType: periodType || null, periodRef: periodRef || null }, type: QueryTypes.SELECT }
  );
}

export async function upsertGoal(companyId: number, data: Partial<Goal>): Promise<Goal> {
  const result = await sequelize.query<Goal>(
    `INSERT INTO dape_goals (company_id, period_type, period_ref, metric, target_value, current_value)
     VALUES (:companyId, :periodType, :periodRef, :metric, :targetValue, :currentValue)
     ON CONFLICT (company_id, period_type, period_ref, metric)
     DO UPDATE SET
       target_value = EXCLUDED.target_value,
       current_value = EXCLUDED.current_value,
       updated_at = NOW()
     RETURNING *`,
    {
      replacements: {
        companyId, periodType: data.periodType, periodRef: data.periodRef,
        metric: data.metric, targetValue: data.targetValue || 0, currentValue: data.currentValue || 0,
      },
      type: QueryTypes.SELECT,
    }
  );
  return result[0];
}

export async function updateGoalProgress(id: number, companyId: number, currentValue: number): Promise<Goal | null> {
  const result = await sequelize.query<Goal>(
    `UPDATE dape_goals SET current_value = :currentValue, updated_at = NOW()
     WHERE id = :id AND company_id = :companyId RETURNING *`,
    { replacements: { id, companyId, currentValue }, type: QueryTypes.SELECT }
  );
  return result[0] || null;
}

export async function getGrowthDashboard(companyId: number): Promise<any> {
  const now = new Date();
  const monthRef = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const quarter = Math.ceil((now.getMonth() + 1) / 3);
  const quarterRef = `${now.getFullYear()}-Q${quarter}`;

  const [campaigns, monthGoals, quarterGoals] = await Promise.all([
    listCampaigns(companyId, "active"),
    listGoals(companyId, "month", monthRef),
    listGoals(companyId, "quarter", quarterRef),
  ]);

  return { activeCampaigns: campaigns, monthGoals, quarterGoals, monthRef, quarterRef };
}
