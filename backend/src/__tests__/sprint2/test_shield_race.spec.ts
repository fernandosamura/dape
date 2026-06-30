/**
 * #030 — Race condition no Shield
 *
 * Verifica a implementação do padrão increment-first no dapleShield.service.ts.
 * O teste de concorrência real exige banco — aqui validamos a lógica estática.
 */

import fs from "fs";
import path from "path";

describe("#030 Shield race condition — increment-first pattern", () => {
  const servicePath = path.resolve(__dirname, "../../dape/shield/dapleShield.service.ts");
  const source = fs.readFileSync(servicePath, "utf-8");

  it("incrementCounters retorna contagem pós-incremento via RETURNING", () => {
    expect(source).toMatch(/RETURNING window_type, count/);
    // A função deve retornar { minute, hour, day }
    expect(source).toMatch(/return \{ minute: get\("minute"\), hour: get\("hour"\), day: get\("day"\) \}/);
  });

  it("usa postCounters (pós-incremento) para verificar limites", () => {
    expect(source).toMatch(/postCounters/);
    expect(source).toMatch(/postCounters\.minute > config\.max_msgs_per_minute/);
    expect(source).toMatch(/postCounters\.hour > config\.max_msgs_per_hour/);
    expect(source).toMatch(/postCounters\.day > config\.max_msgs_per_day/);
  });

  it("faz compensação (-1) quando o limite é excedido", () => {
    expect(source).toMatch(/decrementCounter/);
    expect(source).toMatch(/GREATEST\(0, count - 1\)/);
  });

  it("não usa mais o padrão getCounters → check → incrementCounters", () => {
    // O fluxo antigo era: getCounters() para rate limit check, depois incrementCounters()
    // O novo fluxo: incrementCounters() retornando postCounters, depois check
    // Verificar que a ordem está correta no método evaluate
    const evaluateBlock = source.substring(source.indexOf("async evaluate("));
    const incrementPos = evaluateBlock.indexOf("await incrementCounters");
    const checkPos = evaluateBlock.indexOf("postCounters.minute >");
    expect(incrementPos).toBeGreaterThan(0);
    expect(checkPos).toBeGreaterThan(incrementPos);
  });
});

describe("#030 Shield — currentWindowKeys helper", () => {
  it("extrai currentWindowKeys como função pura", () => {
    const servicePath = path.resolve(__dirname, "../../dape/shield/dapleShield.service.ts");
    const source = fs.readFileSync(servicePath, "utf-8");
    expect(source).toMatch(/function currentWindowKeys/);
    expect(source).toMatch(/minuteKey.*toISOString.*substring.*0, 16/);
    expect(source).toMatch(/hourKey.*toISOString.*substring.*0, 13/);
    expect(source).toMatch(/dayKey.*toISOString.*substring.*0, 10/);
  });
});
