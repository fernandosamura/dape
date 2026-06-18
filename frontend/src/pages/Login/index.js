import React, { useState, useContext } from "react";
import { Link as RouterLink } from "react-router-dom";
import Button from "@material-ui/core/Button";
import CssBaseline from "@material-ui/core/CssBaseline";
import TextField from "@material-ui/core/TextField";
import Link from "@material-ui/core/Link";
import Grid from "@material-ui/core/Grid";
import Box from "@material-ui/core/Box";
import Typography from "@material-ui/core/Typography";
import { makeStyles } from "@material-ui/core/styles";
import { IconButton, Menu, MenuItem } from "@material-ui/core";
import { LanguageOutlined } from "@material-ui/icons";
import { versionSystem } from "../../../package.json";
import { nomeEmpresa } from "../../../package.json";
import { i18n } from "../../translate/i18n";
import { AuthContext } from "../../context/Auth/AuthContext";
import api from "../../services/api";
import logo from "../../assets/daple-logo.png";
import dapleMascote from "../../assets/daple-mascote.png";
import LanguageControl from "../../components/LanguageControl";

const Copyright = () => (
  <Typography variant="body2" align="center" style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>
    {"© "}{new Date().getFullYear()}{" "}{nomeEmpresa}{" v"}{versionSystem}
  </Typography>
);

const useStyles = makeStyles(theme => ({
  root: {
    width: "100vw",
    height: "100vh",
    background: "linear-gradient(135deg, #1a1a1a 0%, #2D2D2D 50%, #1a1a1a 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
  },
  bgDecor: {
    position: "absolute",
    top: "-20%",
    left: "-10%",
    width: "50vw",
    height: "50vw",
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(245,195,0,0.08) 0%, transparent 70%)",
    pointerEvents: "none",
  },
  bgDecor2: {
    position: "absolute",
    bottom: "-20%",
    right: "-10%",
    width: "40vw",
    height: "40vw",
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(245,195,0,0.06) 0%, transparent 70%)",
    pointerEvents: "none",
  },
  card: {
    display: "flex",
    width: "900px",
    maxWidth: "95vw",
    minHeight: "560px",
    borderRadius: "24px",
    overflow: "hidden",
    boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
    position: "relative",
    zIndex: 1,
  },
  leftPanel: {
    flex: 1,
    background: "linear-gradient(160deg, #F5C300 0%, #e6b000 60%, #cc9900 100%)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "48px 32px",
    position: "relative",
    overflow: "hidden",
    "@media (max-width: 650px)": { display: "none" },
  },
  leftDecorCircle: {
    position: "absolute",
    top: "-60px",
    right: "-60px",
    width: "200px",
    height: "200px",
    borderRadius: "50%",
    background: "rgba(255,255,255,0.1)",
  },
  leftDecorCircle2: {
    position: "absolute",
    bottom: "-80px",
    left: "-40px",
    width: "250px",
    height: "250px",
    borderRadius: "50%",
    background: "rgba(255,255,255,0.08)",
  },
  logoLeft: {
    width: "180px",
    marginBottom: "24px",
    filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.3))",
    position: "relative",
    zIndex: 1,
  },
  sammyImg: {
    width: "220px",
    filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.3))",
    position: "relative",
    zIndex: 1,
    animation: "$float 3s ease-in-out infinite",
  },
  "@keyframes float": {
    "0%, 100%": { transform: "translateY(0px)" },
    "50%": { transform: "translateY(-12px)" },
  },
  tagline: {
    color: "#1a1a1a",
    fontWeight: 700,
    fontSize: "18px",
    textAlign: "center",
    marginTop: "20px",
    lineHeight: 1.4,
    position: "relative",
    zIndex: 1,
  },
  subtagline: {
    color: "rgba(0,0,0,0.6)",
    fontSize: "13px",
    textAlign: "center",
    marginTop: "8px",
    position: "relative",
    zIndex: 1,
  },
  rightPanel: {
    flex: 1,
    background: "#1e1e1e",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "48px 40px",
  },
  formTitle: {
    color: "#ffffff",
    fontWeight: 700,
    fontSize: "26px",
    marginBottom: "6px",
    alignSelf: "flex-start",
  },
  formSubtitle: {
    color: "rgba(255,255,255,0.45)",
    fontSize: "14px",
    marginBottom: "32px",
    alignSelf: "flex-start",
  },
  form: {
    width: "100%",
  },
  textField: {
    "& .MuiOutlinedInput-root": {
      background: "rgba(255,255,255,0.05)",
      borderRadius: "10px",
      color: "#fff",
      "& fieldset": { borderColor: "rgba(255,255,255,0.12)" },
      "&:hover fieldset": { borderColor: "rgba(245,195,0,0.5)" },
      "&.Mui-focused fieldset": { borderColor: "#F5C300" },
    },
    "& .MuiInputLabel-root": { color: "rgba(255,255,255,0.45)" },
    "& .MuiInputLabel-root.Mui-focused": { color: "#F5C300" },
    marginBottom: "16px",
  },
  submitBtn: {
    marginTop: "8px",
    marginBottom: "16px",
    padding: "14px",
    borderRadius: "10px",
    background: "linear-gradient(90deg, #F5C300, #e6b000)",
    color: "#1a1a1a",
    fontWeight: 800,
    fontSize: "15px",
    letterSpacing: "0.5px",
    textTransform: "uppercase",
    boxShadow: "0 4px 20px rgba(245,195,0,0.35)",
    "&:hover": {
      background: "linear-gradient(90deg, #e6b000, #cc9900)",
      boxShadow: "0 6px 28px rgba(245,195,0,0.5)",
    },
  },
  registerLink: {
    color: "#F5C300",
    fontSize: "13px",
    textDecoration: "none",
    "&:hover": { textDecoration: "underline" },
  },
  divider: {
    width: "100%",
    height: "1px",
    background: "rgba(255,255,255,0.08)",
    margin: "20px 0",
  },
  languageControl: {
    position: "absolute",
    top: 12,
    right: 12,
    zIndex: 10,
  },
}));

