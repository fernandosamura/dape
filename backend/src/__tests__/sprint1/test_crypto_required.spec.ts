// @ts-nocheck
// Test: cryptoHelper lança erro se CRYPTO_SECRET_KEY não estiver definida
describe("cryptoHelper - #002 sem fallback hardcoded", () => {
  const originalKey = process.env.CRYPTO_SECRET_KEY;

  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    if (originalKey !== undefined) {
      process.env.CRYPTO_SECRET_KEY = originalKey;
    } else {
      delete process.env.CRYPTO_SECRET_KEY;
    }
  });

  it("deve lançar erro se CRYPTO_SECRET_KEY não estiver definida", () => {
    delete process.env.CRYPTO_SECRET_KEY;
    expect(() => {
      require("../../helpers/cryptoHelper");
    }).toThrow(/CRYPTO_SECRET_KEY/);
  });

  it("NÃO deve conter a string hardcoded de fallback no código fonte", () => {
    const fs = require("fs");
    const path = require("path");
    const content = fs.readFileSync(
      path.join(__dirname, "../../helpers/cryptoHelper.ts"),
      "utf8"
    );
    expect(content).not.toContain("dape_default_secret_32chars_key");
  });

  it("deve funcionar normalmente quando CRYPTO_SECRET_KEY estiver definida", () => {
    process.env.CRYPTO_SECRET_KEY = "test_key_32_chars_exactly_padded!";
    const { encrypt, decrypt } = require("../../helpers/cryptoHelper");
    const original = "access_token_teste_123";
    const encrypted = encrypt(original);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(original);
    expect(encrypted).not.toBe(original);
  });
});
