import React, { useState, useEffect } from "react";
import * as Yup from "yup";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";

import {
  Dialog,
  DialogContent,
  DialogTitle,
  Button,
  DialogActions,
  CircularProgress,
  TextField,
  Switch,
  FormControlLabel,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  Divider,
  Chip,
} from "@material-ui/core";
import { Facebook, Instagram, WhatsApp } from "@material-ui/icons";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";
import QueueSelect from "../QueueSelect";

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    flexWrap: "wrap",
  },
  multFieldLine: {
    display: "flex",
    "& > *:not(:last-child)": {
      marginRight: theme.spacing(1),
    },
  },
  btnWrapper: {
    position: "relative",
  },
  buttonProgress: {
    color: green[500],
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: -12,
    marginLeft: -12,
  },
  channelSelector: {
    display: "flex",
    gap: theme.spacing(1),
    marginBottom: theme.spacing(2),
    flexWrap: "wrap",
  },
  channelBtn: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 18px",
    borderRadius: 8,
    border: "2px solid #e0e0e0",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 14,
    transition: "all 0.2s",
    background: "#fafafa",
    "&:hover": {
      borderColor: "#bbb",
    },
  },
  channelBtnWhatsApp: {
    "&.selected": {
      borderColor: "#25D366",
      background: "#e8f5e9",
      color: "#25D366",
    },
  },
  channelBtnFacebook: {
    "&.selected": {
      borderColor: "#1877F2",
      background: "#e3f0ff",
      color: "#1877F2",
    },
  },
  channelBtnInstagram: {
    "&.selected": {
      borderColor: "#E1306C",
      background: "#fce4ec",
      color: "#E1306C",
    },
  },
  metaSection: {
    background: "#f8f9fa",
    border: "1px solid #e0e0e0",
    borderRadius: 8,
    padding: theme.spacing(2),
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1),
  },
  metaTitle: {
    fontWeight: 700,
    fontSize: 13,
    color: "#555",
    marginBottom: theme.spacing(1),
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  helpText: {
    fontSize: 12,
    color: "#888",
    marginTop: 4,
  },
}));

const SessionSchema = Yup.object().shape({
  name: Yup.string()
    .min(2, i18n.t("whatsappModal.formErrors.name.short"))
    .max(50, i18n.t("whatsappModal.formErrors.name.long"))
    .required(i18n.t("whatsappModal.formErrors.name.required")),
});

