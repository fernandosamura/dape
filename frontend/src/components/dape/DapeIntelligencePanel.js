import React, { useState, useEffect, useCallback } from "react";
import api from "../../services/api";

const POTENTIAL_CONFIG = {
  alto:  { label: "🚀 Alto Potencial",   bg: "#D1FAE5", color: "#065F46" },
  medio: { label: "📈 Médio Potencial",  bg: "#FEF3C7", color: "#92400E" },
  baixo: { label: "📉 Baixo Potencial",  bg: "#FEE2E2", color: "#991B1B" },
};

function ScoreGauge({ label, value, color }) {
  return (
    <div style={{ flex: 1, minWidth: 70, textAlign: "center" }}>
      <div style={{
        width: 52, height: 52, borderRadius: "50%", margin: "0 auto 4px",
        background: `conic-gradient(${color} ${value * 3.6}deg, #E5E7EB ${value * 3.6}deg)`,
        display: "flex", alignItems: "center", justifyContent: "center",
        position: "relative",
      }}>
        <div style={{
          width: 38, height: 38, borderRadius: "50%", background: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, fontWeight: "bold", color,
        }}>{value}</div>
      </div>
      <div style={{ fontSize: 10, color: "#6B7280", lineHeight: 1.2 }}>{label}</div>
    </div>
  );
}

function EditField({ label, value, onSave, type = "text", placeholder = "" }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value || "");
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
      <span style={{ fontSize: 11, color: "#9CA3AF", minWidth: 90 }}>{label}:</span>
      {editing ? (
        <>
          <input
            autoFocus
            style={{ flex: 1, padding: "3px 6px", border: "1px solid #93C5FD", borderRadius: 4, fontSize: 12, outline: "none" }}
            type={type} value={val} onChange={e => setVal(e.target.value)}
          />
          <button onClick={() => { onSave(val); setEditing(false); }} style={{ padding: "2px 8px", fontSize: 11, background: "#3B82F6", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}>OK</button>
          <button onClick={() => { setVal(value || ""); setEditing(false); }} style={{ padding: "2px 6px", fontSize: 11, background: "#fff", border: "1px solid #D1D5DB", borderRadius: 4, cursor: "pointer" }}>✕</button>
        </>
      ) : (
        <>
          <span style={{ flex: 1, fontSize: 12, color: val ? "#374151" : "#D1D5DB" }}>{val || placeholder || "—"}</span>
          <button onClick={() => setEditing(true)} style={{ fontSize: 10, color: "#9CA3AF", border: "none", background: "none", cursor: "pointer", padding: "0 2px" }}>✏️</button>
        </>
      )}
    </div>
  );
}

