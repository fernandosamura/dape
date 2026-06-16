import React, { useState, useEffect, useCallback } from "react";
import api from "../../services/api";
import DapeModuleGuard from "../../components/dape/DapeModuleGuard";

// ── Helpers ──────────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  draft:    { label: "Rascunho",  bg: "#F3F4F6", color: "#6B7280" },
  active:   { label: "Ativa",     bg: "#D1FAE5", color: "#065F46" },
  paused:   { label: "Pausada",   bg: "#FEF3C7", color: "#92400E" },
  finished: { label: "Concluída", bg: "#DBEAFE", color: "#1D4ED8" },
};

const GOAL_STATUS = (current, target) => {
  if (target <= 0) return { label: "—", color: "#9CA3AF" };
  const pct = (current / target) * 100;
  if (pct >= 100) return { label: "✅ Atingida", color: "#065F46" };
  if (pct >= 70)  return { label: "🟡 Em progresso", color: "#92400E" };
  return { label: "🔴 Abaixo", color: "#991B1B" };
};

const METRIC_LABELS = {
  leads: "Leads", meetings: "Reuniões", contracts: "Contratos", revenue: "Receita (R$)",
};

function ProgressBar({ value, color = "#3B82F6" }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div style={{ background: "#E5E7EB", borderRadius: 4, height: 8, overflow: "hidden", marginTop: 4 }}>
      <div style={{ width: `${pct}%`, height: "100%", background: pct >= 100 ? "#22C55E" : color, borderRadius: 4, transition: "width 0.4s" }} />
    </div>
  );
}

function Badge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  return <span style={{ padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: "bold", background: cfg.bg, color: cfg.color }}>{cfg.label}</span>;
}

