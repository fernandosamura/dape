// @ts-nocheck
// Test: CORS não aceita origens desconhecidas
describe("CORS whitelist - #003 não mais allow-all", () => {
  let originalEnv: any;

  beforeEach(() => {
    jest.resetModules();
    originalEnv = {
      FRONTEND_URL: process.env.FRONTEND_URL,
      SENTRY_DSN: process.env.SENTRY_DSN,
      CRYPTO_SECRET_KEY: process.env.CRYPTO_SECRET_KEY,
    };
    process.env.FRONTEND_URL = "https://app.daple.com.br";
    process.env.SENTRY_DSN = "";
    process.env.CRYPTO_SECRET_KEY = "test_key_32_chars_exactly_padded!";
  });

  afterEach(() => {
    Object.assign(process.env, originalEnv);
  });

  it("código fonte NÃO deve ter callback(null, true) sem checagem de origem", () => {
    const fs = require("fs");
    const path = require("path");
    const content = fs.readFileSync(
      path.join(__dirname, "../../app.ts"),
      "utf8"
    );
    // Não pode ter allow-all sem checar allowedOrigins
    expect(content).not.toContain("callback(null, true); // allow all origins");
    // Deve ter verificação de allowedOrigins
    expect(content).toContain("allowedOrigins.includes(origin)");
  });

  it("código fonte deve ter array allowedOrigins definido", () => {
    const fs = require("fs");
    const path = require("path");
    const content = fs.readFileSync(
      path.join(__dirname, "../../app.ts"),
      "utf8"
    );
    expect(content).toContain("allowedOrigins");
    expect(content).toContain("FRONTEND_URL");
  });
});
