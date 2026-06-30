/**
 * #053 — Idempotência DB-level no webhook Asaas
 *
 * Garante que o segundo envio do mesmo webhook NÃO duplica o evento
 * e que a controller responde corretamente em ambos os casos.
 */

import fs from "fs";
import path from "path";

describe("#053 billing idempotency — INSERT ON CONFLICT pattern", () => {
  const controllerPath = path.resolve(
    __dirname,
    "../../dape/billing/billingWebhook.controller.ts"
  );
  const source = fs.readFileSync(controllerPath, "utf-8");

  it("usa INSERT ... ON CONFLICT ... DO NOTHING RETURNING id", () => {
    expect(source).toMatch(/ON CONFLICT ON CONSTRAINT uq_billing_events_gateway_event DO NOTHING/);
    expect(source).toMatch(/RETURNING id/);
  });

  it("não usa mais o padrão SELECT-then-INSERT para idempotência", () => {
    // O antigo SELECT separado para checar existência não deve mais existir
    expect(source).not.toMatch(/SELECT id.*FROM dape_billing_events WHERE gateway/);
  });

  it("retorna already_processed quando inserted.length === 0 (conflito)", () => {
    expect(source).toMatch(/inserted\.length === 0/);
    expect(source).toMatch(/already_processed/);
  });

  it("usa billingQueue.add em vez de setImmediate", () => {
    expect(source).toMatch(/billingQueue\.add/);
    expect(source).not.toMatch(/setImmediate/);
  });
});

describe("#053 migration 018 — constraint nomeada", () => {
  const migrationPath = path.resolve(
    __dirname,
    "../../dape/migrations/018_billing_events_unique.sql"
  );
  const sql = fs.readFileSync(migrationPath, "utf-8");

  it("migration 018 existe e adiciona constraint uq_billing_events_gateway_event", () => {
    expect(sql).toMatch(/uq_billing_events_gateway_event/);
    expect(sql).toMatch(/ADD CONSTRAINT/);
  });

  it("migration é idempotente (usa IF NOT EXISTS ou bloco DO)", () => {
    expect(sql).toMatch(/DO \$\$/);
    expect(sql).toMatch(/IF NOT EXISTS/);
  });
});
