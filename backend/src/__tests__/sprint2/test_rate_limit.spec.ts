/**
 * #060 — Rate limit global em rotas autenticadas
 *
 * Verifica que o app.ts configura os rate limits corretamente.
 */

import fs from "fs";
import path from "path";

describe("#060 rate limiting — app.ts", () => {
  const appPath = path.resolve(__dirname, "../../app.ts");
  const source = fs.readFileSync(appPath, "utf-8");

  it("importa express-rate-limit", () => {
    expect(source).toMatch(/from ["']express-rate-limit["']/);
  });

  it("configura rate limit global com max=1000 e windowMs=15min", () => {
    expect(source).toMatch(/windowMs:\s*15\s*\*\s*60\s*\*\s*1000/);
    expect(source).toMatch(/max:\s*1000/);
  });

  it("configura rate limit de autenticação com max=100", () => {
    expect(source).toMatch(/max:\s*100/);
  });

  it("exclui /webhooks/ e /health do rate limit global", () => {
    expect(source).toMatch(/startsWith\(["']\/webhooks\//);
    expect(source).toMatch(/["']\/health["']/);
  });

  it("aplica rate limit de auth em /auth", () => {
    expect(source).toMatch(/["']\/auth["']/);
  });
});
