import { QueryTypes } from "sequelize";
import sequelize from "../../database";

export interface OverviewMetrics {
  totalTickets: number;
  openTickets: number;
  closedTickets: number;
  pendingTickets: number;
  conversionRate: number;
  avgFirstResponseMinutes: number;
  totalContacts: number;
  newContactsInPeriod: number;
}

export interface ChannelMetrics {
  channel: string;
  total: number;
  open: number;
  closed: number;
  conversionRate: number;
}

export interface FunnelStage {
  stage: string;
  count: number;
  percentage: number;
}

export interface DailyCount {
  date: string;
  count: number;
}

function buildDateFilter(from?: string, to?: string): { clause: string; params: Record<string, any> } {
  if (from && to) {
    return {
      clause: `AND t."createdAt" >= :from AND t."createdAt" <= :to`,
      params: { from: new Date(from), to: new Date(to + "T23:59:59") },
    };
  }
  if (from) {
    return { clause: `AND t."createdAt" >= :from`, params: { from: new Date(from) } };
  }
  return { clause: "", params: {} };
}

export async function getOverview(
  companyId: number,
  from?: string,
  to?: string
): Promise<OverviewMetrics> {
  const { clause, params } = buildDateFilter(from, to);

  const ticketStats = await sequelize.query<{
    total: number; open: number; closed: number; pending: number;
  }>(
    `SELECT
       COUNT(*) AS total,
       COUNT(*) FILTER (WHERE t.status = 'open') AS open,
       COUNT(*) FILTER (WHERE t.status = 'closed') AS closed,
       COUNT(*) FILTER (WHERE t.status = 'pending') AS pending
     FROM "Tickets" t
     WHERE t."companyId" = :companyId ${clause}`,
    { replacements: { companyId, ...params }, type: QueryTypes.SELECT }
  );

  const stats = ticketStats[0];
  const total = Number(stats?.total || 0);
  const closed = Number(stats?.closed || 0);
  const conversionRate = total > 0 ? Math.round((closed / total) * 100) : 0;

  // Avg first response: time between ticket creation and first agent message
  const avgResponseResult = await sequelize.query<{ avg_minutes: number }>(
    `SELECT AVG(EXTRACT(EPOCH FROM (m."createdAt" - t."createdAt")) / 60) AS avg_minutes
     FROM "Tickets" t
     JOIN "Messages" m ON m."ticketId" = t.id AND m."fromMe" = true
     WHERE t."companyId" = :companyId
       AND m."createdAt" = (
         SELECT MIN(m2."createdAt") FROM "Messages" m2
         WHERE m2."ticketId" = t.id AND m2."fromMe" = true
       ) ${clause.replace(/t\."createdAt"/g, 't."createdAt"')}`,
    { replacements: { companyId, ...params }, type: QueryTypes.SELECT }
  );

  const avgFirstResponse = Math.round(Number(avgResponseResult[0]?.avg_minutes || 0));

  // New contacts in period
  const contactsResult = await sequelize.query<{ new_contacts: number; total_contacts: number }>(
    `SELECT
       COUNT(*) FILTER (WHERE c."createdAt" >= COALESCE(:from::timestamp, '1970-01-01') AND c."createdAt" <= COALESCE(:to::timestamp, NOW())) AS new_contacts,
       COUNT(*) AS total_contacts
     FROM "Contacts" c
     WHERE c."companyId" = :companyId`,
    {
      replacements: {
        companyId,
        from: from ? new Date(from) : null,
        to: to ? new Date(to + "T23:59:59") : null,
      },
      type: QueryTypes.SELECT,
    }
  );

  return {
    totalTickets: total,
    openTickets: Number(stats?.open || 0),
    closedTickets: closed,
    pendingTickets: Number(stats?.pending || 0),
    conversionRate,
    avgFirstResponseMinutes: avgFirstResponse,
    totalContacts: Number(contactsResult[0]?.total_contacts || 0),
    newContactsInPeriod: Number(contactsResult[0]?.new_contacts || 0),
  };
}

export async function getByChannel(
  companyId: number,
  from?: string,
  to?: string
): Promise<ChannelMetrics[]> {
  const { clause, params } = buildDateFilter(from, to);

  const rows = await sequelize.query<{
    channel: string; total: number; open: number; closed: number;
  }>(
    `SELECT
       COALESCE(w.channel, 'whatsapp') AS channel,
       COUNT(t.id) AS total,
       COUNT(t.id) FILTER (WHERE t.status = 'open') AS open,
       COUNT(t.id) FILTER (WHERE t.status = 'closed') AS closed
     FROM "Tickets" t
     LEFT JOIN "Whatsapps" w ON w.id = t."whatsappId"
     WHERE t."companyId" = :companyId ${clause}
     GROUP BY COALESCE(w.channel, 'whatsapp')
     ORDER BY total DESC`,
    { replacements: { companyId, ...params }, type: QueryTypes.SELECT }
  );

  return rows.map((r) => ({
    channel: r.channel,
    total: Number(r.total),
    open: Number(r.open),
    closed: Number(r.closed),
    conversionRate: Number(r.total) > 0 ? Math.round((Number(r.closed) / Number(r.total)) * 100) : 0,
  }));
}

