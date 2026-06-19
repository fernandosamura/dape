import { useState, useEffect, useContext } from "react";
import api from "../services/api";
import { AuthContext } from "../context/Auth/AuthContext";

let cachedModules = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000;

export function useDapeModules() {
  const { user } = useContext(AuthContext);
  const [enabledModules, setEnabledModules] = useState(cachedModules?.enabledModules || []);
  const [modules, setModules] = useState(cachedModules?.modules || []);
  const [planFeatures, setPlanFeatures] = useState(cachedModules?.planFeatures || {});
  const [isLoading, setIsLoading] = useState(!cachedModules);

  useEffect(() => {
    if (!user?.id) return;
    const now = Date.now();
    if (cachedModules && now - cacheTime < CACHE_TTL) {
      setEnabledModules(cachedModules.enabledModules);
      setModules(cachedModules.modules);
      setIsLoading(false);
      return;
    }
    api.get("/dape/modules/my-access")
      .then(({ data }) => {
        cachedModules = data;
        cacheTime = Date.now();
        setEnabledModules(data.enabledModules || []);
        setModules(data.modules || []);
        setPlanFeatures(data.planFeatures || {});
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [user?.id]);

  const hasModule = (moduleKey) => enabledModules.includes(moduleKey);

  // Returns the operation_mode for a given module key, defaulting to 'assisted'
  const getModuleMode = (moduleKey) => {
    const mod = modules.find(m => m.module_key === moduleKey);
    return mod?.operation_mode || 'assisted';
  };

  // Map of moduleKey → operation_mode for convenient access
  const modulesModes = modules.reduce((acc, m) => {
    acc[m.module_key] = m.operation_mode || 'assisted';
    return acc;
  }, {});

  return {
    enabledModules,
    modules,
    modulesModes,
    planFeatures,
    hasModule,
    getModuleMode,
    isLoading,
    isMaster: hasModule("dape_pipeline") && hasModule("dape_radar"), // master has all
    hasPipeline:     hasModule("dape_pipeline"),
    hasAnalytics:    hasModule("dape_analytics"),
    hasIA:           hasModule("dape_ia"),
    hasGrowth:       hasModule("dape_growth"),
    hasIntelligence: hasModule("dape_intelligence"),
    hasRadar:        hasModule("dape_radar"),
    invalidateCache: () => { cachedModules = null; cacheTime = 0; },
  };
}
