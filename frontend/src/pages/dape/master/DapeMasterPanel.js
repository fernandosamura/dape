import React, { useState, useEffect, useCallback } from "react";
import {
  Box, Typography, Button, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, IconButton, Chip, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Grid, Switch, FormControlLabel, CircularProgress, Tabs, Tab,
  Card, CardContent, CardActions, Divider, Alert
} from "@material-ui/core";
import {
  Edit as EditIcon, Delete as DeleteIcon, Add as AddIcon, HowToReg as ApproveIcon,
  Business as BusinessIcon, Assignment as PlanIcon,
  Settings as SettingsIcon, BarChart as StatsIcon,
  Refresh as RefreshIcon, CheckCircle, Cancel, Warning
} from "@material-ui/icons";
import { makeStyles } from "@material-ui/core/styles";
import { toast } from "react-toastify";
import api from "../../../services/api";

const useStyles = makeStyles((theme) => ({
  root: { padding: theme.spacing(3) },
  header: { marginBottom: theme.spacing(3), display: "flex", alignItems: "center", justifyContent: "space-between" },
  tabs: { marginBottom: theme.spacing(3) },
  card: { height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between" },
  chip: { margin: "2px" },
  priceTag: { fontSize: "1.5rem", fontWeight: "bold", color: theme.palette.primary.main },
  moduleGrid: { display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "8px" },
  sectionTitle: { fontWeight: 600, marginBottom: theme.spacing(1), marginTop: theme.spacing(2) },
  masterBadge: { background: "#FFD700", color: "#000", fontWeight: "bold" },
  warningBanner: { marginBottom: theme.spacing(2) }
}));

const MODULE_KEYS = [
  { key: "dape_pipeline", label: "Pipeline" },
  { key: "dape_analytics", label: "Analytics" },
  { key: "dape_ia", label: "IA" },
  { key: "dape_growth", label: "Growth" },
  { key: "dape_intelligence", label: "Intelligence" },
  { key: "dape_radar", label: "Radar" }
];

const EMPTY_PLAN = {
  name: "", description: "", price: "",
  max_users: 5, max_contacts: 1000,
  max_connections: 3, max_queues: 3,
  extra_user_price: 0, trial_days: 0, grace_days: 3,
  use_campaigns: false, use_schedules: false, use_internal_chat: false,
  use_external_api: false, use_kanban: false, use_openai: false, use_integrations: false,
  use_ia_audio_reply: false,
  allowed_ia_models: "",
  modules: {
    dape_pipeline: false, dape_analytics: false, dape_ia: false,
    dape_growth: false, dape_intelligence: false, dape_radar: false
  },
  modulesModes: {
    dape_pipeline: "assisted", dape_analytics: "assisted", dape_ia: "assisted",
    dape_growth: "assisted", dape_intelligence: "assisted", dape_radar: "assisted"
  }
};

const OPERATION_MODE_OPTIONS = [
  { value: "disabled", label: "Desativado" },
  { value: "assisted", label: "Assistido" },
  { value: "automatic", label: "Automático" },
];

const EMPTY_COMPANY = {
  name: "", email: "", phone: "", status: "active", dueDate: "",
  plan_id: "", admin_name: "", admin_email: "", admin_password: ""
};

// ─── PLAN DIALOG ─────────────────────────────────────────────────────────────
function PlanDialog({ open, onClose, plan, onSaved }) {
  const [form, setForm] = useState(EMPTY_PLAN);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (plan) {
      // Extract modulesModes from plan.modules if it carries the new object format
      const rawMods = plan.modules || EMPTY_PLAN.modules;
      const parsedMods = typeof rawMods === "string" ? JSON.parse(rawMods || "{}") : rawMods;
      const modulesEnabled = {};
      const modulesModes = { ...EMPTY_PLAN.modulesModes };
      MODULE_KEYS.forEach(({ key }) => {
        const v = parsedMods[key];
        if (typeof v === "object" && v !== null) {
          modulesEnabled[key] = !!v.is_enabled;
          modulesModes[key] = v.operation_mode || "assisted";
        } else {
          modulesEnabled[key] = !!v;
          modulesModes[key] = modulesModes[key] || "assisted";
        }
      });
      setForm({
        name: plan.name || "",
        description: plan.description || "",
        price: plan.price || 0,
        max_users: plan.max_users || 5,
        max_contacts: plan.max_contacts || 1000,
        max_connections: plan.max_connections || 3,
        max_queues: plan.max_queues || 3,
        extra_user_price: plan.extra_user_price || 0,
        trial_days: plan.trial_days || 0,
        grace_days: plan.grace_days || 3,
        use_campaigns: plan.use_campaigns || false,
        use_schedules: plan.use_schedules || false,
        use_internal_chat: plan.use_internal_chat || false,
        use_external_api: plan.use_external_api || false,
        use_kanban: plan.use_kanban || false,
        use_openai: plan.use_openai || false,
        use_integrations: plan.use_integrations || false,
        use_ia_audio_reply: plan.use_ia_audio_reply || false,
        allowed_ia_models: Array.isArray(plan.allowed_ia_models) ? plan.allowed_ia_models.join(", ") : (plan.allowed_ia_models || ""),
        modules: modulesEnabled,
        modulesModes,
      });
    } else {
      setForm(EMPTY_PLAN);
    }
  }, [plan, open]);

  const set = (field, val) => setForm(p => ({ ...p, [field]: val }));
  const setModule = (key, val) => setForm(p => ({ ...p, modules: { ...p.modules, [key]: val } }));
  const setModuleMode = (key, val) => setForm(p => ({ ...p, modulesModes: { ...p.modulesModes, [key]: val } }));

  const handleSave = async () => {
    if (!form.name) return toast.error("Nome obrigatório");
    setSaving(true);
    try {
      const allowedIaModelsArray = typeof form.allowed_ia_models === "string"
        ? form.allowed_ia_models.split(",").map(s => s.trim()).filter(s => s.length > 0)
        : [];
      // Build modules as objects carrying both is_enabled and operation_mode
      const modulesPayload = {};
      MODULE_KEYS.forEach(({ key }) => {
        modulesPayload[key] = { is_enabled: !!form.modules[key], operation_mode: form.modulesModes[key] || "assisted" };
      });
      const payload = { ...form, allowed_ia_models: allowedIaModelsArray, modules: modulesPayload };
      if (plan?.id) {
        await api.put(`/dape/master/plans/${plan.id}`, payload);
        toast.success("Plano atualizado!");
      } else {
        await api.post("/dape/master/plans", payload);
        toast.success("Plano criado!");
      }
      await onSaved();
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.error || "Erro ao salvar plano");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{plan?.id ? "Editar Plano" : "Novo Plano"}</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} style={{ marginTop: 4 }}>
          <Grid item xs={12} md={8}>
            <TextField fullWidth label="Nome do plano" value={form.name} onChange={e => set("name", e.target.value)} variant="outlined" size="small" />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField fullWidth label="Preço (R$)" type="number" value={form.price} onChange={e => set("price", e.target.value)} variant="outlined" size="small" />
          </Grid>
          <Grid item xs={12}>
            <TextField fullWidth label="Descrição" value={form.description} onChange={e => set("description", e.target.value)} variant="outlined" size="small" multiline rows={2} />
          </Grid>
          <Grid item xs={12}>
            <TextField fullWidth label="Modelos de IA Permitidos (separados por vírgula)" value={form.allowed_ia_models} onChange={e => set("allowed_ia_models", e.target.value)} variant="outlined" size="small" placeholder="Ex: gpt-4,gpt-3.5-turbo,claude-3 (vazio = sem restrição)" helperText="Deixe vazio para liberar todos. Ou digite: openai, anthropic, gemini, manus" />
          </Grid>

          <Grid item xs={12}><Typography variant="subtitle2" style={{ fontWeight: 600 }}>Limites do Sistema</Typography></Grid>
          <Grid item xs={6} md={3}><TextField fullWidth label="Máx. Usuários Base" type="number" value={form.max_users} onChange={e => set("max_users", parseInt(e.target.value) || 0)} variant="outlined" size="small" helperText="Padrão: 5" /></Grid>
          <Grid item xs={6} md={3}><TextField fullWidth label="Máx. Conexões" type="number" value={form.max_connections} onChange={e => set("max_connections", parseInt(e.target.value) || 0)} variant="outlined" size="small" /></Grid>
          <Grid item xs={6} md={3}><TextField fullWidth label="Máx. Filas" type="number" value={form.max_queues} onChange={e => set("max_queues", parseInt(e.target.value) || 0)} variant="outlined" size="small" /></Grid>
          <Grid item xs={6} md={3}><TextField fullWidth label="Máx. Contatos" type="number" value={form.max_contacts} onChange={e => set("max_contacts", parseInt(e.target.value) || 0)} variant="outlined" size="small" /></Grid>

          <Grid item xs={12}><Typography variant="subtitle2" style={{ fontWeight: 600 }}>Configurações de Cobrança</Typography></Grid>
          <Grid item xs={6} md={4}>
            <TextField fullWidth label="Preço Usuário Extra (R$/mês)" type="number" value={form.extra_user_price}
              onChange={e => set("extra_user_price", parseFloat(e.target.value) || 0)}
              variant="outlined" size="small"
              helperText="Cobrado por cada usuário extra além do limite base"
            />
          </Grid>
          <Grid item xs={6} md={4}>
            <TextField fullWidth label="Dias de Trial Gratuito" type="number" value={form.trial_days}
              onChange={e => set("trial_days", parseInt(e.target.value) || 0)}
              variant="outlined" size="small"
              helperText="0 = sem trial. Ex: 7, 14, 30"
            />
          </Grid>
          <Grid item xs={6} md={4}>
            <TextField fullWidth label="Dias de Tolerância (Grace)" type="number" value={form.grace_days}
              onChange={e => set("grace_days", parseInt(e.target.value) || 3)}
              variant="outlined" size="small"
              helperText="Dias após vencimento antes de bloquear"
            />
          </Grid>

          <Grid item xs={12}><Typography variant="subtitle2" style={{ fontWeight: 600 }}>Funcionalidades do Sistema</Typography></Grid>
          {[
            ["use_campaigns","Campanhas"], ["use_schedules","Agendamentos"],
            ["use_internal_chat","Chat Interno"], ["use_external_api","API Externa"],
            ["use_kanban","Kanban"], ["use_openai","OpenAI"], ["use_integrations","Integrações"], ["use_facebook","Facebook"], ["use_instagram","Instagram"], ["use_ia_audio_reply","Resposta em Áudio (TTS)"]
          ].map(([k, l]) => (
            <Grid item xs={6} md={3} key={k}>
              <FormControlLabel control={<Switch checked={!!form[k]} onChange={e => set(k, e.target.checked)} color="primary" size="small" />} label={l} />
            </Grid>
          ))}

          <Grid item xs={12}><Divider /><Typography variant="subtitle2" style={{ fontWeight: 600, marginTop: 8 }}>Módulos DAPLE</Typography></Grid>
          {MODULE_KEYS.map(m => (
            <Grid item xs={12} md={6} key={m.key}>
              <Box display="flex" alignItems="center" style={{ gap: 8 }}>
                <FormControlLabel
                  style={{ marginRight: 0, minWidth: 130 }}
                  control={<Switch checked={!!form.modules[m.key]} onChange={e => setModule(m.key, e.target.checked)} color="primary" size="small" />}
                  label={m.label}
                />
                <TextField
                  select size="small" variant="outlined"
                  value={form.modulesModes[m.key] || "assisted"}
                  onChange={e => setModuleMode(m.key, e.target.value)}
                  SelectProps={{ native: true }}
                  style={{ minWidth: 130 }}
                >
                  {OPERATION_MODE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </TextField>
              </Box>
            </Grid>
          ))}
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancelar</Button>
        <Button onClick={handleSave} variant="contained" color="primary" disabled={saving}>
          {saving ? <CircularProgress size={20} /> : "Salvar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── COMPANY DIALOG ──────────────────────────────────────────────────────────
function CompanyDialog({ open, onClose, company, plans, onSaved }) {
  const [form, setForm] = useState(EMPTY_COMPANY);
  const [saving, setSaving] = useState(false);
  const isEdit = !!company?.id;

  useEffect(() => {
    if (company) {
      setForm({
        name: company.name || "",
        email: company.email || "",
        phone: company.phone || "",
        document: company.document || "",
        status: (company.status === true || company.status === "active") ? "active" : "inactive",
        dueDate: company.dueDate && !isNaN(new Date(company.dueDate)) ? new Date(company.dueDate).toISOString().substring(0, 10) : "",
        plan_id: company.dape_plan_id || "",
        admin_name: "", admin_email: "", admin_password: ""
      });
    } else {
      setForm(EMPTY_COMPANY);
    }
  }, [company, open]);

  const set = (field, val) => setForm(p => ({ ...p, [field]: val }));

  const handleSave = async () => {
    if (!form.name || !form.email) return toast.error("Nome e email obrigatórios");
    if (!form.plan_id) return toast.error("Selecione um plano");
    setSaving(true);
    try {
      const payload = { ...form };
      if (isEdit) {
        await api.put(`/dape/master/native/companies/${company.id}`, payload);
        toast.success("Empresa atualizada!");
      } else {
        await api.post("/dape/master/native/companies", payload);
        toast.success("Empresa criada!");
      }
      await onSaved();
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.error || "Erro ao salvar empresa");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isEdit ? "Editar Empresa" : "Nova Empresa"}</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} style={{ marginTop: 4 }}>
          <Grid item xs={12}><TextField fullWidth label="Nome da empresa *" value={form.name} onChange={e => set("name", e.target.value)} variant="outlined" size="small" /></Grid>
          <Grid item xs={12}><TextField fullWidth label="Email *" value={form.email} onChange={e => set("email", e.target.value)} variant="outlined" size="small" /></Grid>
          <Grid item xs={6}><TextField fullWidth label="Telefone" value={form.phone} onChange={e => set("phone", e.target.value)} variant="outlined" size="small" /></Grid>
          <Grid item xs={6}>
            <TextField fullWidth select label="Status" value={form.status} onChange={e => set("status", e.target.value)} variant="outlined" size="small" SelectProps={{ native: true }}>
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
            </TextField>
          </Grid>
          <Grid item xs={6}><TextField fullWidth label="Vencimento" type="date" value={form.dueDate} onChange={e => set("dueDate", e.target.value)} variant="outlined" size="small" InputLabelProps={{ shrink: true }} /></Grid>
          <Grid item xs={12}>
            <TextField fullWidth select label="Plano *" value={form.plan_id} onChange={e => set("plan_id", e.target.value)} variant="outlined" size="small" SelectProps={{ native: true }}>
              <option value="">-- Selecione o plano --</option>
              {plans.map(p => (
                <option key={p.id} value={p.id}>{p.name} — R$ {parseFloat(p.price || 0).toFixed(2)}/mês</option>
              ))}
            </TextField>
          </Grid>
          {!isEdit && (
            <>
              <Grid item xs={12}><Divider /><Typography variant="subtitle2" style={{ fontWeight: 600, marginTop: 8 }}>Usuário Admin (opcional)</Typography></Grid>
              <Grid item xs={12}><TextField fullWidth label="Nome do admin" value={form.admin_name} onChange={e => set("admin_name", e.target.value)} variant="outlined" size="small" /></Grid>
              <Grid item xs={6}><TextField fullWidth label="Email do admin" value={form.admin_email} onChange={e => set("admin_email", e.target.value)} variant="outlined" size="small" /></Grid>
              <Grid item xs={6}><TextField fullWidth label="Senha" type="password" value={form.admin_password} onChange={e => set("admin_password", e.target.value)} variant="outlined" size="small" /></Grid>
            </>
          )}
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancelar</Button>
        <Button onClick={handleSave} variant="contained" color="primary" disabled={saving}>
          {saving ? <CircularProgress size={20} /> : "Salvar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── MODULE OVERRIDE DIALOG ──────────────────────────────────────────────────
function ModuleOverrideDialog({ open, onClose, company, onSaved }) {
  const [overrides, setOverrides] = useState({});
  const [overrideModes, setOverrideModes] = useState({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && company?.id) {
      setLoading(true);
      api.get(`/dape/modules/my-access?companyId=${company.id}`)
        .then(r => {
          const enabled = {};
          const modes = {};
          const modsList = r.data?.modules || [];
          MODULE_KEYS.forEach(k => {
            const mod = modsList.find(mod => mod.module_key === k.key);
            enabled[k.key] = mod ? mod.is_enabled : false;
            modes[k.key] = mod?.operation_mode || "assisted";
          });
          setOverrides(enabled);
          setOverrideModes(modes);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [open, company]);

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const [moduleKey, isEnabled] of Object.entries(overrides)) {
        const operationMode = overrideModes[moduleKey] || "assisted";
        await api.post("/dape/master/module-override", { companyId: company.id, moduleKey, isEnabled, operationMode });
      }
      toast.success("Módulos atualizados!");
      await onSaved();
      onClose();
    } catch (e) {
      toast.error("Erro ao salvar módulos");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Módulos — {company?.name}</DialogTitle>
      <DialogContent>
        {loading ? <CircularProgress size={24} /> : MODULE_KEYS.map(m => (
          <Box key={m.key} display="flex" alignItems="center" style={{ gap: 8, marginBottom: 8 }}>
            <FormControlLabel
              style={{ marginRight: 0, minWidth: 150 }}
              control={<Switch checked={!!overrides[m.key]} onChange={e => setOverrides(p => ({ ...p, [m.key]: e.target.checked }))} color="primary" />}
              label={m.label}
            />
            <TextField
              select size="small" variant="outlined"
              value={overrideModes[m.key] || "assisted"}
              onChange={e => setOverrideModes(p => ({ ...p, [m.key]: e.target.value }))}
              SelectProps={{ native: true }}
              style={{ minWidth: 140 }}
            >
              {OPERATION_MODE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </TextField>
          </Box>
        ))}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancelar</Button>
        <Button onClick={handleSave} variant="contained" color="primary" disabled={saving}>
          {saving ? <CircularProgress size={20} /> : "Salvar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── MASTER BILLING TAB ─────────────────────────────────────────────────────
function MasterBillingTab() {
  const classes = useStyles();
  const [loading, setLoading] = React.useState(true);
  const [overview, setOverview] = React.useState({ summary: {}, companies: [] });

  const loadOverview = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/dape/billing/master/overview");
      setOverview(res.data);
    } catch (err) {
      toast.error("Erro ao carregar painel financeiro");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { loadOverview(); }, [loadOverview]);

  const fmt = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString("pt-BR") : "—";

  const STATUS_COLOR = {
    active: "#22c55e", trialing: "#3b82f6", past_due: "#f59e0b",
    blocked: "#ef4444", canceled: "#6b7280", pending_first_payment: "#8b5cf6",
  };

  const s = overview.summary;

  if (loading) return <Box display="flex" justifyContent="center" p={4}><CircularProgress /></Box>;

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6" style={{ fontWeight: 700 }}>Painel Financeiro</Typography>
        <IconButton size="small" onClick={loadOverview}><RefreshIcon /></IconButton>
      </Box>

      {/* Cards de resumo */}
      <Grid container spacing={2} style={{ marginBottom: 24 }}>
        <Grid item xs={6} md={2}>
          <Card variant="outlined">
            <CardContent style={{ padding: "12px 16px" }}>
              <Typography variant="caption" color="textSecondary">Ativos</Typography>
              <Typography variant="h5" style={{ fontWeight: 700, color: "#22c55e" }}>{s.active_count || 0}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} md={2}>
          <Card variant="outlined">
            <CardContent style={{ padding: "12px 16px" }}>
              <Typography variant="caption" color="textSecondary">Trial</Typography>
              <Typography variant="h5" style={{ fontWeight: 700, color: "#3b82f6" }}>{s.trialing_count || 0}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} md={2}>
          <Card variant="outlined">
            <CardContent style={{ padding: "12px 16px" }}>
              <Typography variant="caption" color="textSecondary">Pendente</Typography>
              <Typography variant="h5" style={{ fontWeight: 700, color: "#f59e0b" }}>{s.past_due_count || 0}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} md={2}>
          <Card variant="outlined">
            <CardContent style={{ padding: "12px 16px" }}>
              <Typography variant="caption" color="textSecondary">Bloqueados</Typography>
              <Typography variant="h5" style={{ fontWeight: 700, color: "#ef4444" }}>{s.blocked_count || 0}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} md={2}>
          <Card variant="outlined">
            <CardContent style={{ padding: "12px 16px" }}>
              <Typography variant="caption" color="textSecondary">Cancelados</Typography>
              <Typography variant="h5" style={{ fontWeight: 700, color: "#6b7280" }}>{s.canceled_count || 0}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} md={2}>
          <Card variant="outlined" style={{ borderColor: "#1565c0" }}>
            <CardContent style={{ padding: "12px 16px" }}>
              <Typography variant="caption" color="textSecondary">MRR Estimado</Typography>
              <Typography variant="h6" style={{ fontWeight: 700, color: "#1565c0" }}>{fmt(s.mrr_estimated)}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabela de empresas */}
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Empresa</TableCell>
              <TableCell>Plano</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Extras</TableCell>
              <TableCell>Valor/mês</TableCell>
              <TableCell>Vencimento</TableCell>
              <TableCell>Último Pgto</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {overview.companies.map((c) => (
              <TableRow key={c.id} hover>
                <TableCell>
                  <Typography variant="body2" style={{ fontWeight: 600 }}>{c.name}</Typography>
                  <Typography variant="caption" color="textSecondary">{c.email}</Typography>
                </TableCell>
                <TableCell>{c.plan_name}</TableCell>
                <TableCell>
                  <Chip
                    label={c.billing_status || "sem assinatura"}
                    size="small"
                    style={{ background: STATUS_COLOR[c.billing_status] || "#e5e7eb", color: "#fff", fontWeight: 600 }}
                  />
                </TableCell>
                <TableCell>{c.extra_users_count || 0}</TableCell>
                <TableCell>{fmt(c.monthly_amount)}</TableCell>
                <TableCell>{fmtDate(c.next_due_date)}</TableCell>
                <TableCell>{fmtDate(c.last_payment_at)}</TableCell>
              </TableRow>
            ))}
            {overview.companies.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Typography variant="body2" color="textSecondary">Nenhuma empresa com assinatura registrada</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

// ─── MAIN PANEL ──────────────────────────────────────────────────────────────
export default function DapeMasterPanel() {
  const classes = useStyles();
  const [tab, setTab] = useState(0);
  const [plans, setPlans] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [planDialog, setPlanDialog] = useState({ open: false, plan: null });
  const [companyDialog, setCompanyDialog] = useState({ open: false, company: null });
  const [moduleDialog, setModuleDialog] = useState({ open: false, company: null });

  const loadPlans = useCallback(async () => {
    try {
      const r = await api.get("/dape/master/plans");
      setPlans(r.data || []);
    } catch (e) { toast.error("Erro ao carregar planos"); }
  }, []);

  const loadCompanies = useCallback(async () => {
    try {
      const r = await api.get("/dape/master/native/companies");
      setCompanies(r.data || []);
    } catch (e) { toast.error("Erro ao carregar empresas"); }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadPlans(), loadCompanies()]);
    setLoading(false);
  }, [loadPlans, loadCompanies]);

  useEffect(() => {
    loadAll();
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => { loadAll(); }, 30000);
    return () => clearInterval(interval);
  }, [loadAll]);

  const handleDeletePlan = async (plan) => {
    if (!window.confirm(`Excluir plano "${plan.name}"?`)) return;
    try {
      await api.delete(`/dape/master/plans/${plan.id}`);
      toast.success("Plano excluído!");
      loadPlans();
    } catch (e) {
      toast.error(e.response?.data?.error || "Erro ao excluir plano");
    }
  };

  const handleDeleteCompany = async (company) => {
    if (!window.confirm(`Excluir empresa "${company.name}"? Esta ação não pode ser desfeita.`)) return;
    try {
      await api.delete(`/dape/master/native/companies/${company.id}`);
      toast.success("Empresa excluída!");
      loadCompanies();
    } catch (e) {
      toast.error(e.response?.data?.error || "Erro ao excluir empresa");
    }
  };

  const handleApproveCompany = async (company) => {
    if (!window.confirm(`Aprovar acesso da empresa "${company.name}"?`)) return;
    try {
      await api.put(`/dape/master/native/companies/${company.id}/approve`);
      toast.success("Empresa aprovada! Agora pode acessar o sistema.");
      loadCompanies();
    } catch (e) {
      toast.error(e.response?.data?.error || "Erro ao aprovar empresa");
    }
  };

  const statusChip = (status) => {
    const isActive = status === true || status === "active";
    return <Chip label={isActive ? "Ativo" : "Inativo"} size="small"
      style={{ background: isActive ? "#e8f5e9" : "#fce4ec", color: isActive ? "#388e3c" : "#c62828" }} />;
  };

  return (
    <Box className={classes.root}>
      <Box className={classes.header}>
        <Typography variant="h5" style={{ fontWeight: 700 }}>
          ⚡ Central de Administração DAPLE
        </Typography>
        <IconButton onClick={loadAll} disabled={loading}>
          <RefreshIcon />
        </IconButton>
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} className={classes.tabs} indicatorColor="primary" textColor="primary">
        <Tab label="🏢 Empresas" />
        <Tab label="📋 Planos" />
        <Tab label="📊 Monitoramento" />
        <Tab label="💰 Financeiro" />
      </Tabs>

      {/* ─── TAB 0: EMPRESAS ─── */}
      {tab === 0 && (
        <Box>
          <Box display="flex" justifyContent="flex-end" mb={2}>
            <Button variant="contained" color="primary" startIcon={<AddIcon />}
              onClick={() => setCompanyDialog({ open: true, company: null })}>
              Nova Empresa
            </Button>
          </Box>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Empresa</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Plano</TableCell>
                  <TableCell>Valor</TableCell>
                  <TableCell>Vencimento</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Aprovação</TableCell>
                  <TableCell>Usuários</TableCell>
                  <TableCell>Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {companies.map(c => (
                  <TableRow key={c.id}>
                    <TableCell>{c.id}</TableCell>
                    <TableCell>
                      {c.name}
                      {c.is_master && <Chip label="MASTER" size="small" className={classes.masterBadge} style={{ marginLeft: 4 }} />}
                    </TableCell>
                    <TableCell>{c.email}</TableCell>
                    <TableCell>{c.plan_name || "—"}</TableCell>
                    <TableCell>{c.plan_price ? `R$ ${parseFloat(c.plan_price).toFixed(2)}` : "—"}</TableCell>
                    <TableCell>{c.dueDate && new Date(c.dueDate).getFullYear() > 1970 ? new Date(c.dueDate).toLocaleDateString("pt-BR") : "—"}</TableCell>
                    <TableCell>{statusChip(c.status)}</TableCell>
                    <TableCell>
                      {c.approved ? (
                        <Chip label="Aprovada" size="small" style={{ background: "#e8f5e9", color: "#388e3c", fontWeight: 600 }} />
                      ) : (
                        <Chip label="Pendente" size="small" style={{ background: "#fff3e0", color: "#e65100", fontWeight: 600 }} />
                      )}
                    </TableCell>
                    <TableCell>{c.user_count || 0}</TableCell>
                    <TableCell>
                      <Tooltip title="Editar empresa">
                        <IconButton size="small" onClick={() => setCompanyDialog({ open: true, company: c })}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Módulos personalizados">
                        <IconButton size="small" onClick={() => setModuleDialog({ open: true, company: c })}>
                          <SettingsIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {!c.is_master && !c.approved && (
                        <Tooltip title="Aprovar empresa">
                          <IconButton size="small" onClick={() => handleApproveCompany(c)} style={{ color: "#4CAF50" }}>
                            <ApproveIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {!c.is_master && (
                        <Tooltip title="Excluir empresa">
                          <IconButton size="small" onClick={() => handleDeleteCompany(c)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* ─── TAB 1: PLANOS ─── */}
      {tab === 1 && (
        <Box>
          <Box display="flex" justifyContent="flex-end" mb={2}>
            <Button variant="contained" color="primary" startIcon={<AddIcon />}
              onClick={() => setPlanDialog({ open: true, plan: null })}>
              Novo Plano
            </Button>
          </Box>
          <Grid container spacing={2}>
            {plans.map(p => (
              <Grid item xs={12} md={4} key={p.id}>
                <Card className={classes.card} variant="outlined">
                  <CardContent>
                    <Typography variant="h6" style={{ fontWeight: 700 }}>{p.name}</Typography>
                    {p.description && <Typography variant="body2" color="textSecondary">{p.description}</Typography>}
                    <Typography className={classes.priceTag} style={{ marginTop: 8 }}>
                      R$ {parseFloat(p.price || 0).toFixed(2)}<Typography variant="caption" color="textSecondary">/mês</Typography>
                    </Typography>
                    <Divider style={{ margin: "8px 0" }} />
                    <Typography variant="caption" display="block">
                      {p.max_users} usuários · {p.max_connections} conexões · {p.max_queues} filas
                    </Typography>
                    <Typography variant="caption" display="block" color="textSecondary">
                      {p.max_contacts?.toLocaleString()} contatos · {p.max_messages_per_month?.toLocaleString()} msg/mês
                    </Typography>
                    <Box className={classes.moduleGrid} style={{ marginTop: 8 }}>
                      {MODULE_KEYS.map(m => {
                        const mods = typeof p.modules === "string" ? JSON.parse(p.modules || "{}") : (p.modules || {});
                        const enabled = mods[m.key];
                        return (
                          <Chip key={m.key} label={m.label} size="small" className={classes.chip}
                            style={{ background: enabled ? "#e3f2fd" : "#f5f5f5", color: enabled ? "#1565c0" : "#9e9e9e" }} />
                        );
                      })}
                    </Box>
                  </CardContent>
                  <CardActions style={{ justifyContent: "flex-end" }}>
                    <IconButton size="small" onClick={() => setPlanDialog({ open: true, plan: p })}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => handleDeletePlan(p)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* ─── TAB 2: MONITORING ─── */}
      {tab === 2 && (
        <Box>
          <Typography variant="h6" gutterBottom>Resumo Geral</Typography>
          <Grid container spacing={2}>
            <Grid item xs={6} md={3}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" color="textSecondary">Total de Empresas</Typography>
                  <Typography variant="h4" style={{ fontWeight: 700 }}>{companies.length}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} md={3}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" color="textSecondary">Empresas Ativas</Typography>
                  <Typography variant="h4" style={{ fontWeight: 700, color: "#388e3c" }}>
                    {companies.filter(c => c.status === true || c.status === "active").length}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} md={3}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" color="textSecondary">Total de Planos</Typography>
                  <Typography variant="h4" style={{ fontWeight: 700 }}>{plans.length}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} md={3}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" color="textSecondary">Receita Estimada/mês</Typography>
                  <Typography variant="h4" style={{ fontWeight: 700, color: "#1565c0" }}>
                    R$ {companies.reduce((sum, c) => sum + parseFloat(c.plan_price || 0), 0).toFixed(0)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
          <Box mt={3}>
            <Typography variant="h6" gutterBottom>Empresas por Plano</Typography>
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead><TableRow><TableCell>Plano</TableCell><TableCell>Empresas</TableCell><TableCell>Receita/mês</TableCell></TableRow></TableHead>
                <TableBody>
                  {plans.map(p => {
                    const planCompanies = companies.filter(c => c.dape_plan_id == p.id);
                    return (
                      <TableRow key={p.id}>
                        <TableCell>{p.name}</TableCell>
                        <TableCell>{planCompanies.length}</TableCell>
                        <TableCell>R$ {(planCompanies.length * parseFloat(p.price || 0)).toFixed(2)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </Box>
      )}

      {/* ─── TAB 3: FINANCEIRO / BILLING ─── */}
      {tab === 3 && <MasterBillingTab />}

      {/* ─── DIALOGS ─── */}
      <PlanDialog
        open={planDialog.open}
        plan={planDialog.plan}
        onClose={() => setPlanDialog({ open: false, plan: null })}
        onSaved={loadPlans}
      />
      <CompanyDialog
        open={companyDialog.open}
        company={companyDialog.company}
        plans={plans}
        onClose={() => setCompanyDialog({ open: false, company: null })}
        onSaved={loadCompanies}
      />
      <ModuleOverrideDialog
        open={moduleDialog.open}
        company={moduleDialog.company}
        onClose={() => setModuleDialog({ open: false, company: null })}
        onSaved={loadAll}
      />
    </Box>
  );
}
