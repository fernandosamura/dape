export interface DapeLeadScore {
  id: number;
  contactId: number;
  ticketId?: number;
  companyId: number;
  score: number;
  temperature: "cold" | "warm" | "hot";
  closeProbability: number;
  estimatedValue?: number;
  scoreBreakdown: Record<string, number>;
  lastCalculatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface DapeScoreEvent {
  id: number;
  contactId: number;
  ticketId?: number;
  companyId: number;
  eventType: ScoreEventType;
  points: number;
  description?: string;
  createdAt: Date;
}

export type ScoreEventType =
  | "respondeu_rapido"
  | "abriu_proposta"
  | "reuniao"
  | "orcamento"
  | "sem_resposta_3d"
  | "sem_resposta_7d";

export interface ScoreEventRequest {
  contactId: number;
  ticketId?: number;
  eventType: ScoreEventType;
  description?: string;
}

export interface UpdateEstimatedValueRequest {
  estimatedValue: number;
}

export interface PipelineSummary {
  hot: number;
  warm: number;
  cold: number;
  total: number;
  totalEstimatedValue: number;
  hotEstimatedValue: number;
}

export const SCORE_RULES: Record<ScoreEventType, number> = {
  respondeu_rapido: 10,
  abriu_proposta: 15,
  reuniao: 20,
  orcamento: 25,
  sem_resposta_3d: -10,
  sem_resposta_7d: -20,
};

export const SCORE_RULES_LABELS: Record<ScoreEventType, string> = {
  respondeu_rapido: "Respondeu em menos de 5 minutos",
  abriu_proposta: "Abriu a proposta",
  reuniao: "Participou de reunião",
  orcamento: "Solicitou orçamento",
  sem_resposta_3d: "Sem resposta há 3 dias",
  sem_resposta_7d: "Sem resposta há 7 dias",
};