// ── Campaign Modal ────────────────────────────────────────────────────────────
function CampaignModal({ open, onClose, onSave, initial }) {
  const empty = { name: "", description: "", targetSegment: "", goalLeads: 0, goalMeetings: 0, goalContracts: 0, goalRevenue: 0, startDate: "", endDate: "", status: "draft" };
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setForm(initial ? { ...empty, ...initial } : empty); }, [open]);

  if (!open) return null;

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSave() {
    if (!form.name.trim()) { alert("Nome é obrigatório"); return; }
    setSaving(true);
    try { await onSave(form); onClose(); }
    catch (e) { alert(e?.response?.data?.error || "Erro ao salvar"); }
    finally { setSaving(false); }
  }

  const inputStyle = { width: "100%", padding: "7px 10px", border: "1px solid #D1D5DB", borderRadius: 6, fontSize: 13, boxSizing: "border-box", outline: "none" };
  const labelStyle = { fontSize: 12, color: "#6B7280", marginBottom: 3, display: "block" };
  const row = { display: "flex", gap: 10, marginBottom: 12 };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: 12, padding: 24, width: 500, maxWidth: "92vw", maxHeight: "85vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 16, fontWeight: "bold", marginBottom: 18 }}>{initial ? "Editar Campanha" : "Nova Campanha"}</div>

        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Nome da campanha *</label>
          <input style={inputStyle} value={form.name} onChange={e => set("name", e.target.value)} placeholder="Ex: Black Friday 2026" />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Segmento-alvo</label>
          <input style={inputStyle} value={form.targetSegment} onChange={e => set("targetSegment", e.target.value)} placeholder="Ex: salões de beleza, restaurantes..." />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Descrição</label>
          <textarea style={{ ...inputStyle, height: 64, resize: "none" }} value={form.description} onChange={e => set("description", e.target.value)} />
        </div>

        <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 8 }}>Metas</div>
        <div style={row}>
          {["goalLeads","goalMeetings","goalContracts"].map(k => (
            <div key={k} style={{ flex: 1 }}>
              <label style={labelStyle}>{k === "goalLeads" ? "Leads" : k === "goalMeetings" ? "Reuniões" : "Contratos"}</label>
              <input style={inputStyle} type="number" min="0" value={form[k]} onChange={e => set(k, Number(e.target.value))} />
            </div>
          ))}
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Meta de receita (R$)</label>
          <input style={inputStyle} type="number" min="0" value={form.goalRevenue} onChange={e => set("goalRevenue", Number(e.target.value))} />
        </div>

        <div style={row}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Início</label>
            <input style={inputStyle} type="date" value={form.startDate || ""} onChange={e => set("startDate", e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Fim</label>
            <input style={inputStyle} type="date" value={form.endDate || ""} onChange={e => set("endDate", e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Status</label>
            <select style={inputStyle} value={form.status} onChange={e => set("status", e.target.value)}>
              {Object.entries(STATUS_CONFIG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
          <button onClick={onClose} style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #D1D5DB", background: "#fff", cursor: "pointer", fontSize: 13 }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: "#22C55E", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: "bold" }}>
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Result Entry Modal ────────────────────────────────────────────────────────
function ResultModal({ open, onClose, campaignId, onSave }) {
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({ metricDate: today, leadsGenerated: 0, meetingsDone: 0, contractsClosed: 0, revenueGenerated: 0, notes: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) setForm(f => ({ ...f, metricDate: today })); }, [open]);
  if (!open) return null;

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }
  const inp = { width: "100%", padding: "7px 10px", border: "1px solid #D1D5DB", borderRadius: 6, fontSize: 13, boxSizing: "border-box" };

  async function handleSave() {
    setSaving(true);
    try { await onSave(form); onClose(); }
    catch (e) { alert(e?.response?.data?.error || "Erro"); }
    finally { setSaving(false); }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: 12, padding: 24, width: 380, maxWidth: "90vw", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 15, fontWeight: "bold", marginBottom: 16 }}>Lançar Resultado Diário</div>
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 12, color: "#6B7280" }}>Data</label>
          <input style={inp} type="date" value={form.metricDate} onChange={e => set("metricDate", e.target.value)} />
        </div>
        {[["leadsGenerated","Leads gerados"],["meetingsDone","Reuniões feitas"],["contractsClosed","Contratos fechados"],["revenueGenerated","Receita gerada (R$)"]].map(([k,l]) => (
          <div key={k} style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 12, color: "#6B7280" }}>{l}</label>
            <input style={inp} type="number" min="0" value={form[k]} onChange={e => set(k, Number(e.target.value))} />
          </div>
        ))}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, color: "#6B7280" }}>Observações</label>
          <textarea style={{ ...inp, height: 56, resize: "none" }} value={form.notes} onChange={e => set("notes", e.target.value)} />
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "7px 14px", borderRadius: 6, border: "1px solid #D1D5DB", background: "#fff", cursor: "pointer", fontSize: 13 }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: "7px 14px", borderRadius: 6, border: "none", background: "#3B82F6", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: "bold" }}>
            {saving ? "..." : "Lançar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Goals Section ─────────────────────────────────────────────────────────────
function GoalsSection({ companyId }) {
  const now = new Date();
  const monthRef = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [goals, setGoals] = useState([]);
  const [editGoal, setEditGoal] = useState(null);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [addForm, setAddForm] = useState({ periodType: "month", periodRef: monthRef, metric: "leads", targetValue: 0, currentValue: 0 });

  useEffect(() => { loadGoals(); }, []);

  async function loadGoals() {
    try { const { data } = await api.get("/dape/growth/goals"); setGoals(data); }
    catch (e) { console.error(e); }
  }

  async function handleUpdateProgress(goal, newValue) {
    try {
      await api.put(`/dape/growth/goals/${goal.id}`, { currentValue: Number(newValue) });
      loadGoals();
    } catch (e) { alert("Erro ao atualizar meta"); }
  }

  async function handleAddGoal() {
    try {
      await api.post("/dape/growth/goals", addForm);
      setShowAddGoal(false);
      loadGoals();
    } catch (e) { alert(e?.response?.data?.error || "Erro"); }
  }

  const inp = { padding: "5px 8px", border: "1px solid #D1D5DB", borderRadius: 5, fontSize: 12, boxSizing: "border-box" };
  const currentMonth = goals.filter(g => g.period_ref === monthRef);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#374151" }}>🎯 Metas — {monthRef}</div>
        <button onClick={() => setShowAddGoal(!showAddGoal)} style={{ padding: "5px 12px", borderRadius: 6, border: "none", background: "#3B82F6", color: "#fff", fontSize: 12, cursor: "pointer", fontWeight: "bold" }}>+ Meta</button>
      </div>

      {showAddGoal && (
        <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 10, padding: 14, marginBottom: 14, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end" }}>
          <div><label style={{ fontSize: 11, color: "#6B7280" }}>Período</label><br />
            <select style={inp} value={addForm.periodType} onChange={e => setAddForm(f => ({ ...f, periodType: e.target.value }))}>
              <option value="month">Mês</option><option value="quarter">Trimestre</option><option value="year">Ano</option>
            </select>
          </div>
          <div><label style={{ fontSize: 11, color: "#6B7280" }}>Referência</label><br />
            <input style={{ ...inp, width: 90 }} value={addForm.periodRef} onChange={e => setAddForm(f => ({ ...f, periodRef: e.target.value }))} placeholder="2026-06" />
          </div>
          <div><label style={{ fontSize: 11, color: "#6B7280" }}>Métrica</label><br />
            <select style={inp} value={addForm.metric} onChange={e => setAddForm(f => ({ ...f, metric: e.target.value }))}>
              {Object.entries(METRIC_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div><label style={{ fontSize: 11, color: "#6B7280" }}>Meta</label><br />
            <input style={{ ...inp, width: 80 }} type="number" min="0" value={addForm.targetValue} onChange={e => setAddForm(f => ({ ...f, targetValue: Number(e.target.value) }))} />
          </div>
          <button onClick={handleAddGoal} style={{ padding: "5px 12px", borderRadius: 6, border: "none", background: "#22C55E", color: "#fff", fontSize: 12, cursor: "pointer" }}>Salvar</button>
        </div>
      )}

      {currentMonth.length === 0 ? (
        <p style={{ color: "#9CA3AF", fontSize: 13 }}>Nenhuma meta cadastrada para este mês.</p>
      ) : (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {currentMonth.map(g => {
            const pct = g.target_value > 0 ? Math.min(100, Math.round((g.current_value / g.target_value) * 100)) : 0;
            const st = GOAL_STATUS(g.current_value, g.target_value);
            return (
              <div key={g.id} style={{ flex: 1, minWidth: 180, background: "#fff", border: "1px solid #E5E7EB", borderRadius: 10, padding: 14, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
                <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 4 }}>{METRIC_LABELS[g.metric] || g.metric}</div>
                <div style={{ fontSize: 22, fontWeight: "bold", color: "#111827" }}>
                  {g.metric === "revenue" ? `R$ ${Number(g.current_value).toLocaleString("pt-BR",{minimumFractionDigits:0})}` : g.current_value}
                  <span style={{ fontSize: 13, color: "#9CA3AF", fontWeight: "normal" }}>
                    {" / "}{g.metric === "revenue" ? `R$ ${Number(g.target_value).toLocaleString("pt-BR",{minimumFractionDigits:0})}` : g.target_value}
                  </span>
                </div>
                <ProgressBar value={pct} color={pct >= 100 ? "#22C55E" : pct >= 70 ? "#F59E0B" : "#EF4444"} />
                <div style={{ fontSize: 11, marginTop: 5, color: st.color }}>{st.label} — {pct}%</div>
                {editGoal === g.id ? (
                  <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
                    <input id={`goal-inp-${g.id}`} style={{ ...inp, flex: 1, fontSize: 12 }} type="number" defaultValue={g.current_value} />
                    <button onClick={() => { handleUpdateProgress(g, document.getElementById(`goal-inp-${g.id}`).value); setEditGoal(null); }} style={{ padding: "3px 8px", background: "#3B82F6", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11 }}>OK</button>
                    <button onClick={() => setEditGoal(null)} style={{ padding: "3px 6px", background: "#fff", border: "1px solid #D1D5DB", borderRadius: 4, cursor: "pointer", fontSize: 11 }}>✕</button>
                  </div>
                ) : (
                  <button onClick={() => setEditGoal(g.id)} style={{ marginTop: 8, fontSize: 11, color: "#3B82F6", border: "none", background: "none", cursor: "pointer", padding: 0 }}>Atualizar progresso</button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main Growth Page ──────────────────────────────────────────────────────────
function GrowthDashboard() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editCampaign, setEditCampaign] = useState(null);
  const [resultModal, setResultModal] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [campaignResults, setCampaignResults] = useState({});
  const [filterStatus, setFilterStatus] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    try { const { data } = await api.get("/dape/growth/campaigns"); setCampaigns(data); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSaveCampaign(form) {
    if (editCampaign) await api.put(`/dape/growth/campaigns/${editCampaign.id}`, form);
    else await api.post("/dape/growth/campaigns", form);
    await load();
  }

  async function handleDelete(id) {
    if (!window.confirm("Excluir esta campanha?")) return;
    await api.delete(`/dape/growth/campaigns/${id}`);
    await load();
  }

  async function handleSaveResult(campaignId, form) {
    await api.post(`/dape/growth/campaigns/${campaignId}/results`, form);
    await load();
    // Refresh results
    const { data } = await api.get(`/dape/growth/campaigns/${campaignId}/results`);
    setCampaignResults(r => ({ ...r, [campaignId]: data }));
  }

  async function toggleExpand(id) {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (!campaignResults[id]) {
      const { data } = await api.get(`/dape/growth/campaigns/${id}/results`);
      setCampaignResults(r => ({ ...r, [id]: data }));
    }
  }

  const filtered = filterStatus === "all" ? campaigns : campaigns.filter(c => c.status === filterStatus);

  return (
    <div style={{ padding: "20px 24px", fontFamily: "inherit", background: "#F9FAFB", minHeight: "100vh" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: "bold", color: "#111827" }}>🚀 DAPE Growth</div>
        <button onClick={() => { setEditCampaign(null); setModalOpen(true); }} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#22C55E", color: "#fff", fontWeight: "bold", fontSize: 13, cursor: "pointer" }}>+ Nova Campanha</button>
      </div>

      {/* Goals */}
      <div style={{ background: "#fff", borderRadius: 12, padding: 20, marginBottom: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
        <GoalsSection />
      </div>

      {/* Campaigns */}
      <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#374151" }}>📋 Campanhas</div>
          <div style={{ display: "flex", gap: 6 }}>
            {["all", "active", "draft", "paused", "finished"].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)} style={{ padding: "4px 10px", borderRadius: 14, fontSize: 11, cursor: "pointer", border: "none", fontWeight: filterStatus === s ? "bold" : "normal", background: filterStatus === s ? "#3B82F6" : "#E5E7EB", color: filterStatus === s ? "#fff" : "#374151" }}>
                {s === "all" ? "Todas" : STATUS_CONFIG[s]?.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? <p style={{ color: "#9CA3AF" }}>Carregando...</p> : filtered.length === 0 ? (
          <p style={{ color: "#9CA3AF", fontSize: 13 }}>Nenhuma campanha encontrada.</p>
        ) : filtered.map(c => (
          <div key={c.id} style={{ border: "1px solid #E5E7EB", borderRadius: 10, marginBottom: 12, overflow: "hidden" }}>
            {/* Campaign Header */}
            <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => toggleExpand(c.id)}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontWeight: "bold", fontSize: 14, color: "#111827" }}>{c.name}</span>
                  <Badge status={c.status} />
                  {c.target_segment && <span style={{ fontSize: 11, color: "#9CA3AF" }}>· {c.target_segment}</span>}
                </div>
                {/* Progress bars */}
                <div style={{ display: "flex", gap: 16 }}>
                  {[
                    ["Leads", c.total_leads || c.totalLeads, c.goal_leads || c.goalLeads, "#3B82F6"],
                    ["Reuniões", c.total_meetings || c.totalMeetings, c.goal_meetings || c.goalMeetings, "#8B5CF6"],
                    ["Contratos", c.total_contracts || c.totalContracts, c.goal_contracts || c.goalContracts, "#22C55E"],
                  ].filter(([,, goal]) => goal > 0).map(([label, val, goal, color]) => {
                    const pct = goal > 0 ? Math.min(100, Math.round((val / goal) * 100)) : 0;
                    return (
                      <div key={label} style={{ flex: 1, minWidth: 80 }}>
                        <div style={{ fontSize: 11, color: "#6B7280" }}>{label}: <strong>{val}/{goal}</strong> ({pct}%)</div>
                        <ProgressBar value={pct} color={color} />
                      </div>
                    );
                  })}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={e => { e.stopPropagation(); setResultModal(c.id); }} style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: "#3B82F6", color: "#fff", fontSize: 11, cursor: "pointer" }}>+ Resultado</button>
                <button onClick={e => { e.stopPropagation(); setEditCampaign(c); setModalOpen(true); }} style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #D1D5DB", background: "#fff", fontSize: 11, cursor: "pointer" }}>✏️</button>
                <button onClick={e => { e.stopPropagation(); handleDelete(c.id); }} style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #FCA5A5", background: "#FEF2F2", fontSize: 11, cursor: "pointer", color: "#991B1B" }}>🗑️</button>
              </div>
            </div>

            {/* Expanded results */}
            {expandedId === c.id && (
              <div style={{ borderTop: "1px solid #F3F4F6", padding: "12px 16px", background: "#FAFAFA" }}>
                {c.description && <p style={{ fontSize: 12, color: "#6B7280", marginBottom: 8 }}>{c.description}</p>}
                <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 8 }}>Histórico de Resultados</div>
                {!campaignResults[c.id] || campaignResults[c.id].length === 0 ? (
                  <p style={{ fontSize: 12, color: "#9CA3AF" }}>Nenhum resultado lançado ainda.</p>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr>{["Data","Leads","Reuniões","Contratos","Receita","Obs"].map(h => (
                        <th key={h} style={{ textAlign: "left", padding: "5px 8px", color: "#9CA3AF", fontWeight: 600, borderBottom: "1px solid #E5E7EB" }}>{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody>
                      {campaignResults[c.id].map(r => (
                        <tr key={r.id} style={{ borderBottom: "1px solid #F3F4F6" }}>
                          <td style={{ padding: "5px 8px" }}>{r.metric_date?.substring?.(0,10)}</td>
                          <td style={{ padding: "5px 8px" }}>{r.leads_generated}</td>
                          <td style={{ padding: "5px 8px" }}>{r.meetings_done}</td>
                          <td style={{ padding: "5px 8px" }}>{r.contracts_closed}</td>
                          <td style={{ padding: "5px 8px" }}>R$ {Number(r.revenue_generated).toLocaleString("pt-BR",{minimumFractionDigits:2})}</td>
                          <td style={{ padding: "5px 8px", color: "#9CA3AF" }}>{r.notes || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <CampaignModal open={modalOpen} onClose={() => setModalOpen(false)} onSave={handleSaveCampaign} initial={editCampaign} />
      <ResultModal open={!!resultModal} onClose={() => setResultModal(null)} campaignId={resultModal} onSave={(form) => handleSaveResult(resultModal, form)} />
    </div>
  );
}

export default function DapeGrowthPage() {
  return (
    <DapeModuleGuard moduleKey="dape_growth" fallback={<div style={{ padding: 32, color: "#9CA3AF" }}>Módulo Growth não habilitado no seu plano.</div>}>
      <GrowthDashboard />
    </DapeModuleGuard>
  );
}
