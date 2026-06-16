/**
 * DAPE Automation Cron
 * ─────────────────────────────────────────────────────────────────────────────
 * Centraliza todos os jobs automáticos do DAPE:
 *
 * 1. [DIÁRIO 02:00]  Manutenção de banco (retenção de logs, limpeza de dados)
 * 2. [DIÁRIO 23:50]  Campaign results automáticos (calculados dos tickets nativos)
 * 3. [4h em 4h]      Score negativo automático (sem_resposta_3d / sem_resposta_7d)
 * 4. [EVENTO]        Resumo IA automático quando lead muda para HOT
 * 5. [SEMANAL SEG 06:00] Recálculo de Intelligence Score
 * 6. [4h em 4h]      Auto Score por palavras-chave nas mensagens
 */

import sequelize from "../database";
import { QueryTypes } from "sequelize";
import { moduleAccessService } from "./shared/moduleAccess.service";
import { registerScoreEvent } from "./pipeline/dapePipeline.service";
import { summarizeTicket, getLatestSummary } from "./ia/dapeIA.service";
import { upsertCampaignResult } from "./growth/dapeGrowth.service";

// ── Helpers ──────────────────────────────────────────────────────────────────

function log(job: string, msg: string) {
  const ts = new Date().toISOString().replace("T", " ").substring(0, 19);
  console.info(`[DAPE Automation][${job}] ${ts} — ${msg}`);
}