const Login = () => {
  const classes = useStyles();
  const [user, setUser] = useState({ email: "", password: "" });
  const [pendingApproval, setPendingApproval] = useState(false);
  const [anchorElLanguage, setAnchorElLanguage] = useState(null);
  const [menuLanguageOpen, setMenuLanguageOpen] = useState(false);
  const { handleLogin } = useContext(AuthContext);

  const handleChangeInput = e => setUser({ ...user, [e.target.name]: e.target.value });
  const handlSubmit = async e => {
    e.preventDefault();
    try {
      await api.post("/auth/login", user);
      handleLogin(user);
    } catch (err) {
      if (err?.response?.data?.error === "ERR_COMPANY_PENDING_APPROVAL") {
        setPendingApproval(true);
      }
    }
  };
  const handlemenuLanguage = e => { setAnchorElLanguage(e.currentTarget); setMenuLanguageOpen(true); };
  const handleCloseMenuLanguage = () => { setAnchorElLanguage(null); setMenuLanguageOpen(false); };

  if (pendingApproval) {
    return (
      <div className={classes.root}>
        <div className={classes.bgDecor} />
        <div className={classes.bgDecor2} />
        <div className={classes.card} style={{ maxWidth: 480, minHeight: "auto" }}>
          <div className={classes.rightPanel} style={{ alignItems: "center", textAlign: "center", padding: "56px 40px" }}>
            <img src={dapleMascote} alt="DAPLE" style={{ width: 130, marginBottom: 24, animation: "none", opacity: 0.85 }} />
            <div style={{ fontSize: 48, marginBottom: 12 }}>⏳</div>
            <Typography style={{ color: "#F5C300", fontWeight: 800, fontSize: 22, marginBottom: 8 }}>
              Aguardando Aprovação
            </Typography>
            <Typography style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
              Sua conta foi criada com sucesso!<br />
              Um administrador precisa aprovar o acesso antes que você possa entrar no sistema.<br /><br />
              Entre em contato com o suporte para agilizar a liberação.
            </Typography>
            <Button
              variant="outlined"
              onClick={() => setPendingApproval(false)}
              style={{ borderColor: "rgba(245,195,0,0.4)", color: "#F5C300", borderRadius: 10 }}
            >
              ← Voltar ao login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={classes.root}>
      <div className={classes.bgDecor} />
      <div className={classes.bgDecor2} />

      <div className={classes.languageControl}>
        <IconButton size="small">
          <LanguageOutlined
            onClick={handlemenuLanguage}
            style={{ color: "rgba(255,255,255,0.5)", fontSize: 20 }}
          />
        </IconButton>
        <Menu
          anchorEl={anchorElLanguage}
          getContentAnchorEl={null}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          transformOrigin={{ vertical: "top", horizontal: "right" }}
          open={menuLanguageOpen}
          onClose={handleCloseMenuLanguage}
        >
          <MenuItem><LanguageControl /></MenuItem>
        </Menu>
      </div>

      <div className={classes.card}>
        {/* LEFT PANEL */}
        <div className={classes.leftPanel}>
          <div className={classes.leftDecorCircle} />
          <div className={classes.leftDecorCircle2} />
          <img src={logo} alt="DAPLE" className={classes.logoLeft} />
          <img src={dapleMascote} alt="DAPLE Mascote" className={classes.sammyImg} />
          <Typography className={classes.tagline}>
            Seu atendimento<br />inteligente começa aqui
          </Typography>
          <Typography className={classes.subtagline}>
            Gerencie, automatize e conquiste clientes
          </Typography>
        </div>

        {/* RIGHT PANEL */}
        <div className={classes.rightPanel}>
          <CssBaseline />
          <Typography className={classes.formTitle}>Bem-vindo de volta 👋</Typography>
          <Typography className={classes.formSubtitle}>Entre com suas credenciais para acessar</Typography>

          <form className={classes.form} noValidate onSubmit={handlSubmit}>
            <TextField
              className={classes.textField}
              variant="outlined"
              required
              fullWidth
              id="email"
              label={i18n.t("login.form.email")}
              name="email"
              value={user.email}
              onChange={handleChangeInput}
              autoComplete="email"
              autoFocus
            />
            <TextField
              className={classes.textField}
              variant="outlined"
              required
              fullWidth
              name="password"
              label={i18n.t("login.form.password")}
              type="password"
              id="password"
              value={user.password}
              onChange={handleChangeInput}
              autoComplete="current-password"
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              className={classes.submitBtn}
            >
              {i18n.t("login.buttons.submit")}
            </Button>
            <div className={classes.divider} />
            <Grid container justifyContent="center">
              <Grid item>
                <Link component={RouterLink} to="/signup" className={classes.registerLink}>
                  {i18n.t("login.buttons.register")}
                </Link>
              </Grid>
            </Grid>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '16px 0 4px' }}>
              <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
              <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '12px', whiteSpace: 'nowrap' }}>ou</span>
              <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
            </div>
            <Grid container justifyContent="center">
              <Grid item>
                <Link component={RouterLink} to="/landing" style={{ color: '#F5C300', fontSize: '13px', textDecoration: 'none' }}>
                  Ver nossos planos →
                </Link>
              </Grid>
            </Grid>
          </form>

          <Box mt={4} width="100%">
            <Copyright />
          </Box>
        </div>
      </div>
    </div>
  );
};

export default Login;
