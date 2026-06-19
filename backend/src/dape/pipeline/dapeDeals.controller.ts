import { Request, Response } from "express";
import * as DealsService from "./dapeDeals.service";

function getCompanyId(req: Request): number {
  return (req as any).user?.companyId || 1;
}

export async function list(req: Request, res: Response): Promise<void> {
  try {
    const companyId = getCompanyId(req);
    const { status, stage, contactId } = req.query;

    const filters: { status?: string; stage?: string; contactId?: number } = {};
    if (status) filters.status = status as string;
    if (stage) filters.stage = stage as string;
    if (contactId) filters.contactId = parseInt(contactId as string, 10);

    const deals = await DealsService.listDeals(companyId, filters);
    res.json(deals);
  } catch (err) {
    console.error("[DAPE Deals] list error:", err);
    res.status(500).json({ error: "Erro ao listar deals" });
  }
}

export async function create(req: Request, res: Response): Promise<void> {
  try {
    const companyId = getCompanyId(req);
    const { contactId, title, value, status, stage, expectedCloseDate } = req.body;

    if (!contactId || !title) {
      res.status(400).json({ error: "contactId e title são obrigatórios" });
      return;
    }

    const deal = await DealsService.createDeal(companyId, parseInt(contactId, 10), {
      title,
      value,
      status,
      stage,
      expectedCloseDate,
    });

    res.status(201).json(deal);
  } catch (err) {
    console.error("[DAPE Deals] create error:", err);
    res.status(500).json({ error: "Erro ao criar deal" });
  }
}

export async function update(req: Request, res: Response): Promise<void> {
  try {
    const companyId = getCompanyId(req);
    const dealId = parseInt(req.params.id, 10);

    if (isNaN(dealId)) {
      res.status(400).json({ error: "id inválido" });
      return;
    }

    const deal = await DealsService.updateDeal(dealId, companyId, req.body);
    res.json(deal);
  } catch (err: any) {
    console.error("[DAPE Deals] update error:", err);
    if (err?.message === "Deal não encontrado") {
      res.status(404).json({ error: "Deal não encontrado" });
      return;
    }
    res.status(500).json({ error: "Erro ao atualizar deal" });
  }
}

export async function deleteDeal(req: Request, res: Response): Promise<void> {
  try {
    const companyId = getCompanyId(req);
    const dealId = parseInt(req.params.id, 10);

    if (isNaN(dealId)) {
      res.status(400).json({ error: "id inválido" });
      return;
    }

    await DealsService.deleteDeal(dealId, companyId);
    res.status(204).send();
  } catch (err: any) {
    console.error("[DAPE Deals] delete error:", err);
    if (err?.message === "Deal não encontrado") {
      res.status(404).json({ error: "Deal não encontrado" });
      return;
    }
    res.status(500).json({ error: "Erro ao deletar deal" });
  }
}