export default function DapeIntelligencePanel({ contactId }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [pendingUpdates, setPendingUpdates] = useState({});

  const loadProfile = useCallback(async () => {
    if (!contactId) return;
    try {
      setLoading(true);
      const { data } = await api.get(`/dape/intelligence/profile/${contactId}`);
      setProfile(data);
    } catch (err) {
      if (err?.response?.status !== 404) console.error("[DapeIntelligence] load:", err);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [contactId]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  async function handleAnalyze() {
    setAnalyzing(true);
    try {
      const { data } = await api.post(`/dape/intelligence/analyze/${contactId}`);
      setProfile(data);
    } catch (err) {
      alert(err?.response?.data?.error || "Erro ao analisar");
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleFieldSave(field, value) {
    const update = { ...pendingUpdates, [field]: value };
    setPendingUpdates(update);
    try {
      await api.put(`/dape/intelligence/profile/${contactId}`, update);
      await loadProfile();
      setPendingUpdates({});
    } catch (err) {
      console.error("[DapeIntelligence] update:", err);
    }
  }

  const potCfg = profile?.growth_potential ? POTENTIAL_CONFIG[profile.growth_potential] : null;

  const s = {
    wrap: { border: "1px solid #E5E7EB", borderRadius: 10, padding: 14, background: "#FAFAFA", marginBottom: 12 },
    header: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
    title: { fontSize: 13, fontWeight: "bold", color: "#374151" },
    btnPrimary: { padding: "4px 10px", borderRadius: 6, fontSize: 12, border: "none", background: "#6D28D9", color: "#fff", cursor: "pointer", fontWeight: "bold" },
    btnSm: { padding: "3px 8px", borderRadius: 5, fontSize: 11, border: "1px solid #D1D5DB", background: "#fff", cursor: "pointer", color: "#374151", marginLeft: 4 },
    gaugesRow: { display: "flex", gap: 6, justifyContent: "space-around", padding: "10px 0", borderBottom: "1px solid #F3F4F6", marginBottom: 10 },
    noData: { fontSize: 12, color: "#9CA3AF" },
    loading: { fontSize: 12, color: "#9CA3AF" },
    editSection: { marginTop: 10, paddingTop: 10, borderTop: "1px solid #F3F4F6" },
  };

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <span style={s.title}>🏢 Intelligence</span>
        <div>
          <button style={s.btnPrimary} onClick={handleAnalyze} disabled={analyzing}>
            {analyzing ? "Analisando..." : "🔍 Analisar"}
          </button>
          <button style={s.btnSm} onClick={() => setShowEdit(!showEdit)}>
            {showEdit ? "▲" : "✏️ Dados"}
          </button>
        </div>
      </div>

      {loading ? (
        <div style={s.loading}>Carregando...</div>
      ) : !profile ? (
        <div style={s.noData}>Nenhuma análise. Clique em "Analisar" para gerar o diagnóstico.</div>
      ) : (
        <>
          {/* Potential badge */}
          {potCfg && (
            <div style={{ marginBottom: 10 }}>
              <span style={{ padding: "3px 10px", borderRadius: 12, fontSize: 12, fontWeight: "bold", background: potCfg.bg, color: potCfg.color }}>
                {potCfg.label}
              </span>
              {profile.segment && <span style={{ marginLeft: 8, fontSize: 11, color: "#9CA3AF" }}>{profile.segment}</span>}
            </div>
          )}

          {/* Score gauges */}
          <div style={s.gaugesRow}>
            <ScoreGauge label="Presença Digital" value={profile.digital_presence_score || 0} color="#8B5CF6" />
            <ScoreGauge label="Conversão" value={profile.conversion_score || 0} color="#3B82F6" />
            <ScoreGauge label="Relacionamento" value={profile.relationship_score || 0} color="#22C55E" />
            <ScoreGauge label="Score Geral" value={profile.overall_score || 0} color="#F59E0B" />
          </div>

          {/* Social data summary */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 11, color: "#6B7280" }}>
            {profile.instagram_handle && (
              <span>📷 @{profile.instagram_handle}
                {profile.instagram_followers ? ` (${Number(profile.instagram_followers).toLocaleString()} seguidores)` : ""}
              </span>
            )}
            {profile.google_rating > 0 && (
              <span>⭐ {Number(profile.google_rating).toFixed(1)}{profile.google_reviews ? ` (${profile.google_reviews} avaliações)` : ""}</span>
            )}
            {profile.website_url && <span>🌐 Site cadastrado</span>}
            {profile.city && <span>📍 {profile.city}{profile.state ? `/${profile.state}` : ""}</span>}
          </div>

          {profile.last_analyzed_at && (
            <div style={{ fontSize: 10, color: "#D1D5DB", textAlign: "right", marginTop: 6 }}>
              Análise: {new Date(profile.last_analyzed_at).toLocaleString("pt-BR")}
            </div>
          )}
        </>
      )}

      {/* Editable fields */}
      {showEdit && (
        <div style={s.editSection}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", marginBottom: 8, textTransform: "uppercase" }}>Dados da Empresa</div>
          <EditField label="Nome empresa" value={profile?.company_name} onSave={v => handleFieldSave("companyName", v)} placeholder="Nome da empresa" />
          <EditField label="Instagram" value={profile?.instagram_handle} onSave={v => handleFieldSave("instagramHandle", v)} placeholder="@usuario" />
          <EditField label="Seguidores IG" value={profile?.instagram_followers} onSave={v => handleFieldSave("instagramFollowers", parseInt(v, 10) || 0)} type="number" placeholder="0" />
          <EditField label="Nota Google" value={profile?.google_rating} onSave={v => handleFieldSave("googleRating", parseFloat(v) || 0)} type="number" placeholder="4.5" />
          <EditField label="Avaliações" value={profile?.google_reviews} onSave={v => handleFieldSave("googleReviews", parseInt(v, 10) || 0)} type="number" placeholder="0" />
          <EditField label="Website" value={profile?.website_url} onSave={v => handleFieldSave("websiteUrl", v)} placeholder="https://..." />
          <EditField label="Segmento" value={profile?.segment} onSave={v => handleFieldSave("segment", v)} placeholder="Ex: salão de beleza" />
          <EditField label="Cidade" value={profile?.city} onSave={v => handleFieldSave("city", v)} placeholder="São Paulo" />
          <EditField label="Estado" value={profile?.state} onSave={v => handleFieldSave("state", v.toUpperCase().slice(0, 2))} placeholder="SP" />
          <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 6 }}>Após editar os dados, clique em "Analisar" para recalcular o score.</div>
        </div>
      )}
    </div>
  );
}
