import { QueryTypes } from "sequelize";
import sequelize from "../../database";

export interface CompanyProfile {
  id: number;
  contactId: number;
  companyId: number;
  companyName?: string;
  instagramHandle?: string;
  instagramFollowers?: number;
  googleRating?: number;
  googleReviews?: number;
  websiteUrl?: string;
  segment?: string;
  city?: string;
  state?: string;
  digitalPresenceScore: number;
  conversionScore: number;
  relationshipScore: number;
  overallScore: number;
  growthPotential?: "alto" | "medio" | "baixo";
  analysisData: Record<string, any>;
  lastAnalyzedAt?: Date;
}

// ── Score calculation ────────────────────────────────────────────────────────

function calcDigitalPresenceScore(profile: Partial<CompanyProfile>): number {
  let score = 0;
  // Instagram presence
  if (profile.instagramHandle) {
    score += 15;
    const followers = profile.instagramFollowers || 0;
    if (followers >= 10000) score += 25;
    else if (followers >= 5000) score += 20;
    else if (followers >= 1000) score += 15;
    else if (followers >= 500) score += 10;
    else if (followers > 0) score += 5;
  }
  // Google presence
  if (profile.googleRating && profile.googleRating > 0) {
    score += 15;
    const rating = profile.googleRating;
    if (rating >= 4.5) score += 20;
    else if (rating >= 4.0) score += 15;
    else if (rating >= 3.5) score += 10;
    else score += 5;
    const reviews = profile.googleReviews || 0;
    if (reviews >= 100) score += 10;
    else if (reviews >= 50) score += 7;
    else if (reviews >= 10) score += 4;
  }
  // Website
  if (profile.websiteUrl) score += 15;
  return Math.min(100, score);
}

async function calcConversionScore(contactId: number, companyId: number): Promise<number> {
  const stats = await sequelize.query<{
    total: number; closed: number; avg_response: number;
  }>(
    `SELECT
       COUNT(t.id) AS total,
       COUNT(t.id) FILTER (WHERE t.status = 'closed') AS closed,
       AVG(EXTRACT(EPOCH FROM (m."createdAt" - t."createdAt")) / 60) AS avg_response
     FROM "Tickets" t
     LEFT JOIN "Messages" m ON m."ticketId" = t.id AND m."fromMe" = true
       AND m."createdAt" = (SELECT MIN(m2."createdAt") FROM "Messages" m2 WHERE m2."ticketId" = t.id AND m2."fromMe" = true)
     WHERE t."contactId" = :contactId AND t."companyId" = :companyId`,
    { replacements: { contactId, companyId }, type: QueryTypes.SELECT }
  );

  const s = stats[0];
  const total = Number(s?.total || 0);
  if (total === 0) return 0;

  let score = 0;
  const convRate = (Number(s?.closed || 0) / total) * 100;
  if (convRate >= 80) score += 50;
  else if (convRate >= 60) score += 40;
  else if (convRate >= 40) score += 30;
  else if (convRate >= 20) score += 20;
  else score += 10;

  // Volume bonus
  if (total >= 10) score += 20;
  else if (total >= 5) score += 15;
  else if (total >= 2) score += 10;
  else score += 5;

  // Response time bonus
  const avgMin = Number(s?.avg_response || 999);
  if (avgMin <= 5) score += 30;
  else if (avgMin <= 15) score += 20;
  else if (avgMin <= 60) score += 10;

  return Math.min(100, score);
}

