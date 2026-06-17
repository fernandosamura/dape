import React, { useState, useEffect } from "react";
import qs from 'query-string';
import * as Yup from "yup";
import { useHistory, Link as RouterLink } from "react-router-dom";
import { toast } from "react-toastify";
import { Formik, Form, Field } from "formik";
import Button from "@material-ui/core/Button";
import CssBaseline from "@material-ui/core/CssBaseline";
import TextField from "@material-ui/core/TextField";
import Link from "@material-ui/core/Link";
import Grid from "@material-ui/core/Grid";
import Box from "@material-ui/core/Box";
import Typography from "@material-ui/core/Typography";
import { makeStyles } from "@material-ui/core/styles";
import InputMask from 'react-input-mask';
import logo from "../../assets/daple-logo.png";
import sammy from "../../assets/sammy.png";
import { i18n } from "../../translate/i18n";
import { openApi } from "../../services/api";
import toastError from "../../errors/toastError";
import moment from "moment";
import { versionSystem } from "../../../package.json";
import { nomeEmpresa } from "../../../package.json";

const Copyright = () => (
  <Typography variant="body2" align="center" style={{ color: "rgba(255,255,255,0.35)", fontSize: 12 }}>
    {"© "}{new Date().getFullYear()}{" "}{nomeEmpresa}{" v"}{versionSystem}
  </Typography>
);

const useStyles = makeStyles(theme => ({
  root: {
    width: "100vw",
    minHeight: "100vh",
    background: "linear-gradient(135deg, #1a1a1a 0%, #2D2D2D 50%, #1a1a1a 100%)",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
    paddingTop: "40px",
    paddingBottom: "40px",
    boxSizing: "border-box",
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
    width: "980px",
    maxWidth: "96vw",
    borderRadius: "24px",
    overflow: "hidden",
    boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
    position: "relative",
    zIndex: 1,
    alignSelf: "flex-start",
  },
  leftPanel: {
    flex: "0 0 340px",
    background: "linear-gradient(160deg, #F5C300 0%, #e6b000 60%, #cc9900 100%)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "48px 32px",
    position: "relative",
    overflow: "hidden",
    "@media (max-width: 700px)": { display: "none" },
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
    width: "160px",
    marginBottom: "20px",
    filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.3))",
    position: "relative",
    zIndex: 1,
  },
  sammyImg: {
    width: "200px",
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
    fontSize: "16px",
    textAlign: "center",
    marginTop: "16px",
    lineHeight: 1.4,
    position: "relative",
    zIndex: 1,
  },
  subtagline: {
    color: "rgba(0,0,0,0.6)",
    fontSize: "12px",
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
    padding: "40px 40px 32px",
    overflowY: "auto",
    maxHeight: "calc(100vh - 80px)",
  },
  formTitle: {
    color: "#ffffff",
    fontWeight: 700,
    fontSize: "24px",
    marginBottom: "4px",
  },
  formSubtitle: {
    color: "rgba(255,255,255,0.45)",
    fontSize: "13px",
    marginBottom: "24px",
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
  },
  submitBtn: {
    marginTop: "8px",
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
  divider: {
    width: "100%",
    height: "1px",
    background: "rgba(255,255,255,0.08)",
    margin: "16px 0",
  },
  // Plan cards
  plansTitle: {
    color: "rgba(255,255,255,0.7)",
    fontSize: "13px",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "1px",
    marginBottom: "12px",
  },
  plansGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: "10px",
    marginBottom: "20px",
  },
  planCardCompact: {
    padding: "14px 16px",
    borderRadius: "12px",
    border: "1.5px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.04)",
    cursor: "pointer",
    transition: "all 0.2s",
    userSelect: "none",
  },
  planCardCompactSelected: {
    background: "rgba(245,195,0,0.08)",
    border: "1.5px solid rgba(245,195,0,0.6)",
    boxShadow: "0 0 16px rgba(245,195,0,0.15)",
  },
  planCardName: {
    fontSize: "14px",
    fontWeight: 700,
    marginBottom: "2px",
  },
  planCardPrice: {
    fontSize: "16px",
    fontWeight: 800,
    color: "#F5C300",
    marginBottom: "4px",
  },
  planCardMeta: {
    fontSize: "11px",
    color: "rgba(255,255,255,0.4)",
  },
  linkRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: "4px",
  },
  link: {
    color: "#F5C300",
    fontSize: "13px",
    textDecoration: "none",
    "&:hover": { textDecoration: "underline" },
  },
  linkGray: {
    color: "rgba(255,255,255,0.4)",
    fontSize: "12px",
    textDecoration: "none",
    "&:hover": { color: "rgba(255,255,255,0.7)" },
  },
}));

