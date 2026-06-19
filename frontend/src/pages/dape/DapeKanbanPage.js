import React, { useState, useEffect } from "react";
import { makeStyles, Typography, Button, IconButton, LinearProgress } from "@material-ui/core";
import useDeals from "../../hooks/useDeals";
import DealModal from "../../components/dape/DealModal";
import DapeModuleGuard from "../../components/dape/DapeModuleGuard";

const STAGES = [
  { key: "prospecting",   label: "Prospecção",  color: "#6366F1" },
  { key: "qualification", label: "Qualificação", color: "#F59E0B" },
  { key: "proposal",      label: "Proposta",     color: "#3B82F6" },
  { key: "negotiation",   label: "Negociação",   color: "#8B5CF6" },
  { key: "closing",       label: "Fechamento",   color: "#10B981" },
];

const useStyles = makeStyles((theme) => ({
  root: {
    padding: "20px 24px",
    [theme.breakpoints.down("sm")]: { padding: "12px 16px" },
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
    flexWrap: "wrap",
    gap: 12,
  },
  board: {
    display: "flex",
    gap: 16,
    overflowX: "auto",
    paddingBottom: 16,
    [theme.breakpoints.down("sm")]: {
      flexDirection: "column",
      overflowX: "visible",
    },
  },
  column: {
    minWidth: 240,
    flex: "0 0 240px",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 12,
    [theme.breakpoints.down("sm")]: {
      minWidth: "unset",
      flex: "unset",
      width: "100%",
    },
  },
  columnHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
    fontWeight: 700,
    fontSize: "0.875rem",
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: "10px 12px",
    marginBottom: 8,
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
    border: "1px solid #E2E8F0",
  },
  cardTitle: {
    fontWeight: 600,
    fontSize: "0.875rem",
    marginBottom: 4,
    color: "#1E293B",
  },
  cardValue: {
    fontSize: "0.8125rem",
    color: "#10B981",
    fontWeight: 600,
    marginBottom: 4,
  },
  cardContact: {
    fontSize: "0.75rem",
    color: "#64748B",
    marginBottom: 8,
  },
  cardActions: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 4,
  },
  badge: {
    padding: "2px 8px",
    borderRadius: 20,
    fontSize: "0.7rem",
    fontWeight: 600,
    color: "#FFF",
  },
}));

export default function DapeKanbanPage() {
  const classes = useStyles();
  const { deals, loading, fetchDeals, createDeal, updateDeal } = useDeals();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState(null);

  useEffect(() => { fetchDeals(); }, []);

  const dealsByStage = STAGES.reduce((acc, s) => {
    acc[s.key] = deals.filter(d => d.stage === s.key);
    return acc;
  }, {});

  const handleSave = async (data) => {
    try {
      if (selectedDeal) {
        await updateDeal(selectedDeal.id, data);
      } else {
        await createDeal(data);
      }
      await fetchDeals();
      setModalOpen(false);
      setSelectedDeal(null);
    } catch (err) {
      console.error("[DapeKanbanPage] save error:", err);
    }
  };

  const moveDeal = async (deal, direction) => {
    const stageKeys = STAGES.map(s => s.key);
    const currentIdx = stageKeys.indexOf(deal.stage);
    const nextIdx = currentIdx + direction;
    if (nextIdx < 0 || nextIdx >= stageKeys.length) return;
    await updateDeal(deal.id, { stage: stageKeys[nextIdx] });
    await fetchDeals();
  };

  return (
    <DapeModuleGuard moduleKey="dape_pipeline">
      <div className={classes.root}>
        {/* Header */}
        <div className={classes.header}>
          <Typography variant="h5" style={{ fontWeight: 700 }}>
            🏆 Funil de Vendas
          </Typography>
          <Button
            variant="contained"
            style={{ backgroundColor: "#22C55E", color: "#FFF", borderRadius: 8 }}
            onClick={() => { setSelectedDeal(null); setModalOpen(true); }}
          >
            + Novo Deal
          </Button>
        </div>

        {/* Loading */}
        {loading && <LinearProgress style={{ marginBottom: 16 }} />}

        {/* Kanban Board */}
        <div className={classes.board}>
          {STAGES.map((stage) => (
            <div key={stage.key} className={classes.column}>
              {/* Column header */}
              <div className={classes.columnHeader}>
                <div className={classes.colorDot} style={{ backgroundColor: stage.color }} />
                <span>{stage.label}</span>
                <span style={{ marginLeft: "auto", color: "#94A3B8", fontWeight: 400 }}>
                  {dealsByStage[stage.key].length}
                </span>
              </div>

              {/* Deal cards */}
              {dealsByStage[stage.key].map((deal) => (
                <div key={deal.id} className={classes.card}>
                  <div className={classes.cardTitle}>{deal.title}</div>
                  <div className={classes.cardValue}>
                    {Number(deal.value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </div>
                  {deal.contact && (
                    <div className={classes.cardContact}>👤 {deal.contact.name}</div>
                  )}
                  <div className={classes.cardActions}>
                    {/* Status badge */}
                    <span
                      className={classes.badge}
                      style={{
                        backgroundColor:
                          deal.status === "won" ? "#10B981" :
                          deal.status === "lost" ? "#EF4444" : "#6366F1",
                      }}
                    >
                      {deal.status === "won" ? "Ganho" : deal.status === "lost" ? "Perdido" : "Aberto"}
                    </span>
                    {/* Action buttons */}
                    <div style={{ display: "flex", gap: 4 }}>
                      <IconButton
                        size="small"
                        onClick={() => moveDeal(deal, -1)}
                        disabled={STAGES[0].key === deal.stage}
                        title="Voltar estágio"
                      >
                        ←
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => { setSelectedDeal(deal); setModalOpen(true); }}
                        title="Editar"
                      >
                        ✏️
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => moveDeal(deal, 1)}
                        disabled={STAGES[STAGES.length - 1].key === deal.stage}
                        title="Avançar estágio"
                      >
                        →
                      </IconButton>
                    </div>
                  </div>
                </div>
              ))}

              {/* Empty state */}
              {dealsByStage[stage.key].length === 0 && (
                <div style={{ textAlign: "center", color: "#CBD5E1", fontSize: "0.8rem", padding: "20px 0" }}>
                  Nenhum deal
                </div>
              )}
            </div>
          ))}
        </div>

        {/* DealModal */}
        <DealModal
          open={modalOpen}
          onClose={() => { setModalOpen(false); setSelectedDeal(null); }}
          onSave={handleSave}
          deal={selectedDeal}
        />
      </div>
    </DapeModuleGuard>
  );
}
