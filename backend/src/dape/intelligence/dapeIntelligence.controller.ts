import { Request, Response } from "express";
import * as IntelligenceService from "./dapeIntelligence.service";

function getCompanyId(req: Request): number {
  return (req as any).user?.companyId || 1;
}

export async function analyzeContact(req: Request, res: Response): Promise<void> {
  try {
    const companyId = getCompanyId(req);
    const contactId = parseInt(req.params.contactId, 10);
    if (isNaN(contactId)) { res.status(400).json({ error: "contactId inválido" }); return; }
    const result = await IntelligenceService.analyzeContact(contactId, companyId);
    res.json(result);
  } catch (err: any) {
    if (err?.message === "CONTACT_NOT_FOUND") { res.status(404).json({ error: "Contato não encontrado" }); return; }
    console.error("[DAPE Intelligence] analyzeContact:", err);
    res.status(500).json({ error: "Erro ao analisar contato" });
  }
}

export async function getProfile(req: Request, res: Response): Promise<void> {
  try {
    const companyId = getCompanyId(req);
    const contactId = parseInt(req.params.contactId, 10);
    if (isNaN(contactId)) { res.status(400).json({ error: "contactId inválido" }); return; }
    const profile = await IntelligenceService.getProfile(contactId, companyId);
    if (!profile) { res.json(null); return; }
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar perfil" });
  }
}

export async function updateProfile(req: Request, res: Response): Promise<void> {
  try {
    const companyId = getCompanyId(req);
    const contactId = parseInt(req.params.contactId, 10);
    if (isNaN(contactId)) { res.status(400).json({ error: "contactId inválido" }); return; }
    const result = await IntelligenceService.updateProfileData(contactId, companyId, req.body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Erro ao atualizar perfil" });
  }
}

export async function listProfiles(req: Request, res: Response): Promise<void> {
  try {
    const companyId = getCompanyId(req);
    const { growthPotential, segment } = req.query as { growthPotential?: string; segment?: string };
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const offset = parseInt(req.query.offset as string, 10) || 0;
    const result = await IntelligenceService.listProfiles(companyId, growthPotential, segment, limit, offset);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Erro ao listar perfis" });
  }
}
