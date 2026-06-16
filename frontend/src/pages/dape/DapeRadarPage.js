import React, { useState, useEffect, useCallback } from "react";
import {
  Box, Typography, Paper, Button, Chip, TextField, Select, MenuItem,
  FormControl, InputLabel, Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableHead, TableRow, TableCell, TableBody, TablePagination,
  IconButton, Tooltip, CircularProgress, Snackbar, Grid, Card,
  CardContent, LinearProgress, Tabs, Tab, InputAdornment
} from "@material-ui/core";
import { Alert } from "@material-ui/lab";
import { makeStyles } from "@material-ui/core/styles";
import AddIcon from "@material-ui/icons/Add";
import SearchIcon from "@material-ui/icons/Search";
import RefreshIcon from "@material-ui/icons/Refresh";
import DeleteIcon from "@material-ui/icons/Delete";
import EditIcon from "@material-ui/icons/Edit";
import PhoneIcon from "@material-ui/icons/Phone";
import CheckCircleIcon from "@material-ui/icons/CheckCircle";
import CancelIcon from "@material-ui/icons/Cancel";
import TransformIcon from "@material-ui/icons/Transform";
import CloudUploadIcon from "@material-ui/icons/CloudUpload";
import api from "../../services/api";

const useStyles = makeStyles((theme) => ({
  root: { padding: theme.spacing(3) },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: theme.spacing(2) },
  filterBar: { display: "flex", gap: theme.spacing(2), flexWrap: "wrap", marginBottom: theme.spacing(2), alignItems: "center" },
  card: { height: "100%" },
  scoreBar: { height: 6, borderRadius: 3, marginTop: 4 },
  statusChip: { fontSize: "0.7rem" },
  actions: { display: "flex", gap: 4 },
  importArea: {
    border: "2px dashed #ccc", borderRadius: 8, padding: theme.spacing(3),
    textAlign: "center", cursor: "pointer", marginTop: theme.spacing(2),
    "&:hover": { borderColor: theme.palette.primary.main },
  },
}));

const STATUS_LABELS = { new: "Novo", contacted: "Contactado", discarded: "Descartado", converted: "Convertido" };
const STATUS_COLORS = { new: "default", contacted: "primary", discarded: "secondary", converted: "default" };
const STATUS_BG = { new: "#e3f2fd", contacted: "#fff3e0", discarded: "#fce4ec", converted: "#e8f5e9" };
const SOURCE_LABELS = { google_maps: "Google Maps", instagram: "Instagram", facebook: "Facebook", linkedin: "LinkedIn", manual: "Manual" };

function ScoreBar({ score }) {
  const color = score >= 70 ? "#4caf50" : score >= 40 ? "#ff9800" : "#f44336";
  return (
    <Box>
      <Typography variant="caption" style={{ fontWeight: "bold", color }}>{score}/100</Typography>
      <LinearProgress
        variant="determinate" value={score}
        style={{ height: 6, borderRadius: 3, backgroundColor: "#eee" }}
        classes={{ bar: "score-bar" }}
      />
    </Box>
  );
}

const EMPTY_FORM = {
  source: "manual", company_name: "", phone: "", instagram: "",
  city: "", segment: "", website: "", google_rating: "", followers: "", notes: ""
};

