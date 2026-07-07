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
**Domínio:** https://daple.pubplus.com.br
**SSL:** Let's Encrypt — válido até 23/09/2026 (renovação automática ativa)
**Repo local:** /tmp/dape_push
**Branch em produção:** sprint2/seguranca-resiliencia

---

## Módulos

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
| Grupos WhatsApp    | OK      | OK       | OK        | Completo |

---

## Sessão 2026-06-25 — Migração VPS + UI/UX

### 1. Migração de Servidor (EUA -> Brasil)
- Nova VPS Hostinger Brasil: 187.127.25.246 (VPS antiga EUA 2.25.196.154 DESCOMISSIONADA em 2026-06-25)
- Docker 29.6 instalado + repo clonado + backup restaurado
- Banco restaurado: 71 tabelas, 14 usuarios, 1.189 contatos, 108 mensagens
- Nginx configurado como proxy reverso: /api -> 3000, / -> 3001
- SSL Let's Encrypt gerado para daple.pubplus.com.br
- DNS apontado via Hostinger: A daple -> 187.127.25.246 (TTL 300)
- docker compose up --build -d executado com sucesso na nova maquina

### 2. UI/UX — Menu Lateral (MainListItems.js + pt.js)
- Removidos emojis dos itens DAPE: Pipeline, Kanban DAPE, Analytics, Growth, Intelligence, Radar, DAPLE Master, Assinatura
- Renomeado Open.Ai para Daple AI em pt.js
- Movido bloco Assinatura (/dape/billing) para secao ADMINISTRACAO (logo apos Informativos)

### 3. Favicon — Mascote DAPLE (robo no foguete)
- PNG original sem canal alpha (cor de fundo branca)
- Fundo removido com ImageMagick (-fuzz 5% -transparent white)
- ICO construido manualmente em Python com PNGs RGBA embutidos (ColorType=6)
- Tamanhos: 16x16, 32x32, 48x48, 64x64, 256x256
- Arquivo salvo em brands/dape-favicon.ico (copiado automaticamente no build)

### 4. Fix TypeScript — MessageController.ts
- req.user.id e tipo string, userId em SendWhatsAppMessage espera number
- Corrigido: Number(req.user.id) nas linhas 69 e 171

### 5. UI — Chat Interno (bolhas + lista premium)
- ChatMessages.js: boxLeft (outro usuario) blue -> #daeeff (azul pastel claro)
- ChatMessages.js: boxRight (proprio usuario) green -> #d6f5e3 (verde pastel claro)
- Ambas com borderRadius 12px, boxShadow suave e borda semi-transparente
- ChatList.js: itens com borderRadius 8px, margin, hover com fundo sutil e sombra
- Item selecionado: borda azul #1976d2 + fundo rgba(25,118,210,0.08) + sombra

### 6. Grupos WhatsApp — multi-atendente (commit e5c002c)
- Tabela TicketUsers (migration 20260624000003)
- Model TicketUser.ts + BelongsToMany em Ticket.ts
- Rotas: POST /tickets/:id/join, POST /tickets/:id/leave, GET /tickets/:id/users
- SendWhatsAppMessage: prefixo [Nome] em mensagens de grupo
- Frontend: botoes Entrar/Sair do Grupo + exibicao do remetente em grupos

Commits: ec7eda6 · c18d068 · 67f52af · 28ded8c · 867e369 · e5c002c

---

## Correções aplicadas (2026-06-24 sessão 2) — handleOpenAi 4 melhorias

1. **Roteamento para Fila corrigido** — transferQueue: status=pending, userId=null, chatbot=false
2. **Delay Humanizado — Sammy Digitando** — sendWithTypingDelay: presenceSubscribe + composing + delay clamp(palavras×60ms+jitter, 800-4000ms)
3. **Novos Modelos Gemini** — famílias 2.5 e 3.1 (flash, flash-lite, pro, pro-preview, flash-live, etc.)
4. **Transcrição de Áudio com Gemini Multimodal** — base64 via inlineData direto no payload

---

## Correções aplicadas (2026-06-24 sessão 1) — DapeDeal + IA Rate Limit
- DapeDeal "column does not exist" — corrigido com `@Table({ underscored: true })`
- Rate Limit IA: MAX_CALLS_PER_MINUTE 10 → 50
- Migrations: dape_ia_rate_limits, dape_ia_summaries, dape_ia_suggestions, colunas Prompts

---

## Correções anteriores (2026-06-18 a 2026-06-23)
- Billing/Asaas: tabelas dape_billing_invoices, dape_billing_events
- Constraints por empresa: Queues, Whatsapps, QueueIntegrations, Settings
- Parecer Técnico Manus AI: 6 correções de backend