function msUntil(hour: number, minute: number = 0): number {
  const now = new Date();
  const target = new Date();
  target.setHours(hour, minute, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  return target.getTime() - now.getTime();
}

function msUntilNextMonday(hour: number): number {
  const now = new Date();
  const target = new Date();
  const daysUntilMonday = (8 - now.getDay()) % 7 || 7;
  target.setDate(now.getDate() + daysUntilMonday);
  target.setHours(hour, 0, 0, 0);
  return target.getTime() - now.getTime();
}

/** Retorna todas as empresas com acesso ao módulo informado */
async function getCompaniesWithModule(moduleKey: string): Promise<number[]> {
  const rows = await sequelize.query<{ company_id: number }>(
    `SELECT DISTINCT tp.company_id
     FROM dape_tenant_plans tp
     JOIN dape_plan_modules pm ON pm.plan_id = tp.plan_id
     WHERE pm.module_key = :moduleKey AND pm.is_enabled = true AND tp.is_active = true`,
    { replacements: { moduleKey }, type: QueryTypes.SELECT }
  );
  return rows.map(r => r.company_id);
}

// ── JOB 1 — Manutenção de banco (diário 02:00) ───────────────────────────────

async function runMaintenanceJob(): Promise<void> {
  log("maintenance", "Iniciando manutenção diária do banco...");
  try {
    const results = await sequelize.query<{ operation: string; rows_affected: number }>(
      `SELECT * FROM dape_run_maintenance()`,
      { type: QueryTypes.SELECT }
    );
    for (const r of results) {
      log("maintenance", `${r.operation}: ${r.rows_affected} registros afetados`);
    }
    log("maintenance", "✅ Manutenção concluída com sucesso");
  } catch (err) {
    console.error("[DAPE Automation][maintenance] ERRO:", err);
  }
  // Agenda próxima execução em 24h
  setTimeout(runMaintenanceJob, 24 * 60 * 60 * 1000);
}

// ── JOB 2 — Campaign results automáticos (diário 23:50) ─────────────────────

async function runCampaignAutoResults(): Promise<void> {
  log("campaign-results", "Calculando resultados de campanha automaticamente...");
  try {
    // Busca campanhas ativas e suas empresas
    const activeCampaigns = await sequelize.query<{
      id: number; company_id: number; start_date: string; end_date: string;
    }>(
      `SELECT id, company_id, start_date::text, end_date::text
       FROM dape_campaigns
       WHERE status = 'active'
         AND start_date <= CURRENT_DATE
         AND (end_date IS NULL OR end_date >= CURRENT_DATE)`,
      { type: QueryTypes.SELECT }
    );

    const today = new Date().toISOString().split("T")[0];

    for (const campaign of activeCampaigns) {
      const hasGrowth = await moduleAccessService.checkAccess(campaign.company_id, "dape_growth");
      if (!hasGrowth) continue;

      // Conta novos contatos hoje (leads gerados)
      const leadsToday = await sequelize.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM "Contacts"
         WHERE "companyId" = :companyId
           AND DATE("createdAt") = CURRENT_DATE`,
        { replacements: { companyId: campaign.company_id }, type: QueryTypes.SELECT }
      );

      // Conta tickets fechados hoje
      const closedToday = await sequelize.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM "Tickets"
         WHERE "companyId" = :companyId
           AND status = 'closed'
           AND DATE("updatedAt") = CURRENT_DATE`,
        { replacements: { companyId: campaign.company_id }, type: QueryTypes.SELECT }
      );

      // Soma valores estimados de leads fechados hoje (via dape_lead_scores)
      const revenueToday = await sequelize.query<{ total: string }>(
        `SELECT COALESCE(SUM(ls.estimated_value), 0) AS total
         FROM dape_lead_scores ls
         JOIN "Tickets" t ON t.id = ls.ticket_id
         WHERE ls.company_id = :companyId
           AND t.status = 'closed'
           AND DATE(t."updatedAt") = CURRENT_DATE
           AND ls.estimated_value IS NOT NULL`,
        { replacements: { companyId: campaign.company_id }, type: QueryTypes.SELECT }
      );

      const leadsGenerated = parseInt(leadsToday[0]?.count || "0", 10);
      const contractsClosed = parseInt(closedToday[0]?.count || "0", 10);
      const revenueGenerated = parseFloat(revenueToday[0]?.total || "0");

      // Só salva se teve algum dado
      if (leadsGenerated > 0 || contractsClosed > 0 || revenueGenerated > 0) {
        await upsertCampaignResult(campaign.id, campaign.company_id, {
          metricDate: today,
          leadsGenerated,
          contractsClosed,
          revenueGenerated,
          notes: "Calculado automaticamente pelo DAPE às 23:50",
        } as any);
        log("campaign-results",
          `Campanha #${campaign.id} (empresa ${campaign.company_id}): ` +
          `${leadsGenerated} leads, ${contractsClosed} contratos, R$${revenueGenerated.toFixed(2)}`
        );
      }
    }
    log("campaign-results", "✅ Campaign results calculados");
  } catch (err) {
    console.error("[DAPE Automation][campaign-results] ERRO:", err);
  }
  // Agenda próxima execução em 24h
  setTimeout(runCampaignAutoResults, 24 * 60 * 60 * 1000);
}

// ── JOB 3 — Score negativo automático por inatividade (a cada 4h) ────────────

