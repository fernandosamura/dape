import { Request, Response } from "express";
import * as PipelineService from "./dapePipeline.service";
import { ScoreEventRequest, UpdateEstimatedValueRequest } from "./dapePipeline.types";

function getCompanyId(req: Request): number {
  return (req as any).user?.companyId || 1;
}

export async function getScore(req: Request, res: Response): Promise<void> {
  try {
    const companyId = getCompanyId(req);
    const contactId = parseInt(req.params.contactId, 10);

    if (isNaN(contactId)) {
      res.status(400).json({ error: "contactId inválido" });
      return;
    }

    const score = await PipelineService.getLeadScore(contactId, companyId);
    if (!score) {
      const created = await PipelineService.getOrCreateLeadScore(contactId, companyId);
      res.json(created);
      return;
    }
    res.json(score);
  } catch (err) {
    console.error("[DAPE Pipeline] getScore error:", err);
    res.status(500).json({ error: "Erro ao buscar score" });
  }
}

export async function registerEvent(req: Request, res: Response): Promise<void> {
  try {
    const companyId = getCompanyId(req);
    const body = req.body as ScoreEventRequest;

    if (!body.contactId || !body.eventType) {
      res.status(400).json({ error: "contactId e eventType são obrigatórios" });
      return;
    }

    const updated = await PipelineService.registerScoreEvent(body, companyId);
    res.json(updated);
  } catch (err) {
    console.error("[DAPE Pipeline] registerEvent error:", err);
    res.status(500).json({ error: "Erro ao registrar evento" });
  }
}

export async function listScores(req: Request, res: Response): Promise<void> {
  try {
    const companyId = getCompanyId(req);
    const temperature = req.query.temperature as string | undefined;
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const offset = parseInt(req.query.offset as string, 10) || 0;

    const result = await PipelineService.listLeadScores(companyId, temperature, limit, offset);
    res.json(result);
  } catch (err) {
    console.error("[DAPE Pipeline] listScores error:", err);
    res.status(500).json({ error: "Erro ao listar scores" });
  }
}

export async function updateValue(req: Request, res: Response): Promise<void> {
  try {
    const companyId = getCompanyId(req);
    const scoreId = parseInt(req.params.id, 10);
    const { estimatedValue } = req.body as UpdateEstimatedValueRequest;

    if (isNaN(scoreId) || estimatedValue === undefined) {
      res.status(400).json({ error: "id e estimatedValue são obrigatórios" });
      return;
    }

    const updated = await PipelineService.updateEstimatedValue(scoreId, companyId, estimatedValue);
    if (!updated) {
      res.status(404).json({ error: "Score não encontrado" });
      return;
    }
    res.json(updated);
  } catch (err) {
    console.error("[DAPE Pipeline] updateValue error:", err);
    res.status(500).json({ error: "Erro ao atualizar valor estimado" });
  }
}

export async function getPipelineSummary(req: Request, res: Response): Promise<void> {
  try {
    const companyId = getCompanyId(req);
    const summary = await PipelineService.getPipelineSummary(companyId);
    res.json(summary);
  } catch (err) {
    console.error("[DAPE Pipeline] getPipelineSummary error:", err);
    res.status(500).json({ error: "Erro ao buscar resumo do pipeline" });
  }
}

export async function getContactEvents(req: Request, res: Response): Promise<void> {
  try {
    const companyId = getCompanyId(req);
    const contactId = parseInt(req.params.contactId, 10);

    if (isNaN(contactId)) {
      res.status(400).json({ error: "contactId inválido" });
      return;
    }

    const events = await PipelineService.getScoreEvents(contactId, companyId);
    res.json(events);
  } catch (err) {
    console.error("[DAPE Pipeline] getContactEvents error:", err);
    res.status(500).json({ error: "Erro ao buscar eventos" });
  }
}