---

## Sessão 2026-06-25 (tarde) — Migração de Armazenamento para Cloudflare R2

**Objetivo:** migrar arquivos de mídia de /public na VPS para Cloudflare R2 (S3-compatível), por economia de disco e escalabilidade.

1. **Variáveis de ambiente** (.env backend): CLOUDFLARE_R2_ENABLED, CLOUDFLARE_R2_BUCKET_NAME=daplemidias, ACCESS_KEY_ID/SECRET_ACCESS_KEY, ENDPOINT, PUBLIC_URL
2. **R2Service.ts (novo)** — S3Client (endpoint R2, region auto): uploadToR2, deleteFromR2, downloadFromR2
3. **upload.ts** — com R2 ativo, destino forçado para public/temp (staging); sem R2, comportamento original
4. **FilesController.ts** — uploadMedias: salva no disco → uploadToR2 → unlinkSync
5. **MessageController.ts** — store/send: upload antes de enfileirar/enviar, depois remove local
6. **verifyMediaMessage (wbotMessageListener.ts)** — mídia recebida salva em temp → R2 → unlink
7. **SendWhatsAppMedia.ts** — resolveLocalPath(): baixa do R2 para temp se não existir localmente; finally limpa temp
8. **Message.ts** — getter mediaUrl: retorna URL do R2 se ativo e configurado, senão fallback disco local
9. **3 bugs críticos corrigidos no módulo de IA:**
   - TTS: uploadToR2 do .ogg ANTES de deleteFileSync (senão mediaUrl apontava pra arquivo já deletado)
   - Transcrição de áudio: downloadFromR2 antes de ler, limpeza do temp depois (Gemini e Whisper)
   - .env.example atualizado com todas as variáveis CLOUDFLARE_R2_*

Commits: a33cb53 · a8f18a1

---

## Sessão 2026-06-26 — Landing Page Mobile + Bug Troca de Senha

### 1-2. Landing Page — Layout Mobile (planos + cards Intelligence/Radar)
- Cards apareciam lado a lado no celular por inline style `grid-template-columns` sem a class esperada pelo media query
- Fix: regras CSS `!important` mirando os containers reais (`.plans-section .inner>div[style]`, nova class `intel-sub-grid`)
- Commits: 9b8f170 · 80630fc

### 3. Bug crítico — Troca de senha pelo próprio usuário (4 correções)
- **Fix 1** (UserController.ts): usuário não-admin recebia 403 ao editar o próprio perfil — `isSelf` agora permite, com campos sensíveis (profile/queueIds/whatsappId) filtrados para não-admins. Commit 4c52ba6
- **Fix 2** (UpdateUserService.ts): hash de senha não persistia — `password` é campo VIRTUAL no Sequelize v5, hook BeforeUpdate gerava passwordHash mas não entrava no UPDATE. Corrigido com hash manual antes do `user.update()`. Commit cfed0ec
- **Fix 3** (UpdateUserService.ts): erro 400 por companyId undefined após o Fix 1 filtrar o body. Verificação só roda se `companyId !== undefined`. Commit c637369
- **Fix 4** (UserController.ts): queueIds vazio no self-edit apagava todas as filas do usuário (`$set("queues", [])`). Corrigido preservando filas atuais. Commit 151954a

Commits: 9b8f170 · 80630fc · 4c52ba6 · cfed0ec · c637369 · 151954a

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

## ✅ Fix — Fluxo completo de mídia (imagens, áudios, vídeos, anexos) (2026-07-06)

**Commit:** fa7a6be — "fix: corrige fluxo de midia - buffer corrompido, sanitizacao de nomes de arquivo e CORS de imagens R2"

| # | Fix | Arquivo |
|---|-----|---------|
| 1 | `media.data` do `downloadMediaMessage` já é um Buffer nativo — fazia `Buffer.from(media.data, 'base64')` de novo e corrompia o arquivo. Agora checa `Buffer.isBuffer()` antes | backend/src/services/WbotServices/wbotMessageListener.ts |
| 2 | Multer não sanitizava nomes com acentos/caracteres especiais, quebrando path local e URL do R2. Agora normaliza NFD, remove diacríticos e substitui não-alfanuméricos por `_` | backend/src/config/upload.ts |
| 3 | `ModalImageCors` usava a instância `api` (com baseURL do backend) mesmo para URLs absolutas do R2, gerando 404. Agora detecta URL absoluta (`startsWith("http")`) e usa `axios` puro nesse caso | frontend/src/components/ModalImageCors/index.js |