async function runInactivityScoreJob(): Promise<void> {
  log("inactivity-score", "Verificando leads inativos...");
  try {
    const companies = await getCompaniesWithModule("dape_pipeline");

    for (const companyId of companies) {
      // Leads sem resposta há 3 dias (que ainda não foram pontuados hoje por este motivo)
      const inactive3d = await sequelize.query<{ contact_id: number; ticket_id: number }>(
        `SELECT DISTINCT ls.contact_id, ls.ticket_id
         FROM dape_lead_scores ls
         JOIN "Tickets" t ON t.id = ls.ticket_id
         WHERE ls.company_id = :companyId
           AND ls.temperature != 'cold'
           AND t.status = 'open'
           AND t."updatedAt" < NOW() - INTERVAL '3 days'
           AND t."updatedAt" >= NOW() - INTERVAL '7 days'
           AND NOT EXISTS (
             SELECT 1 FROM dape_score_events se
             WHERE se.contact_id = ls.contact_id
               AND se.company_id = :companyId
               AND se.event_type = 'sem_resposta_3d'
               AND se.created_at >= NOW() - INTERVAL '3 days'
           )`,
        { replacements: { companyId }, type: QueryTypes.SELECT }
      );

      for (const lead of inactive3d) {
        await registerScoreEvent(
          { contactId: lead.contact_id, ticketId: lead.ticket_id, eventType: "sem_resposta_3d",
            description: "Aplicado automaticamente — sem atividade há 3 dias" },
          companyId
        );
        log("inactivity-score", `Empresa ${companyId} — contato ${lead.contact_id}: -10pts (3 dias)`);
      }

      // Leads sem resposta há 7 dias
      const inactive7d = await sequelize.query<{ contact_id: number; ticket_id: number }>(
        `SELECT DISTINCT ls.contact_id, ls.ticket_id
         FROM dape_lead_scores ls
         JOIN "Tickets" t ON t.id = ls.ticket_id
         WHERE ls.company_id = :companyId
           AND t.status = 'open'
           AND t."updatedAt" < NOW() - INTERVAL '7 days'
           AND NOT EXISTS (
             SELECT 1 FROM dape_score_events se
             WHERE se.contact_id = ls.contact_id
               AND se.company_id = :companyId
               AND se.event_type = 'sem_resposta_7d'
               AND se.created_at >= NOW() - INTERVAL '7 days'
           )`,
        { replacements: { companyId }, type: QueryTypes.SELECT }
      );

      for (const lead of inactive7d) {
        await registerScoreEvent(
          { contactId: lead.contact_id, ticketId: lead.ticket_id, eventType: "sem_resposta_7d",
            description: "Aplicado automaticamente — sem atividade há 7 dias" },
          companyId
        );
        log("inactivity-score", `Empresa ${companyId} — contato ${lead.contact_id}: -20pts (7 dias)`);
      }
    }
    log("inactivity-score", "✅ Verificação de inatividade concluída");
  } catch (err) {
    console.error("[DAPE Automation][inactivity-score] ERRO:", err);
  }
  // Repete a cada 4 horas
  setTimeout(runInactivityScoreJob, 4 * 60 * 60 * 1000);
}

// ── JOB 4 — Auto Score por palavras-chave nas mensagens (a cada 4h) ──────────

const KEYWORD_RULES: Array<{
  keywords: RegExp;
  eventType: "respondeu_rapido" | "abriu_proposta" | "reuniao" | "orcamento";
  label: string;
}> = [
  {
    keywords: /or[cç]amento|cotação|cota[cç][aã]o|quanto custa|pre[cç]o|proposta de pre[cç]o/i,
    eventType: "orcamento",
    label: "Solicitou orçamento (detecção automática)",
  },
  {
    keywords: /proposta|apresenta[cç][aã]o|apresentar|envia.*proposta|manda.*proposta/i,
    eventType: "abriu_proposta",
    label: "Abriu proposta (detecção automática)",
  },
  {
    keywords: /reuni[aã]o|agendar|marcar.*conversa|call|video.*chamada|meet|teams/i,
    eventType: "reuniao",
    label: "Agendou reunião (detecção automática)",
  },
];

