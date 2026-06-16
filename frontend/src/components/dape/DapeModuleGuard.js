import React from "react";
import { useDapeModules } from "../../hooks/useDapeModules";

/**
 * Renders children only if the module is enabled for the current tenant.
 * Usage: <DapeModuleGuard moduleKey="dape_pipeline"><ScoreWidget /></DapeModuleGuard>
 */
const DapeModuleGuard = ({ moduleKey, children, fallback = null }) => {
  const { hasModule, isLoading } = useDapeModules();
  if (isLoading) return null;
  if (!hasModule(moduleKey)) return fallback;
  return children;
};

export default DapeModuleGuard;
