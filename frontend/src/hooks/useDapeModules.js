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
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [user?.id]);

  const hasModule = (moduleKey) => enabledModules.includes(moduleKey);

  return {
    enabledModules,
    modules,
    hasModule,
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
