# Resultado do Deploy — Sprint 2
**Data/Hora:** 2026-06-30 às 07:32 BRT
**Servidor:** root@187.127.25.246
**Branch deployada:** `sprint2/seguranca-resiliencia`

---

## Status Final: 🟢 SUCESSO

---

## Cronologia

| Hora (BRT) | Etapa | Resultado |
|-----------|-------|-----------|
| 04:30 | Backup confirmado (169K, hoje às 03:00 BRT) | ✅ |
| 04:30 | Tag de rollback `pre-sprint2-20260630` criada | ✅ |
| 04:30 | `CSRF_SECRET` adicionado ao `.env` | ✅ |
| 04:31 | `git checkout sprint2/seguranca-resiliencia` | ✅ |
| 04:31 | `docker compose up -d --build backend` | ✅ TypeScript compilou sem erros |
| 04:31 | Migration 018 executada: constraint nomeada criada | ✅ |
| 04:32 | Smoke test `/health` | ✅ HTTP 200 `{"status":"ok","db":"ok"}` |
| 04:32 | Smoke test `/csrf-token` | ✅ token gerado |
| 04:32 | Smoke test webhook Asaas (1ª vez) | ✅ `{"status":"received"}` |
| 04:32 | Smoke test webhook Asaas (2ª vez) | ✅ `{"status":"already_processed"}` — idempotência OK |
| 04:32 | BillingQueue: evento processado e status `processed` no banco | ✅ |

---

## Status dos serviços

| Serviço | Status |
|---------|--------|
| Backend | ✅ Rodando |
| Banco de dados | ✅ Conectado |
| Redis / Filas | ✅ BillingQueue ativa |
| Frontend | ✅ Rodando |

## Status das conexões WhatsApp

| Conexão | Status |
|---------|--------|
| Pub Plus Brasil | ✅ CONNECTED |
| Pop | ⚠️ qrcode — reescanear |
| PUB TEST | ⚠️ qrcode — reescanear |

*Comportamento normal após restart de container Baileys.*

---

## Ajuste durante o deploy

**csrf-csrf v4 — `getSessionIdentifier` obrigatório**
A biblioteca csrf-csrf v4 tornou o campo `getSessionIdentifier` obrigatório
(não estava na documentação do prompt). Adicionado `(req) => req.ip` imediatamente
e re-deployado. Impacto: ~60s de downtime adicional.

**Migration 018 — tipo name[] vs text[]**
A query SQL que buscava a constraint anônima por nomes de colunas tinha
incompatibilidade de tipo entre `pg_attribute.attname` (tipo `name`) e
`ARRAY['event_id','gateway']` (tipo `text[]`). Simplificado para buscar
pelo nome exato gerado pelo PostgreSQL (`dape_billing_events_gateway_event_id_key`).

---

## O que você precisa fazer AGORA

**Ação imediata:**
Acesse o painel DAPLE → Conexões e reescaneie o QR Code de:
- **Pop**
- **PUB TEST**

**Nas próximas 24h:**
Verifique no dia seguinte que o backup rodou normalmente:
```bash
tail -3 /var/log/dape-backup.log
```