export async function getFunnel(companyId: number): Promise<FunnelStage[]> {
  const result = await sequelize.query<{ status: string; count: number }>(
    `SELECT status, COUNT(*) AS count FROM "Tickets"
     WHERE "companyId" = :companyId
     GROUP BY status ORDER BY count DESC`,
    { replacements: { companyId }, type: QueryTypes.SELECT }
  );

  const total = result.reduce((sum, r) => sum + Number(r.count), 0);
  const stageOrder = ["pending", "open", "closed"];

  return stageOrder.map((stage) => {
    const found = result.find((r) => r.status === stage);
    const count = Number(found?.count || 0);
    return {
      stage,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0,
    };
  });
}

export async function getSummaryToday(companyId: number): Promise<{
  ticketsCreated: number;
  ticketsClosed: number;
  messagesReceived: number;
  messagesSent: number;
  newContacts: number;
}> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [tickets, messages, contacts] = await Promise.all([
    sequelize.query<{ created: number; closed: number }>(
      `SELECT
         COUNT(*) FILTER (WHERE "createdAt" >= :today) AS created,
         COUNT(*) FILTER (WHERE "updatedAt" >= :today AND status = 'closed') AS closed
       FROM "Tickets" WHERE "companyId" = :companyId`,
      { replacements: { companyId, today }, type: QueryTypes.SELECT }
    ),
    sequelize.query<{ received: number; sent: number }>(
      `SELECT
         COUNT(*) FILTER (WHERE "fromMe" = false) AS received,
         COUNT(*) FILTER (WHERE "fromMe" = true) AS sent
       FROM "Messages"
       WHERE "companyId" = :companyId AND "createdAt" >= :today`,
      { replacements: { companyId, today }, type: QueryTypes.SELECT }
    ),
    sequelize.query<{ count: number }>(
      `SELECT COUNT(*) AS count FROM "Contacts"
       WHERE "companyId" = :companyId AND "createdAt" >= :today`,
      { replacements: { companyId, today }, type: QueryTypes.SELECT }
    ),
  ]);

  return {
    ticketsCreated: Number(tickets[0]?.created || 0),
    ticketsClosed: Number(tickets[0]?.closed || 0),
    messagesReceived: Number(messages[0]?.received || 0),
    messagesSent: Number(messages[0]?.sent || 0),
    newContacts: Number(contacts[0]?.count || 0),
  };
}

export async function getDailyTickets(
  companyId: number,
  from: string,
  to: string
): Promise<DailyCount[]> {
  const rows = await sequelize.query<{ date: string; count: number }>(
    `SELECT DATE(t."createdAt") AS date, COUNT(*) AS count
     FROM "Tickets" t
     WHERE t."companyId" = :companyId
       AND t."createdAt" >= :from AND t."createdAt" <= :to
     GROUP BY DATE(t."createdAt")
     ORDER BY date ASC`,
    {
      replacements: { companyId, from: new Date(from), to: new Date(to + "T23:59:59") },
      type: QueryTypes.SELECT,
    }
  );
  return rows.map((r) => ({ date: String(r.date).substring(0, 10), count: Number(r.count) }));
}

export async function saveSnapshot(companyId: number): Promise<void> {
  const today = new Date().toISOString().split("T")[0];
  const overview = await getOverview(companyId);
  const channels = await getByChannel(companyId);

  const metrics: Array<{ key: string; value: number; dimension?: string; dimensionValue?: string }> = [
    { key: "total_tickets", value: overview.totalTickets },
    { key: "open_tickets", value: overview.openTickets },
    { key: "closed_tickets", value: overview.closedTickets },
    { key: "pending_tickets", value: overview.pendingTickets },
    { key: "conversion_rate", value: overview.conversionRate },
    { key: "avg_first_response_minutes", value: overview.avgFirstResponseMinutes },
    { key: "new_contacts", value: overview.newContactsInPeriod },
    ...channels.map((ch) => ({
      key: "tickets_by_channel",
      value: ch.total,
      dimension: "channel",
      dimensionValue: ch.channel,
    })),
  ];

  for (const m of metrics) {
    await sequelize.query(
      `INSERT INTO dape_analytics_snapshots
         (snapshot_date, company_id, metric_key, metric_value, dimension, dimension_value)
       VALUES (:date, :companyId, :key, :value, :dimension, :dimensionValue)
       ON CONFLICT (snapshot_date, company_id, metric_key, COALESCE(dimension,''), COALESCE(dimension_value,''))
       DO UPDATE SET metric_value = EXCLUDED.metric_value`,
      {
        replacements: {
          date: today, companyId, key: m.key, value: m.value,
          dimension: m.dimension || null, dimensionValue: m.dimensionValue || null,
        },
        type: QueryTypes.INSERT,
      }
    );
  }
}
