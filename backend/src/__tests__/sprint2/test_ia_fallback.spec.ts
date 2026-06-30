/**
 * #073 — Fallback chain de IA provider
 *
 * Verifica a implementação do fallback chain no dapeIA.service.ts.
 */

import fs from "fs";
import path from "path";

describe("#073 IA fallback chain — dapeIA.service.ts", () => {
  const servicePath = path.resolve(__dirname, "../../dape/ia/dapeIA.service.ts");
  const source = fs.readFileSync(servicePath, "utf-8");

  it("define getFallbackAISettings", () => {
    expect(source).toMatch(/async function getFallbackAISettings/);
  });

  it("getFallbackAISettings lê aiFallbackProvider das Settings", () => {
    expect(source).toMatch(/aiFallbackProvider/);
  });

  it("callAI tenta fallback quando provider principal lança IA_PROVIDER_ERROR", () => {
    expect(source).toMatch(/IA_PROVIDER_ERROR/);
    expect(source).toMatch(/getFallbackAISettings/);
  });

  it("loga fallback_used=true no Sentry", () => {
    expect(source).toMatch(/fallback_used:\s*true/);
    expect(source).toMatch(/Sentry/);
  });

  it("NÃO faz fallback para RATE_LIMIT, API_KEY e 429 (re-throw)", () => {
    expect(source).toMatch(/RATE_LIMIT.*throw primaryErr/s);
    expect(source).toMatch(/API_KEY.*throw primaryErr/s);
  });
});

describe("#073 IA timeout — AIProviderRouter.ts", () => {
  const routerPath = path.resolve(
    __dirname,
    "../../services/AIProviderService/AIProviderRouter.ts"
  );
  const source = fs.readFileSync(routerPath, "utf-8");

  it("define AI_TIMEOUT_MS = 30_000", () => {
    expect(source).toMatch(/AI_TIMEOUT_MS\s*=\s*30[_,]?000/);
  });

  it("OpenAI usa timeout via baseOptions", () => {
    expect(source).toMatch(/baseOptions:\s*\{[^}]*timeout:\s*AI_TIMEOUT_MS/);
  });

  it("Anthropic usa timeout no construtor", () => {
    expect(source).toMatch(/new Anthropic\([^)]*timeout:\s*AI_TIMEOUT_MS/);
  });

  it("Gemini usa Promise.race com timeout", () => {
    expect(source).toMatch(/Promise\.race/);
    expect(source).toMatch(/AI_TIMEOUT_MS/);
  });
});
