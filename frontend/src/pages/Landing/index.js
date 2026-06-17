import React, { useState, useEffect } from "react";
import { useHistory, Link as RouterLink } from "react-router-dom";
import { openApi } from "../../services/api";
import logo from "../../assets/daple-logo.png";
import sammy from "../../assets/sammy.png";

const styles = {
  root: {
    minHeight: "100vh",
    background: "#0f0f0f",
    color: "#ffffff",
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    overflowX: "hidden",
  },

  // NAVBAR
  navbar: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 48px",
    height: "70px",
    background: "rgba(15,15,15,0.95)",
    backdropFilter: "blur(12px)",
    borderBottom: "1px solid rgba(245,195,0,0.15)",
    boxShadow: "0 4px 30px rgba(0,0,0,0.5)",
  },
  navLogo: {
    height: "38px",
  },
  navActions: {
    display: "flex",
    gap: "12px",
    alignItems: "center",
  },
  btnOutline: {
    padding: "9px 22px",
    borderRadius: "8px",
    border: "1.5px solid rgba(245,195,0,0.5)",
    background: "transparent",
    color: "#F5C300",
    fontWeight: 600,
    fontSize: "14px",
    cursor: "pointer",
    textDecoration: "none",
    transition: "all 0.2s",
    display: "inline-block",
  },
  btnSolid: {
    padding: "9px 22px",
    borderRadius: "8px",
    border: "none",
    background: "linear-gradient(90deg, #F5C300, #e6b000)",
    color: "#1a1a1a",
    fontWeight: 700,
    fontSize: "14px",
    cursor: "pointer",
    textDecoration: "none",
    transition: "all 0.2s",
    display: "inline-block",
    boxShadow: "0 4px 16px rgba(245,195,0,0.4)",
  },

  // HERO
  hero: {
    paddingTop: "120px",
    paddingBottom: "80px",
    paddingLeft: "48px",
    paddingRight: "48px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    maxWidth: "1200px",
    margin: "0 auto",
    minHeight: "90vh",
    position: "relative",
  },
  heroContent: {
    flex: 1,
    maxWidth: "600px",
  },
  heroBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    padding: "6px 16px",
    borderRadius: "100px",
    background: "rgba(245,195,0,0.1)",
    border: "1px solid rgba(245,195,0,0.3)",
    color: "#F5C300",
    fontSize: "13px",
    fontWeight: 600,
    marginBottom: "28px",
  },
  heroTitle: {
    fontSize: "clamp(36px, 5vw, 64px)",
    fontWeight: 800,
    lineHeight: 1.1,
    marginBottom: "24px",
    letterSpacing: "-1px",
  },
  heroGradientText: {
    background: "linear-gradient(90deg, #F5C300, #ff9500)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  },
  heroSubtitle: {
    fontSize: "18px",
    color: "rgba(255,255,255,0.6)",
    lineHeight: 1.7,
    marginBottom: "40px",
    maxWidth: "480px",
  },
  heroButtons: {
    display: "flex",
    gap: "16px",
    flexWrap: "wrap",
    marginBottom: "56px",
  },
  btnHeroPrimary: {
    padding: "16px 36px",
    borderRadius: "12px",
    border: "none",
    background: "linear-gradient(90deg, #F5C300, #e6b000)",
    color: "#1a1a1a",
    fontWeight: 800,
    fontSize: "16px",
    cursor: "pointer",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    boxShadow: "0 8px 32px rgba(245,195,0,0.4)",
    transition: "all 0.3s",
  },
  btnHeroSecondary: {
    padding: "16px 36px",
    borderRadius: "12px",
    border: "1.5px solid rgba(255,255,255,0.2)",
    background: "rgba(255,255,255,0.05)",
    color: "#ffffff",
    fontWeight: 600,
    fontSize: "16px",
    cursor: "pointer",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
  },
  heroStats: {
    display: "flex",
    gap: "32px",
    flexWrap: "wrap",
  },
  statItem: {
    textAlign: "center",
  },
  statNum: {
    fontSize: "28px",
    fontWeight: 800,
    color: "#F5C300",
    display: "block",
  },
  statLabel: {
    fontSize: "12px",
    color: "rgba(255,255,255,0.5)",
    textTransform: "uppercase",
    letterSpacing: "1px",
  },
  heroVisual: {
    flex: 1,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    maxWidth: "450px",
  },
  sammyWrapper: {
    position: "relative",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  sammyGlow: {
    position: "absolute",
    width: "300px",
    height: "300px",
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(245,195,0,0.25) 0%, transparent 70%)",
    pointerEvents: "none",
  },
  sammyImg: {
    width: "320px",
    position: "relative",
    zIndex: 1,
    filter: "drop-shadow(0 16px 48px rgba(245,195,0,0.3))",
    animation: "float 3s ease-in-out infinite",
  },
  heroDecorRing: {
    position: "absolute",
    width: "400px",
    height: "400px",
    borderRadius: "50%",
    border: "1px solid rgba(245,195,0,0.1)",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    pointerEvents: "none",
  },
  heroDecorRing2: {
    position: "absolute",
    width: "520px",
    height: "520px",
    borderRadius: "50%",
    border: "1px solid rgba(245,195,0,0.05)",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    pointerEvents: "none",
  },

  // SECTION
  section: {
    padding: "80px 48px",
    maxWidth: "1200px",
    margin: "0 auto",
  },
  sectionTitle: {
    fontSize: "40px",
    fontWeight: 800,
    textAlign: "center",
    marginBottom: "16px",
    letterSpacing: "-0.5px",
  },
  sectionSubtitle: {
    fontSize: "17px",
    color: "rgba(255,255,255,0.55)",
    textAlign: "center",
    marginBottom: "60px",
    maxWidth: "500px",
    margin: "0 auto 60px",
    lineHeight: 1.6,
  },
  sectionLabel: {
    display: "block",
    textAlign: "center",
    fontSize: "13px",
    fontWeight: 600,
    color: "#F5C300",
    textTransform: "uppercase",
    letterSpacing: "2px",
    marginBottom: "16px",
  },

  // FEATURES
  featuresGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: "24px",
  },
  featureCard: {
    background: "linear-gradient(135deg, #1a1a1a 0%, #1e1e1e 100%)",
    borderRadius: "20px",
    padding: "32px",
    border: "1px solid rgba(255,255,255,0.06)",
    transition: "all 0.3s",
    cursor: "default",
  },
  featureIcon: {
    fontSize: "44px",
    marginBottom: "20px",
    display: "block",
    lineHeight: 1,
  },
  featureTitle: {
    fontSize: "18px",
    fontWeight: 700,
    color: "#ffffff",
    marginBottom: "10px",
  },
  featureDesc: {
    fontSize: "14px",
    color: "rgba(255,255,255,0.5)",
    lineHeight: 1.7,
  },
  featureAccent: {
    display: "inline-block",
    width: "40px",
    height: "3px",
    borderRadius: "2px",
    background: "linear-gradient(90deg, #F5C300, #ff9500)",
    marginTop: "16px",
  },

  // PLANS
  plansSection: {
    padding: "80px 48px",
    background: "linear-gradient(180deg, #0f0f0f 0%, #141414 50%, #0f0f0f 100%)",
    position: "relative",
    overflow: "hidden",
  },
  plansBg: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: "800px",
    height: "400px",
    background: "radial-gradient(ellipse, rgba(245,195,0,0.04) 0%, transparent 70%)",
    pointerEvents: "none",
  },
  plansInner: {
    maxWidth: "1200px",
    margin: "0 auto",
    position: "relative",
    zIndex: 1,
  },
  plansGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: "24px",
    alignItems: "start",
  },
  planCard: {
    background: "#1a1a1a",
    borderRadius: "20px",
    padding: "32px 28px",
    border: "1px solid rgba(255,255,255,0.07)",
    position: "relative",
    transition: "transform 0.3s, box-shadow 0.3s",
    display: "flex",
    flexDirection: "column",
  },
  planCardPopular: {
    background: "linear-gradient(160deg, #1f1b00 0%, #1a1a00 100%)",
    border: "2px solid #F5C300",
    boxShadow: "0 0 40px rgba(245,195,0,0.2)",
    transform: "translateY(-8px)",
  },
  popularBadge: {
    position: "absolute",
    top: "-14px",
    left: "50%",
    transform: "translateX(-50%)",
    background: "linear-gradient(90deg, #F5C300, #e6b000)",
    color: "#1a1a1a",
    fontWeight: 800,
    fontSize: "11px",
    padding: "5px 18px",
    borderRadius: "100px",
    textTransform: "uppercase",
    letterSpacing: "1px",
    whiteSpace: "nowrap",
  },
  planColorBar: {
    height: "4px",
    borderRadius: "100px",
    marginBottom: "24px",
  },
  planName: {
    fontSize: "22px",
    fontWeight: 800,
    marginBottom: "4px",
  },
  planDesc: {
    fontSize: "13px",
    color: "rgba(255,255,255,0.4)",
    marginBottom: "20px",
    minHeight: "36px",
  },
  planPrice: {
    marginBottom: "24px",
  },
  planPriceValue: {
    fontSize: "42px",
    fontWeight: 800,
    lineHeight: 1,
    display: "block",
  },
  planPriceSuffix: {
    fontSize: "14px",
    color: "rgba(255,255,255,0.4)",
    marginTop: "4px",
    display: "block",
  },
  planDivider: {
    height: "1px",
    background: "rgba(255,255,255,0.07)",
    margin: "20px 0",
  },
  planLimitsList: {
    listStyle: "none",
    padding: 0,
    margin: "0 0 16px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  planLimitItem: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    fontSize: "13px",
    color: "rgba(255,255,255,0.7)",
  },
  planLimitIcon: {
    fontSize: "16px",
    minWidth: "20px",
    textAlign: "center",
  },
  planFeaturesList: {
    listStyle: "none",
    padding: 0,
    margin: "0 0 16px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  planFeatureItem: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    fontSize: "13px",
  },
  planFeatureCheck: {
    color: "#22c55e",
    fontWeight: 700,
    minWidth: "16px",
  },
  planFeatureCross: {
    color: "rgba(255,255,255,0.2)",
    minWidth: "16px",
  },
  planFeatureText: {
    color: "rgba(255,255,255,0.65)",
  },
  planFeatureTextDisabled: {
    color: "rgba(255,255,255,0.2)",
    textDecoration: "line-through",
  },
  modulesList: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
    marginBottom: "24px",
  },
  moduleBadge: {
    padding: "3px 10px",
    borderRadius: "100px",
    background: "rgba(59,130,246,0.15)",
    border: "1px solid rgba(59,130,246,0.3)",
    color: "#60a5fa",
    fontSize: "11px",
    fontWeight: 600,
  },
  planBtn: {
    width: "100%",
    padding: "14px",
    borderRadius: "10px",
    border: "none",
    fontWeight: 700,
    fontSize: "15px",
    cursor: "pointer",
    textDecoration: "none",
    display: "block",
    textAlign: "center",
    marginTop: "auto",
    transition: "all 0.2s",
  },
  planBtnPopular: {
    background: "linear-gradient(90deg, #F5C300, #e6b000)",
    color: "#1a1a1a",
    boxShadow: "0 4px 20px rgba(245,195,0,0.4)",
  },
  planBtnDefault: {
    background: "rgba(255,255,255,0.08)",
    color: "#ffffff",
    border: "1px solid rgba(255,255,255,0.12)",
  },
  planSectionTitle: {
    fontSize: "13px",
    fontWeight: 700,
    color: "rgba(255,255,255,0.4)",
    textTransform: "uppercase",
    letterSpacing: "1px",
    marginBottom: "10px",
  },

  // CTA
  ctaSection: {
    background: "linear-gradient(135deg, #F5C300 0%, #e6b000 60%, #cc9900 100%)",
    padding: "80px 48px",
    textAlign: "center",
    position: "relative",
    overflow: "hidden",
  },
  ctaDecor1: {
    position: "absolute",
    top: "-80px",
    left: "-80px",
    width: "320px",
    height: "320px",
    borderRadius: "50%",
    background: "rgba(255,255,255,0.1)",
    pointerEvents: "none",
  },
  ctaDecor2: {
    position: "absolute",
    bottom: "-100px",
    right: "-60px",
    width: "400px",
    height: "400px",
    borderRadius: "50%",
    background: "rgba(255,255,255,0.08)",
    pointerEvents: "none",
  },
  ctaInner: {
    position: "relative",
    zIndex: 1,
    maxWidth: "600px",
    margin: "0 auto",
  },
  ctaTitle: {
    fontSize: "42px",
    fontWeight: 800,
    color: "#1a1a1a",
    marginBottom: "16px",
    lineHeight: 1.2,
    letterSpacing: "-0.5px",
  },
  ctaSubtitle: {
    fontSize: "17px",
    color: "rgba(0,0,0,0.65)",
    marginBottom: "40px",
    lineHeight: 1.6,
  },
  ctaBtn: {
    padding: "18px 48px",
    borderRadius: "12px",
    border: "none",
    background: "#1a1a1a",
    color: "#F5C300",
    fontWeight: 800,
    fontSize: "16px",
    cursor: "pointer",
    textDecoration: "none",
    display: "inline-block",
    boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
    transition: "all 0.3s",
  },

  // FOOTER
  footer: {
    background: "#0a0a0a",
    padding: "40px 48px",
    borderTop: "1px solid rgba(255,255,255,0.06)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: "16px",
  },
  footerLogo: {
    height: "28px",
    opacity: 0.7,
  },
  footerText: {
    color: "rgba(255,255,255,0.35)",
    fontSize: "13px",
  },
  footerLinks: {
    display: "flex",
    gap: "24px",
  },
  footerLink: {
    color: "rgba(255,255,255,0.35)",
    fontSize: "13px",
    textDecoration: "none",
  },
  loadingPlans: {
    textAlign: "center",
    padding: "60px",
    color: "rgba(255,255,255,0.3)",
    fontSize: "16px",
  },
};

