import React from "react";
import DapePipelineSummary from "../../components/dape/DapePipelineSummary";
import DapeModuleGuard from "../../components/dape/DapeModuleGuard";

export default function DapePipelinePage() {
  return (
    <DapeModuleGuard moduleKey="dape_pipeline" fallback={<div style={{ padding: 32, color: "#9CA3AF" }}>Módulo Pipeline não habilitado no seu plano.</div>}>
      <DapePipelineSummary />
    </DapeModuleGuard>
  );
}