Deploy: rebuild conjunto de backend + frontend (`docker compose stop/rm/up --build backend frontend`), containers iniciados 2026-07-06 16:11 UTC.
Saúde pós-deploy: `/health` → `{"status":"ok","db":"ok"}` ✅ | sessão WA POP 4081 reconectou "open" ✅

**Pendente de verificação manual (não testável via SSH):** enviar imagem do celular pro painel, anexo com nome complexo do painel pro celular, e áudio gravado no painel — conforme roteiro do prompt original.

### ⚠️ Update 2026-07-06 — usuário reportou que os 3 fixes acima NÃO resolveram (mídia continuava sem enviar/receber)

Causas raiz reais eram de **infraestrutura**, não só código:

1. **Nginx sem `client_max_body_size`** — usava o default de 1MB, rejeitando com 413 qualquer mídia maior antes de chegar no backend (por isso nenhum log de upload aparecia). Corrigido: `client_max_body_size 50M;` adicionado em `/etc/nginx/sites-enabled/dape-frontend` (backup salvo como `dape-frontend.nginx.bak-*` em `/root`). Nginx recarregado.

2. **`CLOUDFLARE_R2_PUBLIC_URL` com valor inválido** — estava setada como um token (`cfat_Q89gP6yXNN2HTqMm7...`), não uma URL. Isso corrompia `mediaUrl` de toda mensagem com mídia armazenada no R2 (getter em `Message.ts:55`). **IMPORTANTE:** o valor real usado pelo container vem de `/root/dape/.env` (raiz do projeto, via `env_file` no docker-compose), **não** de `backend/.env` — este último não tem efeito no container em produção, apesar de existir e parecer o lugar óbvio. Corrigido para `https://pub-8178b70f9db24ba3a98c650406e67e52.r2.dev` em ambos os arquivos por consistência. Backend recriado com `docker compose up -d --force-recreate backend` (só troca de env var, não precisa rebuild de imagem).

Verificado: `curl -I` num arquivo já existente no R2 (`1783355045540_folha_pagamento_corrigida.xlsx`) retornou HTTP 200 pela nova URL pública — confirma que a mídia armazenada volta a ser acessível.

**Lição:** ao investigar bugs de mídia/upload neste projeto, sempre checar 1) limites de nginx (`client_max_body_size`) e 2) qual `.env` realmente alimenta o container via `env_file` no `docker-compose.yml` — não assumir que `backend/.env` é o arquivo ativo.

### ⚠️ Update 2026-07-06 (cont.) — usuário testou de novo, console mostrou 2 problemas novos

**Commit:** c3f97a9 — "fix: corrige upload R2 (ContentLength/checksum) e remove dependencia de CORS no ModalImageCors"

1. **Upload pro R2 quebrado por incompatibilidade AWS SDK v3 x R2:** `TypeError [ERR_HTTP_INVALID_HEADER_VALUE]: Invalid value "undefined" for header "x-amz-decoded-content-length"`. SDK instalado (3.1078.0, via range `^3.600.0`) calcula checksum "flexible" por padrão em uploads via stream sem `ContentLength` explícito, o que o R2 não suporta corretamente. Isso causava falha no upload e, em cascata, `ENOENT` ao tentar ler o arquivo temp já removido. **Fix em `R2Service.ts`:** `requestChecksumCalculation: "WHEN_REQUIRED"` no `S3Client` + `ContentLength: fs.statSync(filePath).size` explícito no `PutObjectCommand`. Testado com upload real dentro do container: `UPLOAD_OK` / `DELETE_OK`.

2. **CORS bloqueado ao carregar imagens do R2 no navegador:** o fix anterior fazia o browser buscar a imagem via XHR direto do domínio R2 (`pub-xxxx.r2.dev`), mas o bucket não tem CORS liberado pra `daple.pubplus.com.br`. **Fix real (mais robusto que configurar CORS no bucket):** áudio/vídeo/documento no `MessagesList` já usam `<audio src>`/`<video src>`/`<a href>` diretos (não passam por XHR, não são afetados). Só `ModalImageCors` fazia fetch via blob. Como URLs do R2 já são públicas, não precisam de fetch autenticado — agora `ModalImageCors` detecta URL absoluta e usa direto como `src` da imagem, sem chamar XHR nenhuma, eliminando a dependência de CORS no bucket.

Deploy: rebuild conjunto backend+frontend, containers iniciados 2026-07-06 17:03 UTC. `/health` OK.

---

## ✅ Feature — Nome do bot na conversa, tickets órfãos em "Aguardando", tela de login (2026-07-06)

**Commit:** fec3c58 — "feat: nome do bot na conversa, tickets orfaos em Aguardando, fixes e melhorias na tela de login"

