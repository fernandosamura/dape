import { Request, Response } from "express";
import * as GrowthService from "./dapeGrowth.service";

function getCompanyId(req: Request): number {
  return (req as any).user?.companyId || 1;
}

// ── Campaigns ────────────────────────────────────────────────────────────────
export async function listCampaigns(req: Request, res: Response): Promise<void> {
  try {
    const companyId = getCompanyId(req);
    const { status } = req.query as { status?: string };
    res.json(await GrowthService.listCampaigns(companyId, status));
  } catch (err) {
    console.error("[DAPE Growth] listCampaigns:", err);
    res.status(500).json({ error: "Erro ao listar campanhas" });
  }
}

export async function getCampaign(req: Request, res: Response): Promise<void> {
  try {
    const companyId = getCompanyId(req);
    const id = parseInt(req.params.id, 10);
    const campaign = await GrowthService.getCampaign(id, companyId);
    if (!campaign) { res.status(404).json({ error: "Campanha não encontrada" }); return; }
    res.json(campaign);
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar campanha" });
  }
}

export async function createCampaign(req: Request, res: Response): Promise<void> {
  try {
    const companyId = getCompanyId(req);
    if (!req.body.name) { res.status(400).json({ error: "name é obrigatório" }); return; }
    res.status(201).json(await GrowthService.createCampaign(companyId, req.body));
  } catch (err) {
    console.error("[DAPE Growth] createCampaign:", err);
    res.status(500).json({ error: "Erro ao criar campanha" });
  }
}

export async function updateCampaign(req: Request, res: Response): Promise<void> {
  try {
    const companyId = getCompanyId(req);
    const id = parseInt(req.params.id, 10);
    const updated = await GrowthService.updateCampaign(id, companyId, req.body);
    if (!updated) { res.status(404).json({ error: "Campanha não encontrada" }); return; }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Erro ao atualizar campanha" });
  }
}

export async function deleteCampaign(req: Request, res: Response): Promise<void> {
  try {
    const companyId = getCompanyId(req);
    const id = parseInt(req.params.id, 10);
    const deleted = await GrowthService.deleteCampaign(id, companyId);
    if (!deleted) { res.status(404).json({ error: "Campanha não encontrada" }); return; }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Erro ao deletar campanha" });
  }
}

// ── Campaign Results ─────────────────────────────────────────────────────────
export async function getCampaignResults(req: Request, res: Response): Promise<void> {
  try {
    const companyId = getCompanyId(req);
    const campaignId = parseInt(req.params.id, 10);
    res.json(await GrowthService.getCampaignResults(campaignId, companyId));
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar resultados" });
  }
}

export async function upsertCampaignResult(req: Request, res: Response): Promise<void> {
  try {
    const companyId = getCompanyId(req);
    const campaignId = parseInt(req.params.id, 10);
    const result = await GrowthService.upsertCampaignResult(campaignId, companyId, req.body);
    res.json(result);
  } catch (err: any) {
    if (err?.message === "CAMPAIGN_NOT_FOUND") { res.status(404).json({ error: "Campanha não encontrada" }); return; }
    res.status(500).json({ error: "Erro ao lançar resultado" });
  }
}

// ── Goals ────────────────────────────────────────────────────────────────────
export async function listGoals(req: Request, res: Response): Promise<void> {
  try {
    const companyId = getCompanyId(req);
    const { periodType, periodRef } = req.query as { periodType?: string; periodRef?: string };
    res.json(await GrowthService.listGoals(companyId, periodType, periodRef));
  } catch (err) {
    res.status(500).json({ error: "Erro ao listar metas" });
  }
}

export async function upsertGoal(req: Request, res: Response): Promise<void> {
  try {
    const companyId = getCompanyId(req);
    const { periodType, periodRef, metric, targetValue, currentValue } = req.body;
    if (!periodType || !periodRef || !metric || targetValue === undefined) {
      res.status(400).json({ error: "periodType, periodRef, metric e targetValue são obrigatórios" }); return;
    }
    res.json(await GrowthService.upsertGoal(companyId, req.body));
  } catch (err) {
    res.status(500).json({ error: "Erro ao salvar meta" });
  }
}

export async function updateGoalProgress(req: Request, res: Response): Promise<void> {
  try {
    const companyId = getCompanyId(req);
    const id = parseInt(req.params.id, 10);
    const { currentValue } = req.body;
    if (currentValue === undefined) { res.status(400).json({ error: "currentValue é obrigatório" }); return; }
    const updated = await GrowthService.updateGoalProgress(id, companyId, currentValue);
    if (!updated) { res.status(404).json({ error: "Meta não encontrada" }); return; }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Erro ao atualizar progresso" });
  }
}

export async function getDashboard(req: Request, res: Response): Promise<void> {
  try {
    res.json(await GrowthService.getGrowthDashboard(getCompanyId(req)));
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar dashboard" });
  }
}
