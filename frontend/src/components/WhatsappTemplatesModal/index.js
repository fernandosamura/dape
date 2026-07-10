import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  Typography,
  CircularProgress,
  TextField,
  Tooltip,
} from "@material-ui/core";
import { Refresh } from "@material-ui/icons";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import {
  extractTemplateVariables,
  renderTemplateBody,
} from "../../utils/whatsappTemplateVariables";

const STATUS_COLORS = {
  APPROVED: { background: "#DCFCE7", color: "#166534" },
  PENDING: { background: "#FEF9C3", color: "#854D0E" },
  REJECTED: { background: "#FEE2E2", color: "#991B1B" },
  PAUSED: { background: "#E0E7FF", color: "#3730A3" },
  DISABLED: { background: "#F3F4F6", color: "#374151" },
};

const UseTemplateDialog = ({ open, onClose, template }) => {
  const [to, setTo] = useState("");
  const [values, setValues] = useState({});
  const [sending, setSending] = useState(false);

  const variables = template ? extractTemplateVariables(template.bodyText || "") : [];
  const preview = template ? renderTemplateBody(template.bodyText || "", values) : "";

  useEffect(() => {
    if (open) {
      setTo("");
      setValues({});
    }
  }, [open, template]);

  const handleSend = async () => {
    if (!to.trim()) {
      toast.warn("Informe o número de destino.");
      return;
    }
    setSending(true);
    try {
      await api.post(`/meta-cloud/templates/${template.id}/send`, {
        to,
        bodyParams: values,
      });
      toast.success("Modelo enviado com sucesso!");
      onClose();
    } catch (err) {
      toastError(err);
    } finally {
      setSending(false);
    }
  };

  if (!template) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Usar modelo: {template.name}</DialogTitle>
      <DialogContent dividers>
        <TextField
          label="Número de destino (com DDI/DDD)"
          placeholder="5511999999999"
          fullWidth
          margin="dense"
          variant="outlined"
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />

        {variables.map((v) => (
          <TextField
            key={v}
            label={`Variável {{${v}}}`}
            fullWidth
            margin="dense"
            variant="outlined"
            value={values[v] || ""}
            onChange={(e) => setValues((prev) => ({ ...prev, [v]: e.target.value }))}
          />
        ))}

        <Typography variant="caption" style={{ display: "block", marginTop: 12 }}>
          Prévia da mensagem:
        </Typography>
        <Typography
          variant="body2"
          style={{
            background: "#F9FAFB",
            border: "1px solid #E5E7EB",
            borderRadius: 8,
            padding: 12,
            marginTop: 4,
            whiteSpace: "pre-wrap",
          }}
        >
          {preview}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={sending}>
          Cancelar
        </Button>
        <Button onClick={handleSend} color="primary" variant="contained" disabled={sending}>
          {sending ? "Enviando..." : "Enviar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const WhatsappTemplatesModal = ({ open, onClose, whatsapp }) => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [useTemplate, setUseTemplate] = useState(null);

  const fetchTemplates = async () => {
    if (!whatsapp) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/meta-cloud/templates/${whatsapp.id}`);
      setTemplates(data);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    if (!whatsapp) return;
    setSyncing(true);
    try {
      const { data } = await api.post(`/meta-cloud/templates/${whatsapp.id}/sync`);
      setTemplates(data);
      toast.success("Modelos atualizados com sucesso!");
    } catch (err) {
      toastError(err);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    if (open) fetchTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, whatsapp]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Modelos de mensagem — {whatsapp?.name}
      </DialogTitle>
      <DialogContent dividers>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <Typography variant="body2" color="textSecondary">
            Modelos sincronizados a partir do WhatsApp Manager (Meta).
          </Typography>
          <Button
            size="small"
            variant="outlined"
            color="primary"
            startIcon={<Refresh />}
            onClick={handleSync}
            disabled={syncing}
          >
            {syncing ? "Atualizando..." : "Atualizar modelos"}
          </Button>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 24 }}>
            <CircularProgress size={24} />
          </div>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Nome</TableCell>
                <TableCell>Categoria</TableCell>
                <TableCell>Idioma</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Conteúdo</TableCell>
                <TableCell>Última sincronização</TableCell>
                <TableCell align="center">Ação</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {templates.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    Nenhum modelo sincronizado ainda. Clique em "Atualizar modelos".
                  </TableCell>
                </TableRow>
              )}
              {templates.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{t.name}</TableCell>
                  <TableCell>{t.category}</TableCell>
                  <TableCell>{t.language}</TableCell>
                  <TableCell>
                    <Chip
                      label={t.status}
                      size="small"
                      style={STATUS_COLORS[t.status] || {}}
                    />
                  </TableCell>
                  <TableCell>
                    <Tooltip title={t.bodyText || ""}>
                      <span>
                        {(t.bodyText || "").slice(0, 40)}
                        {(t.bodyText || "").length > 40 ? "..." : ""}
                      </span>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    {t.updatedAt ? new Date(t.updatedAt).toLocaleString("pt-BR") : "-"}
                  </TableCell>
                  <TableCell align="center">
                    <Button
                      size="small"
                      color="primary"
                      disabled={t.status !== "APPROVED"}
                      onClick={() => setUseTemplate(t)}
                    >
                      Usar modelo
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Fechar</Button>
      </DialogActions>

      <UseTemplateDialog
        open={!!useTemplate}
        onClose={() => setUseTemplate(null)}
        template={useTemplate}
      />
    </Dialog>
  );
};

export default WhatsappTemplatesModal;