const PLAN_COLORS = {
  basic: "#6B7280",
  starter: "#3B82F6",
  pro: "#F5C300",
  enterprise: "#8B5CF6",
};

const PLAN_NAMES_MAP = {
  basic: "basic",
  starter: "starter",
  pro: "pro",
  enterprise: "enterprise",
};

function getPlanColor(planName) {
  if (!planName) return "#6B7280";
  const lower = planName.toLowerCase();
  if (lower.includes("enterprise") || lower.includes("premium")) return PLAN_COLORS.enterprise;
  if (lower.includes("pro")) return PLAN_COLORS.pro;
  if (lower.includes("starter") || lower.includes("start")) return PLAN_COLORS.starter;
  return PLAN_COLORS.basic;
}

function isPopularPlan(planName) {
  if (!planName) return false;
  return planName.toLowerCase().includes("pro");
}

function formatPrice(price) {
  if (!price && price !== 0) return "—";
  return `R$ ${Number(price).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatLimit(val) {
  if (!val && val !== 0) return "Ilimitado";
  if (Number(val) === -1 || Number(val) === 0) return "Ilimitado";
  return val;
}

const FEATURES = [
  { key: "use_campaigns", label: "Campanhas" },
  { key: "use_schedules", label: "Agendamentos" },
  { key: "use_internal_chat", label: "Chat Interno" },
  { key: "use_kanban", label: "Kanban" },
  { key: "use_openai", label: "IA / OpenAI" },
  { key: "use_external_api", label: "API Externa" },
  { key: "use_facebook", label: "Facebook" },
  { key: "use_instagram", label: "Instagram" },
];

const DAPE_MODULE_LABELS = {
  pipeline: "Pipeline",
  analytics: "Analytics",
  growth: "Growth",
  intelligence: "Intelligence",
  radar: "Radar",
  forecast: "Forecast",
  crm: "CRM",
  campaigns: "Campaigns",
};

function getModuleLabel(key) {
  return DAPE_MODULE_LABELS[key] || key;
}

const PlanCard = ({ plan, history }) => {
  const color = getPlanColor(plan.name);
  const popular = isPopularPlan(plan.name);
  const modules = Array.isArray(plan.modules) ? plan.modules : [];

  return (
    <div
      style={{
        ...styles.planCard,
        ...(popular ? styles.planCardPopular : {}),
      }}
    >
      {popular && <div style={styles.popularBadge}>⭐ Mais Popular</div>}
      <div style={{ ...styles.planColorBar, background: `linear-gradient(90deg, ${color}, ${color}aa)` }} />
      <div style={{ ...styles.planName, color }}>{plan.name}</div>
      <div style={styles.planDesc}>{plan.description || "Plano ideal para sua empresa"}</div>

      <div style={styles.planPrice}>
        <span style={{ ...styles.planPriceValue, color: popular ? "#F5C300" : "#ffffff" }}>
          {formatPrice(plan.price_monthly)}
        </span>
        <span style={styles.planPriceSuffix}>por mês</span>
      </div>

      <div style={styles.planDivider} />

      <div style={styles.planSectionTitle}>Limites</div>
      <ul style={styles.planLimitsList}>
        <li style={styles.planLimitItem}>
          <span style={styles.planLimitIcon}>👤</span>
          <span><strong>{formatLimit(plan.max_users)}</strong> usuários</span>
        </li>
        <li style={styles.planLimitItem}>
          <span style={styles.planLimitIcon}>🔌</span>
          <span><strong>{formatLimit(plan.max_connections)}</strong> conexões</span>
        </li>
        <li style={styles.planLimitItem}>
          <span style={styles.planLimitIcon}>📋</span>
          <span><strong>{formatLimit(plan.max_queues)}</strong> filas</span>
        </li>
        <li style={styles.planLimitItem}>
          <span style={styles.planLimitIcon}>👥</span>
          <span><strong>{formatLimit(plan.max_contacts)}</strong> contatos</span>
        </li>
      </ul>

      <div style={styles.planDivider} />

      <div style={styles.planSectionTitle}>Funcionalidades</div>
      <ul style={styles.planFeaturesList}>
        {FEATURES.map(f => {
          const enabled = Boolean(plan[f.key]);
          return (
            <li key={f.key} style={styles.planFeatureItem}>
              <span style={enabled ? styles.planFeatureCheck : styles.planFeatureCross}>
                {enabled ? "✓" : "✗"}
              </span>
              <span style={enabled ? styles.planFeatureText : styles.planFeatureTextDisabled}>
                {f.label}
              </span>
            </li>
          );
        })}
      </ul>

      {modules.length > 0 && (
        <>
          <div style={styles.planDivider} />
          <div style={styles.planSectionTitle}>Módulos DAPE</div>
          <div style={styles.modulesList}>
            {modules.map(m => (
              <span key={m} style={styles.moduleBadge}>{getModuleLabel(m)}</span>
            ))}
          </div>
        </>
      )}

      <RouterLink
        to={`/signup?planId=${plan.id}`}
        style={{
          ...styles.planBtn,
          ...(popular ? styles.planBtnPopular : styles.planBtnDefault),
        }}
      >
        Assinar Agora
      </RouterLink>
    </div>
  );
};

const Landing = () => {
  const history = useHistory();
  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansError, setPlansError] = useState(false);

  useEffect(() => {
    openApi
      .get("/plans/landing")
      .then(res => {
        setPlans(res.data || []);
        setPlansLoading(false);
      })
      .catch(() => {
        setPlansError(true);
        setPlansLoading(false);
      });
  }, []);

  return (
    <div style={styles.root}>
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-16px); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        body { margin: 0; }
        a:hover { opacity: 0.85; }
        .plan-card:hover { transform: translateY(-4px); box-shadow: 0 20px 60px rgba(0,0,0,0.4); }
        .feature-card:hover { border-color: rgba(245,195,0,0.2) !important; transform: translateY(-4px); box-shadow: 0 16px 48px rgba(0,0,0,0.4); }
      `}</style>

      {/* NAVBAR */}
      <nav style={styles.navbar}>
        <img src={logo} alt="DAPLE" style={styles.navLogo} />
        <div style={styles.navActions}>
          <RouterLink to="/login" style={styles.btnOutline}>Entrar</RouterLink>
          <RouterLink to="/signup" style={styles.btnSolid}>Começar Agora →</RouterLink>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ paddingTop: "70px", background: "linear-gradient(180deg, #0f0f0f 0%, #111111 100%)", position: "relative", overflow: "hidden" }}>
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
          backgroundImage: "radial-gradient(circle at 20% 50%, rgba(245,195,0,0.05) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(245,195,0,0.04) 0%, transparent 50%)",
          pointerEvents: "none",
        }} />
        <div style={styles.hero}>
          <div style={styles.heroContent}>
            <div style={styles.heroBadge}>
              <span>⚡</span> Plataforma de Inteligência Comercial
            </div>
            <h1 style={styles.heroTitle}>
              <span style={styles.heroGradientText}>Inteligência</span><br />
              Comercial que<br />
              Transforma Resultados
            </h1>
            <p style={styles.heroSubtitle}>
              Automatize seu atendimento, gerencie pipelines e tome decisões com dados em tempo real. O DAPLE é a plataforma completa para empresas que querem crescer.
            </p>
            <div style={styles.heroButtons}>
              <RouterLink to="/signup" style={styles.btnHeroPrimary}>
                🚀 Começar Gratuitamente
              </RouterLink>
              <a href="#planos" style={styles.btnHeroSecondary}>
                Ver Planos ↓
              </a>
            </div>
            <div style={styles.heroStats}>
              <div style={styles.statItem}>
                <span style={styles.statNum}>+500</span>
                <span style={styles.statLabel}>Empresas</span>
              </div>
              <div style={styles.statItem}>
                <span style={styles.statNum}>3</span>
                <span style={styles.statLabel}>Canais integrados</span>
              </div>
              <div style={styles.statItem}>
                <span style={styles.statNum}>7</span>
                <span style={styles.statLabel}>Módulos DAPE</span>
              </div>
              <div style={styles.statItem}>
                <span style={styles.statNum}>99.9%</span>
                <span style={styles.statLabel}>Uptime</span>
              </div>
            </div>
          </div>

          <div style={styles.heroVisual}>
            <div style={styles.sammyWrapper}>
              <div style={styles.heroDecorRing2} />
              <div style={styles.heroDecorRing} />
              <div style={styles.sammyGlow} />
              <img
                src={sammy}
                alt="DAPLE Mascote"
                style={{ ...styles.sammyImg, animation: "float 3s ease-in-out infinite" }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section style={{ ...styles.section, paddingTop: "100px" }}>
        <span style={styles.sectionLabel}>Recursos</span>
        <h2 style={styles.sectionTitle}>Tudo que você precisa para crescer</h2>
        <p style={styles.sectionSubtitle}>
          Do atendimento ao cliente à inteligência de mercado, o DAPLE oferece ferramentas completas para seu negócio.
        </p>

        <div style={styles.featuresGrid}>
          {[
            {
              icon: "📊",
              title: "Pipeline de Vendas",
              desc: "Visualize e gerencie seu funil de vendas com kanban intuitivo. Acompanhe cada oportunidade do início ao fechamento.",
            },
            {
              icon: "📈",
              title: "Analytics em Tempo Real",
              desc: "Dashboards completos com métricas de atendimento, conversão e performance da sua equipe em tempo real.",
            },
            {
              icon: "🤖",
              title: "IA Integrada",
              desc: "Utilize inteligência artificial para automatizar respostas, classificar leads e gerar insights estratégicos.",
            },
            {
              icon: "⚡",
              title: "Automação Inteligente",
              desc: "Crie fluxos automáticos de atendimento e campanhas. Economize tempo e aumente a eficiência da equipe.",
            },
            {
              icon: "🎯",
              title: "Inteligência de Mercado",
              desc: "Analise tendências, comportamento de clientes e oportunidades de mercado com dados precisos e atualizados.",
            },
            {
              icon: "🔭",
              title: "Radar de Oportunidades",
              desc: "Identifique leads quentes, detecte padrões de compra e antecipe demandas antes da concorrência.",
            },
          ].map((feat, i) => (
            <div key={i} className="feature-card" style={{ ...styles.featureCard, transition: "all 0.3s" }}>
              <span style={styles.featureIcon}>{feat.icon}</span>
              <div style={styles.featureTitle}>{feat.title}</div>
              <div style={styles.featureDesc}>{feat.desc}</div>
              <div style={styles.featureAccent} />
            </div>
          ))}
        </div>
      </section>

      {/* PLANS */}
      <section id="planos" style={styles.plansSection}>
        <div style={styles.plansBg} />
        <div style={styles.plansInner}>
          <span style={styles.sectionLabel}>Planos</span>
          <h2 style={{ ...styles.sectionTitle, marginBottom: "16px" }}>Escolha seu Plano</h2>
          <p style={styles.sectionSubtitle}>
            Planos flexíveis para empresas de todos os tamanhos. Comece pequeno e escale conforme seu negócio cresce.
          </p>

          {plansLoading && (
            <div style={styles.loadingPlans}>
              <span style={{ animation: "pulse 1.5s ease-in-out infinite", display: "inline-block" }}>
                ⏳ Carregando planos...
              </span>
            </div>
          )}

          {plansError && (
            <div style={styles.loadingPlans}>
              <span>⚠️ Não foi possível carregar os planos. <RouterLink to="/signup" style={{ color: "#F5C300" }}>Criar conta</RouterLink></span>
            </div>
          )}

          {!plansLoading && !plansError && plans.length === 0 && (
            <div style={styles.loadingPlans}>
              <span>Nenhum plano disponível no momento.</span>
            </div>
          )}

          {!plansLoading && plans.length > 0 && (
            <div style={styles.plansGrid}>
              {plans.map(plan => (
                <PlanCard key={plan.id} plan={plan} history={history} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section style={styles.ctaSection}>
        <div style={styles.ctaDecor1} />
        <div style={styles.ctaDecor2} />
        <div style={styles.ctaInner}>
          <h2 style={styles.ctaTitle}>Pronto para transformar seu atendimento?</h2>
          <p style={styles.ctaSubtitle}>
            Junte-se a mais de 500 empresas que já usam o DAPLE para crescer mais rápido, atender melhor e vender mais.
          </p>
          <RouterLink to="/signup" style={styles.ctaBtn}>
            🚀 Começar Gratuitamente
          </RouterLink>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={styles.footer}>
        <img src={logo} alt="DAPLE" style={styles.footerLogo} />
        <span style={styles.footerText}>© {new Date().getFullYear()} DAPLE — Inteligência Comercial. Todos os direitos reservados.</span>
        <div style={styles.footerLinks}>
          <RouterLink to="/login" style={styles.footerLink}>Entrar</RouterLink>
          <RouterLink to="/signup" style={styles.footerLink}>Criar conta</RouterLink>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
