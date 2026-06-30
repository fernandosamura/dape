// @ts-nocheck
// Test: JWT payload não tem mais o typo 'usarname'
import jwt from "jsonwebtoken";

// Mock auth config para não depender de .env real
jest.mock("../../config/auth", () => ({
  secret: "test_secret_jwt",
  expiresIn: "1h",
  refreshSecret: "test_refresh",
  refreshExpiresIn: "7d"
}));

describe("JWT payload - #007 fix typo usarname→username", () => {
  it("deve conter 'username' e não 'usarname'", () => {
    const { createAccessToken } = require("../../helpers/CreateTokens");
    const fakeUser = {
      id: 1,
      name: "João Teste",
      profile: "admin",
      companyId: 1,
      super: false,
      tokenVersion: 1
    };
    const token = createAccessToken(fakeUser as any);
    const decoded: any = jwt.decode(token);
    expect(decoded).not.toHaveProperty("usarname");
    expect(decoded).toHaveProperty("username");
    expect(decoded.username).toBe("João Teste");
    expect(typeof decoded.super).toBe("boolean");
  });
});
