import React, { useState, useEffect, useCallback } from "react";
import api from "../../services/api";

const URGENCY_CONFIG = {
  alta:  { label: "🔴 URGENTE", bg: "#FEE2E2", color: "#991B1B" },
  media: { label: "🟡 MÉDIA",   bg: "#FEF3C7", color: "#92400E" },
  baixa: { label: "🟢 BAIXA",   bg: "#D1FAE5", color: "#065F46" },
};
const SENTIMENT_CONFIG = {
  positivo: { label: "😊 Positivo", color: "#22C55E" },
  neutro:   { label: "😐 Neutro",   color: "#F59E0B" },
  negativo: { label: "😟 Negativo", color: "#EF4444" },
};

const s = {
  wrap: { border: "1px solid #E5E7EB", borderRadius: 10, padding: 14, background: "#FAFAFA", marginBottom: 12 },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  title: { fontSize: 13, fontWeight: "bold", color: "#374151" },
  btnPrimary: { padding: "4px 10px", borderRadius: 6, fontSize: 12, border: "none", background: "#8B5CF6", color: "#fff", cursor: "pointer", fontWeight: "bold" },
  btnSm: { padding: "3px 8px", borderRadius: 5, fontSize: 11, border: "1px solid #D1D5DB", background: "#fff", cursor: "pointer", color: "#374151", marginLeft: 4 },
  badge: (bg, color) => ({ display: "inline-block", padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: "bold", background: bg, color, marginRight: 4 }),
  summaryBox: { background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, padding: "10px 12px", fontSize: 13, color: "#374151", lineHeight: 1.5, marginBottom: 8 },
  nextAction: { background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#1D4ED8", marginBottom: 8 },
  metaRow: { display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 },
  noData: { fontSize: 12, color: "#9CA3AF", padding: "8px 0" },
  loading: { fontSize: 12, color: "#9CA3AF", padding: "8px 0" },
};

export default function DapeIASummary({ ticketId }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const loadSummary = useCallback(async () => {
    if (!ticketId) return;
    try {
      setLoading(true);
      const { data } = await api.get(`/dape/ia/summary/${ticketId}`);
      setSummary(data);
    } catch (err) {
      if (err?.response?.status !== 404) console.error("[DapeIASummary] load error:", err);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => { loadSummary(); }, [loadSummary]);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const { data } = await api.post(`/dape/ia/summarize/${ticketId}`);
      setSummary({
        summary_text: data.summary,
        next_action: data.nextAction,
        sentiment: data.sentiment,
        urgency: data.urgency,
        intent: data.intent,
        estimated_value: data.estimatedValue,
        generated_at: new Date().toISOString(),
      });
    } catch (err) {
      const msg = err?.response?.data?.error || "Erro ao gerar resumo";
      alert(msg);
    } finally {
      setGenerating(false);
    }
  }

  const urgCfg = summary?.urgency ? URGENCY_CONFIG[summary.urgency] : null;
  const sentCfg = summary?.sentiment ? SENTIMENT_CONFIG[summary.sentiment] : null;

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <span style={s.title}>🤖 DAPE IA — Resumo</span>
        <button style={s.btnPrimary} onClick={handleGenerate} disabled={generating}>
          {generating ? "Gerando..." : "✨ Gerar Resumo"}
        </button>
      </div>

      {loading ? (
        <div style={s.loading}>Carregando...</div>
      ) : !summary ? (
        <div style={s.noData}>Nenhum resumo gerado. Clique em "Gerar Resumo".</div>
      ) : (
        <>
          <div style={s.metaRow}>
            {urgCfg && <span style={s.badge(urgCfg.bg, urgCfg.color)}>{urgCfg.label}</span>}
            {sentCfg && <span style={s.badge("#F3F4F6", sentCfg.color)}>{sentCfg.label}</span>}
            {summary.intent && <span style={s.badge("#F3F4F6", "#6B7280")}>{summary.intent}</span>}
            {summary.estimated_value && (
              <span style={s.badge("#ECFDF5", "#065F46")}>
                R$ {Number(summary.estimated_value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </span>
            )}
          </div>
          <div style={s.summaryBox}>{summary.summary_text}</div>
          {summary.next_action && (
            <div style={s.nextAction}>
              <strong>Próxima ação:</strong> {summary.next_action}
            </div>
          )}
          <div style={{ fontSize: 10, color: "#D1D5DB", textAlign: "right" }}>
            {summary.generated_at && new Date(summary.generated_at).toLocaleString("pt-BR")}
          </div>
        </>
      )}
    </div>
  );
}
