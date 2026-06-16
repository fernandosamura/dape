import React, { useState, useEffect } from "react";
import api from "../../services/api";

const styles = {
  container: { padding: 16, fontFamily: "inherit" },
  title: { fontSize: 18, fontWeight: "bold", marginBottom: 20, color: "#111827" },
  cards: { display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" },
  card: (color) => ({
    flex: 1, minWidth: 140, padding: 16, borderRadius: 10,
    background: color + "15", border: `1.5px solid ${color}30`,
    textAlign: "center",
  }),
  cardValue: (color) => ({ fontSize: 28, fontWeight: "bold", color }),
  cardLabel: { fontSize: 12, color: "#6B7280", marginTop: 4 },
  cardSub: { fontSize: 11, color: "#9CA3AF", marginTop: 2 },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: {
    textAlign: "left", padding: "8px 10px", borderBottom: "2px solid #E5E7EB",
    color: "#6B7280", fontSize: 11, fontWeight: 600, textTransform: "uppercase",
  },
  td: { padding: "9px 10px", borderBottom: "1px solid #F3F4F6", color: "#374151" },
  badge: (temp) => ({
    display: "inline-block", padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: "bold",
    background: temp === "hot" ? "#FEE2E2" : temp === "warm" ? "#FEF3C7" : "#DBEAFE",
    color: temp === "hot" ? "#DC2626" : temp === "warm" ? "#D97706" : "#2563EB",
  }),
  filterRow: { display: "flex", gap: 8, marginBottom: 16 },
  filterBtn: (active) => ({
    padding: "5px 14px", borderRadius: 20, fontSize: 12, cursor: "pointer",
    border: active ? "none" : "1px solid #D1D5DB",
    background: active ? "#3B82F6" : "#fff",
    color: active ? "#fff" : "#374151", fontWeight: active ? "bold" : "normal",
  }),
};

const TEMP_LABELS = { hot: "🔥 HOT", warm: "🌡️ WARM", cold: "🧊 COLD" };

export default function DapePipelineSummary() {
  const [summary, setSummary] = useState(null);
  const [scores, setScores] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [sumRes, scoresRes] = await Promise.all([
          api.get("/dape/pipeline/summary"),
          api.get("/dape/pipeline/scores"),
        ]);
        setSummary(sumRes.data);
        setScores(scoresRes.data.scores || []);
      } catch (err) {
        console.error("[DapePipelineSummary] load error:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = filter === "all" ? scores : scores.filter((s) => s.temperature === filter);

  if (loading) return <div style={styles.container}><p>Carregando...</p></div>;

  return (
    <div style={styles.container}>
      <div style={styles.title}>Pipeline de Leads</div>

      {summary && (
        <div style={styles.cards}>
          <div style={styles.card("#EF4444")}>
            <div style={styles.cardValue("#EF4444")}>{summary.hot}</div>
            <div style={styles.cardLabel}>🔥 HOT</div>
            {summary.hotEstimatedValue > 0 && (
              <div style={styles.cardSub}>
                R$ {Number(summary.hotEstimatedValue).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
              </div>
            )}
          </div>
          <div style={styles.card("#F59E0B")}>
            <div style={styles.cardValue("#F59E0B")}>{summary.warm}</div>
            <div style={styles.cardLabel}>🌡️ WARM</div>
          </div>
          <div style={styles.card("#3B82F6")}>
            <div style={styles.cardValue("#3B82F6")}>{summary.cold}</div>
            <div style={styles.cardLabel}>🧊 COLD</div>
          </div>
          <div style={styles.card("#6B7280")}>
            <div style={styles.cardValue("#6B7280")}>{summary.total}</div>
            <div style={styles.cardLabel}>Total de Leads</div>
            {summary.totalEstimatedValue > 0 && (
              <div style={styles.cardSub}>
                R$ {Number(summary.totalEstimatedValue).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
              </div>
            )}
          </div>
        </div>
      )}

      <div style={styles.filterRow}>
        {["all", "hot", "warm", "cold"].map((f) => (
          <button key={f} style={styles.filterBtn(filter === f)} onClick={() => setFilter(f)}>
            {f === "all" ? "Todos" : TEMP_LABELS[f]}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p style={{ color: "#9CA3AF", fontSize: 13 }}>Nenhum lead encontrado.</p>
      ) : (
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Contato</th>
              <th style={styles.th}>Temperatura</th>
              <th style={styles.th}>Score</th>
              <th style={styles.th}>Probabilidade</th>
              <th style={styles.th}>Valor Estimado</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.id}>
                <td style={styles.td}>#{s.contact_id}</td>
                <td style={styles.td}>
                  <span style={styles.badge(s.temperature)}>
                    {TEMP_LABELS[s.temperature] || s.temperature}
                  </span>
                </td>
                <td style={styles.td}><strong>{s.score}</strong>/100</td>
                <td style={styles.td}>{Number(s.close_probability).toFixed(0)}%</td>
                <td style={styles.td}>
                  {s.estimated_value
                    ? `R$ ${Number(s.estimated_value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
