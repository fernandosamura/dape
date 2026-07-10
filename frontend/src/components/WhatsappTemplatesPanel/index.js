import React, { useContext, useEffect, useState } from "react";
import { toast } from "react-toastify";

import {
  Box,
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
} from "@material-ui/core";
import { Refresh } from "@material-ui/icons";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import {
  extractTemplateVariables,
  renderTemplateBody,
  getTemplateHeader,
  getTemplateFooter,
  getTemplateButtons,
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
  const [headerMediaUrl, setHeaderMediaUrl] = useState("");
  const [sending, setSending] = useState(false);

  const variables = template ? extractTemplateVariables(template.bodyText || "") : [];
  const preview = template ? renderTemplateBody(template.bodyText || "", values) : "";
  const header = template ? getTemplateHeader(template.components) : null;
  const footer = template ? getTemplateFooter(template.components) : null;
  const previewButtons = template ? getTemplateButtons(template.components) : [];
  const needsHeaderMedia = header && header.format !== "TEXT";

  useEffect(() => {
    if (open) {
      setTo("");
      setValues({});
      setHeaderMediaUrl("");
    }
  }, [open, template]);

  const handleSend = async () => {
    if (!to.trim()) {
      toast.warn("Informe o número de destino.");
      return;
    }
    if (needsHeaderMedia && !headerMediaUrl.trim()) {
      toast.warn("Informe a URL da mídia do cabeçalho.");
      return;
    }
    setSending(true);
    try {
      await api.post(`/meta-cloud/templates/${template.id}/send`, {
        to,
        bodyParams: values,
        headerMediaUrl: headerMediaUrl || undefined,
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

        {needsHeaderMedia && (
          <TextField
            label={`URL da ${header.format === "IMAGE" ? "imagem" : header.format === "VIDEO" ? "vídeo" : "documento"} do cabeçalho`}
            placeholder="https://..."
            fullWidth
            margin="dense"
            variant="outlined"
            value={headerMediaUrl}
            onChange={(e) => setHeaderMediaUrl(e.target.value)}
          />
        )}

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
          Prévia da mensagem (o que o contato vai receber):
        </Typography>
        <Box
          style={{
            background: "#F9FAFB",
            border: "1px solid #E5E7EB",
            borderRadius: 8,
            padding: 12,
            marginTop: 4,
          }}
        >
          {header?.format === "TEXT" && header.text && (
            <Typography variant="body2" style={{ fontWeight: "bold", marginBottom: 6 }}>
              {header.text}
            </Typography>
          )}
          {needsHeaderMedia && (
            <Typography variant="body2" style={{ fontWeight: "bold", marginBottom: 6 }}>
              📎 {header.format} do cabeçalho
            </Typography>
          )}
          <Typography variant="body2" style={{ whiteSpace: "pre-wrap" }}>
            {preview}
          </Typography>
          {footer && (
            <Typography variant="caption" style={{ display: "block", color: "#9CA3AF", marginTop: 6 }}>
              {footer}
            </Typography>
          )}
          {previewButtons.map((b, i) => (
            <Chip
              key={i}
              size="small"
              label={b.url ? `${b.text}: ${b.url}` : b.text}
              style={{ marginTop: 6, marginRight: 6, background: "#E5F9EF", color: "#128C69" }}
            />
          ))}
        </Box>
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

// Gestao de modelos de mensagem da Meta (WABA) - vive em Configuracoes de
// Campanhas porque templates sao usados principalmente pra disparo de
// campanhas via Cloud API (mensagem de negocio fora da janela de 24h exige
// template aprovado). Nao fica em Conexoes pra nao poluir a tela de gestao
// de sessoes/canais.
const WhatsappTemplatesPanel = () => {
  const { user } = useContext(AuthContext);
  const { companyId } = user;

  const [whatsapps, setWhatsapps] = useState([]);
  const [whatsappId, setWhatsappId] = useState("");
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [useTemplate, setUseTemplate] = useState(null);

  useEffect(() => {
    api
      .get("/whatsapp", { params: { companyId, session: 0 } })
      .then(({ data }) => {
        const cloudApiWhatsapps = (Array.isArray(data) ? data : []).filter(
          (w) => w.providerType === "meta_cloud"
        );
        setWhatsapps(cloudApiWhatsapps);
        if (cloudApiWhatsapps.length > 0) setWhatsappId(cloudApiWhatsapps[0].id);
      })
      .catch((err) => toastError(err));
  }, [companyId]);

  const fetchTemplates = async () => {
    if (!whatsappId) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/meta-cloud/templates/${whatsappId}`);
      setTemplates(data);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    if (!whatsappId) return;
    setSyncing(true);
    try {
      const { data } = await api.post(`/meta-cloud/templates/${whatsappId}/sync`);
      setTemplates(data);
      toast.success("Modelos atualizados com sucesso!");
    } catch (err) {
      toastError(err);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    if (whatsappId) fetchTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [whatsappId]);

  if (whatsapps.length === 0) return null;

  return (
    <Grid xs={12} item style={{ marginTop: 24 }}>
      <Typography component={"h3"}>Modelos de mensagem (WhatsApp Oficial)</Typography>

      <Grid container spacing={2} style={{ marginTop: 4, marginBottom: 8 }}>
        <Grid xs={12} md={4} item>
          <FormControl variant="outlined" fullWidth>
            <InputLabel id="templates-whatsapp-label">Conexão</InputLabel>
            <Select
              labelId="templates-whatsapp-label"
              label="Conexão"
              value={whatsappId}
              onChange={(e) => setWhatsappId(e.target.value)}
            >
              {whatsapps.map((w) => (
                <MenuItem key={w.id} value={w.id}>
                  {w.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid xs={12} md={8} item style={{ display: "flex", alignItems: "center" }}>
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
        </Grid>
      </Grid>

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
            {templates.map((t) => {
              const tHeader = getTemplateHeader(t.components);
              const tFooter = getTemplateFooter(t.components);
              const tButtons = getTemplateButtons(t.components);
              const fullText = [
                tHeader?.format === "TEXT" ? tHeader.text : tHeader ? `[cabeçalho ${tHeader.format}]` : null,
                t.bodyText,
                tFooter,
                ...tButtons.map((b) => `[botão: ${b.text}]`),
              ].filter(Boolean).join("\n\n");
              return (
              <TableRow key={t.id}>
                <TableCell>{t.name}</TableCell>
                <TableCell>{t.category}</TableCell>
                <TableCell>{t.language}</TableCell>
                <TableCell>
                  <Chip label={t.status} size="small" style={STATUS_COLORS[t.status] || {}} />
                </TableCell>
                <TableCell>
                  <Tooltip title={<span style={{ whiteSpace: "pre-wrap" }}>{fullText}</span>}>
                    <span>
                      {(t.bodyText || "").slice(0, 40)}
                      {(t.bodyText || "").length > 40 ? "..." : ""}
                      {(tHeader || tFooter || tButtons.length > 0) && " 📎"}
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
              );
            })}
          </TableBody>
        </Table>
      )}

      <UseTemplateDialog
        open={!!useTemplate}
        onClose={() => setUseTemplate(null)}
        template={useTemplate}
      />
    </Grid>
  );
};

export default WhatsappTemplatesPanel;
