import React, { useState, useEffect, useCallback } from "react";
import {
  Box, Typography, Grid, Paper, Button, Divider, Chip,
  CircularProgress, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Select, MenuItem, FormControl,
  InputLabel, Snackbar, IconButton, Tooltip, Table,
  TableBody, TableCell, TableHead, TableRow
} from "@material-ui/core";
import { Alert } from "@material-ui/lab";
import { makeStyles } from "@material-ui/core/styles";
import AddIcon from "@material-ui/icons/Add";
import RemoveIcon from "@material-ui/icons/Remove";
import CancelIcon from "@material-ui/icons/Cancel";
import CheckCircleIcon from "@material-ui/icons/CheckCircle";
import WarningIcon from "@material-ui/icons/Warning";
import BlockIcon from "@material-ui/icons/Block";
import RefreshIcon from "@material-ui/icons/Refresh";
import FileCopyIcon from "@material-ui/icons/FileCopy";
import api from "../../services/api";
import { useHistory } from "react-router-dom";

const useStyles = makeStyles((theme) => ({
  root: {
    padding: theme.spacing(3),
    maxWidth: 900,
    margin: "0 auto",
    [theme.breakpoints.down("sm")]: {
      padding: theme.spacing(1.5),
    },
  },
  statusCard: {
    padding: theme.spacing(3),
    borderRadius: 12,
    marginBottom: theme.spacing(3),
  },
  statusActive: {
    borderLeft: `6px solid ${theme.palette.success.main}`,
    background: theme.palette.type === "dark" ? "#1a2e1a" : "#f0fdf4",
  },
  statusGrace: {
    borderLeft: `6px solid ${theme.palette.warning.main}`,
    background: theme.palette.type === "dark" ? "#2e2a1a" : "#fffbeb",
  },
  statusBlocked: {
    borderLeft: `6px solid ${theme.palette.error.main}`,
    background: theme.palette.type === "dark" ? "#2e1a1a" : "#fef2f2",
  },
  planCard: {
    padding: theme.spacing(2.5),
    borderRadius: 12,
    marginBottom: theme.spacing(2),
  },
  priceTag: {
    fontSize: "2rem",
    fontWeight: 700,
    color: theme.palette.primary.main,
  },
  userCounter: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    padding: theme.spacing(2),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 8,
  },
  counterValue: {
    fontSize: "1.5rem",
    fontWeight: 700,
    minWidth: 40,
    textAlign: "center",
  },
  invoiceRow: {
    "&:hover": { background: theme.palette.action.hover },
  },
  pixBox: {
    background: theme.palette.type === "dark" ? "#1e1e2e" : "#f8f9fa",
    borderRadius: 8,
    padding: theme.spacing(2),
    textAlign: "center",
  },
  copyButton: {
    marginTop: theme.spacing(1),
    wordBreak: "break-all",
    fontSize: "0.75rem",
    textAlign: "left",
    padding: theme.spacing(1),
    background: theme.palette.type === "dark" ? "#2a2a3e" : "#e9ecef",
    borderRadius: 4,
    cursor: "pointer",
    userSelect: "all",
  },
  sectionTitle: {
    fontWeight: 700,
    marginBottom: theme.spacing(1.5),
    marginTop: theme.spacing(2),
  },
  blockedOverlay: {
    textAlign: "center",
    padding: theme.spacing(4),
  },
}));

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_LABELS = {
  trialing: { label: "Trial Ativo", color: "primary" },
  pending_first_payment: { label: "Aguardando Pagamento", color: "default" },
  active: { label: "Ativo", color: "primary" },
  past_due: { label: "Pagamento Pendente", color: "default" },
  blocked: { label: "Bloqueado", color: "secondary" },
  canceled: { label: "Cancelado", color: "default" },
  expired: { label: "Expirado", color: "default" },
  no_subscription: { label: "Sem Assinatura", color: "default" },
};

const ACCESS_ICONS = {
  allowed: <CheckCircleIcon style={{ color: "#22c55e" }} />,
  grace: <WarningIcon style={{ color: "#f59e0b" }} />,
  blocked: <BlockIcon style={{ color: "#ef4444" }} />,
};

