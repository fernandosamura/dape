// @ts-nocheck
// Test: Shield usa 1 INSERT com 3 VALUES (não 3 INSERTs separados)
describe("Shield incrementCounters - #029 batch INSERT", () => {
  it("deve usar 1 INSERT com múltiplos VALUES, não for-loop com 3 INSERTs", () => {
    const fs = require("fs");
    const path = require("path");
    const content = fs.readFileSync(
      path.join(__dirname, "../../dape/shield/dapleShield.service.ts"),
      "utf8"
    );

    // Encontrar a função incrementCounters
    const startIdx = content.indexOf("async function incrementCounters");
    const endIdx = content.indexOf("\nasync function ", startIdx + 1);
    const funcContent = content.substring(startIdx, endIdx > startIdx ? endIdx : startIdx + 1000);

    // NÃO pode ter for-loop com INSERTs separados
    const hasForLoop = /for\s*\(.*of entries\)/.test(funcContent);
    expect(hasForLoop).toBe(false);

    // DEVE ter um único INSERT com VALUES múltiplos (3 tuplas)
    const insertMatches = (funcContent.match(/INSERT INTO daple_shield_counters/g) || []).length;
    expect(insertMatches).toBe(1);

    // Deve ter 3 linhas de VALUES
    expect(funcContent).toContain("'minute'");
    expect(funcContent).toContain("'hour'");
    expect(funcContent).toContain("'day'");
  });

  it("routes/index.ts deve ter endpoint /health", () => {
    const fs = require("fs");
    const path = require("path");
    const content = fs.readFileSync(
      path.join(__dirname, "../../routes/index.ts"),
      "utf8"
    );
    expect(content).toContain('"/health"');
    expect(content).toContain("sequelize.authenticate");
  });

  it("server.ts deve usar pLimit para boot das sessões WA", () => {
    const fs = require("fs");
    const path = require("path");
    const content = fs.readFileSync(
      path.join(__dirname, "../../server.ts"),
      "utf8"
    );
    expect(content).toContain("pLimit");
    expect(content).toContain("Promise.race");
  });

  it("tokenAuth.ts deve preservar req.params existentes com spread", () => {
    const fs = require("fs");
    const path = require("path");
    const content = fs.readFileSync(
      path.join(__dirname, "../../middleware/tokenAuth.ts"),
      "utf8"
    );
    expect(content).toContain("...req.params");
  });

  it("isSuper.ts NÃO deve chamar User.findByPk", () => {
    const fs = require("fs");
    const path = require("path");
    const content = fs.readFileSync(
      path.join(__dirname, "../../middleware/isSuper.ts"),
      "utf8"
    );
    expect(content).not.toContain("findByPk");
    expect(content).toContain("req.user");
  });
});
