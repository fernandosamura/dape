# DAPE — Status de Desenvolvimento

Última atualização: 2026-06-24 (sessão 2)

## Módulos

| Módulo           | Backend | Frontend | Migration | Status         |
|------------------|---------|----------|-----------|----------------|
| DAPE Foundation  | OK      | OK       | OK        | Completo       |
| DAPE Pipeline    | OK      | OK       | OK        | Completo       |
| DAPE Analytics   | OK      | OK       | OK        | Completo       |
| DAPE IA          | OK      | OK       | OK        | Completo       |
| DAPE Growth      | OK      | OK       | OK        | Completo       |
| DAPE Intelligence| OK      | OK       | OK        | Completo       |
| DAPE Radar       | OK      | OK       | OK        | Completo       |
| DAPE Automation  | OK      | --       | OK        | Completo       |
| Channels por Plano | OK   | OK       | OK        | Completo       |
| DAPE Billing     | OK      | OK       | OK        | Completo       |

## Ultimo backup realizado
Local: /home/backup/dape_20260624_183300_dapedeal_ia_fix
Data: 2026-06-24 18:33:00

## Correcoes aplicadas (2026-06-24) — DapeDeal + IA Rate Limit

### Blockers resolvidos

#### 1. DapeDeal / PipelineAgent — column does not exist
- **Erro:** `column DapeDeal.contactId does not exist` e `column "companyId" does not exist`
- **Causa raiz:** Tabela `dape_deals` criada com snake_case (`company_id`, `contact_id`) mas
  o modelo `DapeDeal.ts` sem `underscored: true` gerava SQL com camelCase
- **Correção:** `@Table({ tableName: "dape_deals", underscored: true })` em `DapeDeal.ts`
- **Arquivo:** `backend/src/models/DapeDeal.ts`

#### 2. Rate Limit IA muito restritivo
- **Problema:** `MAX_CALLS_PER_MINUTE = 10` bloqueava o chatbot prematuramente
- **Correção:** Aumentado para `50` em `backend/src/dape/ia/dapeIA.service.ts`

#### 3. Migrations criadas (idempotentes)
- `20260624000001-create-dape-ia-tables.ts` — tabelas `dape_ia_rate_limits`,
  `dape_ia_summaries`, `dape_ia_suggestions` (já existiam, migration documenta a estrutura)
- `20260624000002-add-provider-to-prompts.ts` — colunas `provider`, `baseUrl`, `voice`,
  `voiceKey`, `voiceRegion`, `ttsProvider` na tabela `Prompts` (já existiam)
- Migrations anteriores (`20260622*`, `20260623*`) registradas no `SequelizeMeta`

#### 4. Container backend — fix nodemon
- **Problema:** Após restart, `yarn start` falhava com `/bin/sh: nodemon: not found`
- **Causa:** Yarn executa scripts via `sh -c`, sem `node_modules/.bin` no PATH do Alpine sh
- **Correção:** `package.json` start: `"nodemon dist/server.js"` → `"node dist/server.js"`
- Imagem corrigida salva como `dape-backend:fixed`

### Resultado
- Logs limpos: zero erros de DapeDeal/PipelineAgent após o fix
- Backend rodando estável na porta 3000
- Todos os providers de IA (Gemini, Claude, GPT) operacionais

## Correcoes aplicadas (2026-06-23) — Billing / Asaas

- Tabelas `dape_billing_invoices`, `dape_billing_events`, `dape_extra_user_requests`
- Colunas de billing em `dape_tenant_plans` e `dape_plans`
- Migration: `20260623000001-add-billing-tables.ts`

## Correcoes aplicadas (2026-06-22) — Constraints por empresa

- Unique constraints por company em Queues, Whatsapps, QueueIntegrations, Settings
- Coluna `companyId` em Webhooks
- Migrations: `20260622000001` a `20260622000007`

## Correcoes aplicadas (2026-06-18) — Parecer Tecnico Manus AI

### Blockers resolvidos
- 2.1 dapeMasterNative.controller.ts:444 — corrigido dape_module_overrides para dape_tenant_module_overrides
- 2.4 moduleAccess.service.ts — arquivo truncado restaurado completo + getPlanFeatures integrado corretamente
- 2.5 dapeAnalytics.cron.ts:24-26 — corrigido JOIN: removido dape_available_modules, module_key e is_enabled

### Seguranca
- 3.5 Login/index.js — handleLogin movido para dentro do try, impedindo bypass de empresas pendentes

### Estrutura
- 3.4 routes/index.ts — removida rota duplicada routes.use(messageRoutes)
- 3.2 Migrations renomeadas: 20222016014720 e 20222016014721 corrigidos para 20220220
- 3.1 database.ts — fallback de dialeto corrigido de mysql para postgres

## Issues conhecidos
- Nenhum no momento

## Proxima tarefa
- Monitorar comportamento do PipelineAgent com deals reais para confirmar fix completo

## Correcoes aplicadas (2026-06-24 sessão 2) — handleOpenAi 4 melhorias

### 1. Roteamento para Fila corrigido
-  agora define , , 
- Ticket aparece corretamente na aba Aguardando após atendimento da IA
- Arquivo: 

### 2. Delay Humanizado (Sammy Digitando)
- Nova função :  + delay randômico
- Delay = clamp(palavras × 60ms + jitter(0-400ms), 800ms, 4000ms)
- Usado nos 2 pontos de envio de texto em 

### 3. Novos Modelos Gemini (família 2.5 e 3.1)
- Adicionados: gemini-1.5-flash-8b, gemini-2.0-flash-lite, gemini-2.0-flash-thinking-exp
- Gemini 2.5: flash, flash-lite, flash-preview-tts, pro, pro-preview
- Gemini 3.1: flash-lite, flash, flash-tts, pro, pro-preview
- Gemini Live: gemini-2.0-flash-live, gemini-3.1-flash-live
- Arquivo: 

### 4. Transcrição de Áudio com Gemini Multimodal
- Áudio enviado em base64 via  direto no payload do Gemini
- Fluxo: gemini → multimodal nativo | openai/manus → Whisper | anthropic → não suportado
- Sem necessidade de API externa para Gemini
