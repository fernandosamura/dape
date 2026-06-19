import { QueryTypes } from "sequelize";
import sequelize from "../../database";
import DapeDeal from "../../models/DapeDeal";
import Contact from "../../models/Contact";

export async function createDeal(
  companyId: number,
  contactId: number,
  data: {
    title: string;
    value?: number;
    status?: "open" | "won" | "lost";
    stage?: "prospecting" | "qualification" | "proposal" | "negotiation" | "closing";
    expectedCloseDate?: Date;
  }
): Promise<DapeDeal> {
  const deal = await DapeDeal.create({
    companyId,
    contactId,
    title: data.title,
    value: data.value ?? 0,
    status: data.status ?? "open",
    stage: data.stage ?? "prospecting",
    expectedCloseDate: data.expectedCloseDate ?? null,
  } as any);
  return deal;
}

export async function listDeals(
  companyId: number,
  filters?: {
    status?: string;
    stage?: string;
    contactId?: number;
  }
): Promise<DapeDeal[]> {
  const where: any = { companyId };

  if (filters?.status) where.status = filters.status;
  if (filters?.stage) where.stage = filters.stage;
  if (filters?.contactId) where.contactId = filters.contactId;

  const deals = await DapeDeal.findAll({
    where,
    include: [
      {
        model: Contact,
        as: "contact",
        attributes: ["id", "name", "number"],
      },
    ],
    order: [["createdAt", "DESC"]],
  });

  return deals;
}

export async function updateDeal(
  dealId: number,
  companyId: number,
  data: Partial<{
    title: string;
    value: number;
    status: "open" | "won" | "lost";
    stage: "prospecting" | "qualification" | "proposal" | "negotiation" | "closing";
    expectedCloseDate: Date;
    contactId: number;
  }>
): Promise<DapeDeal> {
  const deal = await DapeDeal.findOne({ where: { id: dealId, companyId } });

  if (!deal) {
    throw new Error("Deal não encontrado");
  }

  await deal.update(data);
  return deal;
}

export async function deleteDeal(
  dealId: number,
  companyId: number
): Promise<void> {
  const deal = await DapeDeal.findOne({ where: { id: dealId, companyId } });

  if (!deal) {
    throw new Error("Deal não encontrado");
  }

  await deal.destroy();
}
