import React, { useState, useEffect, useCallback } from "react";
import api from "../../../services/api";
import dapeShieldService from "../../../services/dapeShieldService";
import DapeModuleGuard from "../../../components/dape/DapeModuleGuard";
import toastError from "../../../errors/toastError";

// ── Helpers ───────────────────────────────────────────────────────────────────
const RISK_CONFIG = {
  low:      { label: "Baixo",    bg: "#D1FAE5", color: "#065F46", dot: "#22C55E" },
  medium:   { label: "Médio",    bg: "#FEF3C7", color: "#92400E", dot: "#F59E0B" },
  high:     { label: "Alto",     bg: "#FEE2E2", color: "#991B1B", dot: "#EF4444" },
  critical: { label: "Crítico",  bg: "#7F1D1D", color: "#FEF2F2", dot: "#7F1D1D" },
};

function getRiskLevel(quarantine, counters, config, apiRisk) {
  if (apiRisk?.level) return apiRisk.level.toLowerCase();
  if (quarantine) return "high";
  if (!config) return "low";
  const dayCounter = (counters || []).find(c => c.window_type === "day");
  const dayCount = dayCounter ? Number(dayCounter.count) : 0;
  const maxDay = Number(config.max_msgs_per_day) || 1000;
  const pct = maxDay > 0 ? (dayCount / maxDay) * 100 : 0;
  if (pct >= 80) return "high";
  if (pct >= 50) return "medium";
  return "low";
}

function getStatsRiskForConn(stats, connId) {
  const rows = stats.filter(r => String(r.whatsapp_id) === String(connId));
  const blocked = rows.reduce((s, r) => s + Number(r.blocked || 0), 0);
  const quarantined = rows.some(r => Number(r.quarantined || 0) > 0);
  if (quarantined) return "critical";
  if (blocked > 10) return "high";
  if (blocked > 2) return "medium";
  return "low";
}