const WhatsAppModal = ({ open, onClose, whatsAppId, planChannels }) => {
  const allowFacebook = !planChannels || planChannels.useFacebook !== false;
  const allowInstagram = !planChannels || planChannels.useInstagram !== false;
  const classes = useStyles();
  const initialState = {
    name: "",
    greetingMessage: "",
    complationMessage: "",
    outOfHoursMessage: "",
    ratingMessage: "",
    isDefault: false,
    token: "",
    provider: "beta",
    expiresInactiveMessage: "",
    expiresTicket: 0,
    timeUseBotQueues: 0,
    maxUseBotQueues: 3,
    integration: null,
    channel: "whatsapp",
    facebookPageUserId: "",
    facebookToken: "",
    facebookUserToken: "",
  };

  const [whatsApp, setWhatsApp] = useState(initialState);
  const [selectedQueueIds, setSelectedQueueIds] = useState([]);
  const [queues, setQueues] = useState([]);
  const [selectedQueueId, setSelectedQueueId] = useState(null);
  const [selectedPrompt, setSelectedPrompt] = useState(null);
  const [prompts, setPrompts] = useState([]);
  const [integrations, setIntegrations] = useState([]);
  const [selectedIntegration, setSelectedIntegration] = useState(null);
  const [selectedChannel, setSelectedChannel] = useState("whatsapp");

  useEffect(() => {
    const fetchSession = async () => {
      if (!whatsAppId) return;
      try {
        const { data } = await api.get(`whatsapp/${whatsAppId}?session=0`);
        setWhatsApp(data);
        setSelectedChannel(data.channel || "whatsapp");
        setSelectedPrompt(data.promptId);
        setSelectedIntegration(data.integrationId);
        const whatsQueueIds = data.queues?.map((queue) => queue.id);
        setSelectedQueueIds(whatsQueueIds);
        setSelectedQueueId(data.transferQueueId);
      } catch (err) {
        toastError(err);
      }
    };
    fetchSession();
  }, [whatsAppId]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/prompt");
        setPrompts(data.prompts);
        const { data: dataIntegration } = await api.get("/queueIntegration");
        setIntegrations(dataIntegration.queueIntegrations);
      } catch (err) {
        toastError(err);
      }
    })();
  }, [whatsAppId]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/queue");
        setQueues(data);
      } catch (err) {
        toastError(err);
      }
    })();
  }, []);

  const handleSaveWhatsApp = async (values) => {
    const whatsappData = {
      ...values,
      channel: selectedChannel,
      queueIds: selectedQueueIds,
      transferQueueId: selectedQueueId,
      promptId: selectedPrompt ? selectedPrompt : null,
      integrationId: selectedIntegration,
    };
    delete whatsappData["queues"];
    delete whatsappData["session"];

    try {
      if (whatsAppId) {
        await api.put(`/whatsapp/${whatsAppId}`, whatsappData);
      } else {
        await api.post("/whatsapp", whatsappData);
      }
      toast.success(i18n.t("whatsappModal.success"));
      handleClose();
    } catch (err) {
      toastError(err);
    }
  };

  const handleChangeQueue = (e) => {
    setSelectedQueueIds(e);
    setSelectedPrompt(null);
  };

  const handleChangePrompt = (e) => {
    setSelectedPrompt(e.target.value);
    setSelectedQueueIds([]);
  };

  const handleChangeIntegration = (e) => {
    setSelectedIntegration(e.target.value);
  };

  const handleClose = () => {
    onClose();
    setWhatsApp(initialState);
    setSelectedQueueId(null);
    setSelectedQueueIds([]);
    setSelectedChannel("whatsapp");
  };

  const isMeta = selectedChannel === "facebook" || selectedChannel === "instagram";

  return (
    <div className={classes.root}>
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="md"
        fullWidth
        scroll="paper"
      >
        <DialogTitle>
          {whatsAppId
            ? i18n.t("whatsappModal.title.edit")
            : i18n.t("whatsappModal.title.add")}
        </DialogTitle>
        <Formik
          initialValues={whatsApp}
          enableReinitialize={true}
          validationSchema={SessionSchema}
          onSubmit={(values, actions) => {
            setTimeout(() => {
              handleSaveWhatsApp(values);
              actions.setSubmitting(false);
            }, 400);
          }}
        >
          {({ values, touched, errors, isSubmitting }) => (
            <Form>
              <DialogContent dividers>
                {/* Channel Selector */}
                <Typography variant="caption" style={{ color: "#666", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>
                  Canal de Atendimento
                </Typography>
                <Box className={classes.channelSelector} mt={1}>
                  <Box
                    className={`${classes.channelBtn} ${classes.channelBtnWhatsApp} ${selectedChannel === "whatsapp" ? "selected" : ""}`}
                    onClick={() => setSelectedChannel("whatsapp")}
                  >
                    <WhatsApp style={{ fontSize: 20, color: "#25D366" }} />
                    WhatsApp
                  </Box>
                  {allowFacebook && (
                  <Box
                    className={`${classes.channelBtn} ${classes.channelBtnFacebook} ${selectedChannel === "facebook" ? "selected" : ""}`}
                    onClick={() => setSelectedChannel("facebook")}
                  >
                    <Facebook style={{ fontSize: 20, color: "#1877F2" }} />
                    Facebook
                  </Box>
                  )}
                  {allowInstagram && (
                  <Box
                    className={`${classes.channelBtn} ${classes.channelBtnInstagram} ${selectedChannel === "instagram" ? "selected" : ""}`}
                    onClick={() => setSelectedChannel("instagram")}
                  >
                    <Instagram style={{ fontSize: 20, color: "#E1306C" }} />
                    Instagram
                  </Box>
                  )}
                </Box>

                <Divider style={{ marginBottom: 16 }} />

                <div className={classes.multFieldLine}>
                  <Grid spacing={2} container>
                    <Grid item>
                      <Field
                        as={TextField}
                        label={i18n.t("whatsappModal.form.name")}
                        autoFocus
                        name="name"
                        error={touched.name && Boolean(errors.name)}
                        helperText={touched.name && errors.name}
                        variant="outlined"
                        margin="dense"
                        className={classes.textField}
                      />
                    </Grid>
                    <Grid style={{ paddingTop: 15 }} item>
                      <FormControlLabel
                        control={
                          <Field
                            as={Switch}
                            color="primary"
                            name="isDefault"
                            checked={values.isDefault}
                          />
                        }
                        label={i18n.t("whatsappModal.form.default")}
                      />
                    </Grid>
                  </Grid>
                </div>

                {/* Facebook / Instagram specific fields */}
                {isMeta && (
                  <Box className={classes.metaSection}>
                    <Typography className={classes.metaTitle}>
                      {selectedChannel === "facebook" ? (
                        <><Facebook style={{ color: "#1877F2", fontSize: 18 }} /> Configuração do Facebook</>
                      ) : (
                        <><Instagram style={{ color: "#E1306C", fontSize: 18 }} /> Configuração do Instagram</>
                      )}
                    </Typography>

                    <Field
                      as={TextField}
                      label={selectedChannel === "facebook" ? "ID da Página do Facebook" : "ID da Conta do Instagram"}
                      name="facebookPageUserId"
                      fullWidth
                      variant="outlined"
                      margin="dense"
                      placeholder={selectedChannel === "facebook" ? "Ex: 123456789012345" : "Ex: 17841400000000000"}
                    />
                    <Typography className={classes.helpText}>
                      {selectedChannel === "facebook"
                        ? "O ID numérico da sua Página do Facebook (encontre em Configurações da Página → Sobre)"
                        : "O ID da conta profissional do Instagram (encontre via Meta Business Suite ou Graph API)"}
                    </Typography>

                    <Field
                      as={TextField}
                      label="Token de Acesso da Página (Page Access Token)"
                      name="facebookToken"
                      fullWidth
                      variant="outlined"
                      margin="dense"
                      multiline
                      rows={3}
                      placeholder="EAABsbCS... (token de longa duração)"
                    />
                    <Typography className={classes.helpText}>
                      Token de acesso permanente gerado via Meta Business Suite → Configurações → Avançado → Tokens de Acesso à Página
                    </Typography>

                    <Box mt={1} p={1} style={{ background: "#fff3e0", borderRadius: 6, border: "1px solid #ffe0b2" }}>
                      <Typography style={{ fontSize: 12, color: "#e65100" }}>
                        <b>Pré-requisitos:</b> Você precisa de um App Meta aprovado com as permissões{" "}
                        {selectedChannel === "facebook"
                          ? "pages_messaging e pages_manage_metadata"
                          : "instagram_basic e instagram_manage_messages"}
                        . Configure o webhook em: <b>https://daple.pubplus.com.br/api/webhook</b> com o token de verificação: <b>dape_webhook_2024</b>
                      </Typography>
                    </Box>
                  </Box>
                )}

                {/* WhatsApp-only fields */}
                {!isMeta && (
                  <>
                    <div>
                      <Field
                        as={TextField}
                        label={i18n.t("queueModal.form.token")}
                        type="token"
                        fullWidth
                        name="token"
                        variant="outlined"
                        margin="dense"
                      />
                    </div>
                  </>
                )}

                <div>
                  <Field
                    as={TextField}
                    label={i18n.t("queueModal.form.greetingMessage")}
                    type="greetingMessage"
                    multiline
                    rows={4}
                    fullWidth
                    name="greetingMessage"
                    error={touched.greetingMessage && Boolean(errors.greetingMessage)}
                    helperText={touched.greetingMessage && errors.greetingMessage}
                    variant="outlined"
                    margin="dense"
                  />
                </div>
                <div>
                  <Field
                    as={TextField}
                    label={i18n.t("queueModal.form.complationMessage")}
                    type="complationMessage"
                    multiline
                    rows={4}
                    fullWidth
                    name="complationMessage"
                    error={touched.complationMessage && Boolean(errors.complationMessage)}
                    helperText={touched.complationMessage && errors.complationMessage}
                    variant="outlined"
                    margin="dense"
                  />
                </div>
                <div>
                  <Field
                    as={TextField}
                    label={i18n.t("queueModal.form.outOfHoursMessage")}
                    type="outOfHoursMessage"
                    multiline
                    rows={4}
                    fullWidth
                    name="outOfHoursMessage"
                    error={touched.outOfHoursMessage && Boolean(errors.outOfHoursMessage)}
                    helperText={touched.outOfHoursMessage && errors.outOfHoursMessage}
                    variant="outlined"
                    margin="dense"
                  />
                </div>
                <div>
                  <Field
                    as={TextField}
                    label={i18n.t("queueModal.form.ratingMessage")}
                    type="ratingMessage"
                    multiline
                    rows={4}
                    fullWidth
                    name="ratingMessage"
                    error={touched.ratingMessage && Boolean(errors.ratingMessage)}
                    helperText={touched.ratingMessage && errors.ratingMessage}
                    variant="outlined"
                    margin="dense"
                  />
                </div>

                <QueueSelect
                  selectedQueueIds={selectedQueueIds}
                  onChange={(selectedIds) => handleChangeQueue(selectedIds)}
                />
                <FormControl margin="dense" variant="outlined" fullWidth>
                  <InputLabel>{i18n.t("whatsappModal.form.prompt")}</InputLabel>
                  <Select
                    labelId="dialog-select-prompt-label"
                    id="dialog-select-prompt"
                    name="promptId"
                    value={selectedPrompt || ""}
                    onChange={handleChangePrompt}
                    label={i18n.t("whatsappModal.form.prompt")}
                    fullWidth
                    MenuProps={{
                      anchorOrigin: { vertical: "bottom", horizontal: "left" },
                      transformOrigin: { vertical: "top", horizontal: "left" },
                      getContentAnchorEl: null,
                    }}
                  >
                    {prompts.map((prompt) => (
                      <MenuItem key={prompt.id} value={prompt.id}>
                        {prompt.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl margin="dense" variant="outlined" fullWidth>
                  <InputLabel>{i18n.t("whatsappModal.form.integration")}</InputLabel>
                  <Select
                    labelId="dialog-select-integration-label"
                    id="dialog-select-integration"
                    name="promptId"
                    value={selectedIntegration || ""}
                    onChange={handleChangeIntegration}
                    label={i18n.t("whatsappModal.form.integration")}
                    fullWidth
                    MenuProps={{
                      anchorOrigin: { vertical: "bottom", horizontal: "left" },
                      transformOrigin: { vertical: "top", horizontal: "left" },
                      getContentAnchorEl: null,
                    }}
                  >
                    {integrations.map((integration) => (
                      <MenuItem key={integration.id} value={integration.id}>
                        {integration.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <div>
                  <h3>{i18n.t("whatsappModal.form.queueRedirection")}</h3>
                  <p>{i18n.t("whatsappModal.form.queueRedirectionDesc")}</p>
                  <Grid container spacing={2}>
                    <Grid item sm={6}>
                      <Field
                        fullWidth
                        type="number"
                        as={TextField}
                        label={i18n.t("whatsappModal.form.timeToTransfer")}
                        name="timeToTransfer"
                        error={touched.timeToTransfer && Boolean(errors.timeToTransfer)}
                        helperText={touched.timeToTransfer && errors.timeToTransfer}
                        variant="outlined"
                        margin="dense"
                        className={classes.textField}
                        InputLabelProps={{ shrink: values.timeToTransfer ? true : false }}
                      />
                    </Grid>
                    <Grid item sm={6}>
                      <QueueSelect
                        selectedQueueIds={selectedQueueId}
                        onChange={(selectedId) => setSelectedQueueId(selectedId)}
                        multiple={false}
                        title={i18n.t("whatsappModal.form.queue")}
                      />
                    </Grid>
                  </Grid>
                  <Grid spacing={2} container>
                    <Grid xs={12} md={12} item>
                      <Field
                        as={TextField}
                        label={i18n.t("whatsappModal.form.expiresTicket")}
                        fullWidth
                        name="expiresTicket"
                        variant="outlined"
                        margin="dense"
                        error={touched.expiresTicket && Boolean(errors.expiresTicket)}
                        helperText={touched.expiresTicket && errors.expiresTicket}
                      />
                    </Grid>
                  </Grid>
                  <div>
                    <Field
                      as={TextField}
                      label={i18n.t("whatsappModal.form.expiresInactiveMessage")}
                      multiline
                      rows={4}
                      fullWidth
                      name="expiresInactiveMessage"
                      error={touched.expiresInactiveMessage && Boolean(errors.expiresInactiveMessage)}
                      helperText={touched.expiresInactiveMessage && errors.expiresInactiveMessage}
                      variant="outlined"
                      margin="dense"
                    />
                  </div>
                </div>
              </DialogContent>
              <DialogActions>
                <Button
                  onClick={handleClose}
                  color="secondary"
                  disabled={isSubmitting}
                  variant="outlined"
                >
                  {i18n.t("whatsappModal.buttons.cancel")}
                </Button>
                <Button
                  type="submit"
                  color="primary"
                  disabled={isSubmitting}
                  variant="contained"
                  className={classes.btnWrapper}
                >
                  {whatsAppId
                    ? i18n.t("whatsappModal.buttons.okEdit")
                    : i18n.t("whatsappModal.buttons.okAdd")}
                  {isSubmitting && (
                    <CircularProgress size={24} className={classes.buttonProgress} />
                  )}
                </Button>
              </DialogActions>
            </Form>
          )}
        </Formik>
      </Dialog>
    </div>
  );
};

export default React.memo(WhatsAppModal);
