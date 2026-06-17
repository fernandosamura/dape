import React, { useState, useEffect } from "react";
import api from "../../services/api";
import DapeModuleGuard from "../../components/dape/DapeModuleGuard";

const POTENTIAL_CONFIG = {
  alto:  { label: "🚀 Alto", bg: "#D1FAE5", color: "#065F46" },
  medio: { label: "📈 Médio", bg: "#FEF3C7", color: "#92400E" },
  baixo: { label: "📉 Baixo", bg: "#FEE2E2", color: "#991B1B" },
};

function IntelligenceDashboard() {
  const [profiles, setProfiles] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ growthPotential: "", segment: "" });

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter.growthPotential) params.set("growthPotential", filter.growthPotential);
      if (filter.segment) params.set("segment", filter.segment);
      const { data } = await api.get(`/dape/intelligence/profiles?${params}`);
      setProfiles(data.profiles || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error("[DapeIntelligence] load:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [filter]);

  const inp = { padding: "6px 10px", border: "1px solid #D1D5DB", borderRadius: 6, fontSize: 12, outline: "none" };

  return (
    <div style={{ padding: "20px 24px", fontFamily: "inherit", background: "#F9FAFB", minHeight: "100vh" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: "bold", color: "#111827" }}>🏢 DAPLE Intelligence</div>
        <div style={{ fontSize: 13, color: "#6B7280" }}>{total} perfis analisados</div>
      </div>

      {/* Filters */}
      <div style={{ background: "#fff", borderRadius: 10, padding: 16, marginBottom: 16, display: "flex", gap: 12, alignItems: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
        <div>
          <label style={{ fontSize: 11, color: "#9CA3AF", display: "block", marginBottom: 3 }}>Potencial</label>
          <select style={inp} value={filter.growthPotential} onChange={e => setFilter(f => ({ ...f, growthPotential: e.target.value }))}>
            <option value="">Todos</option>
            <option value="alto">🚀 Alto</option>
            <option value="medio">📈 Médio</option>
            <option value="baixo">📉 Baixo</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: 11, color: "#9CA3AF", display: "block", marginBottom: 3 }}>Segmento</label>
          <input style={inp} placeholder="Buscar segmento..." value={filter.segment} onChange={e => setFilter(f => ({ ...f, segment: e.target.value }))} />
        </div>
        <button onClick={load} style={{ marginTop: 14, padding: "6px 14px", borderRadius: 6, border: "none", background: "#6D28D9", color: "#fff", fontSize: 12, cursor: "pointer" }}>Buscar</button>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ color: "#9CA3AF", padding: 40, textAlign: "center" }}>Carregando perfis...</div>
      ) : profiles.length === 0 ? (
        <div style={{ background: "#fff", borderRadius: 10, padding: 32, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>
          Nenhum perfil encontrado. Abra um ticket e clique em "🔍 Analisar" no painel Intelligence.
        </div>
      ) : (
        <div style={{ background: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#F9FAFB" }}>
                {["Empresa/Contato","Segmento","Presença Digital","Conversão","Relacionamento","Score Geral","Potencial"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "10px 14px", color: "#6B7280", fontSize: 11, fontWeight: 600, textTransform: "uppercase", borderBottom: "1px solid #E5E7EB" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {profiles.map((p, i) => {
                const potCfg = p.growth_potential ? POTENTIAL_CONFIG[p.growth_potential] : null;
                return (
                  <tr key={p.id || i} style={{ borderBottom: "1px solid #F3F4F6" }}>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ fontWeight: "bold", color: "#111827" }}>{p.company_name || p.contact_name}</div>
                      <div style={{ fontSize: 11, color: "#9CA3AF" }}>
                        {p.contact_number}
                        {p.instagram_handle && ` · @${p.instagram_handle}`}
                        {p.city && ` · ${p.city}`}
                      </div>
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "#6B7280" }}>{p.segment || "—"}</td>
                    {[p.digital_presence_score, p.conversion_score, p.relationship_score].map((sc, j) => (
                      <td key={j} style={{ padding: "10px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ width: 40, height: 6, borderRadius: 3, background: "#E5E7EB", overflow: "hidden" }}>
                            <div style={{ width: `${sc || 0}%`, height: "100%", background: (sc||0) >= 70 ? "#22C55E" : (sc||0) >= 40 ? "#F59E0B" : "#EF4444", borderRadius: 3 }} />
                          </div>
                          <span style={{ fontSize: 12, fontWeight: "bold", color: "#374151" }}>{sc || 0}</span>
                        </div>
                      </td>
                    ))}
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ fontSize: 16, fontWeight: "bold", color: (p.overall_score||0) >= 70 ? "#22C55E" : (p.overall_score||0) >= 40 ? "#F59E0B" : "#EF4444" }}>
                        {p.overall_score || 0}
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      {potCfg ? (
                        <span style={{ padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: "bold", background: potCfg.bg, color: potCfg.color }}>{potCfg.label}</span>
                      ) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function DapeIntelligencePage() {
  return (
    <DapeModuleGuard moduleKey="dape_intelligence" fallback={<div style={{ padding: 32, color: "#9CA3AF" }}>Módulo Intelligence não habilitado no seu plano.</div>}>
      <IntelligenceDashboard />
    </DapeModuleGuard>
  );
}
