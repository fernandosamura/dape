import React, { useState, useEffect } from "react";

import * as Yup from "yup";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import CircularProgress from "@material-ui/core/CircularProgress";
import Typography from "@material-ui/core/Typography";
import { i18n } from "../../translate/i18n";
import { MenuItem, FormControl, InputLabel, Select, Grid } from "@material-ui/core";
import { Visibility, VisibilityOff } from "@material-ui/icons";
import { InputAdornment, IconButton } from "@material-ui/core";
import QueueSelectSingle from "../../components/QueueSelectSingle";

import api from "../../services/api";
import toastError from "../../errors/toastError";

// ── Providers e modelos disponíveis ──────────────────────────────────────────
const PROVIDER_MODELS = {
  openai:    ["gpt-3.5-turbo", "gpt-3.5-turbo-1106", "gpt-4o-mini", "gpt-4o", "gpt-4-turbo"],
  anthropic: ["claude-3-haiku-20240307", "claude-3-5-haiku-20241022", "claude-3-5-sonnet-20241022", "claude-opus-4-5", "claude-sonnet-4-5"],
  gemini:    ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.0-flash", "gemini-2.0-flash-exp"],
  manus:     ["manus-default"]
};

const PROVIDER_LABELS = {
  openai:    "OpenAI (ChatGPT)",
  anthropic: "Anthropic (Claude)",
  gemini:    "Google (Gemini)",
  manus:     "Manus IA (Custom)"
};

const PROVIDER_KEY_LABEL = {
  openai:    "OpenAI API Key",
  anthropic: "Anthropic API Key",
  gemini:    "Google Gemini API Key",
  manus:     "Manus API Key"
};

const useStyles = makeStyles(theme => ({
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
    formControl: {
        margin: theme.spacing(1),
        minWidth: 120,
    },
    colorAdorment: {
        width: 20,
        height: 20,
    },
    providerBadge: {
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 600,
        marginLeft: 6,
        backgroundColor: "#e3f2fd",
        color: "#1565c0"
    }
}));

const PromptSchema = Yup.object().shape({
    name: Yup.string().min(5, i18n.t("promptModal.formErrors.name.short")).max(100, i18n.t("promptModal.formErrors.name.long")).required(i18n.t("promptModal.formErrors.name.required")),
    prompt: Yup.string().min(50, i18n.t("promptModal.formErrors.prompt.short")).required(i18n.t("promptModal.formErrors.prompt.required")),
    maxTokens: Yup.number().required(i18n.t("promptModal.formErrors.maxTokens.required")),
    temperature: Yup.number().required(i18n.t("promptModal.formErrors.temperature.required")),
    apiKey: Yup.string().required(i18n.t("promptModal.formErrors.apikey.required")),
    queueId: Yup.number().required(i18n.t("promptModal.formErrors.queueId.required")),
    maxMessages: Yup.number().required(i18n.t("promptModal.formErrors.maxMessages.required"))
});

