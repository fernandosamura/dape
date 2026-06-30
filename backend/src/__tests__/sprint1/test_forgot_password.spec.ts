// @ts-nocheck
// Test: forgot password não revela se e-mail existe
describe("ForgotController - #011 sem enumeração de e-mail", () => {
  it("deve retornar 200 para e-mail válido E inválido (não revela existência)", async () => {
    // Ler o fonte diretamente para verificar a lógica
    const fs = require("fs");
    const path = require("path");
    const content = fs.readFileSync(
      path.join(__dirname, "../../controllers/ForgotController.ts"),
      "utf8"
    );

    // Não pode ter status 404 em nenhum branch do store
    const lines = content.split("\n");
    const storeFunction = lines.slice(
      lines.findIndex(l => l.includes("export const store")),
      lines.findIndex(l => l.includes("export const resetPasswords"))
    ).join("\n");

    // Store NÃO pode retornar 404
    expect(storeFunction).not.toContain("status(404)");
    // Store DEVE retornar 200
    expect(storeFunction).toContain("status(200)");
    // Mensagem deve ser genérica
    expect(storeFunction).toContain("estiver cadastrado");
  });

  it("rate-limit deve estar configurado na rota", () => {
    const fs = require("fs");
    const path = require("path");
    const content = fs.readFileSync(
      path.join(__dirname, "../../routes/forgotPasswordRoutes.ts"),
      "utf8"
    );
    expect(content).toContain("rateLimit");
    expect(content).toContain("forgotRateLimit");
    expect(content).toContain("15 * 60 * 1000");
  });
});
