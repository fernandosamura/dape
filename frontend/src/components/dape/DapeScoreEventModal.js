import React, { useState } from "react";

const EVENT_OPTIONS = [
  { value: "respondeu_rapido", label: "Respondeu em menos de 5 min", points: "+10", color: "#22C55E" },
  { value: "abriu_proposta", label: "Abriu a proposta", points: "+15", color: "#3B82F6" },
  { value: "reuniao", label: "Participou de reunião", points: "+20", color: "#8B5CF6" },
  { value: "orcamento", label: "Solicitou orçamento", points: "+25", color: "#F59E0B" },
  { value: "sem_resposta_3d", label: "Sem resposta há 3 dias", points: "-10", color: "#EF4444" },
  { value: "sem_resposta_7d", label: "Sem resposta há 7 dias", points: "-20", color: "#DC2626" },
];

const styles = {
  overlay: {
    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
    background: "rgba(0,0,0,0.45)", zIndex: 9999,
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  modal: {
    background: "#fff", borderRadius: 12, padding: 24, width: 380,
    maxWidth: "90vw", boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
  },
  title: { fontSize: 16, fontWeight: "bold", marginBottom: 16, color: "#111827" },
  option: (selected) => ({
    display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
    borderRadius: 8, marginBottom: 8, cursor: "pointer",
    border: selected ? "2px solid #3B82F6" : "1px solid #E5E7EB",
    background: selected ? "#EFF6FF" : "#fff",
    transition: "all 0.15s",
  }),
  points: (color) => ({
    marginLeft: "auto", fontWeight: "bold", fontSize: 13, color,
  }),
  descInput: {
    width: "100%", padding: "8px 10px", borderRadius: 6, marginTop: 12,
    border: "1px solid #D1D5DB", fontSize: 13, outline: "none",
    boxSizing: "border-box",
  },
  buttons: { display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" },
  btnCancel: {
    padding: "8px 16px", borderRadius: 6, border: "1px solid #D1D5DB",
    background: "#fff", cursor: "pointer", fontSize: 13,
  },
  btnSave: (disabled) => ({
    padding: "8px 16px", borderRadius: 6, border: "none",
    background: disabled ? "#9CA3AF" : "#3B82F6", color: "#fff",
    cursor: disabled ? "not-allowed" : "pointer", fontSize: 13, fontWeight: "bold",
  }),
};

export default function DapeScoreEventModal({ open, onClose, onSave, loading }) {
  const [selected, setSelected] = useState(null);
  const [description, setDescription] = useState("");

  if (!open) return null;

  function handleSave() {
    if (!selected) return;
    onSave({ eventType: selected, description: description || undefined });
    setSelected(null);
    setDescription("");
  }

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.title}>Registrar Evento de Score</div>
        {EVENT_OPTIONS.map((opt) => (
          <div
            key={opt.value}
            style={styles.option(selected === opt.value)}
            onClick={() => setSelected(opt.value)}
          >
            <span style={{ fontSize: 13, color: "#374151" }}>{opt.label}</span>
            <span style={styles.points(opt.color)}>{opt.points} pts</span>
          </div>
        ))}
        <input
          style={styles.descInput}
          placeholder="Observação (opcional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div style={styles.buttons}>
          <button style={styles.btnCancel} onClick={onClose}>Cancelar</button>
          <button style={styles.btnSave(!selected || loading)} onClick={handleSave} disabled={!selected || loading}>
            {loading ? "Salvando..." : "Salvar Evento"}
          </button>
        </div>
      </div>
    </div>
  );
}