const PromptModal = ({ open, onClose, promptId, refreshPrompts }) => {
    const classes = useStyles();
    const [selectedProvider, setSelectedProvider] = useState("openai");
    const [selectedModel, setSelectedModel] = useState("gpt-3.5-turbo-1106");
    const [selectedTtsProvider, setSelectedTtsProvider] = useState("azure");
    const [showApiKey, setShowApiKey] = useState(false);
    const [showVoiceKey, setShowVoiceKey] = useState(false);

    const handleToggleApiKey = () => setShowApiKey(!showApiKey);

    const initialState = {
        name: "",
        prompt: "",
        model: "gpt-3.5-turbo-1106",
        maxTokens: 100,
        temperature: 1,
        apiKey: "",
        queueId: "",
        maxMessages: 10,
        provider: "openai",
        baseUrl: "",
        voice: "texto",
        voiceKey: "",
        voiceRegion: "",
        ttsProvider: "azure"
    };

    const [prompt, setPrompt] = useState(initialState);

    useEffect(() => {
        const fetchPrompt = async () => {
            if (!promptId) {
                setPrompt(initialState);
                setSelectedProvider("openai");
                setSelectedModel("gpt-3.5-turbo-1106");
                return;
            }
            try {
                const { data } = await api.get(`/prompt/${promptId}`);
                setPrompt(prevState => ({ ...prevState, ...data }));
                const prov = data.provider || "openai";
                setSelectedProvider(prov);
                setSelectedModel(data.model || (PROVIDER_MODELS[prov] || [])[0] || "");
                setSelectedTtsProvider(data.ttsProvider || "azure");
            } catch (err) {
                toastError(err);
            }
        };
        fetchPrompt();
    }, [promptId, open]);

    const handleClose = () => {
        setPrompt(initialState);
        setSelectedProvider("openai");
        setSelectedModel("gpt-3.5-turbo-1106");
        setSelectedTtsProvider("azure");
        onClose();
    };

    const handleChangeProvider = (e) => {
        const prov = e.target.value;
        setSelectedProvider(prov);
        setSelectedModel((PROVIDER_MODELS[prov] || [])[0] || "");
    };

    const handleChangeModel = (e) => setSelectedModel(e.target.value);

    const handleSavePrompt = async values => {
        const promptData = {
            ...values,
            model: selectedModel,
            provider: selectedProvider,
            ttsProvider: selectedTtsProvider
        };
        if (!values.queueId) {
            toastError(i18n.t("promptModal.setor"));
            return;
        }
        try {
            if (promptId) {
                await api.put(`/prompt/${promptId}`, promptData);
            } else {
                await api.post("/prompt", promptData);
            }
            toast.success(i18n.t("promptModal.success"));
            refreshPrompts();
        } catch (err) {
            toastError(err);
        }
        handleClose();
    };

    return (
        <div className={classes.root}>
            <Dialog open={open} onClose={handleClose} maxWidth="md" scroll="paper" fullWidth>
                <DialogTitle id="form-dialog-title">
                    {promptId
                        ? `${i18n.t("promptModal.title.edit")}`
                        : `${i18n.t("promptModal.title.add")}`}
                    <span className={classes.providerBadge}>{PROVIDER_LABELS[selectedProvider]}</span>
                </DialogTitle>
                <Formik
                    initialValues={prompt}
                    enableReinitialize={true}
                    validationSchema={PromptSchema}
                    onSubmit={(values, actions) => {
                        setTimeout(() => {
                            handleSavePrompt(values);
                            actions.setSubmitting(false);
                        }, 400);
                    }}
                >
                    {({ touched, errors, isSubmitting, values }) => (
                        <Form style={{ width: "100%" }}>
                            <DialogContent dividers>
                                <Field
                                    as={TextField}
                                    label={i18n.t("promptModal.form.name")}
                                    name="name"
                                    error={touched.name && Boolean(errors.name)}
                                    helperText={touched.name && errors.name}
                                    variant="outlined"
                                    margin="dense"
                                    fullWidth
                                />

                                {/* ── Provedor de IA ── */}
                                <FormControl fullWidth margin="dense" variant="outlined">
                                    <InputLabel>Provedor de IA</InputLabel>
                                    <Select
                                        value={selectedProvider}
                                        onChange={handleChangeProvider}
                                        labelWidth={100}
                                    >
                                        {Object.entries(PROVIDER_LABELS).map(([value, label]) => (
                                            <MenuItem key={value} value={value}>{label}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>

                                {/* ── API Key (label muda conforme provider) ── */}
                                <FormControl fullWidth margin="dense" variant="outlined">
                                    <Field
                                        as={TextField}
                                        label={PROVIDER_KEY_LABEL[selectedProvider] || "API Key"}
                                        name="apiKey"
                                        type={showApiKey ? "text" : "password"}
                                        error={touched.apiKey && Boolean(errors.apiKey)}
                                        helperText={touched.apiKey && errors.apiKey}
                                        variant="outlined"
                                        margin="dense"
                                        fullWidth
                                        InputProps={{
                                            endAdornment: (
                                                <InputAdornment position="end">
                                                    <IconButton onClick={handleToggleApiKey}>
                                                        {showApiKey ? <VisibilityOff /> : <Visibility />}
                                                    </IconButton>
                                                </InputAdornment>
                                            ),
                                        }}
                                    />
                                </FormControl>

                                {/* ── Base URL (apenas Manus) ── */}
                                {selectedProvider === "manus" && (
                                    <Field
                                        as={TextField}
                                        label="URL Base (endpoint Manus IA)"
                                        name="baseUrl"
                                        variant="outlined"
                                        margin="dense"
                                        fullWidth
                                        placeholder="https://api.manus.ai/v1"
                                        helperText="Endpoint compatível com OpenAI. Deixe vazio para usar o padrão."
                                    />
                                )}

                                <Field
                                    as={TextField}
                                    label={i18n.t("promptModal.form.prompt")}
                                    name="prompt"
                                    error={touched.prompt && Boolean(errors.prompt)}
                                    helperText={touched.prompt && errors.prompt}
                                    variant="outlined"
                                    margin="dense"
                                    fullWidth
                                    rows={10}
                                    multiline={true}
                                />
                                <QueueSelectSingle touched={touched} errors={errors} />

                                <div className={classes.multFieldLine}>
                                    {/* ── Modelo (filtrado por provider) ── */}
                                    <FormControl fullWidth margin="dense" variant="outlined">
                                        <InputLabel>{i18n.t("promptModal.form.model")}</InputLabel>
                                        <Select
                                            labelWidth={60}
                                            name="model"
                                            value={selectedModel}
                                            onChange={handleChangeModel}
                                            multiple={false}
                                        >
                                            {(PROVIDER_MODELS[selectedProvider] || []).map(m => (
                                                <MenuItem key={m} value={m}>{m}</MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                    <Field
                                        as={TextField}
                                        label={i18n.t("promptModal.form.temperature")}
                                        name="temperature"
                                        error={touched.temperature && Boolean(errors.temperature)}
                                        helperText={touched.temperature && errors.temperature}
                                        variant="outlined"
                                        margin="dense"
                                        fullWidth
                                        type="number"
                                        inputProps={{ step: "0.1", min: "0", max: "1" }}
                                    />
                                </div>

                                <div className={classes.multFieldLine}>
                                    <Field
                                        as={TextField}
                                        label={i18n.t("promptModal.form.max_tokens")}
                                        name="maxTokens"
                                        error={touched.maxTokens && Boolean(errors.maxTokens)}
                                        helperText={touched.maxTokens && errors.maxTokens}
                                        variant="outlined"
                                        margin="dense"
                                        fullWidth
                                    />
                                    <Field
                                        as={TextField}
                                        label={i18n.t("promptModal.form.max_messages")}
                                        name="maxMessages"
                                        error={touched.maxMessages && Boolean(errors.maxMessages)}
                                        helperText={touched.maxMessages && errors.maxMessages}
                                        variant="outlined"
                                        margin="dense"
                                        fullWidth
                                    />
                                </div>

                                {/* ── Configuração de Resposta em Áudio TTS ── */}
                                <Typography variant="subtitle2" style={{ marginTop: 16, marginBottom: 2, fontWeight: 600 }}>
                                    🔊 Resposta em Áudio (Text-to-Speech)
                                </Typography>
                                <Typography variant="caption" style={{ color: "#555", display: "block", marginBottom: 8 }}>
                                    Deixe o campo Voz como "texto" para responder por texto. Informe o nome de uma voz do Azure ou Google para ativar respostas em áudio OGG/Opus (compatível com todos os providers de IA).
                                </Typography>

                                <div className={classes.multFieldLine}>
                                    <FormControl fullWidth margin="dense" variant="outlined">
                                        <InputLabel>Provider TTS</InputLabel>
                                        <Select
                                            value={selectedTtsProvider}
                                            onChange={(e) => setSelectedTtsProvider(e.target.value)}
                                            labelWidth={95}
                                        >
                                            <MenuItem value="azure">Microsoft Azure Speech</MenuItem>
                                            <MenuItem value="google">Google Cloud TTS</MenuItem>
                                        </Select>
                                    </FormControl>
                                    <Field
                                        as={TextField}
                                        label="Voz"
                                        name="voice"
                                        variant="outlined"
                                        margin="dense"
                                        fullWidth
                                        placeholder="texto"
                                        helperText={selectedTtsProvider === "azure" ? "Ex: pt-BR-FranciscaNeural" : "Ex: pt-BR-Wavenet-B"}
                                    />
                                </div>

                                <div className={classes.multFieldLine}>
                                    <FormControl fullWidth margin="dense" variant="outlined">
                                        <Field
                                            as={TextField}
                                            label={selectedTtsProvider === "azure" ? "Azure Speech Key" : "Google Cloud API Key"}
                                            name="voiceKey"
                                            type={showVoiceKey ? "text" : "password"}
                                            variant="outlined"
                                            margin="dense"
                                            fullWidth
                                            InputProps={{
                                                endAdornment: (
                                                    <InputAdornment position="end">
                                                        <IconButton onClick={() => setShowVoiceKey(!showVoiceKey)}>
                                                            {showVoiceKey ? <VisibilityOff /> : <Visibility />}
                                                        </IconButton>
                                                    </InputAdornment>
                                                ),
                                            }}
                                        />
                                    </FormControl>
                                    {selectedTtsProvider === "azure" && (
                                        <Field
                                            as={TextField}
                                            label="Região Azure"
                                            name="voiceRegion"
                                            variant="outlined"
                                            margin="dense"
                                            fullWidth
                                            placeholder="brazilsouth"
                                        />
                                    )}
                                </div>

                                {selectedProvider !== "openai" && (
                                    <Typography variant="caption" style={{ color: "#888", display: "block", marginTop: 6 }}>
                                        ℹ️ Transcrição de áudio de entrada (Whisper) disponível apenas para OpenAI. Resposta em áudio (TTS) funciona com todos os providers.
                                    </Typography>
                                )}
                            </DialogContent>
                            <DialogActions>
                                <Button onClick={handleClose} color="secondary" disabled={isSubmitting} variant="outlined">
                                    {i18n.t("promptModal.buttons.cancel")}
                                </Button>
                                <Button
                                    type="submit"
                                    color="primary"
                                    disabled={isSubmitting}
                                    variant="contained"
                                    className={classes.btnWrapper}
                                >
                                    {promptId
                                        ? `${i18n.t("promptModal.buttons.okEdit")}`
                                        : `${i18n.t("promptModal.buttons.okAdd")}`}
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

export default PromptModal;
