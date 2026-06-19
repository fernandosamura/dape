import React, { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, FunnelChart, Funnel, LabelList, Cell,
} from "recharts";
import api from "../../services/api";
import DapeModuleGuard from "../../components/dape/DapeModuleGuard";

// ── Helpers ────────────────────────────────────────────────────────────────
const PERIODS = [
  { label: "Hoje", value: "today" },
  { label: "7 dias", value: "7d" },
  { label: "30 dias", value: "30d" },
  { label: "90 dias", value: "90d" },
];

function buildRange(period) {
  const to = new Date();
  const from = new Date();
  if (period === "7d") from.setDate(from.getDate() - 7);
  else if (period === "30d") from.setDate(from.getDate() - 30);
  else if (period === "90d") from.setDate(from.getDate() - 90);
  else { from.setHours(0, 0, 0, 0); }
  return {
    from: from.toISOString().split("T")[0],
    to: to.toISOString().split("T")[0],
  };
}

const CHANNEL_COLORS = {
  whatsapp: "#25D366",
  facebook: "#1877F2",
  instagram: "#E1306C",
  default: "#6B7280",
};

const FUNNEL_COLORS = { pending: "#F59E0B", open: "#3B82F6", closed: "#22C55E" };
const FUNNEL_LABELS = { pending: "Pendente", open: "Aberto", closed: "Fechado" };