function fmt(dt) {
  if (!dt) return "—";
  try { return new Date(dt).toLocaleString("pt-BR"); } catch { return dt; }
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color = "#3B82F6" }) {
  return (
    <div style={{
      flex: 1, minWidth: 130, padding: 16, borderRadius: 12,
      background: "#fff", border: `1.5px solid ${color}20`,
      boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
    }}>
      <div style={{ fontSize: 26, fontWeight: "bold", color }}>{value ?? "—"}</div>
      <div style={{ fontSize: 12, color: "#6B7280", marginTop: 3 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div style={{ fontSize: 14, fontWeight: 700, color: "#374151", margin: "20px 0 10px" }}>
      {children}
    </div>
  );
}

function RiskChip({ level }) {
  const cfg = RISK_CONFIG[level] || RISK_CONFIG.low;
  return (
    <span style={{
      padding: "3px 10px", borderRadius: 12, fontSize: 12, fontWeight: "bold",
      background: cfg.bg, color: cfg.color,
    }}>{cfg.label}</span>
  );
}

// ── Connection Sidebar ─────────────────────────────────────────────────────────
function ConnectionSidebar({ connections, selectedId, onSelect, stats }) {
  if (connections.length === 0) {
    return (
      <div style={{ padding: 16, color: "#9CA3AF", fontSize: 13, textAlign: "center" }}>
        Nenhuma conexão encontrada.
      </div>
    );
  }
  return (
    <div style={{ overflowY: "auto", maxHeight: 500 }}>
      {connections.map(c => {
        const isSelected = String(c.id) === String(selectedId);
        const riskLevel = getStatsRiskForConn(stats, c.id);
        const dot = (RISK_CONFIG[riskLevel] || RISK_CONFIG.low).dot;
        return (
          <div
            key={c.id}
            onClick={() => onSelect(String(c.id))}
            style={{
              padding: "12px 14px",
              cursor: "pointer",
              borderRadius: 8,
              marginBottom: 4,
              background: isSelected ? "#EFF6FF" : "transparent",
              border: isSelected ? "1.5px solid #93C5FD" : "1.5px solid transparent",
              transition: "all 0.15s",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{
                width: 10, height: 10, borderRadius: "50%",
                background: dot, flexShrink: 0, display: "inline-block",
              }} />
              <span style={{
                fontSize: 13, fontWeight: isSelected ? 700 : 500,
                color: isSelected ? "#1E40AF" : "#374151",
                flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {c.name}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 5, paddingLeft: 18 }}>
              <RiskChip level={riskLevel} />
              <span style={{ fontSize: 11, color: "#9CA3AF" }}>{c.status || "—"}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Config Form ────────────────────────────────────────────────────────────────
function ConfigCard({ whatsappId, connections, onSaved }) {
  const [cfg, setCfg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!whatsappId) return;
    setLoading(true);
    try {
      const { data } = await dapeShieldService.getConfig(whatsappId);
      setCfg(data || {
        is_enabled: true,
        max_msgs_per_minute: 20,
        max_msgs_per_hour: 200,
        max_msgs_per_day: 1000,
        business_hours_start: null,
        business_hours_end: null,
        respect_business_hours: false,
        auto_quarantine_enabled: true,
        quarantine_threshold_min: 5,
        quarantine_duration_min: 30,
      });
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, [whatsappId]);

  useEffect(() => { load(); }, [load]);

  function set(k, v) { setCfg(f => ({ ...f, [k]: v })); }

  async function handleSave() {
    setSaving(true);
    try {
      await dapeShieldService.updateConfig(whatsappId, cfg);
      if (onSaved) onSaved();
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleApplyToAll() {
    if (!cfg || !connections || connections.length === 0) return;
    if (!window.confirm(`Aplicar esta configuração para todas as ${connections.length} conexões?`)) return;
    setSaving(true);
    try {
      await Promise.all(connections.map(c => dapeShieldService.updateConfig(c.id, cfg)));
      if (onSaved) onSaved();
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  }

  const inp = {
    padding: "7px 10px", border: "1px solid #D1D5DB", borderRadius: 6,
    fontSize: 13, boxSizing: "border-box", outline: "none", width: "100%",
  };
  const labelStyle = { fontSize: 12, color: "#6B7280", marginBottom: 3, display: "block" };

  if (loading) return <div style={{ color: "#9CA3AF", padding: 16, textAlign: "center" }}>Carregando configurações...</div>;
  if (!cfg) return null;

  return (
    <div>
      {/* Toggles */}
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 16 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
          <input type="checkbox" checked={!!cfg.is_enabled} onChange={e => set("is_enabled", e.target.checked)} />
          Shield ativo
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
          <input type="checkbox" checked={!!cfg.auto_quarantine_enabled} onChange={e => set("auto_quarantine_enabled", e.target.checked)} />
          Quarentena automática
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
          <input type="checkbox" checked={!!cfg.respect_business_hours} onChange={e => set("respect_business_hours", e.target.checked)} />
          Respeitar horário comercial
        </label>
      </div>

      {/* Limits */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        {[
          ["max_msgs_per_minute", "Máx. msgs/min"],
          ["max_msgs_per_hour", "Máx. msgs/hora"],
          ["max_msgs_per_day", "Máx. msgs/dia"],
        ].map(([k, l]) => (
          <div key={k} style={{ flex: 1, minWidth: 110 }}>
            <label style={labelStyle}>{l}</label>
            <input style={inp} type="number" min="1" value={cfg[k] ?? ""} onChange={e => set(k, Number(e.target.value))} />
          </div>
        ))}
      </div>

      {/* Business hours */}
      {cfg.respect_business_hours && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
          <div style={{ flex: 1, minWidth: 110 }}>
            <label style={labelStyle}>Horário início</label>
            <input style={inp} type="time" value={cfg.business_hours_start || ""} onChange={e => set("business_hours_start", e.target.value || null)} />
          </div>
          <div style={{ flex: 1, minWidth: 110 }}>
            <label style={labelStyle}>Horário fim</label>
            <input style={inp} type="time" value={cfg.business_hours_end || ""} onChange={e => set("business_hours_end", e.target.value || null)} />
          </div>
        </div>
      )}

      {/* Quarantine thresholds */}
      {cfg.auto_quarantine_enabled && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
          <div style={{ flex: 1, minWidth: 110 }}>
            <label style={labelStyle}>Limiar quarentena (erros)</label>
            <input style={inp} type="number" min="1" value={cfg.quarantine_threshold_min ?? ""} onChange={e => set("quarantine_threshold_min", Number(e.target.value))} />
          </div>
          <div style={{ flex: 1, minWidth: 110 }}>
            <label style={labelStyle}>Duração quarentena (min)</label>
            <input style={inp} type="number" min="1" value={cfg.quarantine_duration_min ?? ""} onChange={e => set("quarantine_duration_min", Number(e.target.value))} />
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: "8px 20px", borderRadius: 8, border: "none",
            background: "#3B82F6", color: "#fff", fontWeight: "bold",
            fontSize: 13, cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? "Salvando..." : "Salvar Configurações"}
        </button>
        {connections && connections.length > 1 && (
          <button
            onClick={handleApplyToAll}
            disabled={saving}
            style={{
              padding: "8px 20px", borderRadius: 8,
              border: "1.5px solid #D1D5DB", background: "#fff",
              color: "#374151", fontWeight: "bold", fontSize: 13,
              cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.7 : 1,
            }}
          >
            Configurar todas igual
          </button>
        )}
      </div>
    </div>
  );
}

// ── Audit Log Table ────────────────────────────────────────────────────────────
function AuditTable({ whatsappId }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!whatsappId) return;
    setLoading(true);
    dapeShieldService.getAuditLog(whatsappId)
      .then(({ data }) => setRows(Array.isArray(data) ? data.slice(0, 50) : []))
      .catch(toastError)
      .finally(() => setLoading(false));
  }, [whatsappId]);

  const REASON_LABELS = {
    RATE_LIMIT: "Rate Limit",
    QUOTA_EXCEEDED: "Cota excedida",
    BUSINESS_HOURS: "Fora do horário",
    QUARANTINE: "Quarentena",
    DISABLED: "Desativado",
    DEGRADED_MODE: "Modo degradado",
    REPEATED_CONTENT: "Conteúdo repetido",
  };

  if (loading) return <div style={{ color: "#9CA3AF", padding: 16, textAlign: "center" }}>Carregando log...</div>;
  if (rows.length === 0) return <div style={{ color: "#9CA3AF", padding: 16 }}>Nenhum evento registrado.</div>;

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ background: "#F9FAFB" }}>
            {["Data/Hora", "Ação", "Motivo", "Bloqueado", "Msgs/min", "Msgs/hora", "Msgs/dia"].map(h => (
              <th key={h} style={{
                textAlign: "left", padding: "9px 12px", color: "#6B7280",
                fontSize: 11, fontWeight: 600, textTransform: "uppercase",
                borderBottom: "1px solid #E5E7EB", whiteSpace: "nowrap",
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ borderBottom: "1px solid #F3F4F6" }}>
              <td style={{ padding: "8px 12px", whiteSpace: "nowrap", color: "#6B7280" }}>{fmt(r.created_at)}</td>
              <td style={{ padding: "8px 12px" }}>
                <span style={{
                  padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: "bold",
                  background: r.decision === "ALLOW" ? "#D1FAE5" : "#FEE2E2",
                  color: r.decision === "ALLOW" ? "#065F46" : "#991B1B",
                }}>{r.decision === "ALLOW" ? "Permitido" : "Bloqueado"}</span>
              </td>
              <td style={{ padding: "8px 12px", color: "#6B7280" }}>{REASON_LABELS[r.block_reason] || r.block_reason || "—"}</td>
              <td style={{ padding: "8px 12px" }}>
                <span style={{
                  padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: "bold",
                  background: r.decision === "BLOCK" ? "#FEE2E2" : "#F3F4F6",
                  color: r.decision === "BLOCK" ? "#991B1B" : "#6B7280",
                }}>{r.decision === "BLOCK" ? "Sim" : "Não"}</span>
              </td>
              <td style={{ padding: "8px 12px", textAlign: "center" }}>{r.msgs_in_last_minute ?? "—"}</td>
              <td style={{ padding: "8px 12px", textAlign: "center" }}>{r.msgs_in_last_hour ?? "—"}</td>
              <td style={{ padding: "8px 12px", textAlign: "center" }}>{r.msgs_today ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────
function ShieldDashboard() {
  const [stats, setStats] = useState([]);
  const [connections, setConnections] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [status, setStatus] = useState(null);
  const [loadingMain, setLoadingMain] = useState(true);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [releasingQuarantine, setReleasingQuarantine] = useState(false);

  const totalAllowed = stats.reduce((s, r) => s + Number(r.allowed || 0), 0);
  const totalBlocked = stats.reduce((s, r) => s + Number(r.blocked || 0), 0);
  const activeQuarantines = new Set(
    stats.filter(r => Number(r.quarantined || 0) > 0).map(r => r.whatsapp_id)
  ).size;

  const loadMain = useCallback(async () => {
    setLoadingMain(true);
    try {
      const [statsRes, connRes] = await Promise.all([
        dapeShieldService.getStats(),
        api.get("/whatsapp/"),
      ]);
      setStats(Array.isArray(statsRes.data) ? statsRes.data : []);
      const conns = Array.isArray(connRes.data) ? connRes.data : (connRes.data?.whatsapps || []);
      setConnections(conns);
      if (!selectedId && conns.length > 0) setSelectedId(String(conns[0].id));
    } catch (err) {
      toastError(err);
    } finally {
      setLoadingMain(false);
    }
  }, [selectedId]);

  const loadStatus = useCallback(async (wid) => {
    if (!wid) { setStatus(null); return; }
    setLoadingStatus(true);
    try {
      const { data } = await dapeShieldService.getStatus(wid);
      setStatus(data);
    } catch (err) {
      toastError(err);
      setStatus(null);
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => { loadMain(); }, [loadMain]);
  useEffect(() => { loadStatus(selectedId); }, [selectedId, loadStatus]);

  async function handleReleaseQuarantine() {
    if (!selectedId) return;
    setReleasingQuarantine(true);
    try {
      await dapeShieldService.releaseQuarantine(selectedId);
      await loadStatus(selectedId);
    } catch (err) {
      toastError(err);
    } finally {
      setReleasingQuarantine(false);
    }
  }

  const selectedConn = connections.find(c => String(c.id) === String(selectedId));
  const counters = status?.counters || [];
  const getCount = (type) => {
    const row = counters.find(c => c.window_type === type);
    return row ? Number(row.count) : 0;
  };
  const riskLevel = getRiskLevel(status?.quarantine, counters, status?.config, status?.risk);

  // High risk alert across all connections
  const anyHighRisk = connections.some(c => {
    const lvl = getStatsRiskForConn(stats, c.id);
    return lvl === "high" || lvl === "critical";
  });
  const currentHighRisk = status?.risk?.level === "HIGH" || status?.risk?.level === "CRITICAL";

  if (loadingMain) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: 80 }}>
        <div style={{ color: "#9CA3AF", fontSize: 14 }}>Carregando DAPLE Shield...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: "12px 16px", fontFamily: "inherit", background: "#F9FAFB", minHeight: "100vh" }}>

      {/* High risk alert */}
      {(anyHighRisk || currentHighRisk) && (
        <div style={{
          background: "#FEF2F2", border: "1.5px solid #FCA5A5", borderRadius: 10,
          padding: "12px 18px", marginBottom: 16, color: "#991B1B", fontWeight: 600,
          fontSize: 14, display: "flex", alignItems: "center", gap: 10,
        }}>
          ⚠️ Uma ou mais conexões estão em nível de risco elevado. Verifique o Shield.
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: "bold", color: "#111827" }}>🛡️ DAPLE Shield</div>
          <div style={{ fontSize: 12, color: "#6B7280", marginTop: 3 }}>
            Proteção anti-ban — rate limit e quarentena automática para conexões WhatsApp
          </div>
        </div>
        <button
          onClick={loadMain}
          style={{
            padding: "6px 14px", borderRadius: 8, border: "1px solid #D1D5DB",
            background: "#fff", fontSize: 12, cursor: "pointer", color: "#374151",
          }}
        >
          Atualizar
        </button>
      </div>

      {/* KPI cards */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <KpiCard label="Mensagens permitidas (7d)" value={totalAllowed.toLocaleString("pt-BR")} color="#22C55E" />
        <KpiCard label="Mensagens bloqueadas (7d)" value={totalBlocked.toLocaleString("pt-BR")} color="#EF4444" />
        <KpiCard label="Conexões em quarentena" value={activeQuarantines} color="#F59E0B" />
        <KpiCard
          label="Conexões monitoradas"
          value={connections.length}
          color="#3B82F6"
          sub="Shield ativo nesta empresa"
        />
      </div>

      {/* Two-column layout */}
      {connections.length === 0 ? (
        <div style={{
          background: "#fff", borderRadius: 12, padding: "24px 20px",
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)", color: "#6B7280",
          fontSize: 13, textAlign: "center",
        }}>
          Nenhuma conexão WhatsApp encontrada. Configure em{" "}
          <strong>Configurações &gt; Conexões</strong>.
        </div>
      ) : (
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>

          {/* Left — connection list */}
          <div style={{
            width: 220, flexShrink: 0,
            background: "#fff", borderRadius: 12,
            padding: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
          }}>
            <div style={{
              fontSize: 12, fontWeight: 700, color: "#6B7280",
              textTransform: "uppercase", letterSpacing: "0.05em",
              padding: "4px 4px 10px",
            }}>
              Conexões ({connections.length})
            </div>
            <ConnectionSidebar
              connections={connections}
              selectedId={selectedId}
              onSelect={setSelectedId}
              stats={stats}
            />
          </div>

          {/* Right — detail panel */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {selectedId ? (
              <>
                {/* Status card */}
                <div style={{ background: "#fff", borderRadius: 12, padding: 20, marginBottom: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#374151" }}>
                      {selectedConn?.name || selectedId}
                    </div>
                    {!loadingStatus && (
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 12, color: "#6B7280" }}>Risco:</span>
                        <RiskChip level={riskLevel} />
                        <span style={{ fontSize: 12, color: "#6B7280" }}>Score: {status?.risk?.score ?? 0}/100</span>
                      </div>
                    )}
                  </div>

                  {loadingStatus ? (
                    <div style={{ color: "#9CA3AF", padding: "12px 0" }}>Carregando status...</div>
                  ) : (
                    <>
                      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
                        <KpiCard label="Msgs no último minuto" value={getCount("minute")} color="#3B82F6" />
                        <KpiCard label="Msgs na última hora" value={getCount("hour")} color="#8B5CF6" />
                        <KpiCard label="Msgs hoje" value={getCount("day")} color="#F59E0B" />
                        <KpiCard
                          label="Shield"
                          value={status?.config?.is_enabled ? "Ativo" : "Inativo"}
                          color={status?.config?.is_enabled ? "#22C55E" : "#9CA3AF"}
                        />
                      </div>

                      {status?.quarantine ? (
                        <div style={{
                          background: "#FEF2F2", border: "1px solid #FCA5A5",
                          borderRadius: 8, padding: "12px 16px",
                          display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10,
                        }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: "bold", color: "#991B1B" }}>Conexão em QUARENTENA</div>
                            <div style={{ fontSize: 12, color: "#B91C1C", marginTop: 3 }}>
                              Até: {fmt(status.quarantine.quarantine_until)} · Motivo: {status.quarantine.reason || "—"}
                            </div>
                          </div>
                          <button
                            onClick={handleReleaseQuarantine}
                            disabled={releasingQuarantine}
                            style={{
                              padding: "7px 16px", borderRadius: 8, border: "none",
                              background: "#EF4444", color: "#fff", fontWeight: "bold",
                              fontSize: 13, cursor: releasingQuarantine ? "not-allowed" : "pointer",
                              opacity: releasingQuarantine ? 0.7 : 1,
                            }}
                          >
                            {releasingQuarantine ? "Liberando..." : "Liberar Quarentena"}
                          </button>
                        </div>
                      ) : (
                        <div style={{
                          background: "#F0FDF4", border: "1px solid #86EFAC",
                          borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#15803D",
                        }}>
                          Sem quarentena ativa
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Config card */}
                <div style={{ background: "#fff", borderRadius: 12, padding: 20, marginBottom: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                  <SectionTitle>Configurações do Shield</SectionTitle>
                  <ConfigCard
                    whatsappId={selectedId}
                    connections={connections}
                    onSaved={() => loadStatus(selectedId)}
                  />
                </div>

                {/* Audit log */}
                <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                  <SectionTitle>Log de Auditoria (últimos 50 eventos)</SectionTitle>
                  <AuditTable whatsappId={selectedId} />
                </div>
              </>
            ) : (
              <div style={{
                background: "#fff", borderRadius: 12, padding: "32px 20px",
                boxShadow: "0 1px 4px rgba(0,0,0,0.06)", color: "#9CA3AF",
                fontSize: 13, textAlign: "center",
              }}>
                Selecione uma conexão na lista ao lado.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Export ─────────────────────────────────────────────────────────────────────
export default function DapeShieldPage() {
  return (
    <DapeModuleGuard
      moduleKey="dape_shield"
      fallback={
        <div style={{ padding: 32, color: "#9CA3AF" }}>
          Módulo DAPLE Shield não habilitado no seu plano.
        </div>
      }
    >
      <ShieldDashboard />
    </DapeModuleGuard>
  );
}
