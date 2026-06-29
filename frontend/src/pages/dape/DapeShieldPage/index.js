import React, { useState, useEffect, useCallback } from "react";
import api from "../../../services/api";
import dapeShieldService from "../../../services/dapeShieldService";
import DapeModuleGuard from "../../../components/dape/DapeModuleGuard";
import toastError from "../../../errors/toastError";

// ── Helpers ───────────────────────────────────────────────────────────────────
const RISK_CONFIG = {
  low:    { label: "Baixo",  bg: "#D1FAE5", color: "#065F46" },
  medium: { label: "Médio",  bg: "#FEF3C7", color: "#92400E" },
  high:   { label: "Alto",   bg: "#FEE2E2", color: "#991B1B" },
};

function getRiskLevel(quarantine, counters, config) {
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

function fmt(dt) {
  if (!dt) return "—";
  try { return new Date(dt).toLocaleString("pt-BR"); } catch { return dt; }
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color = "#3B82F6" }) {
  return (
    <div style={{
      flex: 1, minWidth: 140, padding: 18, borderRadius: 12,
      background: "#fff", border: `1.5px solid ${color}20`,
      boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
    }}>
      <div style={{ fontSize: 28, fontWeight: "bold", color }}>{value ?? "—"}</div>
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

function RiskChip({ level }) {
  const cfg = RISK_CONFIG[level] || RISK_CONFIG.low;
  return (
    <span style={{
      padding: "3px 10px", borderRadius: 12, fontSize: 12, fontWeight: "bold",
      background: cfg.bg, color: cfg.color,
    }}>{cfg.label}</span>
  );
}

// ── Config Form ────────────────────────────────────────────────────────────────
function ConfigCard({ whatsappId, onSaved }) {
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
        business_hours_start: "",
        business_hours_end: "",
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

      {/* Limits row */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        {[
          ["max_msgs_per_minute", "Máx. msgs/min"],
          ["max_msgs_per_hour", "Máx. msgs/hora"],
          ["max_msgs_per_day", "Máx. msgs/dia"],
        ].map(([k, l]) => (
          <div key={k} style={{ flex: 1, minWidth: 120 }}>
            <label style={labelStyle}>{l}</label>
            <input style={inp} type="number" min="1" value={cfg[k] ?? ""} onChange={e => set(k, Number(e.target.value))} />
          </div>
        ))}
      </div>

      {/* Business hours */}
      {cfg.respect_business_hours && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
          <div style={{ flex: 1, minWidth: 120 }}>
            <label style={labelStyle}>Horário início</label>
            <input style={inp} type="time" value={cfg.business_hours_start || ""} onChange={e => set("business_hours_start", e.target.value)} />
          </div>
          <div style={{ flex: 1, minWidth: 120 }}>
            <label style={labelStyle}>Horário fim</label>
            <input style={inp} type="time" value={cfg.business_hours_end || ""} onChange={e => set("business_hours_end", e.target.value)} />
          </div>
        </div>
      )}

      {/* Quarantine thresholds */}
      {cfg.auto_quarantine_enabled && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
          <div style={{ flex: 1, minWidth: 120 }}>
            <label style={labelStyle}>Limiar quarentena (erros)</label>
            <input style={inp} type="number" min="1" value={cfg.quarantine_threshold_min ?? ""} onChange={e => set("quarantine_threshold_min", Number(e.target.value))} />
          </div>
          <div style={{ flex: 1, minWidth: 120 }}>
            <label style={labelStyle}>Duração quarentena (min)</label>
            <input style={inp} type="number" min="1" value={cfg.quarantine_duration_min ?? ""} onChange={e => set("quarantine_duration_min", Number(e.target.value))} />
          </div>
        </div>
      )}

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
    DISABLED: "Shield desativado",
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

  // Derived totals from stats
  const totalAllowed = stats.reduce((s, r) => s + Number(r.allowed || 0), 0);
  const totalBlocked = stats.reduce((s, r) => s + Number(r.blocked || 0), 0);
  const activeQuarantines = new Set(
    stats.filter(r => Number(r.quarantined || 0) > 0).map(r => r.whatsapp_id)
  ).size;
  const shieldActive = connections.length > 0;

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
    } catch (err) {
      toastError(err);
    } finally {
      setLoadingMain(false);
    }
  }, []);

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

  // Counters from status
  const counters = status?.counters || [];
  const getCount = (type) => {
    const row = counters.find(c => c.window_type === type);
    return row ? Number(row.count) : 0;
  };
  const riskLevel = getRiskLevel(status?.quarantine, counters, status?.config);

  const selectStyle = {
    padding: "8px 12px", border: "1px solid #D1D5DB", borderRadius: 8,
    fontSize: 13, background: "#fff", cursor: "pointer", outline: "none",
    minWidth: 220,
  };

  if (loadingMain) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: 80 }}>
        <div style={{ color: "#9CA3AF", fontSize: 14 }}>Carregando DAPLE Shield...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: "12px 16px", fontFamily: "inherit", background: "#F9FAFB", minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: "bold", color: "#111827" }}>
            🛡️ DAPLE Shield
          </div>
          <div style={{ fontSize: 12, color: "#6B7280", marginTop: 3 }}>
            Camada de proteção anti-ban — controle de rate limit e quarentena automática para conexões WhatsApp
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

      {/* Overall stats */}
      <SectionTitle>Resumo Geral — últimos 7 dias</SectionTitle>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
        <KpiCard label="Mensagens permitidas" value={totalAllowed.toLocaleString("pt-BR")} color="#22C55E" />
        <KpiCard label="Mensagens bloqueadas" value={totalBlocked.toLocaleString("pt-BR")} color="#EF4444" />
        <KpiCard label="Conexões em quarentena" value={activeQuarantines} color="#F59E0B" />
        <KpiCard
          label="Status do Shield"
          value={shieldActive ? "Ativo" : "Inativo"}
          color={shieldActive ? "#22C55E" : "#9CA3AF"}
          sub={`${connections.length} conexão(ões) encontrada(s)`}
        />
      </div>

      {/* Connection selector */}
      <SectionTitle>Selecionar Conexão</SectionTitle>
      {connections.length === 0 ? (
        <div style={{
          background: "#fff", borderRadius: 12, padding: "24px 20px",
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)", color: "#6B7280",
          fontSize: 13, textAlign: "center",
        }}>
          Nenhuma conexão WhatsApp encontrada. Configure uma conexão em{" "}
          <strong>Configurações &gt; Conexões</strong> para usar o DAPLE Shield.
        </div>
      ) : (
        <div style={{ marginBottom: 20 }}>
          <select
            style={selectStyle}
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
          >
            <option value="">— Escolha uma conexão —</option>
            {connections.map(c => (
              <option key={c.id} value={String(c.id)}>
                {c.name} ({c.status || "desconhecido"})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Per-connection panel */}
      {selectedId && (
        <>
          {/* Status card */}
          <div style={{ background: "#fff", borderRadius: 12, padding: 20, marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#374151" }}>
                Status — {selectedConn?.name || selectedId}
              </div>
              {!loadingStatus && (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 12, color: "#6B7280" }}>Nível de risco:</span>
                  <RiskChip level={riskLevel} />
                </div>
              )}
            </div>

            {loadingStatus ? (
              <div style={{ color: "#9CA3AF", padding: "12px 0" }}>Carregando status...</div>
            ) : (
              <>
                {/* Counters */}
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
                  <KpiCard label="Msgs no último minuto" value={getCount("minute")} color="#3B82F6" />
                  <KpiCard label="Msgs na última hora" value={getCount("hour")} color="#8B5CF6" />
                  <KpiCard label="Msgs hoje" value={getCount("day")} color="#F59E0B" />
                  <KpiCard
                    label="Shield nesta conexão"
                    value={status?.config?.is_enabled ? "Ativo" : "Inativo"}
                    color={status?.config?.is_enabled ? "#22C55E" : "#9CA3AF"}
                  />
                </div>

                {/* Quarantine */}
                {status?.quarantine ? (
                  <div style={{
                    background: "#FEF2F2", border: "1px solid #FCA5A5",
                    borderRadius: 8, padding: "12px 16px",
                    display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10,
                  }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: "bold", color: "#991B1B" }}>
                        Conexão em QUARENTENA
                      </div>
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
                    Conexão sem quarentena ativa
                  </div>
                )}
              </>
            )}
          </div>

          {/* Configuration card */}
          <div style={{ background: "#fff", borderRadius: 12, padding: 20, marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <SectionTitle>Configurações do Shield</SectionTitle>
            <ConfigCard
              whatsappId={selectedId}
              onSaved={() => loadStatus(selectedId)}
            />
          </div>

          {/* Audit log */}
          <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <SectionTitle>Log de Auditoria (últimos 50 eventos)</SectionTitle>
            <AuditTable whatsappId={selectedId} />
          </div>
        </>
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
