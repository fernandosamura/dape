import DapeLeadSource from "../../models/DapeLeadSource";
import Contact from "../../models/Contact";

export async function createLeadSource(
  companyId: number,
  data: {
    contactId?: number;
    sourceType: "whatsapp" | "instagram" | "facebook" | "landing_page" | "radar" | "manual";
    campaignName?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
  }
): Promise<DapeLeadSource> {
  const source = await DapeLeadSource.create({
    companyId,
    contactId: data.contactId ?? null,
    sourceType: data.sourceType,
    campaignName: data.campaignName ?? null,
    utmSource: data.utmSource ?? null,
    utmMedium: data.utmMedium ?? null,
    utmCampaign: data.utmCampaign ?? null,
  } as any);
  return source;
}

export async function listLeadSources(
  companyId: number,
  filters?: {
    contactId?: number;
    sourceType?: string;
  }
): Promise<DapeLeadSource[]> {
  const where: any = { companyId };

  if (filters?.contactId) where.contactId = filters.contactId;
  if (filters?.sourceType) where.sourceType = filters.sourceType;

  const sources = await DapeLeadSource.findAll({
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

  return sources;
}

export async function updateLeadSource(
  sourceId: number,
  companyId: number,
  data: Partial<{
    contactId: number;
    sourceType: "whatsapp" | "instagram" | "facebook" | "landing_page" | "radar" | "manual";
    campaignName: string;
    utmSource: string;
    utmMedium: string;
    utmCampaign: string;
  }>
): Promise<DapeLeadSource> {
  const source = await DapeLeadSource.findOne({ where: { id: sourceId, companyId } });

  if (!source) {
    throw new Error("Lead source não encontrado");
  }

  await source.update(data);
  return source;
}

export async function deleteLeadSource(
  sourceId: number,
  companyId: number
): Promise<void> {
  const source = await DapeLeadSource.findOne({ where: { id: sourceId, companyId } });

  if (!source) {
    throw new Error("Lead source não encontrado");
  }

  await source.destroy();
}