async function runKeywordScoreJob(): Promise<void> {
  log("keyword-score", "Analisando palavras-chave nas mensagens...");
  try {
    const companies = await getCompaniesWithModule("dape_pipeline");

    for (const companyId of companies) {
      // Busca mensagens das últimas 4h de tickets abertos
      const messages = await sequelize.query<{
        msg_id: number; body: string; ticket_id: number; contact_id: number;
      }>(
        `SELECT m.id AS msg_id, m.body, m."ticketId" AS ticket_id, t."contactId" AS contact_id
         FROM "Messages" m
         JOIN "Tickets" t ON t.id = m."ticketId"
         WHERE t."companyId" = :companyId
           AND t.status = 'open'
           AND m."fromMe" = FALSE
           AND m."createdAt" >= NOW() - INTERVAL '4 hours'
           AND m.body IS NOT NULL
           AND LENGTH(m.body) > 5`,
        { replacements: { companyId }, type: QueryTypes.SELECT }
      );

      for (const msg of messages) {
        for (const rule of KEYWORD_RULES) {
          if (!rule.keywords.test(msg.body)) continue;

          // Verifica se já foi pontuado por este evento nos últimos 3 dias (evita duplicação)
          const alreadyScored = await sequelize.query<{ id: number }>(
            `SELECT id FROM dape_score_events
             WHERE contact_id = :contactId
               AND company_id = :companyId
               AND event_type = :eventType
               AND created_at >= NOW() - INTERVAL '3 days'
             LIMIT 1`,
            {
              replacements: { contactId: msg.contact_id, companyId, eventType: rule.eventType },
              type: QueryTypes.SELECT,
            }
          );

          if (alreadyScored.length === 0) {
            await registerScoreEvent(
              {
                contactId: msg.contact_id,
                ticketId: msg.ticket_id,
                eventType: rule.eventType,
                description: rule.label,
              },
              companyId
            );
            log("keyword-score",
              `Empresa ${companyId} — contato ${msg.contact_id}: ` +
              `${rule.eventType} detectado na mensagem ${msg.msg_id}`
            );
          }
        }
      }
    }
    log("keyword-score", "✅ Análise de palavras-chave concluída");
  } catch (err) {
    console.error("[DAPE Automation][keyword-score] ERRO:", err);
  }
  // Repete a cada 4 horas
  setTimeout(runKeywordScoreJob, 4 * 60 * 60 * 1000);
}

// ── JOB 5 — Resumo IA automático quando lead vai para HOT (a cada 4h) ────────

async function runAutoIASummaryJob(): Promise<void> {
  log("auto-ia-summary", "Verificando leads HOT sem resumo IA...");
  try {
    const companies = await getCompaniesWithModule("dape_ia");

    for (const companyId of companies) {
      const hasPipeline = await moduleAccessService.checkAccess(companyId, "dape_pipeline");
      if (!hasPipeline) continue;

      // Leads HOT com ticket aberto e sem resumo nas últimas 6h
      const hotLeadsNoSummary = await sequelize.query<{ ticket_id: number }>(
        `SELECT DISTINCT ls.ticket_id
         FROM dape_lead_scores ls
         JOIN "Tickets" t ON t.id = ls.ticket_id
         WHERE ls.company_id = :companyId
           AND ls.temperature = 'hot'
           AND t.status = 'open'
           AND ls.ticket_id IS NOT NULL
           AND NOT EXISTS (
             SELECT 1 FROM dape_ia_summaries s
             WHERE s.ticket_id = ls.ticket_id
               AND s.company_id = :companyId
               AND s.generated_at >= NOW() - INTERVAL '6 hours'
           )
         LIMIT 5`,
        { replacements: { companyId }, type: QueryTypes.SELECT }
      );

      // LIMIT 5 por empresa por ciclo — respeita o rate limit de OpenAI
      for (const lead of hotLeadsNoSummary) {
        try {
          await summarizeTicket(lead.ticket_id, companyId);
          log("auto-ia-summary",
            `Empresa ${companyId} — ticket ${lead.ticket_id}: resumo gerado automaticamente`
          );
          // Delay entre chamadas OpenAI para respeitar rate limit
          await new Promise(r => setTimeout(r, 2000));
        } catch (iaErr: any) {
          // Rate limit ou sem API key — pula silenciosamente
          if (iaErr.message?.includes("RATE_LIMIT") || iaErr.message?.includes("OPENAI")) {
            log("auto-ia-summary", `Empresa ${companyId}: rate limit atingido, pausando ciclo`);
            break;
          }
          log("auto-ia-summary", `Ticket ${lead.ticket_id}: erro — ${iaErr.message}`);
        }
      }
    }
    log("auto-ia-summary", "✅ Auto IA summary concluído");
  } catch (err) {
    console.error("[DAPE Automation][auto-ia-summary] ERRO:", err);
  }
  // Repete a cada 4 horas
  setTimeout(runAutoIASummaryJob, 4 * 60 * 60 * 1000);
}

// ── JOB 6 — Recálculo semanal de Intelligence Score (segunda 06:00) ──────────

