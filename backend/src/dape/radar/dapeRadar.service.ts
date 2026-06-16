import sequelize from "../../database";
import { QueryTypes } from "sequelize";

export interface RadarOpportunity {
  id: number;
  company_id: number;
  source: "google_maps" | "instagram" | "facebook" | "linkedin" | "manual";
  company_name: string;
  phone?: string;
  instagram?: string;
  city?: string;
  segment?: string;
  website?: string;
  google_rating?: number;
  followers?: number;
  opportunity_score: number;
  status: "new" | "contacted" | "discarded" | "converted";
  contact_id?: number;
  notes?: string;
  raw_data?: any;
  imported_at: string;
  updated_at: string;
}

export interface RadarFilters {
  source?: string;
  status?: string;
  segment?: string;
  city?: string;
  minScore?: number;
  search?: string;
  limit?: number;
  offset?: number;
}

function calcOpportunityScore(data: Partial<RadarOpportunity>): number {
  let score = 0;
  if (data.phone) score += 20;
  if (data.instagram) score += 10;
  if (data.website) score += 10;
  if (data.google_rating) {
    if (data.google_rating >= 4.5) score += 20;
    else if (data.google_rating >= 4.0) score += 15;
    else if (data.google_rating >= 3.5) score += 10;
    else score += 5;
  }
  if (data.followers) {
    if (data.followers >= 10000) score += 20;
    else if (data.followers >= 5000) score += 15;
    else if (data.followers >= 1000) score += 10;
    else score += 5;
  }
  if (data.city) score += 5;
  if (data.segment) score += 5;
  return Math.min(score, 100);
}

export async function listOpportunities(
  companyId: number,
  filters: RadarFilters = {}
): Promise<{ data: RadarOpportunity[]; total: number }> {
  const conditions: string[] = ["company_id = :companyId"];
  const replacements: any = { companyId };

  if (filters.source) {
    conditions.push("source = :source");
    replacements.source = filters.source;
  }
  if (filters.status) {
    conditions.push("status = :status");
    replacements.status = filters.status;
  }
  if (filters.segment) {
    conditions.push("segment ILIKE :segment");
    replacements.segment = `%${filters.segment}%`;
  }
  if (filters.city) {
    conditions.push("city ILIKE :city");
    replacements.city = `%${filters.city}%`;
  }
  if (filters.minScore !== undefined) {
    conditions.push("opportunity_score >= :minScore");
    replacements.minScore = filters.minScore;
  }
  if (filters.search) {
    conditions.push("(company_name ILIKE :search OR phone ILIKE :search OR instagram ILIKE :search)");
    replacements.search = `%${filters.search}%`;
  }

  const where = conditions.join(" AND ");
  const limit = filters.limit || 50;
  const offset = filters.offset || 0;

  const [countResult, data] = await Promise.all([
    sequelize.query<{ total: string }>(
      `SELECT COUNT(*) as total FROM dape_radar_opportunities WHERE ${where}`,
      { replacements, type: QueryTypes.SELECT }
    ),
    sequelize.query<RadarOpportunity>(
      `SELECT * FROM dape_radar_opportunities WHERE ${where}
       ORDER BY opportunity_score DESC, imported_at DESC
       LIMIT :limit OFFSET :offset`,
      { replacements: { ...replacements, limit, offset }, type: QueryTypes.SELECT }
    ),
  ]);

  return { data, total: parseInt(countResult[0]?.total || "0") };
}

export async function getOpportunity(
  companyId: number,
  id: number
): Promise<RadarOpportunity | null> {
  const result = await sequelize.query<RadarOpportunity>(
    `SELECT * FROM dape_radar_opportunities WHERE id = :id AND company_id = :companyId LIMIT 1`,
    { replacements: { id, companyId }, type: QueryTypes.SELECT }
  );
  return result[0] || null;
}

export async function createOpportunity(
  companyId: number,
  data: Partial<RadarOpportunity>
): Promise<RadarOpportunity> {
  const score = calcOpportunityScore(data);
  const result = await sequelize.query<RadarOpportunity>(
    `INSERT INTO dape_radar_opportunities
       (company_id, source, company_name, phone, instagram, city, segment, website,
        google_rating, followers, opportunity_score, status, notes, raw_data)
     VALUES
       (:companyId, :source, :company_name, :phone, :instagram, :city, :segment, :website,
        :google_rating, :followers, :score, :status, :notes, :raw_data::jsonb)
     RETURNING *`,
    {
      replacements: {
        companyId,
        source: data.source || "manual",
        company_name: data.company_name || "",
        phone: data.phone || null,
        instagram: data.instagram || null,
        city: data.city || null,
        segment: data.segment || null,
        website: data.website || null,
        google_rating: data.google_rating || null,
        followers: data.followers || null,
        score,
        status: data.status || "new",
        notes: data.notes || null,
        raw_data: JSON.stringify(data.raw_data || {}),
      },
      type: QueryTypes.SELECT,
    }
  );
  return result[0];
}