async function calcRelationshipScore(contactId: number, companyId: number): Promise<number> {
  const result = await sequelize.query<{
    ticket_count: number; msg_count: number; days_since_last: number; lead_score: number;
  }>(
    `SELECT
       COUNT(DISTINCT t.id) AS ticket_count,
       COUNT(DISTINCT m.id) AS msg_count,
       EXTRACT(DAY FROM NOW() - MAX(t."updatedAt")) AS days_since_last,
       COALESCE(MAX(ls.score), 0) AS lead_score
     FROM "Tickets" t
     LEFT JOIN "Messages" m ON m."ticketId" = t.id AND m."fromMe" = false
     LEFT JOIN dape_lead_scores ls ON ls.contact_id = t."contactId" AND ls.company_id = t."companyId"
     WHERE t."contactId" = :contactId AND t."companyId" = :companyId`,
    { replacements: { contactId, companyId }, type: QueryTypes.SELECT }
  );

  const r = result[0];
  let score = 0;

  const tickets = Number(r?.ticket_count || 0);
  if (tickets >= 5) score += 25;
  else if (tickets >= 3) score += 20;
  else if (tickets >= 1) score += 10;

  const msgs = Number(r?.msg_count || 0);
  if (msgs >= 50) score += 25;
  else if (msgs >= 20) score += 20;
  else if (msgs >= 5) score += 10;

  const daysSince = Number(r?.days_since_last || 999);
  if (daysSince <= 7) score += 25;
  else if (daysSince <= 30) score += 15;
  else if (daysSince <= 90) score += 5;

  const leadScore = Number(r?.lead_score || 0);
  score += Math.round(leadScore * 0.25);

  return Math.min(100, score);
}

