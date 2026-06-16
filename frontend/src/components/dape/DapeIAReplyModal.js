import React, { useState } from "react";
import api from "../../services/api";

const s = {
  overlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.45)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" },
  modal: { background: "#fff", borderRadius: 12, padding: 24, width: 460, maxWidth: "92vw", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", maxHeight: "80vh", overflowY: "auto" },
  title: { fontSize: 16, fontWeight: "bold", marginBottom: 6, color: "#111827" },
  subtitle: { fontSize: 12, color: "#9CA3AF", marginBottom: 16 },
  optionWrap: (selected) => ({
    border: selected ? "2px solid #8B5CF6" : "1px solid #E5E7EB",
    borderRadius: 8, padding: "10px 14px", marginBottom: 10,
    cursor: "pointer", background: selected ? "#F5F3FF" : "#fff", transition: "all 0.15s",
  }),
  optionNum: { fontSize: 10, fontWeight: "bold", color: "#8B5CF6", marginBottom: 4, textTransform: "uppercase" },
  optionText: { fontSize: 13, color: "#374151", lineHeight: 1.5 },
  lastMsg: { background: "#F9FAFB", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#6B7280", marginBottom: 16, borderLeft: "3px solid #E5E7EB" },
  buttons: { display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" },
  btnCancel: { padding: "8px 16px", borderRadius: 6, border: "1px solid #D1D5DB", background: "#fff", cursor: "pointer", fontSize: 13 },
  btnUse: (disabled) => ({ padding: "8px 16px", borderRadius: 6, border: "none", background: disabled ? "#C4B5FD" : "#8B5CF6", color: "#fff", cursor: disabled ? "not-allowed" : "pointer", fontSize: 13, fontWeight: "bold" }),
  loading: { textAlign: "center", padding: "24px 0", color: "#9CA3AF", fontSize: 13 },
  error: { background: "#FEE2E2", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#991B1B", marginBottom: 12 },
};

export default function DapeIAReplyModal({ open, onClose, ticketId, onUseReply }) {
  const [suggestions, setSuggestions] = useState([]);
  const [lastMessage, setLastMessage] = useState("");
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [loaded, setLoaded] = useState(false);

  async function loadSuggestions() {
    if (loaded) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.post(`/dape/ia/suggest-reply/${ticketId}`);
      setSuggestions(data.suggestions || []);
      setLastMessage(data.lastMessage || "");
      setLoaded(true);
    } catch (err) {
      setError(err?.response?.data?.error || "Erro ao gerar sugestões");
    } finally {
      setLoading(false);
    }
  }

  function handleOpen() {
    if (open && !loaded) loadSuggestions();
  }

  React.useEffect(() => { handleOpen(); }, [open]);

  function handleUse() {
    if (selected === null) return;
    const text = suggestions[selected];
    onUseReply(text);
    // Mark as used
    api.post(`/dape/ia/suggest-reply/${ticketId}`).catch(() => {});
    onClose();
    setSelected(null);
    setSuggestions([]);
    setLoaded(false);
  }

  if (!open) return null;

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <div style={s.title}>🤖 Sugestões de Resposta IA</div>
        <div style={s.subtitle}>Selecione uma sugestão para usar no chat</div>

        {lastMessage && (
          <div style={s.lastMsg}><strong>Última mensagem do cliente:</strong><br />{lastMessage}</div>
        )}

        {loading && <div style={s.loading}>Gerando sugestões com IA...</div>}
        {error && <div style={s.error}>{error}</div>}

        {!loading && suggestions.map((text, i) => (
          <div key={i} style={s.optionWrap(selected === i)} onClick={() => setSelected(i)}>
            <div style={s.optionNum}>Opção {i + 1}</div>
            <div style={s.optionText}>{text}</div>
          </div>
        ))}

        {!loading && !error && suggestions.length === 0 && loaded && (
          <div style={{ color: "#9CA3AF", fontSize: 13 }}>Nenhuma sugestão disponível.</div>
        )}

        <div style={s.buttons}>
          <button style={s.btnCancel} onClick={onClose}>Fechar</button>
          {suggestions.length > 0 && !loading && (
            <button style={s.btnUse(selected === null)} onClick={handleUse} disabled={selected === null}>
              Usar esta resposta
            </button>
          )}
          {loaded && (
            <button style={{ ...s.btnCancel, color: "#8B5CF6" }} onClick={() => { setLoaded(false); setSuggestions([]); loadSuggestions(); }}>
              🔄 Gerar novamente
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