export async function updateOpportunity(
  companyId: number,
  id: number,
  data: Partial<RadarOpportunity>
): Promise<RadarOpportunity | null> {
  const current = await getOpportunity(companyId, id);
  if (!current) return null;

  const merged = { ...current, ...data };
  const score = calcOpportunityScore(merged);

  const result = await sequelize.query<RadarOpportunity>(
    `UPDATE dape_radar_opportunities SET
       source = :source, company_name = :company_name, phone = :phone,
       instagram = :instagram, city = :city, segment = :segment, website = :website,
       google_rating = :google_rating, followers = :followers,
       opportunity_score = :score, status = :status, notes = :notes,
       updated_at = NOW()
     WHERE id = :id AND company_id = :companyId
     RETURNING *`,
    {
      replacements: {
        id,
        companyId,
        source: merged.source,
        company_name: merged.company_name,
        phone: merged.phone || null,
        instagram: merged.instagram || null,
        city: merged.city || null,
        segment: merged.segment || null,
        website: merged.website || null,
        google_rating: merged.google_rating || null,
        followers: merged.followers || null,
        score,
        status: merged.status,
        notes: merged.notes || null,
      },
      type: QueryTypes.SELECT,
    }
  );
  return result[0] || null;
}

export async function updateOpportunityStatus(
  companyId: number,
  id: number,
  status: RadarOpportunity["status"],
  notes?: string
): Promise<RadarOpportunity | null> {
  const result = await sequelize.query<RadarOpportunity>(
    `UPDATE dape_radar_opportunities SET status = :status,
     notes = COALESCE(:notes, notes), updated_at = NOW()
     WHERE id = :id AND company_id = :companyId RETURNING *`,
    {
      replacements: { id, companyId, status, notes: notes || null },
      type: QueryTypes.SELECT,
    }
  );
  return result[0] || null;
}

export async function deleteOpportunity(
  companyId: number,
  id: number
): Promise<boolean> {
  const result = await sequelize.query(
    `DELETE FROM dape_radar_opportunities WHERE id = :id AND company_id = :companyId`,
    { replacements: { id, companyId }, type: QueryTypes.DELETE }
  );
  return true;
}

export async function bulkImportOpportunities(
  companyId: number,
  opportunities: Partial<RadarOpportunity>[]
): Promise<{ imported: number; skipped: number }> {
  let imported = 0;
  let skipped = 0;

  for (const opp of opportunities) {
    if (!opp.company_name) { skipped++; continue; }
    try {
      await createOpportunity(companyId, opp);
      imported++;
    } catch {
      skipped++;
    }
  }

  return { imported, skipped };
}

export async function convertToContact(
  companyId: number,
  id: number
): Promise<{ opportunity: RadarOpportunity; contactId: number | null }> {
  const opp = await getOpportunity(companyId, id);
  if (!opp) throw new Error("OPPORTUNITY_NOT_FOUND");

  let contactId: number | null = null;

  try {
    // Try to create a Contact in native AtendeChat (company = companyId)
    const existing = await sequelize.query<{ id: number }>(
      `SELECT id FROM "Contacts" WHERE number = :phone AND "companyId" = :companyId LIMIT 1`,
      { replacements: { phone: opp.phone || "", companyId }, type: QueryTypes.SELECT }
    );

    if (existing[0]) {
      contactId = existing[0].id;
    } else if (opp.phone) {
      const newContact = await sequelize.query<{ id: number }>(
        `INSERT INTO "Contacts" (name, number, "isGroup", "companyId", "createdAt", "updatedAt")
         VALUES (:name, :phone, false, :companyId, NOW(), NOW()) RETURNING id`,
        {
          replacements: { name: opp.company_name, phone: opp.phone, companyId },
          type: QueryTypes.SELECT,
        }
      );
      contactId = newContact[0]?.id || null;
    }
  } catch (e) {
    // Contact creation may fail — still mark as converted
  }

  const updated = await sequelize.query<RadarOpportunity>(
    `UPDATE dape_radar_opportunities SET status = 'converted', contact_id = :contactId, updated_at = NOW()
     WHERE id = :id AND company_id = :companyId RETURNING *`,
    { replacements: { id, companyId, contactId }, type: QueryTypes.SELECT }
  );

  return { opportunity: updated[0], contactId };
}

export async function getRadarSummary(
  companyId: number
): Promise<any> {
  const result = await sequelize.query<any>(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'new') as new_count,
       COUNT(*) FILTER (WHERE status = 'contacted') as contacted_count,
       COUNT(*) FILTER (WHERE status = 'discarded') as discarded_count,
       COUNT(*) FILTER (WHERE status = 'converted') as converted_count,
       COUNT(*) as total,
       ROUND(AVG(opportunity_score)) as avg_score,
       COUNT(*) FILTER (WHERE opportunity_score >= 70) as high_score_count,
       json_agg(DISTINCT source) FILTER (WHERE source IS NOT NULL) as sources
     FROM dape_radar_opportunities
     WHERE company_id = :companyId`,
    { replacements: { companyId }, type: QueryTypes.SELECT }
  );
  return result[0] || {};
}
