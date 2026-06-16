import React from "react";

const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 6,
    fontFamily: "inherit",
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "3px 10px",
    borderRadius: 12,
    fontWeight: "bold",
    fontSize: 12,
    letterSpacing: 0.5,
  },
  hot: { background: "#FEE2E2", color: "#DC2626" },
  warm: { background: "#FEF3C7", color: "#D97706" },
  cold: { background: "#DBEAFE", color: "#2563EB" },
  progressTrack: {
    width: "100%",
    height: 8,
    borderRadius: 4,
    background: "#E5E7EB",
    overflow: "hidden",
  },
  progressBar: (score, temp) => ({
    height: "100%",
    width: `${score}%`,
    borderRadius: 4,
    background: temp === "hot" ? "#EF4444" : temp === "warm" ? "#F59E0B" : "#3B82F6",
    transition: "width 0.5s ease",
  }),
  probability: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 2,
  },
};

const LABELS = {
  hot: "🔥 HOT",
  warm: "🌡️ WARM",
  cold: "🧊 COLD",
};

export default function DapeScoreBadge({ score = 0, temperature = "cold", closeProbability = 0, estimatedValue }) {
  const badgeStyle = { ...styles.badge, ...styles[temperature] };

  return (
    <div style={styles.container}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
        <span style={badgeStyle}>{LABELS[temperature] || LABELS.cold}</span>
        <span style={{ fontSize: 13, fontWeight: "bold", color: "#374151" }}>{score}/100</span>
      </div>
      <div style={{ width: "100%" }}>
        <div style={styles.progressTrack}>
          <div style={styles.progressBar(score, temperature)} />
        </div>
      </div>
      <div style={styles.probability}>
        Probabilidade de fechamento: <strong>{Number(closeProbability).toFixed(0)}%</strong>
        {estimatedValue && (
          <span style={{ marginLeft: 8 }}>
            · Valor estimado: <strong>R$ {Number(estimatedValue).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong>
          </span>
        )}
      </div>
    </div>
  );
}