| # | Mudança | Arquivo |
|---|---------|---------|
| 1 | Subheader do ticket mostra nome do Prompt de IA (`ticket.queue.prompt.name` + 🤖) quando o bot atende (sem `user`) — antes só mostrava quando havia atendente humano | `frontend/src/components/TicketInfo/index.js` |
| 2 | `ListTicketsService` agora inclui `queue.prompt` (antes só `ShowTicketService` incluía) — necessário pra lista de tickets também ter o nome do bot disponível | `backend/src/services/TicketServices/ListTicketsService.ts` |
| 3 | Tickets sem fila E sem atendente (`queueId: null, userId: null, isGroup: false`) agora aparecem em "Aguardando" pra qualquer atendente, não só admin/showAll — antes ficavam órfãos e invisíveis pra atendentes comuns | `backend/src/services/TicketServices/ListTicketsService.ts` (bloco `status === "pending"`) |
| 4 | Fix bug real de autofill do Chrome: fundo branco forçado deixava o label (cor clara) ilegível — override `:-webkit-autofill` no `textField` | `frontend/src/pages/Login/index.js` |
| 5 | Toggle de mostrar/ocultar senha (`Visibility`/`VisibilityOff`) | `frontend/src/pages/Login/index.js` |
| 6 | Tag "Plataforma de Inteligência Comercial" adicionada como `Typography` real (antes só existia embutida na imagem do logo, se existisse) | `frontend/src/pages/Login/index.js` |
| 7 | Nova copy: tagline "Transforme conversas em vendas" / subtagline "Inteligência artificial que atende, qualifica e fecha negócio por você" (era "Seu atendimento inteligente começa aqui" / "Gerencie, automatize e conquiste clientes") | `frontend/src/pages/Login/index.js` |
| 8 | Rodapé do login: `DAPE v6.0.0` → `DAPLE v6.07` | `frontend/package.json` (`nomeEmpresa`, `versionSystem`) |

Deploy: rebuild conjunto backend+frontend, containers iniciados 2026-07-06 18:15 UTC. `/health` OK, `/login` HTTP 200.

**Pendente de verificação visual (extensão Chrome não conectou nesta sessão):** confirmar autofill não deixa mais o label ilegível, toggle de senha funciona, tag da plataforma aparece, copy nova está no ar.

---

## ✅ Fix — Billing 403, nomes no Pipeline, Shield sem config, chat interno apagando conversas (2026-07-07)

**Commit:** aae53f3 — "fix: rota de plans do tenant no billing, nomes no pipeline e vazamento de estado no chat interno"

| # | Bug | Causa raiz | Correção | Arquivo |
|---|-----|-----------|----------|---------|
| 1 | `GET /dape/master/plans` retornava 403 pra qualquer tenant ao abrir Financeiro | `DapeBillingPage` chamava rota `master`-only (`masterGuard`, exige `is_master=true`) em vez de uma rota de tenant | Nova rota `GET /dape/billing/plans` (só `isAuth`, reaproveita `listUnifiedPlans`) | `backend/src/dape/billing/billing.routes.ts`, `frontend/src/pages/dape/DapeBillingPage.js` |
| 2 | Pipeline mostrava `#8`, `#7`... em vez do nome do contato | `listLeadScores` nunca fazia JOIN com `Contacts`, o nome nem chegava a existir na resposta da API | `LEFT JOIN "Contacts" c ON c.id = ls.contact_id`, retorna `contact_name` | `backend/src/dape/pipeline/dapePipeline.service.ts`, `.types.ts`, `frontend/src/components/dape/DapePipelineSummary.js` |
| 3 | Shield mostrava "Inativo" e "Sem quarentena ativa" mesmo com módulo habilitado no plano | `daple_shield_config` nunca tinha linha criada — `ensureDefaultConfig()` existia no service mas nunca era chamada em lugar nenhum (código morto); `evaluate()` é fail-open (`!config → allowed`), ou seja, a conexão não tinha proteção real nenhuma | `CreateWhatsAppService` agora chama `dapleShield.ensureDefaultConfig` ao criar a conexão; backfill manual rodado no banco pras 3 conexões existentes que não tinham config (2 de 3 estavam sem) | `backend/src/services/WhatsappService/CreateWhatsAppService.ts` + backfill SQL direto (não versionado, é dado, não código) |
| 4 | Ao excluir uma conversa no Chat Interno, outras conversas somem da lista (client-side, não eram apagadas no banco) | `useEffect` de socket com dependência `[currentChat, ...]` reregistrava listeners a cada troca de conversa sem nunca remover os antigos (`socket.off` nunca era chamado) — múltiplos listeners empilhados, cada um com uma cópia stale de `chats`, disputavam o `setChats()` no evento de delete | Handlers nomeados + `setChats(prev => ...)` (update funcional, imune a closures antigas) + `socket.off(...)` no cleanup do efeito | `frontend/src/pages/Chat/index.js` |

