// logger.error({ err }, ...) com um AxiosError bruto grava err.config.headers
// (inclui o Authorization: Bearer <token>) em texto puro no log - achado
// real durante investigacao de erro de envio de template (2026-08-29).
// Usar sempre que for logar um erro de chamada a Graph API/qualquer axios:
// mantem status/corpo da resposta (util pra diagnostico) e descarta
// headers/config, que e onde o token vaza.
export const sanitizeAxiosError = (err: unknown): unknown => {
  const anyErr = err as any;
  if (anyErr?.isAxiosError) {
    return {
      message: anyErr.message,
      status: anyErr.response?.status,
      data: anyErr.response?.data,
      url: anyErr.config?.url,
      method: anyErr.config?.method
    };
  }
  return err;
};
