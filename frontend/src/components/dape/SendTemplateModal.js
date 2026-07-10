import React, { useState } from "react";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import {
  extractTemplateVariables,
  renderTemplateBody,
  getTemplateHeader,
} from "../../utils/whatsappTemplateVariables";

const s = {
  overlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.45)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" },
  modal: { background: "#fff", borderRadius: 12, padding: 24, width: 460, maxWidth: "92vw", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", maxHeight: "80vh", overflowY: "auto" },
  title: { fontSize: 16, fontWeight: "bold", marginBottom: 6, color: "#111827" },
  subtitle: { fontSize: 12, color: "#9CA3AF", marginBottom: 16 },
  optionWrap: { border: "1px solid #E5E7EB", borderRadius: 8, padding: "10px 14px", marginBottom: 10, cursor: "pointer", background: "#fff", transition: "all 0.15s" },
  optionName: { fontSize: 13, fontWeight: "bold", color: "#111827" },
  optionText: { fontSize: 12, color: "#6B7280", marginTop: 4, lineHeight: 1.4 },
  field: { width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 6, border: "1px solid #D1D5DB", fontSize: 13, marginBottom: 10 },
  label: { fontSize: 12, color: "#374151", marginBottom: 4, display: "block", fontWeight: 600 },
  preview: { background: "#F9FAFB", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#374151", marginBottom: 16, borderLeft: "3px solid #25D366", whiteSpace: "pre-wrap" },
  buttons: { display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end", flexWrap: "wrap" },
  btnCancel: { padding: "8px 16px", borderRadius: 6, border: "1px solid #D1D5DB", background: "#fff", cursor: "pointer", fontSize: 13 },
  btnUse: (disabled) => ({ padding: "8px 16px", borderRadius: 6, border: "none", background: disabled ? "#A7D8B5" : "#25D366", color: "#fff", cursor: disabled ? "not-allowed" : "pointer", fontSize: 13, fontWeight: "bold" }),
  loading: { textAlign: "center", padding: "24px 0", color: "#9CA3AF", fontSize: 13 },
  error: { background: "#FEE2E2", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#991B1B", marginBottom: 12 },
};

export default function SendTemplateModal({ open, onClose, ticketId, whatsappId, onSent }) {
  const [templates, setTemplates] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [values, setValues] = useState({});
  const [headerMediaUrl, setHeaderMediaUrl] = useState("");
  const [sending, setSending] = useState(false);

  const reset = () => {
    setSelected(null);
    setValues({});
    setHeaderMediaUrl("");
    setError(null);
  };

  async function loadTemplates(forceSync) {
    setLoading(true);
    setError(null);
    try {
      if (forceSync) {
        const { data } = await api.post(`/meta-cloud/templates/${whatsappId}/sync`);
        setTemplates(data);
      } else {
        const { data } = await api.get(`/meta-cloud/templates/${whatsappId}`);
        setTemplates(data);
      }
      setLoaded(true);
    } catch (err) {
      setError(err?.response?.data?.error || "Erro ao carregar modelos");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    if (open && whatsappId && !loaded) loadTemplates(false);
    if (!open) {
      setLoaded(false);
      reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, whatsappId]);

  async function handleSync() {
    setSyncing(true);
    await loadTemplates(true);
    setSyncing(false);
  }

  function handleSelect(template) {
    setSelected(template);
    setValues({});
    setHeaderMediaUrl("");
  }

  async function handleSend() {
    setSending(true);
    setError(null);
    try {
      await api.post(`/tickets/${ticketId}/send-template`, {
        templateId: selected.id,
        bodyParams: values,
        headerMediaUrl: headerMediaUrl || undefined,
      });
      onSent && onSent();
      onClose();
    } catch (err) {
      toastError(err);
      setError(err?.response?.data?.error || "Erro ao enviar modelo");
    } finally {
      setSending(false);
    }
  }

  if (!open) return null;

  const variables = selected ? extractTemplateVariables(selected.bodyText || "") : [];
  const preview = selected ? renderTemplateBody(selected.bodyText || "", values) : "";
  const approved = templates.filter((t) => t.status === "APPROVED");
  const header = selected ? getTemplateHeader(selected.components) : null;
  const needsHeaderMedia = header && header.format !== "TEXT";
  const canSend = !needsHeaderMedia || headerMediaUrl.trim().length > 0;

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        {!selected ? (
          <>
            <div style={s.title}>📋 Enviar modelo aprovado</div>
            <div style={s.subtitle}>Selecione um modelo oficial da Meta para enviar</div>

            {loading && <div style={s.loading}>Carregando modelos...</div>}
            {error && <div style={s.error}>{error}</div>}

            {!loading && approved.length === 0 && loaded && !error && (
              <div style={{ color: "#9CA3AF", fontSize: 13, marginBottom: 12 }}>
                Nenhum modelo aprovado encontrado. Clique em "Atualizar modelos" para sincronizar com a Meta.
              </div>
            )}

            {!loading &&
              approved.map((t) => (
                <div key={t.id} style={s.optionWrap} onClick={() => handleSelect(t)}>
                  <div style={s.optionName}>{t.name} ({t.language})</div>
                  <div style={s.optionText}>{t.bodyText}</div>
                </div>
              ))}

            <div style={s.buttons}>
              <button style={s.btnCancel} onClick={onClose}>Fechar</button>
              <button style={{ ...s.btnCancel, color: "#25D366" }} onClick={handleSync} disabled={syncing}>
                {syncing ? "Atualizando..." : "🔄 Atualizar modelos"}
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={s.title}>Usar modelo: {selected.name}</div>
            <div style={s.subtitle}>Preencha as variáveis do modelo</div>

            {error && <div style={s.error}>{error}</div>}

            {needsHeaderMedia && (
              <div>
                <label style={s.label}>
                  URL da {header.format === "IMAGE" ? "imagem" : header.format === "VIDEO" ? "vídeo" : "documento"} do cabeçalho
                </label>
                <input
                  style={s.field}
                  placeholder="https://..."
                  value={headerMediaUrl}
                  onChange={(e) => setHeaderMediaUrl(e.target.value)}
                />
              </div>
            )}

            {variables.map((v) => (
              <div key={v}>
                <label style={s.label}>Variável {`{{${v}}}`}</label>
                <input
                  style={s.field}
                  value={values[v] || ""}
                  onChange={(e) => setValues((prev) => ({ ...prev, [v]: e.target.value }))}
                />
              </div>
            ))}

            <label style={s.label}>Prévia</label>
            <div style={s.preview}>{preview}</div>

            <div style={s.buttons}>
              <button style={s.btnCancel} onClick={() => setSelected(null)} disabled={sending}>
                Voltar
              </button>
              <button style={s.btnUse(sending || !canSend)} onClick={handleSend} disabled={sending || !canSend}>
                {sending ? "Enviando..." : "Enviar ao contato"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