export default function DapeRadarPage() {
  const classes = useStyles();
  const [opportunities, setOpportunities] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [filters, setFilters] = useState({ source: "", status: "", segment: "", search: "" });
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [statusDialog, setStatusDialog] = useState({ open: false, id: null, status: "", notes: "" });
  const [snack, setSnack] = useState({ open: false, msg: "", severity: "success" });

  const showSnack = (msg, severity = "success") => setSnack({ open: true, msg, severity });

  const fetchSummary = useCallback(async () => {
    try {
      const { data } = await api.get("/dape/radar/summary");
      setSummary(data);
    } catch {}
  }, []);

  const fetchOpportunities = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", rowsPerPage);
      params.set("offset", page * rowsPerPage);
      if (filters.source) params.set("source", filters.source);
      if (filters.status) params.set("status", filters.status);
      if (filters.segment) params.set("segment", filters.segment);
      if (filters.search) params.set("search", filters.search);
      const { data } = await api.get(`/dape/radar?${params}`);
      setOpportunities(data.data || []);
      setTotal(data.total || 0);
    } catch {
      showSnack("Erro ao carregar oportunidades", "error");
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, filters]);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);
  useEffect(() => { fetchOpportunities(); }, [fetchOpportunities]);

  const handleSave = async () => {
    if (!form.company_name) return showSnack("Nome da empresa é obrigatório", "warning");
    try {
      const payload = {
        ...form,
        google_rating: form.google_rating ? parseFloat(form.google_rating) : null,
        followers: form.followers ? parseInt(form.followers) : null,
      };
      if (editId) {
        await api.put(`/dape/radar/${editId}`, payload);
        showSnack("Oportunidade atualizada");
      } else {
        await api.post("/dape/radar", payload);
        showSnack("Oportunidade criada");
      }
      setDialogOpen(false);
      setEditId(null);
      setForm(EMPTY_FORM);
      fetchOpportunities();
      fetchSummary();
    } catch {
      showSnack("Erro ao salvar oportunidade", "error");
    }
  };

  const handleEdit = (opp) => {
    setEditId(opp.id);
    setForm({
      source: opp.source || "manual",
      company_name: opp.company_name || "",
      phone: opp.phone || "",
      instagram: opp.instagram || "",
      city: opp.city || "",
      segment: opp.segment || "",
      website: opp.website || "",
      google_rating: opp.google_rating || "",
      followers: opp.followers || "",
      notes: opp.notes || "",
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Deseja excluir esta oportunidade?")) return;
    try {
      await api.delete(`/dape/radar/${id}`);
      showSnack("Excluído com sucesso");
      fetchOpportunities();
      fetchSummary();
    } catch {
      showSnack("Erro ao excluir", "error");
    }
  };

  const handleStatusUpdate = async () => {
    try {
      await api.patch(`/dape/radar/${statusDialog.id}/status`, {
        status: statusDialog.status,
        notes: statusDialog.notes,
      });
      showSnack("Status atualizado");
      setStatusDialog({ open: false, id: null, status: "", notes: "" });
      fetchOpportunities();
      fetchSummary();
    } catch {
      showSnack("Erro ao atualizar status", "error");
    }
  };

  const handleConvert = async (id) => {
    if (!window.confirm("Converter esta oportunidade em contato no CRM?")) return;
    try {
      const { data } = await api.post(`/dape/radar/${id}/convert`);
      showSnack(data.contactId ? `Convertido! Contato #${data.contactId} criado` : "Convertido (contato existente ou sem telefone)");
      fetchOpportunities();
      fetchSummary();
    } catch {
      showSnack("Erro ao converter", "error");
    }
  };

  const handleBulkImport = async () => {
    if (!importText.trim()) return;
    setImportLoading(true);
    try {
      let parsed;
      try { parsed = JSON.parse(importText); } catch {
        return showSnack("JSON inválido", "error");
      }
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      const { data } = await api.post("/dape/radar/bulk-import", { opportunities: arr });
      showSnack(`Importados: ${data.imported} | Ignorados: ${data.skipped}`);
      setImportOpen(false);
      setImportText("");
      fetchOpportunities();
      fetchSummary();
    } catch {
      showSnack("Erro na importação", "error");
    } finally {
      setImportLoading(false);
    }
  };

  const openStatusDialog = (opp, status) => {
    setStatusDialog({ open: true, id: opp.id, status, notes: opp.notes || "" });
  };

  return (
    <Box className={classes.root}>
      <Box className={classes.header}>
        <Typography variant="h5" style={{ fontWeight: "bold" }}>📡 DAPE Radar — Oportunidades</Typography>
        <Box style={{ display: "flex", gap: 8 }}>
          <Button startIcon={<CloudUploadIcon />} variant="outlined" onClick={() => setImportOpen(true)}>
            Importar JSON
          </Button>
          <Button startIcon={<AddIcon />} variant="contained" color="primary"
            onClick={() => { setEditId(null); setForm(EMPTY_FORM); setDialogOpen(true); }}>
            Nova Oportunidade
          </Button>
        </Box>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={2} style={{ marginBottom: 16 }}>
        {[
          { label: "Novos", value: summary.new_count || 0, color: "#1976d2", icon: "🆕" },
          { label: "Contactados", value: summary.contacted_count || 0, color: "#f57c00", icon: "📞" },
          { label: "Convertidos", value: summary.converted_count || 0, color: "#388e3c", icon: "✅" },
          { label: "Descartados", value: summary.discarded_count || 0, color: "#d32f2f", icon: "❌" },
          { label: "Score Médio", value: `${summary.avg_score || 0}`, color: "#7b1fa2", icon: "⭐" },
          { label: "Alto Score (≥70)", value: summary.high_score_count || 0, color: "#00796b", icon: "🔥" },
        ].map((s) => (
          <Grid item xs={6} sm={4} md={2} key={s.label}>
            <Card className={classes.card}>
              <CardContent style={{ padding: "12px 16px" }}>
                <Typography variant="caption" color="textSecondary">{s.icon} {s.label}</Typography>
                <Typography variant="h5" style={{ fontWeight: "bold", color: s.color }}>{s.value}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Filters */}
      <Paper style={{ padding: 12, marginBottom: 16 }}>
        <Box className={classes.filterBar}>
          <TextField
            size="small" placeholder="Buscar empresa, telefone, instagram..."
            value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            style={{ minWidth: 280 }}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
          />
          <FormControl size="small" style={{ minWidth: 130 }}>
            <InputLabel>Fonte</InputLabel>
            <Select value={filters.source} onChange={(e) => setFilters({ ...filters, source: e.target.value })}>
              <MenuItem value="">Todas</MenuItem>
              {Object.entries(SOURCE_LABELS).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" style={{ minWidth: 140 }}>
            <InputLabel>Status</InputLabel>
            <Select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
              <MenuItem value="">Todos</MenuItem>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField size="small" placeholder="Segmento" value={filters.segment}
            onChange={(e) => setFilters({ ...filters, segment: e.target.value })} style={{ minWidth: 140 }} />
          <IconButton size="small" onClick={() => { fetchOpportunities(); fetchSummary(); }}>
            <RefreshIcon />
          </IconButton>
        </Box>
      </Paper>

      {/* Table */}
      <Paper>
        {loading ? (
          <Box style={{ display: "flex", justifyContent: "center", padding: 40 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell><strong>Empresa</strong></TableCell>
                  <TableCell><strong>Fonte</strong></TableCell>
                  <TableCell><strong>Contato</strong></TableCell>
                  <TableCell><strong>Segmento</strong></TableCell>
                  <TableCell><strong>Cidade</strong></TableCell>
                  <TableCell><strong>Score</strong></TableCell>
                  <TableCell><strong>Status</strong></TableCell>
                  <TableCell><strong>Ações</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {opportunities.map((opp) => (
                  <TableRow key={opp.id} hover>
                    <TableCell>
                      <Typography variant="body2" style={{ fontWeight: 500 }}>{opp.company_name}</Typography>
                      {opp.website && (
                        <Typography variant="caption" color="textSecondary">
                          <a href={opp.website.startsWith("http") ? opp.website : `https://${opp.website}`}
                            target="_blank" rel="noopener noreferrer" style={{ color: "#1976d2" }}>
                            {opp.website.replace(/^https?:\/\//, "").slice(0, 30)}
                          </a>
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip label={SOURCE_LABELS[opp.source] || opp.source} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>
                      <Box>
                        {opp.phone && <Typography variant="caption" display="block">📞 {opp.phone}</Typography>}
                        {opp.instagram && <Typography variant="caption" display="block" color="textSecondary">📷 @{opp.instagram}</Typography>}
                        {opp.google_rating && <Typography variant="caption" display="block">⭐ {opp.google_rating}</Typography>}
                        {opp.followers && <Typography variant="caption" display="block">👥 {opp.followers.toLocaleString()}</Typography>}
                      </Box>
                    </TableCell>
                    <TableCell><Typography variant="caption">{opp.segment || "—"}</Typography></TableCell>
                    <TableCell><Typography variant="caption">{opp.city || "—"}</Typography></TableCell>
                    <TableCell style={{ minWidth: 80 }}>
                      <ScoreBar score={opp.opportunity_score || 0} />
                    </TableCell>
                    <TableCell>
                      <Box style={{ padding: "2px 8px", borderRadius: 12, background: STATUS_BG[opp.status], display: "inline-block" }}>
                        <Typography variant="caption" style={{ fontWeight: 600 }}>{STATUS_LABELS[opp.status]}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box className={classes.actions}>
                        <Tooltip title="Editar">
                          <IconButton size="small" onClick={() => handleEdit(opp)}><EditIcon fontSize="small" /></IconButton>
                        </Tooltip>
                        {opp.status === "new" && (
                          <Tooltip title="Marcar como Contactado">
                            <IconButton size="small" onClick={() => openStatusDialog(opp, "contacted")} style={{ color: "#f57c00" }}>
                              <PhoneIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {opp.status !== "converted" && opp.status !== "discarded" && (
                          <>
                            <Tooltip title="Converter em Contato CRM">
                              <IconButton size="small" onClick={() => handleConvert(opp.id)} style={{ color: "#388e3c" }}>
                                <TransformIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Descartar">
                              <IconButton size="small" onClick={() => openStatusDialog(opp, "discarded")} style={{ color: "#d32f2f" }}>
                                <CancelIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </>
                        )}
                        <Tooltip title="Excluir">
                          <IconButton size="small" onClick={() => handleDelete(opp.id)} style={{ color: "#999" }}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
                {opportunities.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} align="center" style={{ padding: 32, color: "#999" }}>
                      Nenhuma oportunidade encontrada. Adicione manualmente ou importe um arquivo JSON.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <TablePagination
              component="div" count={total} page={page} rowsPerPage={rowsPerPage}
              onPageChange={(_, p) => setPage(p)}
              onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value)); setPage(0); }}
              rowsPerPageOptions={[10, 25, 50, 100]}
              labelRowsPerPage="Por página:"
            />
          </>
        )}
      </Paper>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editId ? "Editar Oportunidade" : "Nova Oportunidade"}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} style={{ marginTop: 4 }}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Fonte *</InputLabel>
                <Select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
                  {Object.entries(SOURCE_LABELS).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Empresa *" value={form.company_name}
                onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Telefone" value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(11) 99999-9999" />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Instagram" value={form.instagram}
                onChange={(e) => setForm({ ...form, instagram: e.target.value })} placeholder="@empresa" />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Segmento" value={form.segment}
                onChange={(e) => setForm({ ...form, segment: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Cidade" value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth size="small" label="Website" value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://..." />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Nota Google (0-5)" value={form.google_rating}
                onChange={(e) => setForm({ ...form, google_rating: e.target.value })} type="number" inputProps={{ min: 0, max: 5, step: 0.1 }} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Seguidores" value={form.followers}
                onChange={(e) => setForm({ ...form, followers: e.target.value })} type="number" />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth size="small" label="Notas" value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })} multiline rows={2} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancelar</Button>
          <Button variant="contained" color="primary" onClick={handleSave}>Salvar</Button>
        </DialogActions>
      </Dialog>

      {/* Status Update Dialog */}
      <Dialog open={statusDialog.open} onClose={() => setStatusDialog({ ...statusDialog, open: false })} maxWidth="xs" fullWidth>
        <DialogTitle>
          {statusDialog.status === "contacted" ? "Marcar como Contactado" :
           statusDialog.status === "discarded" ? "Descartar Oportunidade" : "Atualizar Status"}
        </DialogTitle>
        <DialogContent>
          <TextField fullWidth size="small" label="Observação (opcional)" multiline rows={3}
            value={statusDialog.notes} onChange={(e) => setStatusDialog({ ...statusDialog, notes: e.target.value })}
            style={{ marginTop: 8 }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStatusDialog({ ...statusDialog, open: false })}>Cancelar</Button>
          <Button variant="contained" color={statusDialog.status === "discarded" ? "secondary" : "primary"}
            onClick={handleStatusUpdate}>Confirmar</Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Import Dialog */}
      <Dialog open={importOpen} onClose={() => setImportOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>📥 Importação em Massa (JSON)</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" gutterBottom>
            Cole um array JSON com as oportunidades. Campos aceitos: company_name, phone, instagram, city, segment,
            website, google_rating, followers, source, notes.
          </Typography>
          <Box style={{ marginTop: 8, marginBottom: 8, padding: 8, background: "#f5f5f5", borderRadius: 4 }}>
            <Typography variant="caption" style={{ fontFamily: "monospace" }}>
              {`[{"company_name":"Empresa X","phone":"11999999999","segment":"Restaurante","city":"São Paulo","source":"manual"}]`}
            </Typography>
          </Box>
          <TextField fullWidth multiline rows={10} value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder='[{"company_name": "...", "phone": "...", ...}]'
            variant="outlined" style={{ fontFamily: "monospace" }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportOpen(false)}>Cancelar</Button>
          <Button variant="contained" color="primary" onClick={handleBulkImport} disabled={importLoading}
            startIcon={importLoading ? <CircularProgress size={16} /> : <CloudUploadIcon />}>
            Importar
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack({ ...snack, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity={snack.severity} onClose={() => setSnack({ ...snack, open: false })}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  );
}
