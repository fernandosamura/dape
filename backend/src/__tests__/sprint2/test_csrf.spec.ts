/**
 * #005 — CSRF tokens
 *
 * Verifica que o backend e o frontend implementam corretamente a proteção CSRF.
 */

import fs from "fs";
import path from "path";

describe("#005 CSRF backend — app.ts", () => {
  const appPath = path.resolve(__dirname, "../../app.ts");
  const source = fs.readFileSync(appPath, "utf-8");

  it("importa doubleCsrf de csrf-csrf", () => {
    expect(source).toMatch(/from ["']csrf-csrf["']/);
  });

  it("define endpoint GET /csrf-token", () => {
    expect(source).toMatch(/app\.get\(["']\/csrf-token["']/);
  });

  it("usa doubleCsrfProtection como middleware", () => {
    expect(source).toMatch(/doubleCsrfProtection/);
  });

  it("exclui /auth/, /webhooks/, /forgetpassword, /health do CSRF", () => {
    expect(source).toMatch(/\/auth\//);
    expect(source).toMatch(/\/webhooks\//);
    expect(source).toMatch(/\/forgetpassword/);
    expect(source).toMatch(/\/health/);
  });

  it("cookie CSRF é httpOnly", () => {
    expect(source).toMatch(/httpOnly:\s*true/);
  });

  it("cookie CSRF é secure em produção", () => {
    expect(source).toMatch(/secure:\s*process\.env\.NODE_ENV === ["']production["']/);
  });
});

describe("#005 CSRF frontend — api.js", () => {
  const apiPath = path.resolve(
    __dirname,
    "../../../../frontend/src/services/api.js"
  );
  const source = fs.readFileSync(apiPath, "utf-8");

  it("fetch token de /csrf-token", () => {
    expect(source).toMatch(/\/csrf-token/);
  });

  it("envia x-csrf-token como header em mutações", () => {
    expect(source).toMatch(/x-csrf-token/);
  });

  it("aplica interceptor apenas em métodos mutadores (post/put/delete/patch)", () => {
    expect(source).toMatch(/MUTATION_METHODS/);
    expect(source).toMatch(/post/);
    expect(source).toMatch(/put/);
    expect(source).toMatch(/delete/);
  });

  it("faz retry quando recebe 403 CSRF_INVALID", () => {
    expect(source).toMatch(/CSRF_INVALID/);
    expect(source).toMatch(/_csrfRetried/);
  });
});