Deploy: `docker compose down` + `up --build -d` (2x nesta sessão — um pro Shield, um pros demais fixes). Todos os containers subiram saudáveis, TypeScript compilou sem erros, sessões WhatsApp reconectaram normalmente.

Backup manual do banco rodado antes do push (`/opt/dape-backup/backup.sh`): `dape_backup_20260707_223748.sql.gz` (302K) enviado ao R2 com sucesso.

---

## ✅ Fix — Nome do bot para tickets com IA, limpeza de repositório (2026-07-07, continuação)

**Commits:** `57504d6` (fix nome do bot) · `6bd4e07` (chore .gitignore/limpeza)

- **Nome do bot não aparecia:** `ticket.chatbot` só reflete o fluxo de menu numérico (`queue.options.length > 0`); tickets atendidos por Prompt de IA (sem menu) ficavam com `chatbot=false` mesmo respondendo ativamente. `TicketInfo/index.js` passou a considerar também `ticket.useIntegration && ticket.promptId`. Corrigido também um `useEffect` com array de dependências vazio que nunca recalculava o nome ao trocar de ticket.
- **Limpeza de repositório:** `.gitignore` passou a cobrir `backups/`, `*.tar.gz`, `*.bak`, `build_new/` (antes só `backup/` singular era ignorado). Apagados 3 tarballs velhos no root (2 continham `.env` + dump SQL completo — risco real de vazamento se alguém desse `git add -A`), `frontend/build_new/` (12M) e 4 arquivos `.bak` (1 estava versionado por engano, removido com `git rm --cached`). **Não apagados:** `backups/` (dumps reais, só ficou fora do git) e os 2 áudios em `public/` (um confirmado referenciado numa mensagem real no banco — `Messages.mediaUrl`).

Deploy: rebuild completo, `/health` 200, containers saudáveis.

---

## ✅ Fix — #015 bcrypt rounds 8→12 com rehash transparente (2026-07-07)

**Commit:** `fc38498` — "security: bcrypt rounds 8 para 12 com rehash transparente no login (#015)"

- `User.ts`: hook `hashPassword` passa a usar `BCRYPT_ROUNDS = 12` (constante exportada) para senhas novas/trocadas.
- `AuthUserService.ts`: após `checkPassword()` validar a senha, confere o custo do hash atual via `getRounds()` (bcryptjs); se `< 12`, rehasheia e persiste só a coluna `passwordHash` — sem tocar no fluxo normal de login, envolto em try/catch pra nunca bloquear o login por falha nesse hardening.
- Hashes antigos em custo 8 continuam validando normalmente (bcrypt embute o custo no próprio hash) — upgrade é gradual, por usuário, no primeiro login após o deploy. Não precisou de migration nem reset de senha.
- Validado antes do deploy: amostra de 5 usuários confirmada em `$2a$08$`. Backup manual rodado antes (`dape_backup_20260707_232811.sql.gz`). Após deploy: build sem erros, containers saudáveis, `/health` 200, rota de login testada com usuário inexistente (401 `ERR_USER_DONT_EXISTS`, sem 500).

---

## 🔜 Sprint 3 — pendente

- #009 Sequelize 5→6 (épico separado)
- #031 wbotMessageListener.ts refactor (god-file 3388 linhas)
- #019 tokenVersion / logout-everywhere
- #024 Encrypt WA session no DB
- #037 Socket.IO namespaces por tenant

**Ordem recomendada de execução (mais seguro → mais arriscado):** ~~#015~~ ✅ → #019 (aditivo, coluna já existe no model) → #024 (precisa fallback de leitura + backfill) → #009 (precisa ambiente isolado pra rodar os 11 testes antes) → #037 (rollout por tenant canário) → #031 (extração incremental, nunca reescrever o arquivo inteiro).

---

## Issues conhecidos
- git push configurado com PAT (token armazenado apenas no remote URL do servidor)

## Documentos no repositório
- BACKUP_RUNBOOK.md · DEPLOY_SPRINT1.md · SPRINT1_VALIDATION.md
- SPRINT2_REPORT.md · DEPLOY_SPRINT2.md · DEPLOY_SPRINT2_RESULTADO.md
- backend/src/__tests__/sprint1/ (5 testes) · sprint2/ (6 testes, 40 casos)