// ── Sub-components ──────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color = "#3B82F6" }) {
  return (
    <div style={{
      flex: 1, minWidth: 140, padding: 18, borderRadius: 12,
      background: "#fff", border: `1.5px solid ${color}20`,
      boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
    }}>
      <div style={{ fontSize: 28, fontWeight: "bold", color }}>{value}</div>
      <div style={{ fontSize: 12, color: "#6B7280", marginTop: 3 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div style={{ fontSize: 14, fontWeight: 700, color: "#374151", margin: "24px 0 12px" }}>
      {children}
    </div>
  );
}

// ── Main Dashboard ──────────────────────────────────────────────────────────
function AnalyticsDashboard() {
  const [period, setPeriod] = useState("30d");
  const [overview, setOverview] = useState(null);
  const [channels, setChannels] = useState([]);
  const [funnel, setFunnel] = useState([]);
  const [daily, setDaily] = useState([]);
  const [today, setToday] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const range = buildRange(period);
      const qs = period === "today" ? "" : `?from=${range.from}&to=${range.to}`;

      const [ovRes, chRes, fnRes, dlRes, tdRes] = await Promise.all([
        api.get(`/dape/analytics/overview${qs}`),
        api.get(`/dape/analytics/by-channel${qs}`),
        api.get("/dape/analytics/funnel"),
        api.get(`/dape/analytics/daily?from=${range.from}&to=${range.to}`),
        api.get("/dape/analytics/summary/today"),
      ]);
      setOverview(ovRes.data);
      setChannels(chRes.data);
      setFunnel(fnRes.data.map(f => ({
        ...f,
        name: FUNNEL_LABELS[f.stage] || f.stage,
        fill: FUNNEL_COLORS[f.stage] || "#6B7280",
      })));
      setDaily(dlRes.data);
      setToday(tdRes.data);
    } catch (err) {
      console.error("[DapeAnalytics] load error:", err);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const containerStyle = {
    padding: "12px 16px",
    fontFamily: "inherit",
    background: "#F9FAFB",
    minHeight: "100vh",
  };

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div style={{ fontSize: 20, fontWeight: "bold", color: "#111827" }}>📊 DAPLE Analytics</div>
        <div style={{ display: "flex", gap: 6 }}>
          {PERIODS.map(p => (
            <button key={p.value} onClick={() => setPeriod(p.value)} style={{
              padding: "5px 14px", borderRadius: 20, fontSize: 12, cursor: "pointer",
              border: "none",
              background: period === p.value ? "#3B82F6" : "#E5E7EB",
              color: period === p.value ? "#fff" : "#374151",
              fontWeight: period === p.value ? "bold" : "normal",
            }}>{p.label}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ color: "#9CA3AF", padding: 40, textAlign: "center" }}>Carregando dados...</div>
      ) : (
        <>
          {/* Today quick strip */}
          {today && (
            <>
              <SectionTitle>Resumo de Hoje</SectionTitle>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
                <KpiCard label="Tickets abertos" value={today.ticketsCreated} color="#3B82F6" />
                <KpiCard label="Tickets fechados" value={today.ticketsClosed} color="#22C55E" />
                <KpiCard label="Msgs recebidas" value={today.messagesReceived} color="#F59E0B" />
                <KpiCard label="Msgs enviadas" value={today.messagesSent} color="#8B5CF6" />
                <KpiCard label="Novos contatos" value={today.newContacts} color="#EC4899" />
              </div>
            </>
          )}

          {/* Overview KPIs */}
          {overview && (
            <>
              <SectionTitle>KPIs do Período</SectionTitle>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <KpiCard label="Total de Tickets" value={overview.totalTickets} color="#3B82F6" />
                <KpiCard label="Taxa de Conversão" value={`${overview.conversionRate}%`} color="#22C55E" />
                <KpiCard label="Tickets Fechados" value={overview.closedTickets} color="#22C55E" />
                <KpiCard label="Tickets Pendentes" value={overview.pendingTickets} color="#F59E0B" />
                <KpiCard
                  label="Tempo Médio 1ª Resp."
                  value={`${overview.avgFirstResponseMinutes}min`}
                  color="#8B5CF6"
                />
                <KpiCard
                  label="Novos Contatos"
                  value={overview.newContactsInPeriod}
                  sub={`Total: ${overview.totalContacts}`}
                  color="#EC4899"
                />
              </div>
            </>
          )}

          {/* Daily tickets line chart */}
          {daily.length > 0 && (
            <>
              <SectionTitle>Evolução de Tickets por Dia</SectionTitle>
              <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflowX: "auto" }}>
                <div style={{ padding: "16px 8px", minWidth: 320 }}>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={daily} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={v => v.slice(5)} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Line type="monotone" dataKey="count" stroke="#3B82F6" strokeWidth={2} dot={false} name="Tickets" />
                  </LineChart>
                </ResponsiveContainer>
                </div>
              </div>
            </>
          )}

          {/* Channel bar chart */}
          {channels.length > 0 && (
            <>
              <SectionTitle>Tickets por Canal</SectionTitle>
              <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflowX: "auto" }}>
                <div style={{ padding: "16px 8px", minWidth: 320 }}>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={channels} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                    <XAxis dataKey="channel" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="total" name="Total" radius={[4, 4, 0, 0]}>
                      {channels.map((entry, index) => (
                        <Cell key={index} fill={CHANNEL_COLORS[entry.channel] || CHANNEL_COLORS.default} />
                      ))}
                    </Bar>
                    <Bar dataKey="closed" name="Fechados" fill="#22C55E" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                </div>
              </div>
            </>
          )}

          {/* Funnel */}
          {funnel.length > 0 && (
            <>
              <SectionTitle>Funil de Conversão</SectionTitle>
              <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflowX: "auto" }}>
                <div style={{ padding: "16px 8px", minWidth: 280 }}>
                <ResponsiveContainer width="100%" height={200}>
                  <FunnelChart>
                    <Tooltip />
                    <Funnel dataKey="count" data={funnel} isAnimationActive>
                      <LabelList position="center" fill="#fff" style={{ fontSize: 13, fontWeight: "bold" }} formatter={(v, entry) => `${entry?.name}: ${v}`} />
                      {funnel.map((entry, index) => (
                        <Cell key={index} fill={entry.fill} />
                      ))}
                    </Funnel>
                  </FunnelChart>
                </ResponsiveContainer>
                </div>
              </div>
            </>
          )}

          {/* Channel table */}
          {channels.length > 0 && (
            <>
              <SectionTitle>Detalhes por Canal</SectionTitle>
              <div style={{ background: "#fff", borderRadius: 12, overflowX: "auto", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#F9FAFB" }}>
                      {["Canal", "Total", "Abertos", "Fechados", "Conversão"].map(h => (
                        <th key={h} style={{ textAlign: "left", padding: "10px 14px", color: "#6B7280", fontSize: 11, fontWeight: 600, textTransform: "uppercase", borderBottom: "1px solid #E5E7EB" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {channels.map((ch, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #F3F4F6" }}>
                        <td style={{ padding: "9px 14px", fontWeight: "bold", color: CHANNEL_COLORS[ch.channel] || CHANNEL_COLORS.default }}>
                          {ch.channel}
                        </td>
                        <td style={{ padding: "9px 14px" }}>{ch.total}</td>
                        <td style={{ padding: "9px 14px" }}>{ch.open}</td>
                        <td style={{ padding: "9px 14px" }}>{ch.closed}</td>
                        <td style={{ padding: "9px 14px" }}>
                          <span style={{
                            padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: "bold",
                            background: ch.conversionRate >= 50 ? "#D1FAE5" : ch.conversionRate >= 25 ? "#FEF3C7" : "#FEE2E2",
                            color: ch.conversionRate >= 50 ? "#065F46" : ch.conversionRate >= 25 ? "#92400E" : "#991B1B",
                          }}>{ch.conversionRate}%</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

export default function DapeAnalyticsPage() {
  return (
    <DapeModuleGuard
      moduleKey="dape_analytics"
      fallback={<div style={{ padding: 32, color: "#9CA3AF" }}>Módulo Analytics não habilitado no seu plano.</div>}
    >
      <AnalyticsDashboard />
    </DapeModuleGuard>
  );
}
