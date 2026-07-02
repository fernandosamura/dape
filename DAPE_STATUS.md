---
name: dape-status
description: Status atual do projeto DAPLE — histórico de implementações e estado do sistema
metadata: 
  node_type: memory
  type: project
  originSessionId: 409a9962-d05d-49c7-adb2-827c4b17de35
---

# DAPLE — Status do Projeto

**Servidor:** root@187.127.25.246
**Repo local:** /tmp/dape_push
**Branch em produção:** sprint2/seguranca-resiliencia (commit d6b7f4b)

---

## ✅ Sprint 1 — 12 fixes de segurança (2026-06-30)
**Commits:** 9b22620 + 9ba0259

#001 SQL Injection em faturas · #002 CRYPTO_SECRET_KEY obrigatória · #003 CORS whitelist · #004 Cookie secure · #005 CronJob boletos diário · #006 Boot WA pLimit(5) · #007 JWT typo usarname→username · #008 isSuper via JWT · #009 Forgot password sem enumeração · #010 tokenAuth preserva params · #011 Shield batch INSERT · #012 /health endpoint

Testes: 13/13 ✅ | TypeScript: 0 erros ✅

---

## ✅ Sprint 2 — 9 fixes segurança/resiliência (2026-06-30)
**Commits:** 924a81b → 811c8e8

| # | Fix | Commit |
|---|-----|--------|
| #053 | Webhook Asaas idempotente (INSERT ON CONFLICT + migration 018) | 924a81b |
| #056 | Pool DB explícito max=50, acquire=30s (era 0=sem timeout) | f9f55d6 |
| #060 | Rate limit global 1000/15min + /auth 100/15min | 5f50302 |
| #035 | Timeout 30s OpenAI/Anthropic/Gemini/TTS | 410cb0b |
| #075 | BillingQueue Bull retry 5x exponencial (era setImmediate) | b79f166 |
| #073 | Fallback chain IA provider com log Sentry | 67f28e8 |
| #030 | Shield race condition: increment-first + compensação atômica | 27b3b52 |
| #008 | jsonwebtoken v8→v9 (CVE-2022-23529/23541) | c54241b |
| #005 | CSRF Double Submit Cookie csrf-csrf v4 (backend + frontend) | dbe82f2 |

Hotfixes pós-deploy:
- da711a9 — csrf-csrf v4 exige getSessionIdentifier; migration 018 corrigida
- 811c8e8 — CSRF error 403 (não 500); frontend rebuilt
- 69f2630 — guard em Ticket/index.js evita GET /tickets/u/undefined
- d6b7f4b — CSRF retry verifica data.error (não data.message); trust proxy

Testes: 40/40 ✅

**Lição crítica:** Proteção CSRF exige rebuild do frontend no mesmo deploy.
O bundle compilado não reflete mudanças no código-fonte sem rebuild.

---

## 🛡️ Infraestrutura

**Backup automático:**
- Cron: `0 6 * * *` (03:00 BRT) → `s3://daplemidias/backups/`
- Retenção local: 30 dias | R2: 90 dias
- Último backup confirmado: 2026-06-30 06:00 UTC — 169K ✅
- Restore testado: 2026-06-30 — Users=17, Companies=3, Messages=163 ✅

**Variáveis adicionadas ao .env de produção:**
- `CRYPTO_SECRET_KEY` (Sprint 1)
- `CSRF_SECRET` (Sprint 2)

**WhatsApp:** Pub Plus Brasil CONNECTED | Pop qrcode | PUB TEST qrcode

---

## ✅ Hotfix Sprint 2.1 — 3 fixes UX/Socket (2026-06-30)

| # | Fix | Arquivo |
|---|-----|---------|
| Bug A | `joinChatBox` UUID guard em socket.ts (regex `/^\d+$/`) | backend/src/libs/socket.ts |
| Bug A | Removido `joinChatBox` emit de Ticket/index.js (componente não precisa da sala) | frontend/src/components/Ticket/index.js |
| Bug B | Optimistic UI: `CreateMessageService` chamado em `SendWhatsAppMessage` após `wbot.sendMessage()`. Mensagem aparece instantaneamente; echo do Baileys deduplicado por `Message.count` check em wbotMessageListener | backend/src/services/WbotServices/SendWhatsAppMessage.ts |
| Bug C | Socket reconecta com novo token quando JWT é renovado: `SocketManager.currentToken` rastreado; `getSocket()` detecta mudança e força reconexão | frontend/src/context/Socket/SocketContext.js |

Deploy: frontend rebuilt + rsync; backend Docker image rebuilt e reiniciado.
Saúde pós-deploy: `/health` → `{"status":"ok","db":"ok"}` ✅ | WA "Pub Plus Brasil" open ✅

---

## ✅ Fix — Isolamento de tickets abertos + suporte a grupos (2026-07-02)

**Commit:** ade1df2 — "fix: isolamento de tickets abertos e suporte a grupos para usuário comum"

| # | Fix | Arquivo |
|---|-----|---------|
| Backend | `status="open" && showAll!=="true"` agora restringe a `{userId} OU {isGroup:true}` — atendente comum não vê mais tickets `open` de outro atendente na mesma fila | backend/src/services/TicketServices/ListTicketsService.ts |
| Frontend | `filteredTickets` permite grupos (`isGroup`) mesmo sem `queueId`, e bloqueia tickets `open` cujo `userId !== user.id` | frontend/src/components/TicketsListCustom/index.js |

Deploy: frontend rebuilt automaticamente pouco após o commit (16:05 UTC); backend ficou rodando a imagem antiga por ~3h30 até deploy manual — corrigido com `docker compose stop/rm/up --build backend` às 19:46 UTC.
Saúde pós-deploy: `/health` → `{"status":"ok","db":"ok"}` ✅ | sessões WA (POP 4081, Pub Plus Brasil) reconectaram "open" ✅

**Nota infra:** servidor usa `docker compose` (plugin v2), não existe binário `docker-compose` standalone — ajustar comandos de deploy.

---

## 🔜 Sprint 3 — pendente

- #009 Sequelize 5→6 (épico separado)
- #031 wbotMessageListener.ts refactor (god-file 3388 linhas)
- #019 tokenVersion / logout-everywhere
- #015 bcrypt rounds 8→12
- #024 Encrypt WA session no DB
- #037 Socket.IO namespaces por tenant

---

## Documentos no repositório
- BACKUP_RUNBOOK.md · DEPLOY_SPRINT1.md · SPRINT1_VALIDATION.md
- SPRINT2_REPORT.md · DEPLOY_SPRINT2.md · DEPLOY_SPRINT2_RESULTADO.md
- backend/src/__tests__/sprint1/ (5 testes) · sprint2/ (6 testes, 40 casos)
