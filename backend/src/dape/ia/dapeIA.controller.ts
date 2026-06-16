import { Request, Response } from "express";
import * as IAService from "./dapeIA.service";

function getCompanyId(req: Request): number {
  return (req as any).user?.companyId || 1;
}

function handleError(res: Response, err: any, context: string): void {
  console.error(`[DAPE IA] ${context}:`, err?.message || err);
  if (err?.message === "RATE_LIMIT_EXCEEDED") {
    res.status(429).json({ error: "Limite de chamadas atingido. Aguarde 1 minuto.", code: "RATE_LIMIT_EXCEEDED" });
    return;
  }
  if (err?.message === "TICKET_NOT_FOUND") {
    res.status(404).json({ error: "Ticket não encontrado" });
    return;
  }
  if (err?.message === "OPENAI_KEY_NOT_CONFIGURED") {
    res.status(503).json({ error: "Chave OpenAI não configurada. Configure em Configurações > Integrações.", code: "OPENAI_KEY_NOT_CONFIGURED" });
    return;
  }
  if (err?.message === "IA_PARSE_ERROR") {
    res.status(502).json({ error: "Resposta da IA inválida. Tente novamente." });
    return;
  }
  res.status(500).json({ error: "Erro interno na IA" });
}

export async function summarize(req: Request, res: Response): Promise<void> {
  try {
    const companyId = getCompanyId(req);
    const ticketId = parseInt(req.params.ticketId, 10);
    if (isNaN(ticketId)) { res.status(400).json({ error: "ticketId inválido" }); return; }
    const result = await IAService.summarizeTicket(ticketId, companyId);
    res.json(result);
  } catch (err) {
    handleError(res, err, "summarize");
  }
}

export async function getSummary(req: Request, res: Response): Promise<void> {
  try {
    const companyId = getCompanyId(req);
    const ticketId = parseInt(req.params.ticketId, 10);
    if (isNaN(ticketId)) { res.status(400).json({ error: "ticketId inválido" }); return; }
    const result = await IAService.getLatestSummary(ticketId, companyId);
    if (!result) { res.json(null); return; }
    res.json(result);
  } catch (err) {
    handleError(res, err, "getSummary");
  }
}

export async function suggestReply(req: Request, res: Response): Promise<void> {
  try {
    const companyId = getCompanyId(req);
    const ticketId = parseInt(req.params.ticketId, 10);
    if (isNaN(ticketId)) { res.status(400).json({ error: "ticketId inválido" }); return; }
    const result = await IAService.suggestReply(ticketId, companyId);
    res.json(result);
  } catch (err) {
    handleError(res, err, "suggestReply");
  }
}

export async function suggestNextAction(req: Request, res: Response): Promise<void> {
  try {
    const companyId = getCompanyId(req);
    const ticketId = parseInt(req.params.ticketId, 10);
    if (isNaN(ticketId)) { res.status(400).json({ error: "ticketId inválido" }); return; }
    const result = await IAService.suggestNextAction(ticketId, companyId);
    res.json(result);
  } catch (err) {
    handleError(res, err, "suggestNextAction");
  }
}

export async function markUsed(req: Request, res: Response): Promise<void> {
  try {
    const companyId = getCompanyId(req);
    const suggestionId = parseInt(req.params.suggestionId, 10);
    if (isNaN(suggestionId)) { res.status(400).json({ error: "suggestionId inválido" }); return; }
    await IAService.markSuggestionUsed(suggestionId, companyId);
    res.json({ ok: true });
  } catch (err) {
    handleError(res, err, "markUsed");
  }
}