function formatCurrency(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("pt-BR");
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function DapeBillingPage() {
  const classes = useStyles();
  const history = useHistory();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [plans, setPlans] = useState([]);

  // Estado do modal de assinatura
  const [subscribeOpen, setSubscribeOpen] = useState(false);
  const [subscribeForm, setSubscribeForm] = useState({ planId: "", billingType: "PIX", cpfCnpj: "", phone: "" });
  const [subscribing, setSubscribing] = useState(false);

  // Estado do modal de usuários extras
  const [extraUsersOpen, setExtraUsersOpen] = useState(false);
  const [newExtraCount, setNewExtraCount] = useState(0);
  const [savingExtra, setSavingExtra] = useState(false);

  // Estado do modal de cancelamento
  const [cancelOpen, setCancelOpen] = useState(false);
  const [canceling, setCanceling] = useState(false);

  // Feedback
  const [snack, setSnack] = useState({ open: false, message: "", severity: "success" });

  const showSnack = (message, severity = "success") => setSnack({ open: true, message, severity });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [statusRes, invoicesRes, plansRes] = await Promise.all([
        api.get("/dape/billing/status"),
        api.get("/dape/billing/invoices"),
        api.get("/dape/master/plans"),
      ]);
      setData(statusRes.data);
      setInvoices(invoicesRes.data || []);
      setPlans(plansRes.data || []);
      if (statusRes.data?.subscription) {
        setNewExtraCount(statusRes.data.subscription.extraUsersCount || 0);
      }
    } catch (err) {
      showSnack("Erro ao carregar dados de assinatura", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Ações ──────────────────────────────────────────────────────────────────

  const handleSubscribe = async () => {
    if (!subscribeForm.planId || !subscribeForm.billingType) {
      return showSnack("Selecione o plano e a forma de pagamento", "error");
    }
    setSubscribing(true);
    try {
      await api.post("/dape/billing/subscribe", {
        planId: subscribeForm.planId,
        billingType: subscribeForm.billingType,
        cpfCnpj: subscribeForm.cpfCnpj || undefined,
        phone: subscribeForm.phone || undefined,
      });
      showSnack("Assinatura criada com sucesso!");
      setSubscribeOpen(false);
      loadData();
    } catch (err) {
      showSnack(err.response?.data?.error || "Erro ao criar assinatura", "error");
    } finally {
      setSubscribing(false);
    }
  };

  const handleUpdateExtraUsers = async () => {
    setSavingExtra(true);
    try {
      const res = await api.put("/dape/billing/extra-users", { extraUsersCount: newExtraCount });
      showSnack(`Usuários extras atualizados! Novo valor mensal: ${formatCurrency(res.data.newMonthlyAmount)}`);
      setExtraUsersOpen(false);
      loadData();
    } catch (err) {
      showSnack(err.response?.data?.error || "Erro ao atualizar usuários extras", "error");
    } finally {
      setSavingExtra(false);
    }
  };

  const handleCancel = async () => {
    setCanceling(true);
    try {
      const res = await api.post("/dape/billing/cancel", { cancelAtPeriodEnd: true });
      showSnack(res.data.message);
      setCancelOpen(false);
      loadData();
    } catch (err) {
      showSnack(err.response?.data?.error || "Erro ao cancelar assinatura", "error");
    } finally {
      setCanceling(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => showSnack("Copiado para a área de transferência!"));
  };

  // ─── Renderização ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={300}>
        <CircularProgress />
      </Box>
    );
  }

  const sub = data?.subscription;
  const plan = data?.plan;
  const pendingInvoice = data?.pendingInvoice;
  const billingStatus = sub?.billingStatus || "no_subscription";
  const accessStatus = sub?.accessStatus || "allowed";
  const statusInfo = STATUS_LABELS[billingStatus] || STATUS_LABELS.no_subscription;

  const statusCardClass =
    accessStatus === "blocked" ? classes.statusBlocked :
    accessStatus === "grace" ? classes.statusGrace :
    classes.statusActive;

  return (
    <Box className={classes.root}>
      <Typography variant="h5" style={{ fontWeight: 700, marginBottom: 16 }}>
        💳 Minha Assinatura
      </Typography>

      {/* ─── Card de Status ─────────────────────────────────────────────── */}
      <Paper className={`${classes.statusCard} ${statusCardClass}`} elevation={0}>
        <Grid container alignItems="center" spacing={2}>
          <Grid item>
            {ACCESS_ICONS[accessStatus] || ACCESS_ICONS.allowed}
          </Grid>
          <Grid item xs>
            <Box display="flex" alignItems="center" gap={8} flexWrap="wrap">
              <Typography variant="h6" style={{ fontWeight: 700 }}>
                {plan?.name || "Sem plano ativo"}
              </Typography>
              <Chip
                label={statusInfo.label}
                color={statusInfo.color}
                size="small"
                style={{ marginLeft: 8 }}
              />
              {sub?.cancelAtPeriodEnd && (
                <Chip label="Cancelamento agendado" size="small" style={{ marginLeft: 4, background: "#f59e0b", color: "#fff" }} />
              )}
            </Box>
            {sub?.nextDueDate && (
              <Typography variant="body2" color="textSecondary" style={{ marginTop: 4 }}>
                Próximo vencimento: <strong>{formatDate(sub.nextDueDate)}</strong>
              </Typography>
            )}
            {accessStatus === "grace" && sub?.graceUntil && (
              <Typography variant="body2" style={{ color: "#f59e0b", marginTop: 4 }}>
                ⚠️ Acesso bloqueado em: <strong>{formatDate(sub.graceUntil)}</strong>
              </Typography>
            )}
          </Grid>
          <Grid item>
            <Tooltip title="Atualizar">
              <IconButton size="small" onClick={loadData}><RefreshIcon /></IconButton>
            </Tooltip>
          </Grid>
        </Grid>
      </Paper>

      {/* ─── Tela de Bloqueio ────────────────────────────────────────────── */}
      {accessStatus === "blocked" && pendingInvoice && (
        <Paper className={classes.planCard} elevation={1} style={{ marginBottom: 24 }}>
          <Box className={classes.blockedOverlay}>
            <BlockIcon style={{ fontSize: 48, color: "#ef4444", marginBottom: 8 }} />
            <Typography variant="h6" style={{ fontWeight: 700, color: "#ef4444" }}>
              Acesso Bloqueado por Inadimplência
            </Typography>
            <Typography variant="body2" color="textSecondary" style={{ marginTop: 8, marginBottom: 16 }}>
              Valor pendente: <strong>{formatCurrency(pendingInvoice.amount)}</strong> —
              Vencimento: <strong>{formatDate(pendingInvoice.due_date)}</strong>
            </Typography>

            {pendingInvoice.pix_copy_paste && (
              <Box className={classes.pixBox}>
                <Typography variant="subtitle2" style={{ fontWeight: 700, marginBottom: 8 }}>
                  Pague via Pix para reativar o acesso automaticamente
                </Typography>
                <Box className={classes.copyButton} onClick={() => copyToClipboard(pendingInvoice.pix_copy_paste)}>
                  <FileCopyIcon style={{ fontSize: 14, marginRight: 4 }} />
                  {pendingInvoice.pix_copy_paste}
                </Box>
                <Button
                  variant="contained"
                  color="primary"
                  size="small"
                  style={{ marginTop: 8 }}
                  onClick={() => copyToClipboard(pendingInvoice.pix_copy_paste)}
                >
                  Copiar código Pix
                </Button>
              </Box>
            )}

            {pendingInvoice.invoice_url && (
              <Button
                variant="outlined"
                color="primary"
                style={{ marginTop: 12 }}
                href={pendingInvoice.invoice_url}
                target="_blank"
              >
                Ver fatura completa
              </Button>
            )}
          </Box>
        </Paper>
      )}

      {/* ─── Resumo do Plano ─────────────────────────────────────────────── */}
      {data?.hasSubscription && plan && (
        <Paper className={classes.planCard} elevation={1}>
          <Typography className={classes.sectionTitle} variant="subtitle1">
            Detalhes do Plano
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="textSecondary">Plano</Typography>
              <Typography variant="body1" style={{ fontWeight: 600 }}>{plan.name}</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="textSecondary">Valor Mensal Total</Typography>
              <Typography className={classes.priceTag}>{formatCurrency(data.monthlyAmount)}</Typography>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Typography variant="body2" color="textSecondary">Usuários Base</Typography>
              <Typography variant="body1" style={{ fontWeight: 600 }}>{plan.maxUsers}</Typography>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Typography variant="body2" color="textSecondary">Usuários Extras</Typography>
              <Typography variant="body1" style={{ fontWeight: 600 }}>{sub.extraUsersCount || 0}</Typography>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Typography variant="body2" color="textSecondary">Total de Usuários</Typography>
              <Typography variant="body1" style={{ fontWeight: 600, color: "#22c55e" }}>
                {sub.totalUsersAllowed}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="textSecondary">Preço por Usuário Extra</Typography>
              <Typography variant="body1">{formatCurrency(plan.extraUserPrice)}/mês</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="textSecondary">Forma de Pagamento</Typography>
              <Typography variant="body1">{sub.billingType || "—"}</Typography>
            </Grid>
          </Grid>

          <Divider style={{ margin: "16px 0" }} />

          {/* ─── Controle de Usuários Extras ─────────────────────────────── */}
          <Typography className={classes.sectionTitle} variant="subtitle1">
            Contratar / Cancelar Usuários Extras
          </Typography>
          <Typography variant="body2" color="textSecondary" style={{ marginBottom: 12 }}>
            Cada usuário extra custa <strong>{formatCurrency(plan.extraUserPrice)}/mês</strong>.
            O novo valor é cobrado a partir do próximo ciclo de cobrança.
          </Typography>

          <Box className={classes.userCounter}>
            <IconButton
              size="small"
              onClick={() => setNewExtraCount(Math.max(0, newExtraCount - 1))}
              disabled={newExtraCount <= 0}
            >
              <RemoveIcon />
            </IconButton>
            <Typography className={classes.counterValue}>{newExtraCount}</Typography>
            <IconButton size="small" onClick={() => setNewExtraCount(newExtraCount + 1)}>
              <AddIcon />
            </IconButton>
            <Box ml={2}>
              <Typography variant="body2" color="textSecondary">usuários extras</Typography>
              <Typography variant="body2" style={{ fontWeight: 600 }}>
                Novo total: {(plan.maxUsers || 5) + newExtraCount} usuários
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Novo valor: {formatCurrency((parseFloat(plan.price) || 0) + newExtraCount * (parseFloat(plan.extraUserPrice) || 0))}/mês
              </Typography>
            </Box>
            <Box ml="auto">
              <Button
                variant="contained"
                color="primary"
                size="small"
                disabled={newExtraCount === (sub.extraUsersCount || 0) || savingExtra}
                onClick={handleUpdateExtraUsers}
              >
                {savingExtra ? <CircularProgress size={18} /> : "Confirmar"}
              </Button>
            </Box>
          </Box>

          <Divider style={{ margin: "16px 0" }} />

          {/* ─── Ações ────────────────────────────────────────────────────── */}
          <Box display="flex" gap={8} flexWrap="wrap">
            {!sub.cancelAtPeriodEnd && billingStatus !== "canceled" && (
              <Button
                variant="outlined"
                color="secondary"
                startIcon={<CancelIcon />}
                size="small"
                onClick={() => setCancelOpen(true)}
              >
                Cancelar Assinatura
              </Button>
            )}
            {sub.cancelAtPeriodEnd && (
              <Typography variant="body2" style={{ color: "#f59e0b", alignSelf: "center" }}>
                ⚠️ Assinatura será cancelada em {formatDate(sub.currentPeriodEnd)}
              </Typography>
            )}
          </Box>
        </Paper>
      )}

      {/* ─── Sem assinatura ──────────────────────────────────────────────── */}
      {!data?.hasSubscription && (
        <Paper className={classes.planCard} elevation={1} style={{ textAlign: "center", padding: 32 }}>
          <Typography variant="h6" style={{ fontWeight: 700, marginBottom: 8 }}>
            Nenhuma assinatura ativa
          </Typography>
          <Typography variant="body2" color="textSecondary" style={{ marginBottom: 16 }}>
            Assine um plano para continuar usando o DAPLE.
          </Typography>
          <Button
            variant="contained"
            color="primary"
            onClick={() => setSubscribeOpen(true)}
          >
            Assinar Agora
          </Button>
        </Paper>
      )}

      {/* ─── Histórico de Faturas ────────────────────────────────────────── */}
      {invoices.length > 0 && (
        <Paper className={classes.planCard} elevation={1}>
          <Typography className={classes.sectionTitle} variant="subtitle1">
            Histórico de Faturas
          </Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Vencimento</TableCell>
                <TableCell>Valor</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Pagamento</TableCell>
                <TableCell align="right">Ação</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {invoices.map((inv) => (
                <TableRow key={inv.id} className={classes.invoiceRow}>
                  <TableCell>{formatDate(inv.due_date)}</TableCell>
                  <TableCell>{formatCurrency(inv.amount)}</TableCell>
                  <TableCell>
                    <Chip
                      label={inv.status}
                      size="small"
                      color={inv.status === "received" || inv.status === "confirmed" ? "primary" : "default"}
                    />
                  </TableCell>
                  <TableCell>{inv.paid_at ? formatDate(inv.paid_at) : "—"}</TableCell>
                  <TableCell align="right">
                    {inv.invoice_url && (
                      <Button size="small" href={inv.invoice_url} target="_blank" variant="outlined">
                        Ver
                      </Button>
                    )}
                    {inv.pix_copy_paste && (
                      <Button size="small" onClick={() => copyToClipboard(inv.pix_copy_paste)} style={{ marginLeft: 4 }}>
                        Copiar Pix
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      {/* ─── Modal: Nova Assinatura ──────────────────────────────────────── */}
      <Dialog open={subscribeOpen} onClose={() => setSubscribeOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Assinar Plano</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} style={{ marginTop: 4 }}>
            <Grid item xs={12}>
              <FormControl fullWidth variant="outlined" size="small">
                <InputLabel>Plano</InputLabel>
                <Select
                  value={subscribeForm.planId}
                  onChange={e => setSubscribeForm(p => ({ ...p, planId: e.target.value }))}
                  label="Plano"
                >
                  {plans.filter(p => !p.is_master).map(p => (
                    <MenuItem key={p.id} value={p.id}>
                      {p.name} — {formatCurrency(p.price)}/mês ({p.max_users || 5} usuários)
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth variant="outlined" size="small">
                <InputLabel>Forma de Pagamento</InputLabel>
                <Select
                  value={subscribeForm.billingType}
                  onChange={e => setSubscribeForm(p => ({ ...p, billingType: e.target.value }))}
                  label="Forma de Pagamento"
                >
                  <MenuItem value="PIX">Pix (Recorrente Mensal)</MenuItem>
                  <MenuItem value="CREDIT_CARD">Cartão de Crédito</MenuItem>
                  <MenuItem value="BOLETO">Boleto</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth size="small" variant="outlined"
                label="CPF/CNPJ (opcional)"
                value={subscribeForm.cpfCnpj}
                onChange={e => setSubscribeForm(p => ({ ...p, cpfCnpj: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth size="small" variant="outlined"
                label="Telefone (opcional)"
                value={subscribeForm.phone}
                onChange={e => setSubscribeForm(p => ({ ...p, phone: e.target.value }))}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSubscribeOpen(false)}>Cancelar</Button>
          <Button onClick={handleSubscribe} variant="contained" color="primary" disabled={subscribing}>
            {subscribing ? <CircularProgress size={20} /> : "Assinar"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ─── Modal: Confirmar Cancelamento ──────────────────────────────── */}
      <Dialog open={cancelOpen} onClose={() => setCancelOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Cancelar Assinatura</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Ao cancelar, sua assinatura será encerrada ao fim do período atual pago
            ({formatDate(sub?.currentPeriodEnd)}). Você continuará com acesso até essa data.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelOpen(false)}>Voltar</Button>
          <Button onClick={handleCancel} variant="contained" color="secondary" disabled={canceling}>
            {canceling ? <CircularProgress size={20} /> : "Confirmar Cancelamento"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ─── Snackbar de feedback ────────────────────────────────────────── */}
      <Snackbar
        open={snack.open}
        autoHideDuration={5000}
        onClose={() => setSnack(p => ({ ...p, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={snack.severity} onClose={() => setSnack(p => ({ ...p, open: false }))}>
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