async function runIntelligenceRecalcJob(): Promise<void> {
  log("intelligence-recalc", "Recalculando Intelligence Scores semanais...");
  try {
    const companies = await getCompaniesWithModule("dape_intelligence");

    for (const companyId of companies) {
      // Busca perfis que não foram recalculados nos últimos 6 dias
      const profiles = await sequelize.query<{
        id: number; instagram_followers: number; google_rating: number;
        google_reviews: number; website_url: string; phone: string;
        city: string; segment: string;
      }>(
        `SELECT id, instagram_followers, google_rating, google_reviews,
                website_url, city, segment
         FROM dape_company_profiles
         WHERE company_id = :companyId
           AND (last_analyzed_at IS NULL OR last_analyzed_at < NOW() - INTERVAL '6 days')
         ORDER BY last_analyzed_at ASC NULLS FIRST
         LIMIT 50`,
        { replacements: { companyId }, type: QueryTypes.SELECT }
      );

      for (const profile of profiles) {
        // Recalcula scores com os dados já existentes
        let presenceScore = 0;
        if (profile.website_url) presenceScore += 20;
        if (profile.instagram_followers) {
          if (profile.instagram_followers >= 10000) presenceScore += 30;
          else if (profile.instagram_followers >= 1000) presenceScore += 20;
          else presenceScore += 10;
        }
        if (profile.google_rating) {
          if (profile.google_rating >= 4.5) presenceScore += 25;
          else if (profile.google_rating >= 4.0) presenceScore += 15;
          else presenceScore += 5;
        }
        if (profile.google_reviews && profile.google_reviews >= 20) presenceScore += 10;
        if (profile.city) presenceScore += 5;
        if (profile.segment) presenceScore += 10;
        presenceScore = Math.min(presenceScore, 100);

        let potential: "alto" | "medio" | "baixo" = "baixo";
        if (presenceScore >= 70) potential = "alto";
        else if (presenceScore >= 40) potential = "medio";

        await sequelize.query(
          `UPDATE dape_company_profiles
           SET digital_presence_score = :score,
               growth_potential = :potential,
               last_analyzed_at = NOW()
           WHERE id = :id AND company_id = :companyId`,
          {
            replacements: { score: presenceScore, potential, id: profile.id, companyId },
            type: QueryTypes.UPDATE,
          }
        );

        // Delay de 50ms entre profiles para não sobrecarregar o banco
        await new Promise(r => setTimeout(r, 50));
      }

      log("intelligence-recalc",
        `Empresa ${companyId}: ${profiles.length} perfis recalculados`
      );
    }
    log("intelligence-recalc", "✅ Recálculo semanal de Intelligence concluído");
  } catch (err) {
    console.error("[DAPE Automation][intelligence-recalc] ERRO:", err);
  }
  // Agenda próxima execução na próxima segunda-feira às 06:00
  const msUntilNextWeek = msUntilNextMonday(6);
  log("intelligence-recalc",
    `Próxima execução em ${Math.round(msUntilNextWeek / 3600000)}h`
  );
  setTimeout(runIntelligenceRecalcJob, msUntilNextWeek);
}

// ── JOB 7 — Snapshot incremental de analytics (a cada 4h, 5 métricas) ────────

