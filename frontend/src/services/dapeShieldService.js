import api from "./api";

const dapeShieldService = {
  // GET /dape/shield/stats — overall stats across all connections
  getStats: () => api.get("/dape/shield/stats"),

  // GET /dape/shield/:whatsappId/status
  getStatus: (whatsappId) => api.get(`/dape/shield/${whatsappId}/status`),

  // GET /dape/shield/:whatsappId/config
  getConfig: (whatsappId) => api.get(`/dape/shield/${whatsappId}/config`),

  // PUT /dape/shield/:whatsappId/config
  updateConfig: (whatsappId, data) => api.put(`/dape/shield/${whatsappId}/config`, data),

  // GET /dape/shield/:whatsappId/audit
  getAuditLog: (whatsappId) => api.get(`/dape/shield/${whatsappId}/audit`),

  // DELETE /dape/shield/:whatsappId/quarantine
  releaseQuarantine: (whatsappId) => api.delete(`/dape/shield/${whatsappId}/quarantine`),
};

export default dapeShieldService;
