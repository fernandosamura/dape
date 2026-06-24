# DAPE — Status de Desenvolvimento

Ultima atualizacao: 2026-06-24

## Modulos

| Modulo             | Backend | Frontend | Migration | Status   |
|--------------------|---------|----------|-----------|----------|
| DAPE Foundation    | OK      | OK       | OK        | Completo |
| DAPE Pipeline      | OK      | OK       | OK        | Completo |
| DAPE Analytics     | OK      | OK       | OK        | Completo |
| DAPE IA            | OK      | OK       | OK        | Completo |
| DAPE Growth        | OK      | OK       | OK        | Completo |
| DAPE Intelligence  | OK      | OK       | OK        | Completo |
| DAPE Radar         | OK      | OK       | OK        | Completo |
| DAPE Automation    | OK      | --       | OK        | Completo |
| Channels por Plano | OK      | OK       | OK        | Completo |
| DAPE Billing       | OK      | OK       | OK        | Completo |

## Ultimo backup realizado
Local: /home/backup/dape_20260624_183300_dapedeal_ia_fix
Data: 2026-06-24 18:33:00

---

## Correcoes aplicadas (2026-06-24 sessao 2) — handleOpenAi 4 melhorias

### 1. Roteamento para Fila corrigido
- Arquivo: backend/src/services/WbotServices/wbotMessageListener.ts
- Funcao transferQueue agora define: status="pending", userId=null, chatbot=false
- Ticket aparece corretamente na aba "Aguardando" apos atendimento da IA
- Antes: queueId era atualizado mas status permanecia "open" com userId do bot

### 2. Delay Humanizado — Sammy Digitando
- Nova funcao sendWithTypingDelay com wbot.sendPresenceUpdate("composing") + delay randomico
- Delay = clamp(palavras x 60ms + jitter(0-400ms), 800ms, 4000ms)
- Aplicado nos 2 pontos de envio de texto em handleOpenAi (texto e audio fallback)

### 3. Novos Modelos Gemini (familias 2.5 e 3.1)
- Arquivo: backend/src/services/AIProviderService/AIProviderRouter.ts
- Adicionados: gemini-1.5-flash-8b, gemini-2.0-flash-lite, gemini-2.0-flash-thinking-exp
- Gemini 2.5: gemini-2.5-flash, gemini-2.5-flash-lite, gemini-2.5-flash-preview-tts, gemini-2.5-pro, gemini-2.5-pro-preview
- Gemini 3.1: gemini-3.1-flash-lite, gemini-3.1-flash, gemini-3.1-flash-tts, gemini-3.1-pro, gemini-3.1-pro-preview
- Gemini Live: gemini-2.0-flash-live, gemini-3.1-flash-live

### 4. Transcricao de Audio com Gemini Multimodal
- Gemini: audio enviado em base64 via inlineData direto no payload (sem API externa)
- OpenAI / Manus: continua usando Whisper
- Anthropic: retorna log informando nao suporte (sem crash)

---

## Correcoes aplicadas (2026-06-24 sessao 1) — DapeDeal + IA Rate Limit

### 1. DapeDeal / PipelineAgent — column does not exist
- Erro: "column DapeDeal.contactId does not exist" e "column companyId does not exist"
- Causa: tabela dape_deals criada com snake_case mas modelo sem underscored: true
- Correcao: @Table({ tableName: "dape_deals", underscored: true }) em DapeDeal.ts

### 2. Rate Limit IA
- MAX_CALLS_PER_MINUTE: 10 -> 50 em dape/ia/dapeIA.service.ts

### 3. Migrations criadas (idempotentes)
- 20260624000001: tabelas dape_ia_rate_limits, dape_ia_summaries, dape_ia_suggestions
- 20260624000002: colunas provider/voice/tts na tabela Prompts
- Migrations 20260622* e 20260623* registradas no SequelizeMeta

### 4. Container backend — fix nodemon
- package.json start: "nodemon dist/server.js" -> "node dist/server.js"
- Imagem corrigida salva como dape-backend:fixed

---

## Correcoes aplicadas (2026-06-23) — Billing / Asaas

- Tabelas: dape_billing_invoices, dape_billing_events, dape_extra_user_requests
- Colunas de billing em dape_tenant_plans e dape_plans
- Migration: 20260623000001-add-billing-tables.ts

---

## Correcoes aplicadas (2026-06-22) — Constraints por empresa

- Unique constraints por company em Queues, Whatsapps, QueueIntegrations, Settings
- Coluna companyId em Webhooks
- Migrations: 20260622000001 a 20260622000007

---

## Correcoes aplicadas (2026-06-18) — Parecer Tecnico Manus AI

- 2.1 dapeMasterNative.controller.ts:444 — corrigido dape_module_overrides
- 2.4 moduleAccess.service.ts — arquivo truncado restaurado
- 2.5 dapeAnalytics.cron.ts:24-26 — corrigido JOIN
- 3.5 Login/index.js — handleLogin dentro do try (seguranca)
- 3.4 routes/index.ts — removida rota duplicada
- 3.2 Migrations renomeadas para timestamps corretos
- 3.1 database.ts — fallback mysql -> postgres

---

## Issues conhecidos
- Nenhum no momento

## Proxima tarefa
- Monitorar PipelineAgent com deals reais para confirmar fix do DapeDeal
- Validar typing delay em producao com usuario real
