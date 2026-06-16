import { Request, Response } from "express";
import * as radarService from "./dapeRadar.service";

export async function listOpportunities(req: Request, res: Response) {
  try {
    const companyId = (req as any).user?.companyId || 1;
    const { source, status, segment, city, minScore, search, limit, offset } = req.query;
    const result = await radarService.listOpportunities(companyId, {
      source: source as string,
      status: status as string,
      segment: segment as string,
      city: city as string,
      minScore: minScore ? Number(minScore) : undefined,
      search: search as string,
      limit: limit ? Number(limit) : 50,
      offset: offset ? Number(offset) : 0,
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function getOpportunity(req: Request, res: Response) {
  try {
    const companyId = (req as any).user?.companyId || 1;
    const opp = await radarService.getOpportunity(companyId, Number(req.params.id));
    if (!opp) return res.status(404).json({ error: "Oportunidade não encontrada" });
    res.json(opp);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function createOpportunity(req: Request, res: Response) {
  try {
    const companyId = (req as any).user?.companyId || 1;
    const opp = await radarService.createOpportunity(companyId, req.body);
    res.status(201).json(opp);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function updateOpportunity(req: Request, res: Response) {
  try {
    const companyId = (req as any).user?.companyId || 1;
    const opp = await radarService.updateOpportunity(companyId, Number(req.params.id), req.body);
    if (!opp) return res.status(404).json({ error: "Oportunidade não encontrada" });
    res.json(opp);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function updateStatus(req: Request, res: Response) {
  try {
    const companyId = (req as any).user?.companyId || 1;
    const { status, notes } = req.body;
    const valid = ["new", "contacted", "discarded", "converted"];
    if (!valid.includes(status)) {
      return res.status(400).json({ error: "Status inválido" });
    }
    const opp = await radarService.updateOpportunityStatus(
      companyId, Number(req.params.id), status, notes
    );
    if (!opp) return res.status(404).json({ error: "Oportunidade não encontrada" });
    res.json(opp);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function deleteOpportunity(req: Request, res: Response) {
  try {
    const companyId = (req as any).user?.companyId || 1;
    await radarService.deleteOpportunity(companyId, Number(req.params.id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function bulkImport(req: Request, res: Response) {
  try {
    const companyId = (req as any).user?.companyId || 1;
    const { opportunities } = req.body;
    if (!Array.isArray(opportunities) || opportunities.length === 0) {
      return res.status(400).json({ error: "Lista de oportunidades é obrigatória" });
    }
    if (opportunities.length > 500) {
      return res.status(400).json({ error: "Máximo de 500 oportunidades por importação" });
    }
    const result = await radarService.bulkImportOpportunities(companyId, opportunities);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function convertToContact(req: Request, res: Response) {
  try {
    const companyId = (req as any).user?.companyId || 1;
    const result = await radarService.convertToContact(companyId, Number(req.params.id));
    res.json(result);
  } catch (err: any) {
    if (err.message === "OPPORTUNITY_NOT_FOUND") {
      return res.status(404).json({ error: "Oportunidade não encontrada" });
    }
    res.status(500).json({ error: err.message });
  }
}

export async function getSummary(req: Request, res: Response) {
  try {
    const companyId = (req as any).user?.companyId || 1;
    const summary = await radarService.getRadarSummary(companyId);
    res.json(summary);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
