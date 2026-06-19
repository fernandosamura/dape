import React, { useState, useEffect } from "react";

const STAGE_OPTIONS = [
  { value: "prospecting",   label: "Prospecção" },
  { value: "qualification", label: "Qualificação" },
  { value: "proposal",      label: "Proposta" },
  { value: "negotiation",   label: "Negociação" },
  { value: "closing",       label: "Fechamento" },
];

const STATUS_OPTIONS = [
  { value: "open", label: "Aberto" },
  { value: "won",  label: "Ganho" },
  { value: "lost", label: "Perdido" },
];

const EMPTY_FORM = {
  title: "",
  value: "",
  stage: "prospecting",
  status: "open",
  expectedCloseDate: "",
};

function DealModal({ open, onClose, onSave, deal }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (deal) {
        setForm({
          title: deal.title || "",
          value: deal.value !== undefined && deal.value !== null ? String(deal.value) : "",
          stage: deal.stage || "prospecting",
          status: deal.status || "open",
          expectedCloseDate: deal.expectedCloseDate
            ? deal.expectedCloseDate.substring(0, 10)
            : (deal.expected_close_date ? deal.expected_close_date.substring(0, 10) : ""),
        });
      } else {
        setForm(EMPTY_FORM);
      }
    }
  }, [open, deal]);

  if (!open) return null;

  function set(k, v) {
    setForm(f => ({ ...f, [k]: v }));
  }

  async function handleSave() {
    if (!form.title.trim()) {
      alert("Título é obrigatório");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        value: form.value !== "" ? Number(form.value) : null,
        stage: form.stage,
        status: form.status,
        expectedCloseDate: form.expectedCloseDate || null,
      };
      await onSave(payload);
      onClose();
    } catch (e) {
      alert(e?.response?.data?.error || "Erro ao salvar negócio");
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = {
    width: "100%",
    padding: "7px 10px",
    border: "1px solid #D1D5DB",
    borderRadius: 6,
    fontSize: 13,
    boxSizing: "border-box",
    outline: "none",
    fontFamily: "inherit",
  };

  const labelStyle = {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 4,
    display: "block",
    fontWeight: 500,
  };

  const fieldStyle = { marginBottom: 14 };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: 24,
          width: "100%",
          maxWidth: 480,
          margin: "0 16px",
          maxHeight: "85vh",
          overflowY: "auto",
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Title */}
        <div style={{ fontSize: 16, fontWeight: "bold", color: "#111827", marginBottom: 20 }}>
          {deal ? "Editar Negócio" : "Novo Negócio"}
        </div>

        {/* Title field */}
        <div style={fieldStyle}>
          <label style={labelStyle}>Título *</label>
          <input
            style={inputStyle}
            value={form.title}
            onChange={e => set("title", e.target.value)}
            placeholder="Ex: Proposta para cliente X"
          />
        </div>

        {/* Value field */}
        <div style={fieldStyle}>
          <label style={labelStyle}>Valor (R$)</label>
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <span
              style={{
                position: "absolute",
                left: 10,
                color: "#6B7280",
                fontSize: 13,
                pointerEvents: "none",
                userSelect: "none",
              }}
            >
              R$
            </span>
            <input
              style={{ ...inputStyle, paddingLeft: 34 }}
              type="number"
              min="0"
              step="0.01"
              value={form.value}
              onChange={e => set("value", e.target.value)}
              placeholder="0,00"
            />
          </div>
        </div>

        {/* Stage and Status row */}
        <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Etapa</label>
            <select
              style={inputStyle}
              value={form.stage}
              onChange={e => set("stage", e.target.value)}
            >
              {STAGE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Status</label>
            <select
              style={inputStyle}
              value={form.status}
              onChange={e => set("status", e.target.value)}
            >
              {STATUS_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Expected close date */}
        <div style={fieldStyle}>
          <label style={labelStyle}>Previsão de Fechamento</label>
          <input
            style={inputStyle}
            type="date"
            value={form.expectedCloseDate}
            onChange={e => set("expectedCloseDate", e.target.value)}
          />
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
          <button
            onClick={onClose}
            style={{
              padding: "8px 16px",
              borderRadius: 6,
              border: "1px solid #D1D5DB",
              background: "#fff",
              cursor: "pointer",
              fontSize: 13,
              fontFamily: "inherit",
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: "8px 16px",
              borderRadius: 6,
              border: "none",
              background: saving ? "#86EFAC" : "#22C55E",
              color: "#fff",
              cursor: saving ? "not-allowed" : "pointer",
              fontSize: 13,
              fontWeight: "bold",
              fontFamily: "inherit",
              transition: "background 0.2s",
            }}
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DealModal;