async function runIncrementalSnapshotJob(): Promise<void> {
  log("incremental-snapshot", "Capturando snapshot incremental...");
  try {
    const companies = await getCompaniesWithModule("dape_analytics");
    const today = new Date().toISOString().split("T")[0];

    for (const companyId of companies) {
      // 5 métricas essenciais — leves, sem JOIN pesado
      const metrics = await sequelize.query<{ metric: string; value: number }>(
        `SELECT 'tickets_open' AS metric, COUNT(*)::numeric AS value
           FROM "Tickets" WHERE "companyId" = :cid AND status = 'open'
         UNION ALL
         SELECT 'tickets_closed_today', COUNT(*)
           FROM "Tickets" WHERE "companyId" = :cid AND status='closed' AND DATE("updatedAt")=CURRENT_DATE
         UNION ALL
         SELECT 'leads_hot', COUNT(*)
           FROM dape_lead_scores WHERE company_id = :cid AND temperature='hot'
         UNION ALL
         SELECT 'revenue_today', COALESCE(SUM(estimated_value),0)
           FROM dape_lead_scores ls
           JOIN "Tickets" t ON t.id=ls.ticket_id
           WHERE ls.company_id=:cid AND t.status='closed' AND DATE(t."updatedAt")=CURRENT_DATE
         UNION ALL
         SELECT 'contacts_created_today', COUNT(*)
           FROM "Contacts" WHERE "companyId"=:cid AND DATE("createdAt")=CURRENT_DATE`,
        { replacements: { cid: companyId }, type: QueryTypes.SELECT }
      );

      for (const m of metrics) {
        await sequelize.query(
          `INSERT INTO dape_analytics_snapshots
             (snapshot_date, company_id, metric_key, metric_value, dimension, dimension_value)
           VALUES (:date, :cid, :key, :val, 'realtime', :hour)
           ON CONFLICT (snapshot_date, company_id, metric_key, COALESCE(dimension,''), COALESCE(dimension_value,''))
           DO UPDATE SET metric_value = EXCLUDED.metric_value`,
          {
            replacements: {
              date: today,
              cid: companyId,
              key: m.metric,
              val: m.value,
              hour: `h${new Date().getHours().toString().padStart(2, "0")}`,
            },
            type: QueryTypes.INSERT,
          }
        );
      }
    }
    log("incremental-snapshot", "✅ Snapshot incremental salvo");
  } catch (err) {
    console.error("[DAPE Automation][incremental-snapshot] ERRO:", err);
  }
  // Repete a cada 4 horas
  setTimeout(runIncrementalSnapshotJob, 4 * 60 * 60 * 1000);
}

// ── Inicialização — agenda todos os jobs ─────────────────────────────────────

export function startDapeAutomation(): void {
  console.info("[DAPE Automation] Iniciando sistema de automações...");

  // JOB 1 — Manutenção (próximo às 02:00)
  setTimeout(runMaintenanceJob, msUntil(2, 0));
  console.info(`[DAPE Automation] Manutenção agendada para 02:00 (${Math.round(msUntil(2, 0) / 60000)} min)`);

  // JOB 2 — Campaign results (próximo às 23:50)
  setTimeout(runCampaignAutoResults, msUntil(23, 50));
  console.info(`[DAPE Automation] Campaign results agendado para 23:50 (${Math.round(msUntil(23, 50) / 60000)} min)`);

  // JOB 3 — Score por inatividade (começa em 5 min, depois a cada 4h)
  setTimeout(runInactivityScoreJob, 5 * 60 * 1000);
  console.info("[DAPE Automation] Score por inatividade: primeiro ciclo em 5 minutos");

  // JOB 4 — Score por palavras-chave (começa em 2 min, depois a cada 4h)
  setTimeout(runKeywordScoreJob, 2 * 60 * 1000);
  console.info("[DAPE Automation] Score por palavras-chave: primeiro ciclo em 2 minutos");

  // JOB 5 — Resumo IA automático (começa em 10 min, depois a cada 4h)
  setTimeout(runAutoIASummaryJob, 10 * 60 * 1000);
  console.info("[DAPE Automation] Auto IA Summary: primeiro ciclo em 10 minutos");

  // JOB 6 — Intelligence recálculo (próxima segunda 06:00)
  setTimeout(runIntelligenceRecalcJob, msUntilNextMonday(6));
  console.info(`[DAPE Automation] Intelligence recalc: próxima segunda às 06:00 (${Math.round(msUntilNextMonday(6) / 3600000)}h)`);

  // JOB 7 — Snapshot incremental (começa em 1 min, depois a cada 4h)
  setTimeout(runIncrementalSnapshotJob, 1 * 60 * 1000);
  console.info("[DAPE Automation] Incremental snapshot: primeiro ciclo em 1 minuto");

  console.info("[DAPE Automation] ✅ Todos os jobs agendados com sucesso");
}
