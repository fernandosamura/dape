import React, { useState, useEffect, useCallback } from "react";
import api from "../../services/api";
import DapeScoreBadge from "./DapeScoreBadge";
import DapeScoreEventModal from "./DapeScoreEventModal";

const styles = {
  widget: {
    border: "1px solid #E5E7EB",
    borderRadius: 10,
    padding: 14,
    background: "#FAFAFA",
    marginBottom: 12,
    fontFamily: "inherit",
  },
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    marginBottom: 12,
  },
  title: { fontSize: 13, fontWeight: "bold", color: "#374151", letterSpacing: 0.3 },
  btn: {
    padding: "4px 10px", borderRadius: 6, fontSize: 12,
    border: "1px solid #D1D5DB", background: "#fff", cursor: "pointer",
    color: "#374151",
  },
  btnPrimary: {
    padding: "4px 10px", borderRadius: 6, fontSize: 12, border: "none",
    background: "#3B82F6", color: "#fff", cursor: "pointer", fontWeight: "bold",
  },
  valueRow: {
    display: "flex", alignItems: "center", gap: 6, marginTop: 10,
    borderTop: "1px solid #E5E7EB", paddingTop: 10,
  },
  valueLabel: { fontSize: 12, color: "#6B7280" },
  valueInput: {
    flex: 1, padding: "4px 8px", border: "1px solid #D1D5DB",
    borderRadius: 5, fontSize: 12, outline: "none",
  },
  eventsToggle: {
    fontSize: 11, color: "#6B7280", cursor: "pointer",
    marginTop: 8, textDecoration: "underline",
  },
  eventItem: {
    fontSize: 11, padding: "3px 0",
    borderBottom: "1px solid #F3F4F6", color: "#374151",
  },
  loading: { fontSize: 12, color: "#9CA3AF", padding: "8px 0" },
};

export default function DapeLeadScoreWidget({ contactId, ticketId }) {
  const [scoreData, setScoreData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [estimatedValue, setEstimatedValue] = useState("");
  const [editingValue, setEditingValue] = useState(false);
  const [showEvents, setShowEvents] = useState(false);
  const [events, setEvents] = useState([]);

  const loadScore = useCallback(async () => {
    if (!contactId) return;
    try {
      setLoading(true);
      const { data } = await api.get(`/dape/pipeline/score/${contactId}`);
      setScoreData(data);
      if (data.estimatedValue) setEstimatedValue(data.estimatedValue);
    } catch (err) {
      console.error("[DapeLeadScoreWidget] load score error:", err);
    } finally {
      setLoading(false);
    }
  }, [contactId]);

  useEffect(() => { loadScore(); }, [loadScore]);

  async function handleSaveEvent({ eventType, description }) {
    setSaving(true);
    try {
      await api.post("/dape/pipeline/score/event", {
        contactId: Number(contactId),
        ticketId: ticketId ? Number(ticketId) : undefined,
        eventType,
        description,
      });
      setModalOpen(false);
      await loadScore();
    } catch (err) {
      console.error("[DapeLeadScoreWidget] save event error:", err);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveValue() {
    if (!scoreData?.id || !estimatedValue) return;
    try {
      await api.put(`/dape/pipeline/score/${scoreData.id}/value`, {
        estimatedValue: parseFloat(estimatedValue),
      });
      setEditingValue(false);
      await loadScore();
    } catch (err) {
      console.error("[DapeLeadScoreWidget] save value error:", err);
    }
  }

  async function handleShowEvents() {
    if (!showEvents && events.length === 0) {
      try {
        const { data } = await api.get(`/dape/pipeline/score/${contactId}/events`);
        setEvents(data);
      } catch (err) {}
    }
    setShowEvents(!showEvents);
  }

  if (loading) return <div style={styles.widget}><div style={styles.loading}>Carregando DAPLE Score...</div></div>;
  if (!scoreData) return null;

  return (
    <div style={styles.widget}>
      <div style={styles.header}>
        <span style={styles.title}>⚡ DAPLE Score</span>
        <button style={styles.btnPrimary} onClick={() => setModalOpen(true)}>+ Evento</button>
      </div>

      <DapeScoreBadge
        score={scoreData.score}
        temperature={scoreData.temperature}
        closeProbability={scoreData.closeProbability || scoreData.close_probability}
        estimatedValue={scoreData.estimatedValue || scoreData.estimated_value}
      />

      <div style={styles.valueRow}>
        <span style={styles.valueLabel}>Valor estimado (R$):</span>
        {editingValue ? (
          <>
            <input
              style={styles.valueInput}
              type="number"
              value={estimatedValue}
              onChange={(e) => setEstimatedValue(e.target.value)}
              placeholder="0,00"
            />
            <button style={styles.btnPrimary} onClick={handleSaveValue}>OK</button>
            <button style={styles.btn} onClick={() => setEditingValue(false)}>✕</button>
          </>
        ) : (
          <button style={styles.btn} onClick={() => setEditingValue(true)}>
            {scoreData.estimated_value
              ? `R$ ${Number(scoreData.estimated_value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
              : "Definir valor"}
          </button>
        )}
      </div>

      <div style={styles.eventsToggle} onClick={handleShowEvents}>
        {showEvents ? "▲ Ocultar histórico" : "▼ Ver histórico de eventos"}
      </div>

      {showEvents && (
        <div style={{ marginTop: 6 }}>
          {events.length === 0 ? (
            <div style={{ fontSize: 11, color: "#9CA3AF" }}>Nenhum evento registrado</div>
          ) : (
            events.slice(0, 10).map((ev) => (
              <div key={ev.id} style={styles.eventItem}>
                <span>{ev.points > 0 ? "+" : ""}{ev.points} pts</span>
                {" · "}
                <span>{ev.event_type?.replace(/_/g, " ")}</span>
                {ev.description && <span style={{ color: "#9CA3AF" }}> — {ev.description}</span>}
              </div>
            ))
          )}
        </div>
      )}

      <DapeScoreEventModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveEvent}
        loading={saving}
      />
    </div>
  );
}
