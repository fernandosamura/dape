# Relatório Pré-Deploy — Sprint 2: Segurança + Resiliência
**Branch:** `sprint2/seguranca-resiliencia`
**Data:** 2026-06-30
**Validado por:** SRE automatizado
**Base:** Sprint 1 (commit `9b22620`) — em produção e estável

---

## Status Geral: 🟢 APROVADO

> 9 de 9 correções implementadas. 40/40 testes passando. TypeScript compila sem erros.

---

## Correções aplicadas

| # | Auditoria | Descrição | Commit | Status |
|---|-----------|-----------|--------|--------|
| 1 | #053 | Idempotência DB-level no webhook Asaas (INSERT ON CONFLICT) | `924a81b` | ✅ |
| 2 | #056 | Pool de conexões DB explícito com timeout de acquire | `f9f55d6` | ✅ |
| 3 | #060 | Rate limit global (1000/15min) e em /auth (100/15min) | `5f50302` | ✅ |
| 4 | #035 | Timeout 30s em OpenAI, Anthropic, Gemini e TTS | `410cb0b` | ✅ |
| 5 | #075 | Webhook Asaas em BullQueue com retry exponencial (5x) | `b79f166` | ✅ |
| 6 | #073 | Fallback chain de IA provider + Sentry alert | `67f28e8` | ✅ |
| 7 | #030 | Race condition no Shield: padrão increment-first | `27b3b52` | ✅ |
| 8 | #008 | Upgrade jsonwebtoken v8→v9 (CVE-2022-23529, CVE-2022-23541) | `c54241b` | ✅ |
| 9 | #005 | CSRF tokens — Double Submit Cookie (backend + frontend) | `dbe82f2` | ✅ |

---

## Resultado dos testes

```
Test Suites: 6 passed, 6 total
Tests:       40 passed, 40 total
TypeScript:  0 erros de compilação
```

| Suite | Testes | Status |
|-------|--------|--------|
| test_billing_idempotency.spec.ts | 6 | ✅ |
| test_rate_limit.spec.ts | 5 | ✅ |
| test_csrf.spec.ts | 9 | ✅ |
| test_jwt_v9.spec.ts | 5 | ✅ |
| test_shield_race.spec.ts | 5 | ✅ |
| test_ia_fallback.spec.ts | 7 | ✅ (+3 de timeout) |

---

## Decisões diferentes do prompt original e porquê

### #053 — ON CONFLICT referenciando nome da constraint
O prompt sugeria `ON CONFLICT (gateway, event_id)`. Optei por
`ON CONFLICT ON CONSTRAINT uq_billing_events_gateway_event` para referenciar
a constraint nomeada explicitamente, tornando mais claro no código que a
idempotência depende da migration 018.

### #056 — Pool: não removi `evict` do config original
O `evict: 1000 * 60 * 5` (eviction de conexões ociosas a cada 5min) estava
no config original e é útil. Mantive-o, apenas corrigi `acquire: 0 → 30000`.

### #008 — Sessões NÃO serão invalidadas
O prompt alertava que "todos os usuários precisam fazer login de novo". Isso
seria verdade se houvesse mudança de algoritmo. Como tanto v8 quanto v9 usam
HS256 com a mesma chave, os tokens existentes continuam válidos. **Nenhum
re-login será necessário.**

### #073 — Fallback lê settings do banco (não de env var)
O fallback é configurado por empresa na tabela `Settings` (chave `aiFallbackProvider`),
não globalmente no `.env`. Isso permite que empresas diferentes tenham
configurações de fallback independentes.

### csrf-csrf v4 — API mudou vs. documentação esperada
O prompt referenciava `generateToken`, mas a csrf-csrf v4 exporta `generateCsrfToken`.
Adaptado com cast `as any` para manter compatibilidade com tipos TypeScript.
Funcionalidade idêntica.

---

## Variáveis novas que DEVEM ser adicionadas ao .env de produção antes do deploy

```bash
# CSRF (obrigatório para o middleware funcionar com segurança)
CSRF_SECRET=$(openssl rand -hex 32)

# Pool DB (opcional — padrões já são seguros)
DB_POOL_MAX=50
DB_POOL_MIN=5
DB_POOL_ACQUIRE=30000
DB_POOL_IDLE=10000

# IA Fallback (opcional — só se quiser redundância de provider)
# Configurar também nas Settings de cada empresa (aiFallbackProvider, etc.)
```

---

## Janela de manutenção

**Tempo estimado:** ~10 minutos
**Impacto:** Reinício do container backend (1-2 min de indisponibilidade)
**Avisar usuários:** SIM — enviar aviso 30 minutos antes

**Invalidação de sessões:** ❌ NÃO (tokens v8/v9 compatíveis, mesmo algoritmo HS256)
**Re-scan de QR Code WhatsApp:** ✅ SIM — sessões Baileys perdem estado no restart

---

## Procedimento de rollback

Se algo der errado após o deploy:

```bash
ssh root@187.127.25.246
cd /root/dape

# Criar tag de rollback ANTES do deploy (ver DEPLOY_SPRINT2.md)
git checkout pre-sprint2-20260630

docker compose up -d --build backend
```

O banco não tem migrations destrutivas neste sprint — rollback é seguro.
A única migration é a 018 (adiciona constraint nomeada), que não remove dados.

---

## O que NÃO foi implementado (fora do escopo)

| Item | Motivo |
|------|--------|
| #009 Sequelize 5→6 | Épico separado — quebra compatibilidade com muitos modelos |
| #031 God-file wbotMessageListener | Épico separado — refactor de 3388 linhas |
| #019 tokenVersion / logout-everywhere | Deferred — requer UI de gerenciamento de sessões |
| #015 bcrypt rounds 8→12 | Deferred — requer migração gradual com hash rehash |
| #024 Encrypt WA session no DB | Deferred — requer migration de dados existentes |
| #037 Socket.IO namespaces por tenant | Deferred — risco de regressão alto |
