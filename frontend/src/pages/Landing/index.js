import React, { useState, useEffect } from "react";
import { useHistory, Link as RouterLink } from "react-router-dom";
import { openApi } from "../../services/api";
import logo from "../../assets/daple-logo.png";
import dapleMascote from "../../assets/daple-mascote.png";
import dapleAnalisando from "../../assets/daple-analisando.png";
import dapleComemorando from "../../assets/daple-comemorando.png";
import dapleDecolando from "../../assets/daple-decolando.png";
import dapleFoguete from "../../assets/daple-foguete.png";

// ─── RESPONSIVE BREAKPOINTS ──────────────────────────────────────────────────
// Usamos CSS-in-JS com media queries via <style> tag injetada no componente.
// As classes responsivas são definidas no bloco <style> dentro do JSX.
// ─────────────────────────────────────────────────────────────────────────────

const styles = {
  root: {
    minHeight: "100vh",
    background: "#0f0f0f",
    color: "#ffffff",
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    overflowX: "hidden",
  },

  // ── NAVBAR ──────────────────────────────────────────────────────────────────
  navbar: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 clamp(16px, 4vw, 48px)",
    height: "64px",
    background: "rgba(15,15,15,0.97)",
    backdropFilter: "blur(12px)",
    borderBottom: "1px solid rgba(245,195,0,0.15)",
    boxShadow: "0 4px 30px rgba(0,0,0,0.5)",
  },
  navLogo: {
    height: "44px",
    maxWidth: "140px",
    objectFit: "contain",
  },
  navActions: {
    display: "flex",
    gap: "10px",
    alignItems: "center",
  },
  btnOutline: {
    padding: "8px 18px",
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
    whiteSpace: "nowrap",
  },
  btnSolid: {
    padding: "8px 18px",
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
    whiteSpace: "nowrap",
  },

  // ── HERO ────────────────────────────────────────────────────────────────────
  heroSection: {
    paddingTop: "64px",
    background: "linear-gradient(180deg, #0f0f0f 0%, #111111 100%)",
    position: "relative",
    overflow: "hidden",
  },
  heroBg: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundImage:
      "radial-gradient(circle at 20% 50%, rgba(245,195,0,0.06) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(245,195,0,0.04) 0%, transparent 50%)",
    pointerEvents: "none",
  },
  hero: {
    padding: "clamp(40px, 8vw, 100px) clamp(16px, 5vw, 48px) clamp(40px, 6vw, 80px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    maxWidth: "1200px",
    margin: "0 auto",
    gap: "40px",
    position: "relative",
    zIndex: 1,
  },
  heroContent: {
    flex: 1,
    minWidth: 0,
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
    marginBottom: "24px",
  },
  heroTitle: {
    fontSize: "clamp(32px, 5.5vw, 64px)",
    fontWeight: 800,
    lineHeight: 1.1,
    marginBottom: "20px",
    letterSpacing: "-1px",
  },
  heroGradientText: {
    background: "linear-gradient(90deg, #F5C300, #ff9500)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  },
  heroSubtitle: {
    fontSize: "clamp(15px, 2vw, 18px)",
    color: "rgba(255,255,255,0.6)",
    lineHeight: 1.7,
    marginBottom: "36px",
    maxWidth: "520px",
  },
  heroButtons: {
    display: "flex",
    gap: "14px",
    flexWrap: "wrap",
    marginBottom: "48px",
  },
  btnHeroPrimary: {
    padding: "14px clamp(20px, 3vw, 36px)",
    borderRadius: "12px",
    border: "none",
    background: "linear-gradient(90deg, #F5C300, #e6b000)",
    color: "#1a1a1a",
    fontWeight: 800,
    fontSize: "clamp(14px, 1.5vw, 16px)",
    cursor: "pointer",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    boxShadow: "0 8px 32px rgba(245,195,0,0.4)",
    transition: "all 0.3s",
    minHeight: "48px",
  },
  btnHeroSecondary: {
    padding: "14px clamp(20px, 3vw, 36px)",
    borderRadius: "12px",
    border: "1.5px solid rgba(255,255,255,0.2)",
    background: "rgba(255,255,255,0.05)",
    color: "#ffffff",
    fontWeight: 600,
    fontSize: "clamp(14px, 1.5vw, 16px)",
    cursor: "pointer",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    minHeight: "48px",
  },
  heroStats: {
    display: "flex",
    gap: "clamp(16px, 3vw, 32px)",
    flexWrap: "wrap",
  },
  statItem: {
    textAlign: "center",
  },
  statNum: {
    fontSize: "clamp(22px, 3vw, 28px)",
    fontWeight: 800,
    color: "#F5C300",
    display: "block",
  },
  statLabel: {
    fontSize: "11px",
    color: "rgba(255,255,255,0.5)",
    textTransform: "uppercase",
    letterSpacing: "1px",
  },
  heroVisual: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    flexShrink: 0,
  },
  sammyWrapper: {
    position: "relative",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  sammyGlow: {
    position: "absolute",
    width: "280px",
    height: "280px",
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(245,195,0,0.25) 0%, transparent 70%)",
    pointerEvents: "none",
  },
  heroDecorRing: {
    position: "absolute",
    width: "360px",
    height: "360px",
    borderRadius: "50%",
    border: "1px solid rgba(245,195,0,0.1)",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    pointerEvents: "none",
  },
  heroDecorRing2: {
    position: "absolute",
    width: "480px",
    height: "480px",
    borderRadius: "50%",
    border: "1px solid rgba(245,195,0,0.05)",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    pointerEvents: "none",
  },

  // ── SECTIONS ─────────────────────────────────────────────────────────────────
  section: {
    padding: "clamp(48px, 8vw, 96px) clamp(16px, 5vw, 48px)",
    maxWidth: "1200px",
    margin: "0 auto",
  },
  sectionTitle: {
    fontSize: "clamp(26px, 4vw, 40px)",
    fontWeight: 800,
    textAlign: "center",
    marginBottom: "16px",
    letterSpacing: "-0.5px",
  },
  sectionSubtitle: {
    fontSize: "clamp(14px, 1.8vw, 17px)",
    color: "rgba(255,255,255,0.55)",
    textAlign: "center",
    marginBottom: "56px",
    maxWidth: "520px",
    margin: "0 auto 56px",
    lineHeight: 1.6,
  },
  sectionLabel: {
    display: "block",
    textAlign: "center",
    fontSize: "12px",
    fontWeight: 600,
    color: "#F5C300",
    textTransform: "uppercase",
    letterSpacing: "2px",
    marginBottom: "14px",
  },

  // ── FEATURES GRID ────────────────────────────────────────────────────────────
  featuresGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))",
    gap: "20px",
  },
  featureCard: {
    background: "linear-gradient(135deg, #1a1a1a 0%, #1e1e1e 100%)",
    borderRadius: "20px",
    padding: "clamp(20px, 3vw, 32px)",
    border: "1px solid rgba(255,255,255,0.06)",
    transition: "all 0.3s",
    cursor: "default",
  },
  featureIcon: {
    fontSize: "clamp(32px, 4vw, 44px)",
    marginBottom: "16px",
    display: "block",
    lineHeight: 1,
  },
  featureTitle: {
    fontSize: "clamp(15px, 1.8vw, 18px)",
    fontWeight: 700,
    color: "#ffffff",
    marginBottom: "10px",
  },
  featureDesc: {
    fontSize: "clamp(13px, 1.4vw, 14px)",
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

  // ── HOW IT WORKS ─────────────────────────────────────────────────────────────
  howSection: {
    padding: "clamp(48px, 8vw, 96px) clamp(16px, 5vw, 48px)",
    background: "linear-gradient(180deg, #0f0f0f 0%, #111111 100%)",
  },
  howGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
    gap: "24px",
    maxWidth: "1200px",
    margin: "0 auto",
  },
  howStep: {
    textAlign: "center",
    padding: "clamp(20px, 3vw, 32px) clamp(16px, 2vw, 24px)",
    background: "#1a1a1a",
    borderRadius: "16px",
    border: "1px solid rgba(255,255,255,0.06)",
  },
  howNum: {
    width: "48px",
    height: "48px",
    borderRadius: "50%",
    background: "linear-gradient(135deg, #F5C300, #e6b000)",
    color: "#1a1a1a",
    fontWeight: 800,
    fontSize: "20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 16px",
  },
  howTitle: {
    fontSize: "clamp(14px, 1.6vw, 16px)",
    fontWeight: 700,
    marginBottom: "8px",
    color: "#fff",
  },
  howDesc: {
    fontSize: "clamp(12px, 1.3vw, 13px)",
    color: "rgba(255,255,255,0.45)",
    lineHeight: 1.6,
  },

  // ── AI SECTION ───────────────────────────────────────────────────────────────
  aiSection: {
    padding: "clamp(48px, 8vw, 96px) clamp(16px, 5vw, 48px)",
    background: "#0a0a0a",
  },
  aiInner: {
    maxWidth: "1200px",
    margin: "0 auto",
  },
  aiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
    gap: "20px",
    marginTop: "48px",
  },
  aiCard: {
    background: "linear-gradient(135deg, #111 0%, #161616 100%)",
    borderRadius: "16px",
    padding: "clamp(18px, 2.5vw, 28px)",
    border: "1px solid rgba(245,195,0,0.1)",
  },
  aiCardIcon: {
    fontSize: "32px",
    marginBottom: "12px",
    display: "block",
  },
  aiCardTitle: {
    fontSize: "clamp(14px, 1.6vw, 16px)",
    fontWeight: 700,
    color: "#F5C300",
    marginBottom: "8px",
  },
  aiCardDesc: {
    fontSize: "clamp(12px, 1.3vw, 13px)",
    color: "rgba(255,255,255,0.5)",
    lineHeight: 1.6,
  },

  // ── PLANS ────────────────────────────────────────────────────────────────────
  plansSection: {
    padding: "clamp(48px, 8vw, 96px) clamp(16px, 5vw, 48px)",
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
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
    gap: "24px",
    alignItems: "start",
  },
  planCard: {
    background: "#1a1a1a",
    borderRadius: "20px",
    padding: "clamp(20px, 3vw, 32px) clamp(16px, 2.5vw, 28px)",
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
    fontSize: "clamp(18px, 2.5vw, 22px)",
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
    fontSize: "clamp(32px, 4vw, 42px)",
    fontWeight: 800,
    lineHeight: 1,
    display: "block",
  },
  planPriceSuffix: {
    fontSize: "13px",
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
    minHeight: "48px",
    boxSizing: "border-box",
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
    fontSize: "12px",
    fontWeight: 700,
    color: "rgba(255,255,255,0.4)",
    textTransform: "uppercase",
    letterSpacing: "1px",
    marginBottom: "10px",
  },

  // ── CTA ──────────────────────────────────────────────────────────────────────
  ctaSection: {
    background: "linear-gradient(135deg, #F5C300 0%, #e6b000 60%, #cc9900 100%)",
    padding: "clamp(48px, 8vw, 96px) clamp(16px, 5vw, 48px)",
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
    fontSize: "clamp(24px, 4vw, 42px)",
    fontWeight: 800,
    color: "#1a1a1a",
    marginBottom: "16px",
    lineHeight: 1.2,
    letterSpacing: "-0.5px",
  },
  ctaSubtitle: {
    fontSize: "clamp(14px, 1.8vw, 17px)",
    color: "rgba(0,0,0,0.65)",
    marginBottom: "36px",
    lineHeight: 1.6,
  },
  ctaBtn: {
    padding: "16px clamp(28px, 4vw, 48px)",
    borderRadius: "12px",
    border: "none",
    background: "#1a1a1a",
    color: "#F5C300",
    fontWeight: 800,
    fontSize: "clamp(14px, 1.6vw, 16px)",
    cursor: "pointer",
    textDecoration: "none",
    display: "inline-block",
    boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
    transition: "all 0.3s",
    minHeight: "52px",
    lineHeight: "20px",
  },

  // ── FOOTER ───────────────────────────────────────────────────────────────────
  footer: {
    background: "#0a0a0a",
    padding: "clamp(24px, 4vw, 40px) clamp(16px, 5vw, 48px)",
    borderTop: "1px solid rgba(255,255,255,0.06)",
  },
  footerTop: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: "32px",
    maxWidth: "1200px",
    margin: "0 auto 32px",
  },
  footerBrand: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    maxWidth: "260px",
  },
  footerLogo: {
    height: "40px",
    objectFit: "contain",
    opacity: 0.8,
  },
  footerTagline: {
    color: "rgba(255,255,255,0.35)",
    fontSize: "13px",
    lineHeight: 1.5,
  },
  footerCol: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  footerColTitle: {
    color: "rgba(255,255,255,0.6)",
    fontSize: "12px",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "1px",
    marginBottom: "4px",
  },
  footerLink: {
    color: "rgba(255,255,255,0.35)",
    fontSize: "13px",
    textDecoration: "none",
    transition: "color 0.2s",
  },
  footerBottom: {
    borderTop: "1px solid rgba(255,255,255,0.05)",
    paddingTop: "20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: "12px",
    maxWidth: "1200px",
    margin: "0 auto",
  },
  footerText: {
    color: "rgba(255,255,255,0.25)",
    fontSize: "12px",
  },
  loadingPlans: {
    textAlign: "center",
    padding: "60px",
    color: "rgba(255,255,255,0.3)",
    fontSize: "16px",
  },
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const PLAN_COLORS = {
  basic: "#6B7280",
  starter: "#3B82F6",
  pro: "#F5C300",
  enterprise: "#8B5CF6",
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
  { key: "_whatsapp",       label: "WhatsApp",        always: true },
  { key: "use_instagram",   label: "Instagram" },
  { key: "use_facebook",    label: "Facebook" },
  { key: "use_campaigns",   label: "Campanhas" },
  { key: "use_schedules",   label: "Agendamentos" },
  { key: "use_internal_chat", label: "Chat Interno" },
  { key: "use_kanban",      label: "Kanban Nativo" },
  { key: "use_openai",      label: "IA / Multi-Provider" },
  { key: "use_external_api", label: "API Externa" },
];

