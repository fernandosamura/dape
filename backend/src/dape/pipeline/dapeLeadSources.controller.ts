import { Request, Response } from "express";
import * as LeadSourcesService from "./dapeLeadSources.service";

function getCompanyId(req: Request): number {
  return (req as any).user?.companyId || 1;
}

export async function list(req: Request, res: Response): Promise<void> {
  try {
    const companyId = getCompanyId(req);
    const { contactId, sourceType } = req.query;

    const filters: { contactId?: number; sourceType?: string } = {};
    if (contactId) filters.contactId = parseInt(contactId as string, 10);
    if (sourceType) filters.sourceType = sourceType as string;

    const sources = await LeadSourcesService.listLeadSources(companyId, filters);
    res.json(sources);
  } catch (err) {
    console.error("[DAPE LeadSources] list error:", err);
    res.status(500).json({ error: "Erro ao listar lead sources" });
  }
}

export async function create(req: Request, res: Response): Promise<void> {
  try {
    const companyId = getCompanyId(req);
    const { contactId, sourceType, campaignName, utmSource, utmMedium, utmCampaign } = req.body;

    if (!sourceType) {
      res.status(400).json({ error: "sourceType é obrigatório" });
      return;
    }

    const source = await LeadSourcesService.createLeadSource(companyId, {
      contactId,
      sourceType,
      campaignName,
      utmSource,
      utmMedium,
      utmCampaign,
    });

    res.status(201).json(source);
  } catch (err) {
    console.error("[DAPE LeadSources] create error:", err);
    res.status(500).json({ error: "Erro ao criar lead source" });
  }
}

export async function update(req: Request, res: Response): Promise<void> {
  try {
    const companyId = getCompanyId(req);
    const sourceId = parseInt(req.params.id, 10);

    if (isNaN(sourceId)) {
      res.status(400).json({ error: "id inválido" });
      return;
    }

    const source = await LeadSourcesService.updateLeadSource(sourceId, companyId, req.body);
    res.json(source);
  } catch (err: any) {
    console.error("[DAPE LeadSources] update error:", err);
    if (err?.message === "Lead source não encontrado") {
      res.status(404).json({ error: "Lead source não encontrado" });
      return;
    }
    res.status(500).json({ error: "Erro ao atualizar lead source" });
  }
}

export async function deleteLeadSource(req: Request, res: Response): Promise<void> {
  try {
    const companyId = getCompanyId(req);
    const sourceId = parseInt(req.params.id, 10);

    if (isNaN(sourceId)) {
      res.status(400).json({ error: "id inválido" });
      return;
    }

    await LeadSourcesService.deleteLeadSource(sourceId, companyId);
    res.status(204).send();
  } catch (err: any) {
    console.error("[DAPE LeadSources] delete error:", err);
    if (err?.message === "Lead source não encontrado") {
      res.status(404).json({ error: "Lead source não encontrado" });
      return;
    }
    res.status(500).json({ error: "Erro ao deletar lead source" });
  }
}
