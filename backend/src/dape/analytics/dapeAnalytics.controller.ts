import { Request, Response } from "express";
import * as AnalyticsService from "./dapeAnalytics.service";

function getCompanyId(req: Request): number {
  return (req as any).user?.companyId || 1;
}

export async function getOverview(req: Request, res: Response): Promise<void> {
  try {
    const companyId = getCompanyId(req);
    const { from, to } = req.query as { from?: string; to?: string };
    const data = await AnalyticsService.getOverview(companyId, from, to);
    res.json(data);
  } catch (err) {
    console.error("[DAPE Analytics] getOverview error:", err);
    res.status(500).json({ error: "Erro ao buscar overview" });
  }
}

export async function getByChannel(req: Request, res: Response): Promise<void> {
  try {
    const companyId = getCompanyId(req);
    const { from, to } = req.query as { from?: string; to?: string };
    const data = await AnalyticsService.getByChannel(companyId, from, to);
    res.json(data);
  } catch (err) {
    console.error("[DAPE Analytics] getByChannel error:", err);
    res.status(500).json({ error: "Erro ao buscar dados por canal" });
  }
}

export async function getFunnel(req: Request, res: Response): Promise<void> {
  try {
    const companyId = getCompanyId(req);
    const data = await AnalyticsService.getFunnel(companyId);
    res.json(data);
  } catch (err) {
    console.error("[DAPE Analytics] getFunnel error:", err);
    res.status(500).json({ error: "Erro ao buscar funil" });
  }
}

export async function getSummaryToday(req: Request, res: Response): Promise<void> {
  try {
    const companyId = getCompanyId(req);
    const data = await AnalyticsService.getSummaryToday(companyId);
    res.json(data);
  } catch (err) {
    console.error("[DAPE Analytics] getSummaryToday error:", err);
    res.status(500).json({ error: "Erro ao buscar resumo do dia" });
  }
}

export async function getDailyTickets(req: Request, res: Response): Promise<void> {
  try {
    const companyId = getCompanyId(req);
    const { from, to } = req.query as { from?: string; to?: string };
    if (!from || !to) {
      res.status(400).json({ error: "Parâmetros from e to são obrigatórios" });
      return;
    }
    const data = await AnalyticsService.getDailyTickets(companyId, from, to);
    res.json(data);
  } catch (err) {
    console.error("[DAPE Analytics] getDailyTickets error:", err);
    res.status(500).json({ error: "Erro ao buscar tickets diários" });
  }
}

export async function triggerSnapshot(req: Request, res: Response): Promise<void> {
  try {
    const companyId = getCompanyId(req);
    await AnalyticsService.saveSnapshot(companyId);
    res.json({ ok: true, message: "Snapshot salvo com sucesso" });
  } catch (err) {
    console.error("[DAPE Analytics] triggerSnapshot error:", err);
    res.status(500).json({ error: "Erro ao salvar snapshot" });
  }
}