const DAPE_MODULE_LABELS = {
  pipeline:     "📊 Pipeline",
  analytics:    "📈 Analytics",
  growth:       "🚀 Growth",
  intelligence: "🏢 Intelligence",
  radar:        "📡 Radar",
  ia:           "🤖 IA Avançada",
  forecast:     "🔮 Forecast",
  crm:          "🗂️ CRM",
};

function getModuleLabel(key) {
  return DAPE_MODULE_LABELS[key] || key;
}

const PLAN_TAGLINES = {
  "Basic":      "Para quem quer começar com o pé direito.",
  "Starter":    "Decole suas vendas com inteligência.",
  "Pro":        "Escale resultados com dados reais.",
  "Enterprise": "Domine o mercado sem limites.",
};

const PLAN_MASCOTS = {
  "Basic":      dapleMascote,
  "Starter":    dapleAnalisando,
  "Pro":        dapleComemorando,
  "Enterprise": dapleFoguete,
};

// ─── PLAN CARD ───────────────────────────────────────────────────────────────

const PlanCard = ({ plan, history }) => {
  const color = getPlanColor(plan.name);
  const popular = isPopularPlan(plan.name);
  const modules = Array.isArray(plan.modules) ? plan.modules : [];
  const tagline = PLAN_TAGLINES[plan.name];
  const mascotImg = PLAN_MASCOTS[plan.name];

  return (
    <div
      className="plan-card"
      style={{
        ...styles.planCard,
        ...(popular ? styles.planCardPopular : {}),
      }}
    >
      {popular && <div style={styles.popularBadge}>⭐ Mais Popular</div>}
      {mascotImg && (
        <div style={{ position: "absolute", top: "16px", right: "16px", opacity: 0.9 }}>
          <img src={mascotImg} alt="DAPLE mascote" style={{ width: "56px" }} />
        </div>
      )}
      <div style={{ ...styles.planColorBar, background: `linear-gradient(90deg, ${color}, ${color}aa)` }} />
      <div style={{ ...styles.planName, color }}>{plan.name}</div>
      {tagline && (
        <div style={{ fontSize: "13px", fontStyle: "italic", color: "rgba(255,255,255,0.6)", marginBottom: "8px" }}>
          {tagline}
        </div>
      )}
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
          const enabled = f.always ? true : Boolean(plan[f.key]);
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
          <div style={styles.planSectionTitle}>Módulos DAPLE</div>
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

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

const Landing = () => {
  const history = useHistory();
  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansError, setPlansError] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

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
      {/* ── GLOBAL STYLES + RESPONSIVE ── */}
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-16px); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        a:hover { opacity: 0.85; }
        .plan-card:hover { transform: translateY(-4px) !important; box-shadow: 0 20px 60px rgba(0,0,0,0.4) !important; }
        .feature-card:hover { border-color: rgba(245,195,0,0.2) !important; transform: translateY(-4px); box-shadow: 0 16px 48px rgba(0,0,0,0.4); }
        .footer-link:hover { color: #F5C300 !important; }

        /* ── MOBILE (≤ 640px) ── */
        @media (max-width: 640px) {
          .hero-layout { flex-direction: column !important; text-align: center; }
          .hero-visual { display: none !important; }
          .hero-stats { justify-content: center !important; }
          .hero-subtitle { max-width: 100% !important; margin-left: auto; margin-right: auto; }
          .hero-buttons { justify-content: center !important; }
          .nav-actions .btn-text { display: none; }
          .nav-actions .btn-icon-only { display: inline-flex !important; }
          .mobile-menu-btn { display: flex !important; }
          .mobile-menu { display: flex !important; }
          .footer-top { flex-direction: column !important; }
          .footer-col-hide { display: none !important; }
        }

        /* ── TABLET (641px – 1024px) ── */
        @media (min-width: 641px) and (max-width: 1024px) {
          .hero-layout { gap: 24px !important; }
          .hero-visual img { width: 200px !important; }
          .sammyGlow { width: 200px !important; height: 200px !important; }
          .heroDecorRing { width: 260px !important; height: 260px !important; }
          .heroDecorRing2 { width: 340px !important; height: 340px !important; }
        }

        /* ── DESKTOP (> 1024px) ── */
        @media (min-width: 1025px) {
          .hero-visual { display: flex !important; }
        }
      `}</style>

      {/* ── NAVBAR ── */}
      <nav style={styles.navbar}>
        <img src={logo} alt="DAPLE" style={styles.navLogo} />
        <div style={styles.navActions} className="nav-actions">
          <RouterLink to="/login" style={styles.btnOutline}>Entrar</RouterLink>
          <RouterLink to="/signup" style={styles.btnSolid}>Começar Agora →</RouterLink>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={styles.heroSection}>
        <div style={styles.heroBg} />
        <div style={styles.hero} className="hero-layout">
          {/* Conteúdo */}
          <div style={styles.heroContent}>
            <div style={styles.heroBadge}>
              <span>⚡</span> Plataforma de Inteligência Comercial
            </div>
            <h1 style={styles.heroTitle}>
              <span style={styles.heroGradientText}>Inteligência</span><br />
              Comercial que<br />
              Transforma Resultados
            </h1>
            <p style={styles.heroSubtitle} className="hero-subtitle">
              Atendimento multicanal, CRM com funil Kanban, agentes de IA e analytics em tempo real.
              O DAPLE é a plataforma completa para empresas que querem crescer de verdade.
            </p>
            <div style={styles.heroButtons} className="hero-buttons">
              <RouterLink to="/signup" style={styles.btnHeroPrimary}>
                Assinar um Plano →
              </RouterLink>
              <a href="#planos" style={styles.btnHeroSecondary}>
                Ver Planos ↓
              </a>
            </div>
            <div style={styles.heroStats} className="hero-stats">
              <div style={styles.statItem}>
                <span style={styles.statNum}>3</span>
                <span style={styles.statLabel}>Canais</span>
              </div>
              <div style={styles.statItem}>
                <span style={styles.statNum}>8</span>
                <span style={styles.statLabel}>Módulos DAPLE</span>
              </div>
              <div style={styles.statItem}>
                <span style={styles.statNum}>4</span>
                <span style={styles.statLabel}>Provedores IA</span>
              </div>
              <div style={styles.statItem}>
                <span style={styles.statNum}>99.9%</span>
                <span style={styles.statLabel}>Uptime</span>
              </div>
            </div>
          </div>

          {/* Visual */}
          <div style={styles.heroVisual} className="hero-visual">
            <div style={styles.sammyWrapper}>
              <div style={styles.heroDecorRing2} className="heroDecorRing2" />
              <div style={styles.heroDecorRing} className="heroDecorRing" />
              <div style={styles.sammyGlow} className="sammyGlow" />
              <img
                src={dapleFoguete}
                alt="DAPLE Mascote"
                style={{
                  width: "clamp(180px, 20vw, 280px)",
                  position: "relative",
                  zIndex: 1,
                  filter: "drop-shadow(0 16px 48px rgba(245,195,0,0.3))",
                  animation: "float 3s ease-in-out infinite",
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section style={styles.section}>
        <span style={styles.sectionLabel}>Recursos</span>
        <h2 style={styles.sectionTitle}>Tudo que você precisa para crescer</h2>
        <p style={styles.sectionSubtitle}>
          Do atendimento ao cliente à inteligência de mercado, o DAPLE oferece ferramentas completas
          para escalar o seu negócio.
        </p>

        <div style={styles.featuresGrid}>
          {[
            {
              icon: "💬",
              title: "Atendimento Multicanal",
              desc: "WhatsApp, Instagram e Facebook em uma única tela. Histórico unificado, filas inteligentes e transferência entre atendentes.",
            },
            {
              icon: "📊",
              title: "Pipeline & Kanban de Vendas",
              desc: "Transforme conversas em negócios. Gerencie seu funil de vendas com quadro Kanban visual, estágios personalizados e valor estimado.",
            },
            {
              icon: "📈",
              title: "Analytics em Tempo Real",
              desc: "Dashboards com TMA, TME, taxa de conversão, volume por canal e performance da equipe. Decida com dados, não com achismos.",
            },
            {
              icon: "🤖",
              title: "IA Multi-Provider",
              desc: "OpenAI (GPT-4o), Claude (Anthropic), Gemini (Google) e Manus integrados. Resumo de conversa, sugestão de resposta e resposta em áudio.",
            },
            {
              icon: "⚡",
              title: "Flow Builder & Automação",
              desc: "Crie chatbots visuais sem código. Fluxos de triagem, campanhas automáticas e agendamento de mensagens para qualquer contato.",
            },
            {
              icon: "🎯",
              title: "Intelligence & Lead Score",
              desc: "Diagnóstico automático de clientes com score de temperatura (Hot/Warm/Cold). Identifique os leads mais propensos a fechar.",
            },
            {
              icon: "🚀",
              title: "Growth & Metas",
              desc: "Defina metas de leads, reuniões e contratos. Acompanhe o progresso da equipe em barras visuais e ajuste a estratégia em tempo real.",
            },
            {
              icon: "📡",
              title: "Radar de Oportunidades",
              desc: "Capture e gerencie oportunidades de mercado. Converta prospectos em contatos do CRM com um clique.",
            },
          ].map((feat, i) => (
            <div key={i} className="feature-card" style={styles.featureCard}>
              <span style={styles.featureIcon}>{feat.icon}</span>
              <div style={styles.featureTitle}>{feat.title}</div>
              <div style={styles.featureDesc}>{feat.desc}</div>
              <div style={styles.featureAccent} />
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section style={styles.howSection}>
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <span style={styles.sectionLabel}>Como Funciona</span>
          <h2 style={styles.sectionTitle}>Em 4 passos você está operando</h2>
          <p style={{ ...styles.sectionSubtitle, marginBottom: "48px" }}>
            Configuração simples, resultado imediato. Sem precisar de TI ou conhecimento técnico.
          </p>
          <div style={styles.howGrid}>
            {[
              { n: "1", title: "Crie sua conta", desc: "Escolha um plano, preencha os dados da empresa e acesse o painel em menos de 2 minutos." },
              { n: "2", title: "Conecte seus canais", desc: "Escaneie o QR Code do WhatsApp, conecte Instagram e Facebook com poucos cliques." },
              { n: "3", title: "Configure sua equipe", desc: "Crie filas, adicione atendentes e defina as permissões de cada um." },
              { n: "4", title: "Comece a atender", desc: "Receba mensagens, use a IA para responder mais rápido e acompanhe tudo no dashboard." },
            ].map((step, i) => (
              <div key={i} style={styles.howStep}>
                <div style={styles.howNum}>{step.n}</div>
                <div style={styles.howTitle}>{step.title}</div>
                <div style={styles.howDesc}>{step.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── IA SECTION ── */}
      <section style={styles.aiSection}>
        <div style={styles.aiInner}>
          <span style={styles.sectionLabel}>Inteligência Artificial</span>
          <h2 style={styles.sectionTitle}>Agentes de IA que trabalham por você</h2>
          <p style={{ ...styles.sectionSubtitle, marginBottom: "0" }}>
            O DAPLE não apenas usa IA — ele possui agentes especializados que atuam de forma autônoma
            ou assistida, dependendo da sua configuração.
          </p>
          <div style={styles.aiGrid}>
            {[
              {
                icon: "🧠",
                title: "Resumo Automático",
                desc: "A IA lê toda a conversa e entrega um resumo em segundos. Perfeito para quando você assume um ticket de outro atendente.",
              },
              {
                icon: "💡",
                title: "Sugestão de Resposta",
                desc: "3 opções de resposta geradas em tempo real com base no contexto da conversa e no perfil da empresa.",
              },
              {
                icon: "🎙️",
                title: "Resposta em Áudio (TTS)",
                desc: "Transforme a sugestão da IA em áudio natural (OGG/Opus) e envie diretamente ao cliente pelo WhatsApp.",
              },
              {
                icon: "🤝",
                title: "SDR IA",
                desc: "Agente que qualifica leads automaticamente ao receber novas mensagens, classificando o interesse e o estágio de compra.",
              },
              {
                icon: "📊",
                title: "Pipeline IA",
                desc: "Lê as conversas do WhatsApp e avança o negócio (Deal) no funil do Kanban de forma automática ou assistida.",
              },
              {
                icon: "🔄",
                title: "Multi-Provider",
                desc: "Use OpenAI, Claude (Anthropic), Gemini (Google) ou Manus. Troque de provedor sem perder histórico ou configurações.",
              },
            ].map((item, i) => (
              <div key={i} style={styles.aiCard}>
                <span style={styles.aiCardIcon}>{item.icon}</span>
                <div style={styles.aiCardTitle}>{item.title}</div>
                <div style={styles.aiCardDesc}>{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PLANS ── */}
      <section id="planos" style={styles.plansSection}>
        <div style={styles.plansBg} />
        <div style={styles.plansInner}>
          <span style={styles.sectionLabel}>Planos</span>
          <h2 style={{ ...styles.sectionTitle, marginBottom: "16px" }}>Escolha seu Plano</h2>
          <p style={styles.sectionSubtitle}>
            Planos flexíveis para empresas de todos os tamanhos. Comece pequeno e escale conforme
            seu negócio cresce.
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
              <span>
                ⚠️ Não foi possível carregar os planos.{" "}
                <RouterLink to="/signup" style={{ color: "#F5C300" }}>Criar conta</RouterLink>
              </span>
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

      {/* ── CTA ── */}
      <section style={styles.ctaSection}>
        <div style={styles.ctaDecor1} />
        <div style={styles.ctaDecor2} />
        <div style={styles.ctaInner}>
          <img src={dapleDecolando} alt="DAPLE decolando" style={{ width: "clamp(80px, 10vw, 120px)", marginBottom: "16px" }} />
          <h2 style={styles.ctaTitle}>Pronto para transformar seu atendimento?</h2>
          <p style={styles.ctaSubtitle}>
            Junte-se às empresas que já usam o DAPLE para crescer mais rápido, atender melhor
            e vender mais com inteligência artificial.
          </p>
          <RouterLink to="/signup" style={styles.ctaBtn}>
            Assinar um Plano →
          </RouterLink>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={styles.footer}>
        <div style={styles.footerTop} className="footer-top">
          {/* Brand */}
          <div style={styles.footerBrand}>
            <img src={logo} alt="DAPLE" style={styles.footerLogo} />
            <p style={styles.footerTagline}>
              Plataforma de inteligência comercial com atendimento multicanal, CRM e IA integrada.
            </p>
          </div>

          {/* Links */}
          <div style={styles.footerCol}>
            <div style={styles.footerColTitle}>Plataforma</div>
            <RouterLink to="/signup" style={styles.footerLink} className="footer-link">Criar conta</RouterLink>
            <RouterLink to="/login" style={styles.footerLink} className="footer-link">Entrar</RouterLink>
            <a href="#planos" style={styles.footerLink} className="footer-link">Ver Planos</a>
          </div>

          <div style={{ ...styles.footerCol }} className="footer-col-hide">
            <div style={styles.footerColTitle}>Módulos</div>
            <span style={{ ...styles.footerLink, cursor: "default" }}>Pipeline & Kanban</span>
            <span style={{ ...styles.footerLink, cursor: "default" }}>Analytics</span>
            <span style={{ ...styles.footerLink, cursor: "default" }}>Growth</span>
            <span style={{ ...styles.footerLink, cursor: "default" }}>Intelligence</span>
            <span style={{ ...styles.footerLink, cursor: "default" }}>Radar</span>
          </div>

          <div style={{ ...styles.footerCol }} className="footer-col-hide">
            <div style={styles.footerColTitle}>Canais</div>
            <span style={{ ...styles.footerLink, cursor: "default" }}>WhatsApp</span>
            <span style={{ ...styles.footerLink, cursor: "default" }}>Instagram</span>
            <span style={{ ...styles.footerLink, cursor: "default" }}>Facebook</span>
          </div>
        </div>

        <div style={styles.footerBottom}>
          <span style={styles.footerText}>
            © {new Date().getFullYear()} DAPLE — Inteligência Comercial. Todos os direitos reservados.
          </span>
          <span style={styles.footerText}>
            Versão 2.1 · Multi-Provider IA · Kanban · TTS
          </span>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
