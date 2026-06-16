import { QueryTypes } from "sequelize";
import sequelize from "../../database";
import {
  DapeLeadScore,
  DapeScoreEvent,
  PipelineSummary,
  ScoreEventRequest,
  ScoreEventType,
  SCORE_RULES,
} from "./dapePipeline.types";

function calculateTemperature(score: number): "cold" | "warm" | "hot" {
  if (score >= 70) return "hot";
  if (score >= 40) return "warm";
  return "cold";
}

function calculateProbability(score: number): number {
  return Math.min(score * 0.95, 95);
}

export async function getOrCreateLeadScore(
  contactId: number,
  companyId: number,
  ticketId?: number
): Promise<DapeLeadScore> {
  const existing = await sequelize.query<DapeLeadScore>(
    `SELECT * FROM dape_lead_scores WHERE contact_id = :contactId AND company_id = :companyId ORDER BY id DESC LIMIT 1`,
    { replacements: { contactId, companyId }, type: QueryTypes.SELECT }
  );

  if (existing.length > 0) return existing[0];

  const created = await sequelize.query<DapeLeadScore>(
    `INSERT INTO dape_lead_scores (contact_id, ticket_id, company_id, score, temperature, close_probability)
     VALUES (:contactId, :ticketId, :companyId, 0, 'cold', 0)
     RETURNING *`,
    {
      replacements: { contactId, ticketId: ticketId || null, companyId },
      type: QueryTypes.SELECT,
    }
  );

  return created[0];
}

export async function getLeadScore(
  contactId: number,
  companyId: number
): Promise<DapeLeadScore | null> {
  const result = await sequelize.query<DapeLeadScore>(
    `SELECT * FROM dape_lead_scores WHERE contact_id = :contactId AND company_id = :companyId ORDER BY id DESC LIMIT 1`,
    { replacements: { contactId, companyId }, type: QueryTypes.SELECT }
  );
  return result[0] || null;
}

export async function registerScoreEvent(
  params: ScoreEventRequest,
  companyId: number
): Promise<DapeLeadScore> {
  const { contactId, ticketId, eventType, description } = params;
  const points = SCORE_RULES[eventType];

  // Insert event
  await sequelize.query(
    `INSERT INTO dape_score_events (contact_id, ticket_id, company_id, event_type, points, description)
     VALUES (:contactId, :ticketId, :companyId, :eventType, :points, :description)`,
    {
      replacements: {
        contactId,
        ticketId: ticketId || null,
        companyId,
        eventType,
        points,
        description: description || null,
      },
      type: QueryTypes.INSERT,
    }
  );

  // Get or create lead score record
  await getOrCreateLeadScore(contactId, companyId, ticketId);

  // Recalculate from all events
  const eventsResult = await sequelize.query<{ total: number }>(
    `SELECT COALESCE(SUM(points), 0) AS total FROM dape_score_events WHERE contact_id = :contactId AND company_id = :companyId`,
    { replacements: { contactId, companyId }, type: QueryTypes.SELECT }
  );

  const rawScore = Number(eventsResult[0]?.total || 0);
  const score = Math.max(0, Math.min(100, rawScore));
  const temperature = calculateTemperature(score);
  const closeProbability = calculateProbability(score);

  // Build breakdown
  const breakdownResult = await sequelize.query<{
    event_type: ScoreEventType;
    total: number;
  }>(
    `SELECT event_type, SUM(points) AS total FROM dape_score_events WHERE contact_id = :contactId AND company_id = :companyId GROUP BY event_type`,
    { replacements: { contactId, companyId }, type: QueryTypes.SELECT }
  );

  const scoreBreakdown: Record<string, number> = {};
  for (const row of breakdownResult) {
    scoreBreakdown[row.event_type] = Number(row.total);
  }

  const updated = await sequelize.query<DapeLeadScore>(
    `UPDATE dape_lead_scores
     SET score = :score, temperature = :temperature, close_probability = :closeProbability,
         score_breakdown = :scoreBreakdown::jsonb, last_calculated_at = NOW(), updated_at = NOW()
     WHERE contact_id = :contactId AND company_id = :companyId
     RETURNING *`,
    {
      replacements: {
        score,
        temperature,
        closeProbability,
        scoreBreakdown: JSON.stringify(scoreBreakdown),
        contactId,
        companyId,
      },
      type: QueryTypes.SELECT,
    }
  );

  return updated[0];
}

export async function listLeadScores(
  companyId: number,
  temperature?: string,
  limit = 50,
  offset = 0
): Promise<{ scores: DapeLeadScore[]; total: number }> {
  const whereTemp = temperature ? `AND temperature = :temperature` : "";

  const scores = await sequelize.query<DapeLeadScore>(
    `SELECT ls.*, 
       (SELECT COUNT(*) FROM dape_score_events se WHERE se.contact_id = ls.contact_id AND se.company_id = ls.company_id) AS event_count
     FROM dape_lead_scores ls
     WHERE ls.company_id = :companyId ${whereTemp}
     ORDER BY ls.score DESC
     LIMIT :limit OFFSET :offset`,
    {
      replacements: { companyId, temperature: temperature || null, limit, offset },
      type: QueryTypes.SELECT,
    }
  );

  const countResult = await sequelize.query<{ count: number }>(
    `SELECT COUNT(*) AS count FROM dape_lead_scores WHERE company_id = :companyId ${whereTemp}`,
    {
      replacements: { companyId, temperature: temperature || null },
      type: QueryTypes.SELECT,
    }
  );

  return { scores, total: Number(countResult[0]?.count || 0) };
}

export async function updateEstimatedValue(
  scoreId: number,
  companyId: number,
  estimatedValue: number
): Promise<DapeLeadScore | null> {
  const result = await sequelize.query<DapeLeadScore>(
    `UPDATE dape_lead_scores SET estimated_value = :estimatedValue, updated_at = NOW()
     WHERE id = :scoreId AND company_id = :companyId RETURNING *`,
    {
      replacements: { estimatedValue, scoreId, companyId },
      type: QueryTypes.SELECT,
    }
  );
  return result[0] || null;
}

export async function getPipelineSummary(companyId: number): Promise<PipelineSummary> {
  const result = await sequelize.query<{
    temperature: string;
    count: number;
    total_value: number;
  }>(
    `SELECT temperature, COUNT(*) AS count, COALESCE(SUM(estimated_value), 0) AS total_value
     FROM dape_lead_scores WHERE company_id = :companyId GROUP BY temperature`,
    { replacements: { companyId }, type: QueryTypes.SELECT }
  );

  const summary: PipelineSummary = {
    hot: 0, warm: 0, cold: 0, total: 0,
    totalEstimatedValue: 0, hotEstimatedValue: 0,
  };

  for (const row of result) {
    const count = Number(row.count);
    const value = Number(row.total_value);
    summary.total += count;
    summary.totalEstimatedValue += value;
    if (row.temperature === "hot") { summary.hot = count; summary.hotEstimatedValue = value; }
    else if (row.temperature === "warm") summary.warm = count;
    else summary.cold = count;
  }

  return summary;
}

export async function getScoreEvents(
  contactId: number,
  companyId: number
): Promise<DapeScoreEvent[]> {
  return sequelize.query<DapeScoreEvent>(
    `SELECT * FROM dape_score_events WHERE contact_id = :contactId AND company_id = :companyId ORDER BY created_at DESC LIMIT 20`,
    { replacements: { contactId, companyId }, type: QueryTypes.SELECT }
  );
}
