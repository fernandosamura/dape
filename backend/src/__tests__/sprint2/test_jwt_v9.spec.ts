/**
 * #008 — jsonwebtoken v8 → v9
 *
 * Verifica que o upgrade foi feito e que o algoritmo "none" é rejeitado.
 * CVE-2022-23529 e CVE-2022-23541: o v8 aceitava tokens sem assinatura.
 */

import { sign, verify } from "jsonwebtoken";
import fs from "fs";
import path from "path";

describe("#008 jsonwebtoken v9 — CVE fix", () => {
  it("está na versão 9.x", () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pkg = require("jsonwebtoken/package.json");
    expect(parseInt(pkg.version.split(".")[0], 10)).toBeGreaterThanOrEqual(9);
  });

  it("rejeita token com algoritmo none (CVE-2022-23529)", () => {
    // Simula o ataque: header alg=none, sem assinatura
    const fakeHeader = Buffer.from('{"alg":"none","typ":"JWT"}').toString("base64url");
    const payload = Buffer.from('{"id":"1","super":true}').toString("base64url");
    const fakeToken = `${fakeHeader}.${payload}.`;

    expect(() => {
      verify(fakeToken, "any-secret", { algorithms: ["HS256"] });
    }).toThrow();
  });

  it("assina e verifica token HS256 corretamente", () => {
    const secret = "test-secret-key-32chars-padding!";
    const token = sign({ id: "1", username: "test" }, secret, {
      algorithm: "HS256",
      expiresIn: "1h",
    });
    const decoded = verify(token, secret, { algorithms: ["HS256"] }) as any;
    expect(decoded.id).toBe("1");
    expect(decoded.username).toBe("test");
  });

  it("todos os verify() no codebase usam { algorithms: ['HS256'] }", () => {
    const files = [
      "../../middleware/isAuth.ts",
      "../../libs/socket.ts",
      "../../services/AuthServices/RefreshTokenService.ts",
      "../../services/AuthServices/FindUserFromToken.ts",
    ];

    for (const file of files) {
      const source = fs.readFileSync(path.resolve(__dirname, file), "utf-8");
      const verifyMatches = source.match(/verify\(/g) || [];
      const withAlgo = source.match(/algorithms.*HS256/g) || [];
      // Cada chamada a verify() deve ter um { algorithms: ["HS256"] } correspondente
      expect(withAlgo.length).toBeGreaterThanOrEqual(verifyMatches.length);
    }
  });

  it("todos os sign() no CreateTokens.ts usam algorithm: 'HS256'", () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, "../../helpers/CreateTokens.ts"),
      "utf-8"
    );
    expect(source).toMatch(/algorithm:\s*["']HS256["']/);
  });
});