function calcGrowthPotential(overall: number): "alto" | "medio" | "baixo" {
  if (overall >= 70) return "alto";
  if (overall >= 40) return "medio";
  return "baixo";
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function analyzeContact(contactId: number, companyId: number): Promise<CompanyProfile> {
  // Get contact base info
  const contact = await sequelize.query<{ name: string; number: string }>(
    `SELECT name, number FROM "Contacts" WHERE id = :contactId AND "companyId" = :companyId`,
    { replacements: { contactId, companyId }, type: QueryTypes.SELECT }
  );
  if (!contact[0]) throw new Error("CONTACT_NOT_FOUND");

  // Get existing profile or start fresh
  const existing = await sequelize.query<any>(
    `SELECT * FROM dape_company_profiles WHERE contact_id = :contactId AND company_id = :companyId`,
    { replacements: { contactId, companyId }, type: QueryTypes.SELECT }
  );
  const current = existing[0] || {};

  const profileData: Partial<CompanyProfile> = {
    instagramHandle: current.instagram_handle,
    instagramFollowers: current.instagram_followers,
    googleRating: current.google_rating,
    googleReviews: current.google_reviews,
    websiteUrl: current.website_url,
  };

  const [digitalScore, convScore, relScore] = await Promise.all([
    Promise.resolve(calcDigitalPresenceScore(profileData)),
    calcConversionScore(contactId, companyId),
    calcRelationshipScore(contactId, companyId),
  ]);

  const overallScore = Math.round((digitalScore * 0.3) + (convScore * 0.4) + (relScore * 0.3));
  const growthPotential = calcGrowthPotential(overallScore);

  const analysisData = {
    digitalPresenceScore: digitalScore,
    conversionScore: convScore,
    relationshipScore: relScore,
    overallScore,
    growthPotential,
    analyzedAt: new Date().toISOString(),
    breakdown: {
      hasInstagram: !!profileData.instagramHandle,
      hasGoogle: !!(profileData.googleRating && profileData.googleRating > 0),
      hasWebsite: !!profileData.websiteUrl,
    },
  };

  const saved = await sequelize.query<any>(
    `INSERT INTO dape_company_profiles
       (contact_id, company_id, company_name, digital_presence_score, conversion_score,
        relationship_score, overall_score, growth_potential, analysis_data, last_analyzed_at, updated_at)
     VALUES (:contactId, :companyId, :companyName, :digitalScore, :convScore,
        :relScore, :overallScore, :growthPotential, :analysisData::jsonb, NOW(), NOW())
     ON CONFLICT (contact_id, company_id) DO UPDATE SET
       digital_presence_score = EXCLUDED.digital_presence_score,
       conversion_score = EXCLUDED.conversion_score,
       relationship_score = EXCLUDED.relationship_score,
       overall_score = EXCLUDED.overall_score,
       growth_potential = EXCLUDED.growth_potential,
       analysis_data = EXCLUDED.analysis_data,
       last_analyzed_at = NOW(),
       updated_at = NOW()
     RETURNING *`,
    {
      replacements: {
        contactId, companyId,
        companyName: current.company_name || contact[0].name,
        digitalScore, convScore, relScore, overallScore,
        growthPotential,
        analysisData: JSON.stringify(analysisData),
      },
      type: QueryTypes.SELECT,
    }
  );
  return saved[0];
}

export async function getProfile(contactId: number, companyId: number): Promise<any | null> {
  const result = await sequelize.query(
    `SELECT p.*, c.name AS contact_name, c.number AS contact_number
     FROM dape_company_profiles p
     JOIN "Contacts" c ON c.id = p.contact_id
     WHERE p.contact_id = :contactId AND p.company_id = :companyId`,
    { replacements: { contactId, companyId }, type: QueryTypes.SELECT }
  );
  return result[0] || null;
}

export async function updateProfileData(
  contactId: number, companyId: number, data: Partial<CompanyProfile>
): Promise<any> {
  // Upsert the editable fields
  const result = await sequelize.query<any>(
    `INSERT INTO dape_company_profiles
       (contact_id, company_id, company_name, instagram_handle, instagram_followers,
        google_rating, google_reviews, website_url, segment, city, state)
     VALUES (:contactId, :companyId, :companyName, :instagramHandle, :instagramFollowers,
        :googleRating, :googleReviews, :websiteUrl, :segment, :city, :state)
     ON CONFLICT (contact_id, company_id) DO UPDATE SET
       company_name = COALESCE(:companyName, dape_company_profiles.company_name),
       instagram_handle = COALESCE(:instagramHandle, dape_company_profiles.instagram_handle),
       instagram_followers = COALESCE(:instagramFollowers, dape_company_profiles.instagram_followers),
       google_rating = COALESCE(:googleRating, dape_company_profiles.google_rating),
       google_reviews = COALESCE(:googleReviews, dape_company_profiles.google_reviews),
       website_url = COALESCE(:websiteUrl, dape_company_profiles.website_url),
       segment = COALESCE(:segment, dape_company_profiles.segment),
       city = COALESCE(:city, dape_company_profiles.city),
       state = COALESCE(:state, dape_company_profiles.state),
       updated_at = NOW()
     RETURNING *`,
    {
      replacements: {
        contactId, companyId,
        companyName: data.companyName || null,
        instagramHandle: data.instagramHandle || null,
        instagramFollowers: data.instagramFollowers ?? null,
        googleRating: data.googleRating ?? null,
        googleReviews: data.googleReviews ?? null,
        websiteUrl: data.websiteUrl || null,
        segment: data.segment || null,
        city: data.city || null,
        state: data.state || null,
      },
      type: QueryTypes.SELECT,
    }
  );
  return result[0];
}

export async function listProfiles(
  companyId: number,
  growthPotential?: string,
  segment?: string,
  limit = 50,
  offset = 0
): Promise<{ profiles: any[]; total: number }> {
  const filters = [
    growthPotential ? `AND p.growth_potential = :growthPotential` : "",
    segment ? `AND p.segment ILIKE :segment` : "",
  ].join(" ");

  const profiles = await sequelize.query(
    `SELECT p.*, c.name AS contact_name, c.number AS contact_number
     FROM dape_company_profiles p
     JOIN "Contacts" c ON c.id = p.contact_id
     WHERE p.company_id = :companyId ${filters}
     ORDER BY p.overall_score DESC
     LIMIT :limit OFFSET :offset`,
    {
      replacements: {
        companyId, limit, offset,
        growthPotential: growthPotential || null,
        segment: segment ? `%${segment}%` : null,
      },
      type: QueryTypes.SELECT,
    }
  );

  const countResult = await sequelize.query<{ count: number }>(
    `SELECT COUNT(*) AS count FROM dape_company_profiles p WHERE company_id = :companyId ${filters}`,
    {
      replacements: { companyId, growthPotential: growthPotential || null, segment: segment ? `%${segment}%` : null },
      type: QueryTypes.SELECT,
    }
  );

  return { profiles, total: Number(countResult[0]?.count || 0) };
}