const UserSchema = Yup.object().shape({
  name: Yup.string()
    .min(2, i18n.t("signup.formErrors.name.short"))
    .max(50, i18n.t("signup.formErrors.name.long"))
    .required(i18n.t("signup.formErrors.name.required")),
  password: Yup.string()
    .min(5, i18n.t("signup.formErrors.password.short"))
    .max(50, i18n.t("signup.formErrors.password.long")),
  email: Yup.string()
    .email(i18n.t("signup.formErrors.email.invalid"))
    .required(i18n.t("signup.formErrors.email.required")),
});

function getPlanColor(planName) {
  if (!planName) return "#6B7280";
  const lower = planName.toLowerCase();
  if (lower.includes("enterprise") || lower.includes("premium")) return "#8B5CF6";
  if (lower.includes("pro")) return "#F5C300";
  if (lower.includes("starter") || lower.includes("start")) return "#3B82F6";
  return "#6B7280";
}

const SignUp = () => {
  const classes = useStyles();
  const history = useHistory();

  const params = qs.parse(window.location.search);
  const preselectedPlanId = params.planId || null;

  const [plans, setPlans] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState(preselectedPlanId || "");

  const dueDate = moment().add(3, "day").format();

  const initialState = {
    name: "",
    email: "",
    phone: "",
    password: "",
    planId: preselectedPlanId || "",
  };

  useEffect(() => {
    openApi
      .get("/plans/landing")
      .then(res => {
        const list = res.data || [];
        setPlans(list);
        if (!selectedPlanId && list.length > 0) {
          const proDefault = list.find(p => p.name && p.name.toLowerCase().includes("pro")) || list[0];
          if (proDefault) {
            setSelectedPlanId(String(proDefault.id));
          }
        } else if (selectedPlanId) {
          setSelectedPlanId(String(selectedPlanId));
        }
      })
      .catch(() => {
        // fallback: use list endpoint
        openApi.get("/plans/list").then(res2 => {
          const list2 = (res2.data || []).filter(p => !["Master", "Bundle"].includes(p.name));
          setPlans(list2.map(p => ({
            id: p.id,
            name: p.name,
            price_monthly: p.value,
            max_users: p.users,
            max_connections: p.connections,
            max_queues: p.queues,
          })));
          if (!selectedPlanId && list2.length > 0) {
            setSelectedPlanId(String(list2[0].id));
          }
        }).catch(() => {});
      });
  }, []);

  const handleSignUp = async values => {
    Object.assign(values, { recurrence: "MENSAL" });
    Object.assign(values, { dueDate: dueDate });
    Object.assign(values, { status: "t" });
    Object.assign(values, { campaignsEnabled: true });
    try {
      await openApi.post("/companies/cadastro", values);
      toast.success(i18n.t("signup.toasts.success"));
      history.push("/login");
    } catch (err) {
      console.log(err);
      toastError(err);
    }
  };

  return (
    <div className={classes.root}>
      <div className={classes.bgDecor} />
      <div className={classes.bgDecor2} />

      <div className={classes.card}>
        {/* LEFT PANEL */}
        <div className={classes.leftPanel}>
          <div className={classes.leftDecorCircle} />
          <div className={classes.leftDecorCircle2} />
          <img src={logo} alt="DAPLE" className={classes.logoLeft} />
          <img src={sammy} alt="Sammy" className={classes.sammyImg} />
          <Typography className={classes.tagline}>
            Comece sua jornada<br />inteligente hoje
          </Typography>
          <Typography className={classes.subtagline}>
            Crie sua conta e transforme seu atendimento
          </Typography>
        </div>

        {/* RIGHT PANEL */}
        <div className={classes.rightPanel}>
          <CssBaseline />
          <Typography className={classes.formTitle}>Criar conta 🚀</Typography>
          <Typography className={classes.formSubtitle}>Preencha os dados abaixo para começar gratuitamente</Typography>

          {/* PLAN CARDS */}
          {plans.length > 0 && (
            <>
              <div className={classes.plansTitle}>Escolha seu plano</div>
              <div className={classes.plansGrid}>
                {plans.map(plan => {
                  const color = getPlanColor(plan.name);
                  const isSelected = String(selectedPlanId) === String(plan.id);
                  return (
                    <div
                      key={plan.id}
                      className={classes.planCardCompact}
                      style={{
                        ...(isSelected ? { background: "rgba(245,195,0,0.08)", border: `1.5px solid ${color}99`, boxShadow: `0 0 16px ${color}25` } : {}),
                      }}
                      onClick={() => setSelectedPlanId(String(plan.id))}
                    >
                      <div className={classes.planCardName} style={{ color }}>
                        {isSelected ? "✓ " : ""}{plan.name}
                      </div>
                      <div className={classes.planCardPrice}>
                        {plan.price_monthly
                          ? `R$ ${Number(plan.price_monthly).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}/mês`
                          : "Grátis"}
                      </div>
                      <div className={classes.planCardMeta}>
                        {plan.max_users || "?"} usuários · {plan.max_connections || "?"} conexões
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* FORM */}
          <Formik
            initialValues={{ ...initialState, planId: selectedPlanId }}
            enableReinitialize={true}
            validationSchema={UserSchema}
            onSubmit={(values, actions) => {
              setTimeout(() => {
                const finalValues = { ...values, planId: selectedPlanId };
                handleSignUp(finalValues);
                actions.setSubmitting(false);
              }, 400);
            }}
          >
            {({ touched, errors, isSubmitting }) => (
              <Form>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <Field
                      as={TextField}
                      className={classes.textField}
                      autoComplete="name"
                      name="name"
                      error={touched.name && Boolean(errors.name)}
                      helperText={touched.name && errors.name}
                      variant="outlined"
                      fullWidth
                      id="name"
                      label={i18n.t("signup.form.name")}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Field
                      as={TextField}
                      className={classes.textField}
                      variant="outlined"
                      fullWidth
                      id="email"
                      label={i18n.t("signup.form.email")}
                      name="email"
                      error={touched.email && Boolean(errors.email)}
                      helperText={touched.email && errors.email}
                      autoComplete="email"
                      required
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Field
                      as={InputMask}
                      mask="(99) 99999-9999"
                      variant="outlined"
                      fullWidth
                      id="phone"
                      name="phone"
                      error={touched.phone && Boolean(errors.phone)}
                      helperText={touched.phone && errors.phone}
                      autoComplete="phone"
                      required
                    >
                      {({ field }) => (
                        <TextField
                          {...field}
                          className={classes.textField}
                          variant="outlined"
                          fullWidth
                          label={i18n.t("signup.form.phone")}
                        />
                      )}
                    </Field>
                  </Grid>
                  <Grid item xs={12}>
                    <Field
                      as={TextField}
                      className={classes.textField}
                      variant="outlined"
                      fullWidth
                      name="password"
                      error={touched.password && Boolean(errors.password)}
                      helperText={touched.password && errors.password}
                      label={i18n.t("signup.form.password")}
                      type="password"
                      id="password"
                      autoComplete="current-password"
                      required
                    />
                  </Grid>
                </Grid>

                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  className={classes.submitBtn}
                  disabled={isSubmitting || !selectedPlanId}
                >
                  {i18n.t("signup.buttons.submit")}
                </Button>

                <div className={classes.divider} />

                <div className={classes.linkRow}>
                  <Link component={RouterLink} to="/login" className={classes.linkGray}>
                    {i18n.t("signup.buttons.login")}
                  </Link>
                  <Link component={RouterLink} to="/landing" className={classes.link}>
                    Ver todos os planos →
                  </Link>
                </div>
              </Form>
            )}
          </Formik>

          <Box mt={3}>
            <Copyright />
          </Box>
        </div>
      </div>
    </div>
  );
};

export default SignUp;
