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

## ✅ Fix — #037 Fase 1: emits de socket em salas sem inquilinos (2026-07-08)

**Commit:** `4ba80f6` — "fix: #037 fase 1 - corrige emits de socket para salas sem inquilinos (nao chegavam em tempo real)"

Investigação completa do #037 (mapeados os ~85 pontos de `io.to()` do backend) mostrou que **não existe vazamento entre empresas hoje** — todo `socket.join()` já é escopado corretamente (por empresa/usuário/fila, ou por ID de ticket, que é global e único). O item do backlog partia de uma premissa que não se confirmou no código.

O problema real encontrado foi o oposto: **6 emissões em 5 arquivos** usavam nomes de sala soltos (`io.to("open")`, `io.to(ticket.status)`, `io.to("notification")`, `io.to(String(companyId))`) que nenhum cliente jamais entra — atualização em tempo real se perdia silenciosamente até o usuário dar F5. Corrigido usando o padrão já correto existente em `TicketController.remove()`:

| Arquivo | Evento afetado |
|---|---|
| `wbotClosedTickets.ts` | Fechamento automático de ticket por inatividade não sumia da tela ao vivo |
| `TicketGroupService.ts` (join + leave) | Entrar/sair de grupo do WhatsApp não atualizava ninguém em tempo real |
| `TicketController.ts` (`store`) | Criação de ticket |
| `queues.ts` | Transferência de ticket via fila (2 salas soltas no mesmo emit) |
| `wbotTransferTicketQueue.ts` | Transferência automática — corrigido pra usar o ticket pós-transferência (fila de destino correta) |

Backup manual rodado antes (`dape_backup_20260708_033635.sql.gz`), verificado com restore de teste completo (75 tabelas, contagens batendo). Validado após deploy: build TypeScript sem erros, containers saudáveis, `/health` 200, confirmado no `dist/` compilado dentro do container que o padrão novo está presente nos 5 arquivos.

**Fase 2** (helper central de emissão, tipo `emitToCompany()`) e a decisão sobre **Fase 3** (namespaces de verdade do Socket.IO — recomendação atual é não fazer, ver análise completa desta sessão) ficam pendentes, não fazem parte desta entrega.

---

## ✅ Fix — #019 logout de todos os dispositivos via tokenVersion (2026-07-08)

**Commit:** `dd1821a` — "feat: #019 - logout de todos os dispositivos via tokenVersion"

A infraestrutura já existia quase pronta: `createRefreshToken` já embutia `tokenVersion` no payload, e `RefreshTokenService.ts` já rejeitava com `ERR_SESSION_EXPIRED` quando a versão não batia com a do banco — só faltava o gatilho pra incrementar.

- `LogoutEverywhereService.ts` (novo): busca o usuário escopado por `companyId` e faz `user.increment("tokenVersion")` (atômico no banco).
- `UserController.ts`: nova ação `logoutEverywhere`, mesma checagem de permissão do `update()` (`isSelf` ou `isAdmin`).
- `userRoutes.ts`: `POST /users/:userId/logout-everywhere`.

**Decisão de escopo (perguntei ao usuário antes):** versão "barata" — sem checar `tokenVersion` em toda requisição (`isAuth`). O access token dura até 1 dia e não é verificado contra `tokenVersion`, então o logout vira efetivo no próximo refresh (reload da página ou expiração natural do token), não instantaneamente. Zero custo de performance extra por requisição.

Validado sem precisar de credenciais reais: chamei o service direto dentro do container contra um usuário de teste real (id=2, tokenVersion 0→1, persistido no banco), depois simulei um refresh token com a versão antiga usando o mesmo segredo JWT — `RefreshTokenService` rejeitou corretamente. tokenVersion do usuário revertido pra 0 depois do teste. Backup rodado antes (`dape_backup_20260708_034736.sql.gz`). Build sem erros, containers saudáveis, `/health` 200, rota nova confirmada registrada.

---

## ✅ Fix — #024 criptografia da sessão WhatsApp no banco (2026-07-08)

**Commit:** `a2ac5e5` — "security: #024 - criptografa sessao do WhatsApp no banco (AES-256-GCM)"

Escolha de abordagem (perguntei ao usuário antes, entre 3 opções): criptografia na aplicação via getter/setter do Sequelize, em vez de pgcrypto (quebraria a transparência do ORM em dezenas de call sites) ou criptografia de disco (não resolve o risco real — os próprios dumps `.sql.gz` que geramos hoje já continham a sessão em texto puro).

- `sessionCrypto.ts` (novo): `encryptSession`/`decryptSession` com AES-256-GCM, chave em `SESSION_ENCRYPTION_KEY` (`.env`, não versionada). Formato: `enc:v1:` + base64(iv + authTag + ciphertext).
- `Whatsapp.ts`: coluna `session` vira getter/setter — decripta na leitura, criptografa na escrita. Confirmei antes que `authState.ts` é o único ponto de leitura/escrita em todo o código (só ORM, nenhum SQL raw) — zero mudança necessária em qualquer outro lugar.
- Fallback: dado legado sem o prefixo `enc:v1:` é devolvido como está (sem tentar decriptar); falha de decriptação devolve `null` em vez de lançar erro, pra não derrubar a inicialização do WhatsApp inteira — só força aquela conexão a pedir QR novo.

**Validado com as 2 conexões reais que estavam ativas em produção** (Pub Plus Brasil, POP 4081): deploy com fallback → ambas reconectaram normal lendo sessão legada em texto puro, sem QR novo. Backfill rodado (script direto no container) → confirmado no banco que `session` virou `enc:v1:...`. Restart do backend depois do backfill → ambas reconectaram de novo, agora lendo a sessão já criptografada, sem erros — prova ponta a ponta com dado real de produção. Backup rodado antes (`dape_backup_20260708_035916.sql.gz`).

---

## 🔍 Investigação — #031 wbotMessageListener.ts, mapeamento completo (2026-07-08)

Antes de mexer em qualquer coisa, mapeei as 43 funções/consts do arquivo (3389 linhas, **zero teste automatizado cobrindo essa lógica**). Pelo menos 8 responsabilidades distintas misturadas no mesmo arquivo — os 4 maiores blocos sozinhos somam ~2.150 linhas (60%+ do arquivo): motor de IA (`handleOpenAi`, 421 linhas), motor de chatbot por menu (`verifyQueue` + `handleChartbot`, 612 linhas), motor do Flow Builder (`flowbuilderIntegration` + `flowBuilderQueue`, 425 linhas) e o orquestrador central `handleMessage` (**691 linhas**, a maior função do arquivo).

Mapeei também os 9 arquivos externos que dependem de 12 funções específicas exportadas daqui (`isNumeric`, `sleep`, `validaCpfCnpj`, `sendMessageImage`, `sendMessageLink`, `verifyMessage`, `wbotMessageListener`, `getBodyMessage`, `convertTextToSpeechAndSaveToFile`, `keepOnlySpecifiedChars`, `transferQueue`, `verifyMediaMessage`) — qualquer extração precisa preservar esses caminhos de import. Achado interessante: `handleMessage` (a maior função) está exportada mas **nenhum arquivo externo a importa de verdade** — menor risco de quebra externa que o tamanho sugere.

Plano de extração (mais seguro → mais arriscado): utilidades genéricas → parsing de mensagem (funções puras) → mídia/TTS → os 3 motores de bot (um de cada vez) → `handleMessage` (orquestrador).

## ✅ Fix — #031 Fase 1: extração das utilidades genéricas (2026-07-08)

**Commit:** `4024d7f` — "refactor: #031 fase 1 - extrai utilidades genericas do wbotMessageListener"

Extraídas as 6 funções sem nenhuma relação com processamento de mensagem do WhatsApp: `isNumeric`, `validaCpfCnpj` (118 linhas!), `sleep`, `makeid`, `sanitizeName`, `keepOnlySpecifiedChars` → `backend/src/utils/generalHelpers.ts` (novo). `wbotMessageListener.ts` passa a importar as que usa internamente e reexporta todas as 6 no mesmo caminho de antes, pra não quebrar os 9 arquivos externos. 3389 → 3258 linhas.

**⚠️ Incidente durante o deploy:** o primeiro build falhou (`tsc`: "Cannot find name 'timeout'") — a função privada `timeout()` (usada por `sleep`) também era chamada direto em `sendWithTypingDelay()`, uma função que ficou no arquivo original; não percebi esse uso na varredura inicial de dependências internas. **Produção ficou fora do ar por ~1 minuto** entre o `docker compose down` e a correção (trocar `timeout(delayMs)` por `new Promise(resolve => setTimeout(resolve, delayMs))` inline) subir. Backup já tinha sido feito antes do primeiro deploy (`dape_backup_20260708_041822.sql.gz`), então o risco de perda de dado era zero — o único impacto foi o downtime curto.

**Lição:** ao mapear usos internos de uma função antes de extrair, checar TODOS os call sites (`grep -n 'nome('`), não só os que aparecem nas primeiras buscas — uma função "privada" auxiliar (`timeout`) pode ter mais de um chamador.

Validado após a correção: build sem erros, containers saudáveis, `/health` 200, as 2 conexões WhatsApp reais (Pub Plus Brasil, POP 4081) reconectaram normalmente. Testadas as 6 funções extraídas direto no container (incluindo `validaCpfCnpj` com CPF real válido/inválido) e confirmado que o reexport em `wbotMessageListener.ts` continua acessível no caminho original.

---

## ✅ Fix — #031 Fase 2: extração do parsing de mensagem (2026-07-08)

**Commit:** `abf3afb` — "refactor: #031 fase 2 - extrai parsing de mensagem do wbotMessageListener"

Segundo grupo extraído: 12 funções puras de parsing/extração de dados da mensagem do Baileys (`getTypeMessage`, `hasCaption`, `getBodyButton`, `msgLocation`, `getBodyMessage`, `getQuotedMessage`, `getQuotedMessageId`, `getMeSocket`, `getSenderMessage`, `getContactMessage`, `isValidMsg`, `filterMessages`) → `wbotMessageParsers.ts` (novo, mesma pasta). Confirmado antes de mexer: só `getBodyMessage` tem consumidor externo real (`providers.ts`, `typebotListener.ts`, `OpenAiService.ts`) — as outras 11 já estavam sem uso fora do arquivo apesar de exportadas. 3258 → 3051 linhas.

**Detalhe técnico:** o novo arquivo precisa dos tipos `Session`/`IMe` (antes privados a `wbotMessageListener.ts`) — usei `import type` para evitar dependência circular real em runtime (o tipo é apagado na compilação; só `wbotMessageListener.ts` importa valores de `wbotMessageParsers.ts` de verdade, nunca o contrário).

**Mudança no processo de deploy** (lição da Fase 1): rodei `docker compose build backend` **antes** de derrubar os containers, pra pegar erro de compilação sem causar downtime. Compilou limpo de primeira — troca de containers levou ~20s, sem incidente desta vez.

Validado: as 2 conexões WhatsApp reais mantidas conectadas durante o deploy. Testadas as funções extraídas com uma mensagem sintética direto no container (`getTypeMessage`, `getBodyMessage`, `isValidMsg` incluindo o caso `status@broadcast`, `filterMessages`) — todos corretos. Reexport de `wbotMessageListener.ts` confirmado funcional, sem problema de import circular. Backup rodado antes (`dape_backup_20260708_043506.sql.gz`).

---

## ✅ Fix — #031 Fase 3: extração de mídia/TTS (2026-07-08)

**Commit:** `f6cf469` — "refactor: #031 fase 3 - extrai midia/TTS do wbotMessageListener"

Terceiro grupo extraído: `sendMessageImage`, `sendMessageLink`, `downloadMedia`, `resolveLidToPhone`, `verifyContact`, `verifyQuotedMessage`, `convertToOggOpus`, `convertTextToSpeechAzure`, `convertTextToSpeechGoogle`, `convertTextToSpeechAndSaveToFile`, `deleteFileSync` → `wbotMessageMedia.ts` (novo). 3051 → 2610 linhas.

**Diferente das fases 1 e 2:** apareceu uma dependência circular *real* (não só de tipo) — `sendMessageImage`/`sendMessageLink` chamam `verifyMessage`, que fica em `wbotMessageListener.ts` e é usada por 11+ outras funções que ficam lá. Mover só as funções de mídia criaria um `require` circular real entre os dois arquivos. Resolvido movendo `verifyMessage` e `verifyMediaMessage` também pra `wbotMessageMedia.ts` (fazem parte do mesmo domínio) — assim a dependência fica unidirecional: `wbotMessageListener.ts` só importa *de* `wbotMessageMedia.ts`, nunca o contrário.

Validado: build isolado antes de derrubar containers (mesmo processo da Fase 2, sem incidente, ~18s de downtime). As 2 conexões WhatsApp reais mantidas conectadas. Todas as 13 funções carregadas via `require` direto no container sem travar (prova que não há deadlock de import circular), `deleteFileSync` executado de verdade contra um arquivo temporário real. Reexport confirmado funcional. Não testei `verifyMessage`/`verifyMediaMessage` com dado fake pra não poluir o banco de produção — build limpo + sistema saudável + automações rodando sem erro foram considerados evidência suficiente. Backup rodado antes (`dape_backup_20260708_050814.sql.gz`).

---

## ✅ Fix — #031 Fase 4: extração do motor de IA (2026-07-08)

**Commit:** `65e84c4` — "refactor: #031 fase 4 - extrai motor de IA do wbotMessageListener"

Primeiro dos 3 "motores de bot": `handleOpenAi` (421 linhas, o maior deles) → `wbotMessageAI.ts` (novo). Decide o provider (OpenAI/Gemini/Anthropic/Manus), monta contexto de conversa, transcreve áudio (Whisper/Gemini), analisa imagem/vídeo (GPT-4V/Gemini Vision) e decide transferência de fila. 2647 → 2189 linhas.

Confirmado antes de mexer: `handleOpenAi` **não chama** `verifyQueue`, `handleChartbot`, `flowbuilderIntegration`, `flowBuilderQueue` ou `handleMessageIntegration` (os outros 2 motores + orquestrador) — é chamada *por* eles, nunca o contrário. Dependência unidirecional, sem risco de ciclo.

Duas funções auxiliares moveram junto por terem exatamente 1 chamador (o próprio `handleOpenAi`), mesmo padrão da Fase 3 pra evitar ciclo: `sendWithTypingDelay` (7 chamadas, todas dentro de `handleOpenAi`) e `transferQueue` (3 chamadas internas + consumidor externo real em `OpenAiService.ts`).

Validado: build isolado antes de derrubar containers (mesmo processo, ~20s, sem incidente). As 2 conexões WhatsApp reais mantidas conectadas. `handleOpenAi`/`transferQueue` carregados via `require` sem travar, reexport confirmado. Não testei com dado fake (chamaria API de IA de verdade e atualizaria ticket) — build limpo + sistema saudável considerados evidência suficiente. Backup rodado antes (`dape_backup_20260708_061718.sql.gz`).

---

## ✅ Fix — #031 Fase 5: extração do motor de Flow Builder (2026-07-08)

**Commit:** `d533c21` — "refactor: #031 fase 5 - extrai motor de Flow Builder do wbotMessageListener"

Segundo dos 3 motores de bot: `flowbuilderIntegration`, `handleMessageIntegration` (dispatcher entre n8n/webhook, typebot ou flowbuilder) e `flowBuilderQueue` → `wbotMessageFlowBuilder.ts` (novo). 2195 → 1696 linhas.

Confirmado antes de mexer: nenhuma das 3 chama `verifyQueue`/`handleChartbot` (motor de menu, fica pra Fase 6) — são chamadas por eles e pelo orquestrador, nunca o contrário. `flowbuilderIntegration`/`flowBuilderQueue` nunca foram exportadas originalmente (só `handleMessageIntegration`), moveram juntas por serem chamadas exclusivamente por ela.

**Achado durante a extração (registrado, não corrigido agora):** dentro de `flowbuilderIntegration` há `io.of(String(companyId))` e `io.to(ticket.status)` — o mesmo padrão de sala sem prefixo de empresa que corrigimos no #037 Fase 1, numa parte do código que ainda não tinha sido auditada. Fica pra uma fase futura do #037.

Validado: build isolado antes de derrubar containers (~20s, sem incidente — só uma falha transitória de autenticação SSH no primeiro comando, resolvida no retry, sem impacto em produção). As 2 conexões WhatsApp reais mantidas conectadas. `handleMessageIntegration` carregada via `require` sem travar, reexport confirmado. Backup rodado antes (`dape_backup_20260708_063731.sql.gz`).

---

## ✅ Fix — #031 Fase 6: extração do motor de Menu/Chatbot (2026-07-08)

**Commit:** `bf219b5` — "refactor: #031 fase 6 - extrai motor de Menu/Chatbot do wbotMessageListener"

Terceiro e último dos 3 motores de bot: `verifyQueue` (saudação/menu de filas), `verifyRating`, `handleRating` (processa nota e fecha ticket) e `handleChartbot` (motor de opções numeradas) → `wbotMessageMenu.ts` (novo). 1702 → 1023 linhas.

Confirmado antes de mexer: as 4 funções são chamadas só por `handleMessage` (orquestrador, fica no arquivo). `handleChartbot` chama `verifyQueue` internamente (voltar ao menu inicial via `#`), mas isso fica dentro do próprio `wbotMessageMenu.ts` — sem dependência circular real com `wbotMessageListener.ts` (só `import type Session`).

**Achado durante a extração:** bug de transcrição manual — ao compor `wbotMessageMenu.ts` à mão, o escape literal `‎` (usado em `formatBody` pra evitar preview de link no WhatsApp) virou acidentalmente o caractere invisível real (U+200E). Detectado antes do deploy comparando contagem de escape-literal vs caractere real (`grep -oP '\x{200E}'` vs `grep -o '\\u200e'`), corrigido com substituição via Python. O mesmo tipo de armadilha derrubou a primeira tentativa de `Edit` direto em `wbotMessageListener.ts` (o `old_string` tinha o caractere real em vez do escape) — resolvido cortando por número de linha (Python) em vez de match de texto, já que a remoção era puramente mecânica (sem mudança de lógica).

Validado: build isolado antes de derrubar containers (tsc limpo, 12.5s; troca de containers ~20s; uma falha transitória de autenticação SSH no build, resolvida no retry). Health check 200, as 2 conexões WhatsApp reais mantidas (`Connection Update open`), sem erros novos nos logs. As 4 funções carregadas via `require` sem travar, reexport confirmado. Backup rodado antes (`dape_backup_20260708_072116.sql.gz`).

Com isso fecham os 3 motores de bot (Fases 4-6: IA, Flow Builder, Menu/Chatbot). Resta em `wbotMessageListener.ts`: `handleMessage` (o orquestrador, ~250 linhas), `handleMsgAck`, `verifyCampaignMessageAndCloseTicket`, o bootstrap `wbotMessageListener`, e `Push` (função morta, nunca chamada, mantida por ora).

**Decisão de escopo (perguntei ao usuário depois da Fase 6):** encerrar o #031 aqui. 1023 linhas com `handleMessage` como orquestrador central foi considerado um ponto de parada razoável — não vale o risco de quebrar ainda mais o orquestrador, que é a função mais complexa e central do arquivo.

---

## 🔍 Investigação — bloqueio de números novos no WhatsApp + integração Meta Cloud API (2026-07-08)

Investigado motivo de números novos (POP 1871, POP 4081) caírem repetidamente enquanto o Pub Plus Brasil (mais antigo) fica estável. Evidência no log bruto do protocolo: `stream:error code 401, conflict type device_removed` — o próprio WhatsApp derrubando a sessão, não um bug do Daple (processo nem chegou a reiniciar nos eventos analisados). Padrão consistente com detecção antifraude da Meta para número novo + cliente não-oficial (Baileys) + IP de datacenter, não com volume de disparo (volume real no período era baixo, campanhas zeradas há 30 dias).

Decisão do usuário: migrar para a API oficial (Meta Cloud API) de forma híbrida — cada conexão escolhe entre Baileys (QR Code) ou Cloud API, com possibilidade de reverter sem perder histórico. Levantamento de custo (BSPs como 360dialog, Gupshup, Zenvia) mostrou que, dado o volume real do Daple hoje (~30-50 msgs/dia, quase tudo dentro da janela de 24h gratuita da Meta), o custo tende a ser dominado pela mensalidade fixa do BSP (~R$900/mês para 3 números via 360dialog), não pelo custo variável por mensagem.

Descoberto que já existia uma tentativa anterior (parcial) de integração Meta Cloud API no código: schema do banco completo (`providerType`, `wabaId`, `phoneNumberId`, `metaAccessToken`, `migrationStatus`), fluxo OAuth do Embedded Signup funcional (`EmbeddedSignupController.ts`), botão de UI (`EmbeddedSignupButton`), e envio manual já roteado por `providerType` (`MessageController.ts`). Mas faltava: credenciais configuradas, SDK do Facebook no frontend, webhook de entrada funcional (só logava, não criava ticket/contato/mensagem), motor de chatbot/IA/Flow Builder sem suporte a `providerType` (só Baileys), download de mídia via Cloud API, e gestão de templates.

Entregues 2 PDFs para o usuário com o passo a passo do lado da Meta: `1_Configuracao_Unica_Plataforma_Daple.pdf` (feito uma única vez pela Daple/Pub Plus — criação do App, App Review, modo Live) e `2_Checklist_Por_Empresa_Cliente.pdf` (repetido para cada empresa cliente que conectar seu próprio número — Business Manager, verificação, Embedded Signup).

Plano de fases acordado (mais seguro → mais arriscado): Fase 1 (infra/credenciais, zero risco) → Fase 2 (webhook de entrada completo) → Fase 3 (download de mídia) → Fase 4 (unificar dispatcher `SendWhatsAppMessage` por `providerType` — única fase que toca código compartilhado com produção) → Fase 5 (templates) → Fase 6 (piloto com 1 número real + validar rollback).

**Acordo de processo com o usuário:** antes de qualquer deploy que reinicie o backend durante este trabalho, avisar no chat com antecedência — o usuário desconecta manualmente os números (evitando ciclos de reconexão que possam prejudicar a reputação do Pub Plus Brasil) e reconecta depois de validado. Ver [[feedback_deploy_meta_cloud_alerta]] na memória.

## ✅ Fix — Meta Cloud API Fase 1: infraestrutura e credenciais (2026-07-08)

**Commit:** `edef113` — "feat: Meta Cloud API fase 1 - infraestrutura e credenciais"

**Achado e corrigido antes de configurar as credenciais:** a verificação de assinatura do webhook (`MetaCloudWebhookController.receiveWebhook`) usava `JSON.stringify(req.body)` pra calcular o HMAC, mas a Meta assina os bytes brutos originais da requisição — qualquer diferença de espaçamento/ordem de chaves do parser do Express faria a assinatura nunca bater. Bug estava invisível porque a checagem só roda quando `META_APP_SECRET` existe; teria quebrado silenciosamente assim que a credencial fosse configurada. Corrigido adicionando `verify` callback ao `bodyParser.json()` em `app.ts` pra capturar `req.rawBody`, usado agora no cálculo do HMAC.

- `frontend/public/index.html`: carrega o SDK do Facebook (`connect.facebook.net`) com `FB.init` usando `%REACT_APP_META_APP_ID%` (guard evita inicializar se vazio).
- `frontend/Dockerfile` + `docker-compose.yml`: propagam `META_APP_ID` do `.env` raiz como `REACT_APP_META_APP_ID` no build do frontend.
- `.env` (não versionado): placeholders para `META_APP_ID`/`META_APP_SECRET` (a preencher pelo usuário após o Passo 5 do documento de configuração única) e `META_WEBHOOK_VERIFY_TOKEN` já gerado (não depende da Meta).

**Deploy em 2 etapas, aproveitando que frontend e backend são containers separados:** frontend rebuilded e reiniciado sozinho primeiro (zero risco às sessões WhatsApp, que rodam só no backend). Backend rebuilded e reiniciado depois — no momento do restart os 4 números já estavam `DISCONNECTED` no banco (usuário havia desconectado manualmente antes, conforme o acordo de processo), então não houve ciclo de reconexão de número ativo real.

Validado: build isolado de ambos (frontend ~118s, backend/tsc ~13s), sem erro. Handshake do webhook testado com `curl`: token correto devolve o challenge (200), token errado devolve 403. `req.rawBody` confirmado presente no bundle compilado. Backup rodado antes (`dape_backup_20260708_213440.sql.gz`).

**Pendente (fora do escopo desta fase):** preencher `META_APP_ID`/`META_APP_SECRET` reais assim que o usuário concluir o Passo 5 do documento de configuração da plataforma, e validar a assinatura HMAC ponta a ponta com um webhook real da Meta.

## ✅ Fix — Meta Cloud API: credenciais reais + webhook bloqueado por CSRF/rate limit (2026-07-09)

**Commit:** `29479dd` — "fix: Meta Cloud API - webhook bloqueado por CSRF e rate limit"

Usuário concluiu o Passo 5 (App ID `1591177185743944` e App Secret, obtidos em `developers.facebook.com/apps/{id}/settings/basic`) e configurou no `.env` do servidor. Frontend rebuilded pra gravar o App ID real no `FB.init` (confirmado via HTML servido). Backend reiniciado com as credenciais reais carregadas (`printenv` confirmado no container).

**Achado crítico ao validar a assinatura HMAC com o secret real:** a rota `POST /meta-cloud/webhook` estava sendo bloqueada pela proteção CSRF global (double-submit cookie) **antes** de chegar no controller — retornava 403 tanto pra assinatura correta quanto pra errada, sem nenhum log da checagem. Causa: a lista de exclusão do CSRF só tinha `/webhooks/` (plural, usado pelo Asaas), não `/meta-cloud/webhook` (singular). Sem essa correção, a Meta jamais conseguiria entregar nenhum webhook de produção — teria passado despercebido até o primeiro teste real com a Meta, bem mais tarde no processo. Corrigido adicionando `/meta-cloud/webhook` tanto ao `csrfExcludes` quanto ao `skipRateLimit` (a segurança dessa rota vem da assinatura HMAC, não de cookie de sessão — é uma chamada servidor-a-servidor da própria Meta).

Validado com `curl` simulando uma chamada real: corpo JSON + HMAC-SHA256 calculado com o App Secret real via `openssl`. Assinatura correta → 200 (processa e loga). Assinatura incorreta → 401 com log de aviso (`[MetaCloud] Webhook signature inválida`). Confirma o pipeline completo funcional: `rawBody` (Fase 1) + App Secret real + exclusão de CSRF/rate-limit (esta correção).

Backend reiniciado 2x nesta sessão (troca de env + esta correção) sem qualquer impacto real — os 4 números já estavam `DISCONNECTED` desde antes (usuário desconectou manualmente por segurança, planeja reconectar só ao final de todo o processo de integração). Backup rodado antes (`dape_backup_20260709_041322.sql.gz`).

**Fase 1 do Meta Cloud API agora está completa de verdade** (antes só tinha a infraestrutura pronta, sem credenciais nem validação real). Próximo passo: Fase 2 (webhook de entrada completo — hoje só loga e emite evento raso, precisa criar contato/ticket/mensagem de verdade).

## ✅ Fix — Meta Cloud API Fase 2: webhook de entrada completo (2026-07-09)

**Commit:** `e84513a` — "feat: Meta Cloud API fase 2 - webhook de entrada completo"

Reescrito `MetaCloudWebhookService.ts`, que antes só logava a mensagem recebida e emitia um evento de socket raso (sem ticket real, sem persistir nada). Agora reaproveita os mesmos services já usados pelo fluxo Baileys — nenhuma lógica de negócio nova, só o adaptador do formato de payload da Cloud API pros services existentes: `CreateOrUpdateContactService` (acha/cria Contact), `FindOrCreateTicketService` (acha/cria Ticket, com o mesmo controle de `unreadMessages` via cacheLayer/Redis do Baileys), `CreateMessageService` (persiste Message e emite os eventos de socket corretos nas salas certas). Ticket fechado que recebe mensagem nova reabre pra "pending", mesmo comportamento do `verifyMessage` do Baileys. Status de entrega (sent/delivered/read/failed) atualizam o `ack` da Message, com guarda contra retrocesso fora de ordem (exceto "failed", sempre registrado).

**Fora do escopo desta fase (por decisão do plano):** download de mídia real (Fase 3 — imagem/áudio/vídeo/documento viram corpo textual placeholder tipo `[imagem]` por enquanto) e acionamento do chatbot/menu/IA (mensagem entra na fila normal pro atendente humano responder, que já funciona via `MessageController.ts`).

Validado com webhook sintético assinado (HMAC-SHA256 real, calculado com o App Secret da Fase 1) contra o backend rodando: mensagem de texto criou Contact/Ticket(pending)/Message corretos no banco (conferido via psql); atualização de status "read" atualizou o ack de 0 para 3. Dados de teste limpos depois (nada ficou em produção). Build isolado (tsc limpo, ~13s), backend reiniciado sem impacto real (números seguem `DISCONNECTED`, reconectam só ao final). Backup rodado antes (`dape_backup_20260709_042559.sql.gz`).

Próximo passo: Fase 3 (download de mídia real via Cloud API).

## ✅ Fix — Meta Cloud API Fase 3: download de mídia real (2026-07-09)

**Commit:** `c7ddac6` — "feat: Meta Cloud API fase 3 - download de midia real"

Antes, imagem/áudio/vídeo/documento/figurinha recebidos via Cloud API viravam só um corpo textual placeholder (`[imagem]` etc, deixado documentado como pendente na Fase 2). Agora baixa e armazena o arquivo de verdade, replicando exatamente a lógica já usada em `verifyMessage`/`verifyMediaMessage` (Baileys): `DownloadMetaCloudMedia.ts` (novo) faz `GET /{media-id}` na Graph API pra pegar a URL temporária + mime type, depois baixa os bytes dessa URL (que também exige o mesmo Bearer token — não é link público), e salva via `uploadToR2` (se habilitado) ou `public/` local, mesma convenção de nome de arquivo do Baileys. `MetaCloudWebhookService.ts` usa a legenda como corpo quando disponível (ou `"-"` sem legenda, mesma convenção do Baileys); se o download falhar por qualquer motivo (token ausente, erro de decriptação, erro da API da Meta), cai de volta no corpo placeholder da Fase 2 — mensagem nunca se perde.

Validado com 2 cenários reais: (1) sem `metaAccessToken` configurado — download pulado, mensagem criada com `[imagem]`; (2) com token real mas ID de mídia inexistente — chamada HTTP de verdade pra Graph API, erro `GraphMethodException` retornado por ela, capturado e logado, mensagem ainda criada com o placeholder. Confirma que erro real de API externa não derruba o processamento.

**Não testado nesta sessão:** o caminho de sucesso (download efetivo de um arquivo real), que exige uma mídia de verdade chegando pelo webhook real da Meta (depende do usuário concluir o Passo 6 — configuração do webhook no painel deles). Fica como validação pendente assim que houver tráfego real.

Build isolado (tsc limpo, ~13s), backend reiniciado sem impacto real (números seguem `DISCONNECTED`). Dados de teste limpos depois. Backup rodado antes (`dape_backup_20260709_054737.sql.gz`).

Próximo passo: Fase 4 (unificar o dispatcher `SendWhatsAppMessage` por `providerType` — única fase que toca código compartilhado com produção).

## 🔄 Replanejamento — compromisso total com API oficial, sem duas frentes (2026-07-09)

Usuário decidiu: em vez de manter Baileys e Cloud API como dois caminhos paralelos de lógica duplicada (a "Fase 4" original — espalhar `if providerType === 'meta_cloud'` pelo motor de menu/IA/Flow Builder), fazer um esforço único e bem estruturado, com paridade completa de funcionalidade e sem nada cosmético. Também pediu que o **DAPLE Shield passe a consultar a saúde real do número direto na Meta** (quality rating, limite de mensagens), não só heurísticas internas.

Novo plano de fases (substitui a Fase 4 original em diante):
- **Fase A** — camada de abstração de mensagens (`MessageChannel`) ✅ concluída (ver abaixo)
- **Fase B** — motor de menu/chatbot sobre a abstração
- **Fase C** — motor de IA sobre a abstração
- **Fase D** — Flow Builder sobre a abstração
- **Fase E** — campanhas com templates aprovados (obrigatório pra Cloud API)
- **Fase F** — DAPLE Shield com sinais reais da Meta (`quality_rating`, `whatsapp_business_manager_messaging_limit` via Graph API + webhooks `phone_number_quality_update`/`business_capability_update`/`phone_number_name_update`/`security`)
- **Fase G** — piloto real + validação de paridade completa

## ✅ Fix — Meta Cloud API Fase A: camada de abstração de mensagens (2026-07-09)

**Commit:** `e6dece6` — "feat: Meta Cloud API fase A - camada de abstracao de mensagens"

Criada a interface comum `MessageChannel` (`sendText`, `sendMedia`, `downloadIncomingMedia`) que as próximas fases (motor de menu, IA, Flow Builder) vão consumir, em vez de checar `providerType` espalhado pelo código de negócio. Dois adaptadores: `BaileysChannel` (usa `GetTicketWbot` + `wbot.sendMessage`, reaproveitando `downloadMedia` de `wbotMessageMedia.ts`) e `CloudApiChannel` (usa `SendMetaCloudMessage` + `downloadAndStoreMetaCloudMedia`, já existentes desde as Fases 1-3). `getMessageChannel(ticket)` é o ponto único de decisão de qual adaptador usar.

Ajuste retrocompatível em `SendMetaCloudMessage.ts`: passa a retornar `{ externalId }` (o wamid da mensagem) em vez de `void`, mesmo padrão que o Baileys já usa com `sentMessage.key.id` — necessário pra gravar a `Message` com o ID correto nas próximas fases.

**Fase deliberadamente só aditiva:** nenhum dos 24+ pontos que chamam `wbot.sendMessage()` diretamente (`verifyQueue`, `handleChartbot`, `handleOpenAi`, `flowbuilderIntegration`, `queues.ts`) foi alterado ainda — isso é o trabalho das Fases B-D. Risco de produção zero: código novo, não referenciado por nenhum caminho já em execução.

Validado: build isolado (tsc limpo, ~13s), backend reiniciado, os 3 módulos carregados via `require()` dentro do container sem erro, instância de `BaileysChannel` confirmada com os métodos do contrato presentes e `providerType` correto. Backup rodado antes (`dape_backup_20260709_063356.sql.gz`).

Próximo passo: Fase B (motor de menu/chatbot sobre a abstração).

## ✅ Fix — Meta Cloud API Fase B: motor de menu/chatbot sobre a abstração (2026-07-09)

**Commit:** `0f0b50f` — "feat: Meta Cloud API fase B - motor de menu/chatbot sobre a abstracao"

Migra `verifyQueue`/`handleChartbot`/`handleRating` (`wbotMessageMenu.ts`) pra usar `MessageChannel` em vez de `wbot.sendMessage()` direto, e — pela primeira vez — conecta o webhook da Cloud API (Fase 2) a esse motor. Antes, mensagem recebida via Cloud API criava ticket/contato/mensagem mas nunca acionava resposta automática; agora aciona de verdade.

- `sendAndPersistText(channel, ticket, body)` (novo, `MessageChannel/sendAndPersist.ts`): substitui os ~15 pares `wbot.sendMessage()` + `verifyMessage(sentMessage, ...)` espalhados no motor de menu por uma chamada genérica que funciona nos dois transportes.
- `verifyQueue`/`handleChartbot` trocam `wbot`/`msg` (Baileys-específicos) por `channel: MessageChannel` + `messageBody`/`fromMe` já extraídos pelo chamador, mais um `baileysCtx?` opcional usado só pra repassar pros motores de IA/Flow Builder (ainda Baileys-only, pendentes Fases C/D) — sem `baileysCtx` (ticket Cloud API), essas chamadas são puladas com aviso claro em vez de quebrar.
- `wbotMessageListener.ts`: os 3 pontos que chamam `verifyQueue`/`handleChartbot` dentro do `handleMessage` (orquestrador Baileys, 100% preservado) agora constroem um `BaileysChannel` e passam `{ wbot, msg }` como `baileysCtx`.
- `MetaCloudWebhookService.ts`: `processIncomingMessage` aciona o motor após persistir a mensagem, replicando a decisão essencial do `handleMessage` simplificada pra menu/chatbot (reset "#", rating, atribuição de fila, chatbot de submenu) — grupos, agentes SDR/Pipeline e Flow Builder legado ficam de fora por ora (ticket segue disponível pro atendente humano normalmente).

**Validado com teste funcional de ponta a ponta real:** PUB TEST temporariamente marcado `meta_cloud` (token/phoneNumberId falsos, revertido depois) — mensagem sintética assinada processada pelo webhook → Contact/Ticket/Message criados → motor de menu acionado de verdade → tentativa real de envio via `CloudApiChannel`/`SendMetaCloudMessage` → Meta respondeu `OAuthException` (token inválido, esperado) → erro capturado e logado, mensagem recebida permanece salva, webhook não quebra. Confirma degradação graciosa end-to-end. Build isolado (tsc limpo, ~12s), `getMessageChannel(ticket)` testado com ticket real (resolveu `BaileysChannel` corretamente). Dados de teste limpos depois. Backup rodado antes (`dape_backup_20260709_070653.sql.gz`).

Próximo passo: Fase C (motor de IA sobre a abstração).

## ✅ Fix — Meta Cloud API Fase C: motor de IA sobre a abstração (2026-07-09)

**Commit:** `6a18ea2` — "feat: Meta Cloud API fase C - motor de IA sobre a abstracao"

Migra `handleOpenAi` (transcrição de áudio, análise de imagem/vídeo, resposta em texto/voz, transferência de fila) pra usar `MessageChannel`, conectando os 5 pontos de chamada (2 em `wbotMessageMenu.ts`, 3 em `wbotMessageListener.ts`). Antes (Fase B), um ticket Cloud API com IA configurada na fila só gerava aviso de log "pendente Fase C" — agora funciona de verdade.

- `handleOpenAi` troca `msg`/`wbot` por `channel: MessageChannel` + `messageBody`/`messageKind` (`"text"|"audio"|"image_video"|"other"`)/`caption` já extraídos pelo chamador, mais `baileysCtx?` usado só onde realmente precisa de Baileys: o indicador "digitando..." (presence — conceito exclusivo do protocolo WhatsApp Web, sem equivalente na Cloud API) e o guard de `messageStubType`. Transcrição (Whisper/Gemini) e visão (GPT-4V/Gemini Vision) já eram provider-agnósticas (só leem o arquivo do disco/R2) — não precisaram mudar.
- `sendAudioReply` (novo): no Baileys continua enviando o buffer inline pelo socket; na Cloud API exige `CLOUDFLARE_R2_ENABLED=true` (já habilitado em produção) e envia via URL pública do R2 — sem R2, cai pra resposta em texto (API oficial não aceita buffer bruto).
- `sendAndPersistMedia` (novo, `MessageChannel/sendAndPersist.ts`): calcula a URL pública completa pro envio (R2 ou `BACKEND_URL/public`, mesma lógica do getter `Message.mediaUrl`), guardando só o nome do arquivo no banco.
- `classifyForAI`/`classifyBaileysMsgForAI` (novos, um em cada arquivo): derivam `messageKind`/`caption` a partir da `Message` já persistida (Cloud API) ou do `msg` bruto (Baileys) — mesma lógica de detecção de tipo que já existia, agora explícita pro chamador.

**Fora do escopo desta fase (documentado):** os gatilhos "IA da conexão inteira" (`whatsapp.promptId`) e "fila com integração já ativa" (`ticket.promptId` + `ticket.useIntegration`) do `handleMessage` Baileys ainda não têm equivalente no webhook Cloud API — `MetaCloudWebhookService` aciona só `verifyQueue`/`handleChartbot`, que já cobre o caso mais comum (IA na primeira fila).

Validado: build isolado (tsc limpo, ~12s) — a tipagem pegou qualquer incompatibilidade real entre os 5 call sites e a nova assinatura. Backend reiniciado, todos os módulos carregados via `require()` sem erro. Lógica de cálculo de URL pública testada isoladamente. Não foi feito teste de ponta a ponta com chamada real a provedor de IA (custo de API externa) — a mesma lógica de tratamento de erro já validada na Fase B se aplica identicamente aqui. Backup rodado antes (`dape_backup_20260709_074709.sql.gz`).

Próximo passo: Fase D (Flow Builder sobre a abstração).

## 🔍 Investigação — Fase D (Flow Builder): escopo maior que o esperado, decisão de adiar (2026-07-09)

**Commit do fix pontual:** `2325af8` — "fix: #037 - sala de socket sem prefixo de empresa no Flow Builder"

Antes de portar o Flow Builder pra `MessageChannel`, mapeei `ActionsWebhookService.ts` (903 linhas — o processador de nós do flow) a fundo. Achado: o envio de mensagens do Flow Builder é bem mais espalhado que o motor de menu (Fase B) ou de IA (Fase C). 8 tipos de nó (`message`, `typebot`, `openai`, `question`, `ticket`, `singleBlock`, `randomizer`, `menu`), usando **pelo menos 4 mecanismos de envio diferentes**:

- `SendMessage(whatsapp, {...})` — por número+whatsapp, **sem** `ticket` — não encaixa direto no `MessageChannel` (que é centrado em `ticket`) sem redesenho; usado pelo nó `message` e pela imagem dentro de `singleBlock`.
- `SendWhatsAppMessage({body, ticket})` — centrado em `ticket`, portável com esforço razoável; usado pelo nó `question` e pelo texto dentro de `singleBlock`.
- `SendWhatsAppMediaFlow({media, ticket})` — usado pelo áudio/vídeo dentro de `singleBlock`.
- `getWbot(whatsapp.id)` direto — nós `typebot` e `openai` (este último chama um `handleOpenAi` de um módulo **diferente**, `OpenAiService.ts` — não o que foi portado na Fase C).

Só o subtipo `singleBlock` sozinho usa 3 desses mecanismos pros seus 5 subtipos. O arquivo também tem bastante código legado (threads de worker comentadas, construção de caminho via `__dirname.split()`, checagem hardcoded de `localhost:8090`, nó `ticket` inteiro desativado/comentado).

**Decisão (apresentei o mapeamento completo ao usuário antes de decidir):** não tentar portar tudo nesta sessão — o esforço é comparável às Fases B+C juntas, num arquivo desconhecido e com sinais de código legado frágil. Fica registrado aqui como ponto de partida pra um esforço futuro dedicado, quando fizer sentido priorizar.

**O que saiu desta investigação:** achado e corrigido um bug real e contido — `flowbuilderIntegration` usava `io.of(String(companyId))` e `io.to(ticket.status)` (salas de socket sem prefixo de empresa, mesma classe do #037 Fase 1), que faziam o evento de "ticket fechado reaberto" vazar pra qualquer empresa com alguém ouvindo aquela sala de status. Corrigido pro mesmo padrão já usado em `verifyMessage`/`handleRating`/`MetaCloudWebhookService`.

Próximo passo: Fase E (templates/campanhas).

## ✅ Fix — Meta Cloud API Fase E: templates e campanhas (2026-07-09)

**Commit:** `f55491b` — "feat: Meta Cloud API fase E - templates e campanhas"

Primeira fase desta integração que mexe em frontend. Sem templates, campanhas via Cloud API não funcionam — mensagem de negócio fora da janela de 24h (o caso normal de uma campanha) exige template pré-aprovado pela Meta, não é opcional.

- **Modelo novo** `WhatsappTemplate` (nome, idioma, categoria, status, componentes em JSONB, `metaTemplateId`) + coluna `templateId` em `Campaigns`.
- **Sincronização com a Meta**: `SyncWhatsappTemplatesService.ts` busca templates existentes (`GET /{waba-id}/message_templates` — normalmente criados direto no WhatsApp Manager) e faz upsert local. `MetaCloudWebhookService.ts` passa a processar o field `message_template_status_update` (antes só `"messages"` era tratado, qualquer outro field era ignorado) — mantém o status sincronizado em tempo real quando a Meta aprova/rejeita um template.
- **Disparo de campanha** (`queues.ts`, `handleDispatchCampaign`): antes de resolver o wbot Baileys, checa `providerType`. Pra Cloud API, exige template aprovado (bloqueia com erro claro se faltar) e envia via `SendMetaCloudTemplate.ts` (novo — envio ticket-less, diferente de `SendMetaCloudMessage.ts` que é centrado em ticket). Caminho Baileys original 100% preservado abaixo do novo bloco.
- **Frontend**: `CampaignModal` esconde as abas de mensagem livre e mostra seletor de template + botão "Sincronizar templates" quando o WhatsApp da campanha é Cloud API. Nenhuma mudança precisou em `CampaignController`/`CreateService`/`UpdateService` — Sequelize aceita `templateId` automaticamente por já ser coluna real do modelo.

**Fora do escopo (documentado):** mídia anexada a template (exigiria header de mídia configurado no próprio template) e variáveis dinâmicas no corpo (função já aceita `bodyParams`, mas nada popula a partir do texto da campanha ainda — templates sem variável, um caso comum, funcionam integralmente).

Validado: build isolado backend (tsc limpo) e frontend (CRA, sem warning nos arquivos alterados). Migração rodou automaticamente no boot. 5 testes funcionais reais contra o backend: sync com credenciais falsas (erro 401 real da Meta tratado), envio bloqueado corretamente quando template não aprovado, envio com erro real da Meta tratado, webhook de status atualizando o registro local (APPROVED→REJECTED confirmado no banco), e query com `include` de template confirmada. **Não foi possível validar a tela do `CampaignModal` num navegador real** (sem credenciais de login disponíveis nesta sessão) — recomendo validação visual manual antes de usar em produção. Backup rodado antes (`dape_backup_20260709_161027.sql.gz`).

Próximo passo: Fase F (DAPLE Shield com sinais reais da Meta).

## ✅ Fix — Meta Cloud API Fase F: DAPLE Shield com saúde real da Meta (2026-07-09)

**Commit:** `1d97508` — "feat: Meta Cloud API fase F - DAPLE Shield com saude real da Meta"

Responde diretamente ao pedido original do usuário: o Shield só olhava heurísticas internas (contadores próprios, quarentena por erro de envio) — nunca tinha consultado a Meta.

- **Campos novos no `Whatsapp`**: `metaQualityRating` (GREEN/YELLOW/RED), `metaMessagingLimit` (nível de limite, compartilhado entre números do mesmo WABA desde out/2025), `metaNameStatus`, `metaHealthSyncedAt`.
- **`SyncWhatsappHealthService.ts`** (novo): `syncWhatsappHealth` consulta `GET /{phone-number-id}?fields=quality_rating,whatsapp_business_manager_messaging_limit,name_status` (nomes de campo confirmados na doc oficial — o antigo `messaging_limit_tier` foi descontinuado em 2026). Cron a cada 2h sincroniza todos os números Cloud API automaticamente (a Meta reavalia a cada 6h).
- **Webhook**: passa a tratar `phone_number_quality_update`, `business_capability_update`, `phone_number_name_update`. Decisão de design: como o formato exato desses payloads não é totalmente documentado, o webhook é tratado só como *gatilho* — busca o estado real direto na Graph API via `resyncWabaHealth` em vez de parsear campos especulativos. `security` só gera log de alerta.
- **`calculateConnectionRisk`** (o coração desta fase): `quality_rating` RED agora retorna CRITICAL imediatamente; YELLOW soma +40 ao score; limite ainda no patamar inicial (`TIER_250`) soma +15. Só se aplica a conexões `meta_cloud` — Baileys continua com as heurísticas de sempre. `getStatus` passa a expor `metaHealth` também.

Validado com 5 testes funcionais reais: sync com token falso (erro real da Meta tratado), `RED` simulado → `CRITICAL/100`, `YELLOW`+`TIER_250` → `HIGH/55` com os motivos certos, `getStatus` retornando os dados corretos, e webhook sintético assinado disparando a re-sincronização (erro tratado nos dois níveis, sem quebrar a resposta). Build isolado (tsc limpo), migração rodou automaticamente. Backup rodado antes (`dape_backup_20260709_165317.sql.gz`).

**Pendente:** usuário precisa habilitar os campos de webhook `phone_number_quality_update`, `business_capability_update`, `phone_number_name_update` e `security` no painel da Meta (mesma tela do Passo 6) — o cron periódico funciona independente disso.

Próximo passo: Fase G (piloto real com número de produção).

## ✅ Fix — Meta Cloud API: App Review (Provedor de Tecnologia) + 3 bugs reais de ponta a ponta (2026-07-10)

**Commits:** `dae9d75`, `d9592ed`, `b3ddcfc`

### App Review / Embedded Signup — progresso e achados de configuração na Meta
- App só tinha o caso de uso "Messenger from Meta" configurado — sem caso de uso de WhatsApp formal, o "WhatsApp Embedded Signup" nem aparecia como variação de login disponível. Resolvido adicionando o caso de uso "Conectar-se com clientes pelo WhatsApp" (junto com Instagram/Messenger, que fazem parte do roadmap do Daple — ver `[[daple_roadmap_multicanal]]`).
- Conectar o WhatsApp da própria Pub Plus a si mesma exige o caminho **"Torne-se um Provedor de Tecnologia"** → **"Independent Tech Provider"** (não "Working with a Solution Partner", que é pra quando se usa infraestrutura de terceiro). Verificação de Negócio já **Aprovada**; Análise do App (Advanced Access de `whatsapp_business_management`/`whatsapp_business_messaging`) pendente — falta ícone do app, URL de política de privacidade (já publicada: `https://daple.pubplus.com.br/politica-privacidade`, servida direto pelo nginx pra evitar o bug do `serve -s` do frontend com arquivos estáticos) e os vídeos de demonstração.
- Configuração de login (`config_id`) inicial travava o OAuth com erro genérico "Sorry, something went wrong" — causa: permissões de Instagram/Ads (`ads_management`, `instagram_manage_events`, `pages_manage_ads`) empacotadas junto ficam **restritas** pela Meta sem aprovação própria, e isso quebra o handshake inteiro. Segunda configuração, só com WhatsApp Cloud API, resolveu — confirma que configs de login devem ser criadas por escopo mínimo necessário, não amplas "pra já deixar pronto".
- `FB.login()` rejeita callback `async` direto ("Expression is of type asyncfunction, not function") — corrigido em `EmbeddedSignupButton/index.js` (callback comum por fora, lógica assíncrona disparada por dentro via IIFE).
- Criado Usuário do Sistema ("Daple API Integration", role Employee) com token permanente (`expires_at: 0`, escopos `business_management`+`whatsapp_business_management`+`whatsapp_business_messaging`) — acesso de asset (WABA) precisa ser concedido explicitamente por WABA em Business Settings, não é automático nem para WABAs da mesma empresa dona do app.

### Três bugs reais que impediam uma conexão Cloud API de funcionar de ponta a ponta
Descobertos testando uma conexão direta (sem Embedded Signup) do número de teste da Meta numa conexão dedicada (`Whatsapps.providerType='meta_cloud'` configurado manualmente com o token do Usuário do Sistema, contornando o Embedded Signup pra WABAs que a própria Pub Plus já possui — não precisa do fluxo de "cliente externo compartilhando ativos" quando o dono do WABA é o mesmo dono do app):

1. **`EmbeddedSignupController.ts`** nunca setava `status: "CONNECTED"` no banco após signup bem-sucedido (só retornava isso no JSON de resposta) — `GetDefaultWhatsApp` só considera conexões com `status === 'CONNECTED'`, então a empresa aparecia sem nenhum WhatsApp configurado. Corrigido no `embeddedSignup` (seta `CONNECTED`) e no `rollback` (seta `DISCONNECTED` de volta).
2. **`CheckIsValidContact.ts`/`CheckNumber.ts`** chamavam `getWbot()` (Baileys) direto, sem checar `providerType` — gerava `ERR_WAPP_NOT_INITIALIZED` ("não existe conexão") ao iniciar uma conversa nova numa conexão Cloud API. Corrigido com bypass early-return quando `providerType === 'meta_cloud'` (a Cloud API não oferece um pré-check de número tipo `onWhatsApp` do Baileys — a validação real acontece no próprio envio).
3. **`StartWhatsAppSession.ts`** (chamada no boot do backend via `StartAllWhatsAppsSessions` e nos botões de reconexão) tentava iniciar sessão Baileys pra qualquer conexão, inclusive Cloud API — derrubava o `status` de `CONNECTED` pra `qrcode` a cada restart do backend. Corrigido com early-return no topo da função.
4. **`SendMetaCloudMessage.ts`** enviava a mensagem de verdade pra API da Meta (confirmado: chegava no destinatário) mas **nunca chamava `CreateMessageService`** — diferente de `SendWhatsAppMessage.ts` (Baileys), que sempre persiste e emite via socket após o envio. Resultado: mensagem saía mas nunca aparecia na tela do ticket, parecendo que o envio tinha falhado. Bug presente desde a implementação original (Fase 1/2), só descoberto agora ao testar envio real de ponta a ponta.
5. **Mensagens recebidas não chegavam ao Daple** (commit `d61a34c`) — envio funcionava, mas nenhuma resposta do cliente aparecia. Causa: a WABA só entrega webhook pra quem estiver explicitamente inscrito via `POST /{waba-id}/subscribed_apps` — a WABA de teste da Meta vinha assinada, por padrão, num app auxiliar interno da Meta ("WA DevX Webhook Events 1P App"), nunca no DAPLE API OFICIAL. Corrigido manualmente pra WABA de teste atual (via API, usando o token do Usuário do Sistema) e adicionada a chamada de assinatura dentro do próprio `embeddedSignup()`, pra que qualquer cliente futuro conectado via Embedded Signup real não caia no mesmo problema.

Todos os 5 fixes validados com teste real de ponta a ponta: envio confirmado chegando no WhatsApp real E aparecendo no ticket do Daple; resposta enviada pelo WhatsApp real confirmada chegando e persistida no ticket (`Messages.fromMe = false`). Backup rodado (`dape_backup_20260710_141340.sql.gz`).

**Pendente:** finalizar Análise do App na Meta (ícone, política de privacidade — já pronta —, vídeos de demonstração), depois piloto real (Fase G).

---

## 🔜 Sprint 3 — pendente

### 🚨 PRIORIDADE MÁXIMA — Instagram e Facebook (2026-07-10)

Instagram e Facebook (mensagens diretas / Messenger) **já constam nos informativos e divulgações do Daple**, e existem **clientes que fecharam contrato especificamente por causa dessas funções** — não é um "nice to have" de roadmap, é compromisso comercial já assumido com clientes pagantes. Ver também `[[daple_roadmap_multicanal]]` na memória.

**Sequência combinada com o usuário:**
1. Concluir agora só a aprovação da Meta pro **WhatsApp** (App Review, vídeos de demonstração — em andamento, ver Fase G/App Review acima).
2. **Assim que o WhatsApp for aprovado, Instagram e Facebook entram como prioridade máxima imediata** — não esperar terminar todo o resto do Sprint 3 antes de começar.
3. O caso de uso "Conectar-se com clientes pelo WhatsApp" e o "Gerenciar mensagens e conteúdo no Instagram"/"Interagir com os clientes no Messenger from Meta" já foram adicionados ao app `DAPLE API OFICIAL` na Meta (ver Casos de Uso, sessão 2026-07-09) — falta a implementação de código em si (webhook de Instagram/Messenger, `SendInstagramMessage`/`SendFacebookMessage` já existem no código mas não foram auditados/testados de ponta a ponta como foi feito com o WhatsApp Cloud API nesta sessão).

**Ação recomendada para a próxima sessão:** repetir para Instagram/Facebook o mesmo processo de auditoria de ponta a ponta que revelou os 5 bugs do WhatsApp Cloud API (persistência de mensagem enviada, assinatura de webhook na conta/página, status de conexão, etc.) — é provável que bugs da mesma classe existam também nesses canais, já que usam padrões de código similares.

---

- #009 Sequelize 5→6 (épico separado)
- **Integração API oficial Meta (plano replanejado — ver acima)** — Fases 1 (infra/credenciais), 2 (webhook de entrada), 3 (mídia), A (camada de abstração), B (motor de menu), C (motor de IA), E (templates/campanhas) e F (Shield com dados reais da Meta) concluídas. **Fase D (Flow Builder) investigada e adiada por decisão** (escopo maior que o esperado — ver investigação acima; só o fix pontual do #037 foi aplicado). Faltam: Fase G (piloto real), validação visual do `CampaignModal` num navegador real, habilitar os campos de webhook de saúde no painel da Meta, e — quando fizer sentido priorizar — o Flow Builder completo (ver mapeamento detalhado acima). Aguardando usuário concluir os passos manuais do documento "Configuração Única da Plataforma" (App Review pode levar dias/semanas).
- ~~#031 wbotMessageListener.ts refactor~~ — **encerrado nas Fases 1 a 6** (utilidades genéricas + parsing de mensagem + mídia/TTS + motor de IA + motor de Flow Builder + motor de Menu/Chatbot). 3389 → 1023 linhas. Decisão: não quebrar `handleMessage` (ver acima).
- ~~#019 tokenVersion / logout-everywhere~~ — concluído (ver acima)
- ~~#024 Encrypt WA session no DB~~ — concluído (ver acima)
- ~~#037 Socket.IO namespaces por tenant~~ — Fase 1 concluída (ver acima); Fase 2 opcional; Fase 3 não recomendada por ora; achados dois casos do mesmo bug pendentes de correção: um dentro de `flowbuilderIntegration` (Fase 5) e possivelmente outros ainda não auditados

**Ordem recomendada de execução (mais seguro → mais arriscado):** ~~#015~~ ✅ → ~~#019~~ ✅ → ~~#024~~ ✅ → #009 (precisa ambiente isolado pra rodar os 11 testes antes) → ~~#037 Fase 1~~ ✅ → ~~#031~~ ✅ (Fases 1-6, encerrado) → ~~Meta Cloud API Fase 1~~ ✅ → ~~Meta Cloud API Fase 2~~ ✅ → ~~Meta Cloud API Fase 3~~ ✅ → ~~Meta Cloud API Fase A~~ ✅ → ~~Meta Cloud API Fase B~~ ✅ → ~~Meta Cloud API Fase C~~ ✅ → Meta Cloud API Fase D (adiada, investigada) → ~~Meta Cloud API Fase E~~ ✅ → ~~Meta Cloud API Fase F~~ ✅ → Meta Cloud API Fase G (última fase - piloto real).

Resta **#009** (Sequelize) como próximo item de maior risco/impacto do Sprint 3, o achado pendente do #037 (namespaces não auditados dentro de `flowbuilderIntegration` e possivelmente outros pontos), e a continuação das fases 2-6 da integração Meta Cloud API.

---

---

## ✅ Auditoria + Janela de atendimento 24h (Cloud API) (2026-08-12)

**Auditoria completa da integração oficial (Embedded Signup, tokens, webhooks, templates, Coexistence, janela 24h)** feita antes de qualquer implementação — sem alterar Embedded Signup, produção ou configs Meta. Achado principal: DAPLE não implementava nenhum controle da janela de atendimento de 24h da Cloud API (mensagem livre fora da janela dependia só do erro 131047 da própria Meta, sem aviso prévio nem UX de contorno).

**Commits:** cd7c244 · 4e2ffb9 · af7e230 · a4bb877 · a2bf31c · 99795d0 · 9b378f4 · a7f44be (branch `sprint2/seguranca-resiliencia`, **pushados pro remoto**)

| # | Fix | Commit |
|---|-----|--------|
| 1 | Schema: `Ticket.lastInboundMessageAt`/`serviceWindowExpiresAt` | cd7c244 |
| 2 | Webhook grava janela em toda mensagem inbound (exceto `reaction`); corrigido emit de socket duplicado em `MetaCloudWebhookService.ts` | 4e2ffb9 |
| 3 | `SendMetaCloudMessage.ts` bloqueia envio livre fora da janela (`ERR_META_CLOUD_WINDOW_CLOSED`); template continua liberado; adicionado suporte a legenda/nome de arquivo em mídia (faltava no payload) | af7e230 |
| 4 | Indicador visual 🟢/🔒 + bloqueio de input em `MessageInputCustom/index.js`, sem polling (setTimeout único) | a4bb877 |
| 5 | **Bug pré-existente corrigido:** `MessageController.store()` roteava toda mídia pro Baileys (`SendWhatsAppMedia`) mesmo em conexões `meta_cloud` — mídia nunca saía de fato pela Cloud API. Agora respeita `providerType` e passa pela checagem de janela também | a2bf31c |
| 6 | **Drift de schema corrigido:** migration nova pra `Companies.approved` e `Contacts.isLid`, colunas usadas pelos models mas ausentes do histórico de migrations deste repo (existiam só em produção, criadas fora de uma migration em algum momento) | 99795d0 |
| 7 | Docs: atualização deste arquivo | 9b378f4 |
| 8 | **Drift de schema resolvido por completo:** migration nova reconstruindo `dape_plans`, `dape_tenant_plans`, `dape_plan_modules`, `dape_available_modules` e `dape_tenant_module_overrides` — schema conferido direto em produção via SSH somente-leitura (autorizado explicitamente pelo usuário), sequenciada antes de `20260623000001-add-billing-tables` que já dependia dessas tabelas | a7f44be |

**Testado localmente end-to-end**, incluindo cadeia completa de migrations do zero (sem nenhum patch manual, confirmando que o gap de schema foi fechado de vez): banner aberto/fechado renderiza corretamente, input bloqueado de verdade (testado digitando), backend bloqueia via API direta, webhook assinado com HMAC recalcula a janela ponta a ponta. **Atualização automática do banner via socket sem reload confirmada visualmente**: com o ticket já aberto na tela, disparado um segundo webhook simulando nova mensagem do cliente — banner recalculou de "22h56min" (valor antigo em cache) pra "23h59min restantes" sozinho, junto com mensagem e badge de não-lida aparecendo em tempo real, sem nenhuma navegação/reload.

**Pendente:** nenhuma das pendências desta sessão — Coexistence (fluxo novo de conexão) e job de renovação automática de token Meta continuam fora do escopo, registrados como próximos itens do roadmap (ver Sprint 3 acima).
- Coexistence (segundo fluxo de conexão) — só desenhado na auditoria, não implementado
- Job de renovação automática de token Meta — risco identificado, fora do escopo desta sessão

---

## ✅ Deploy controlado — WhatsApp Business + DAPLE (Coexistence) (2026-08-26/27)

**Commits:** `26d3613` (feature completa) + `95faddb` (plumbing docker-compose/Dockerfile) — produção em `fc7c5a1`/`64e94ac`

Terceira modalidade de conexão, isolada das outras duas (nenhuma alterada):
1. **Legacy/session** (Baileys QR) — intocado
2. **Cloud API tradicional** (`meta_cloud`, config_id `917113721410373`, `EmbeddedSignupButton`/`EmbeddedSignupController`) — **intocado, validado com smoke test real pós-deploy** (quality_rating=GREEN, TIER_2K, APPROVED)
3. **Coexistence** (`meta_cloud_coexistence`, config_id `2305329230296796`, `CoexistenceSignupButton`/`CoexistenceSignupController`) — novo

**Arquitetura:** `isMetaCloudProvider()` (backend `helpers/isMetaCloudProvider.ts` + frontend espelho `helpers/isMetaCloudProvider.js`) trata `meta_cloud`+`meta_cloud_coexistence` como Cloud API em todos os pontos de roteamento. `CoexistenceChannel` delega por composição pra `CloudApiChannel` (mesmo transporte Graph API). `CoexistenceObservationService` só observa webhooks `history`/`smb_app_state_sync`/`smb_message_echoes` (tabela `dape_coexistence_events`, allowlist de campos técnicos, nunca conteúdo/PII) — sem side-effect em Message/Ticket ainda (fase 1).

**Feature flag:** módulo `whatsapp_coexistence` no catálogo (`dape_available_modules`), sem concessão automática por plano. Habilitado via override oficial (`dape_tenant_module_overrides`) **só pra `companyId=3` (DAPLE TEST)**.

**⚠️ Caveat conhecido, aceito por ora:** `moduleAccess.service.ts` tem bypass pré-existente pra empresas `is_master=true` (só `companyId=1`, Pub Plus Brasil) — recebem qualquer módulo automaticamente, ignorando overrides. O botão Coexistence aparece nela também, não só na DAPLE TEST. Nada é executado só por o botão aparecer; avaliar depois se a regra precisa de exceção.

**Migrations aplicadas em produção** (via entrypoint automático, todas idempotentes/guardadas): `20260622000008` (billing/planos, reconstrução de drift), `20260812000001`/`20260812000002` (janela 24h + drift Companies/Contacts), `20260824000001/2/3` (campos Coexistence, tabela `dape_coexistence_events`, registro do módulo).

**Deploy feito via rsync + git commit direto no servidor** (não `git pull`) — o PAT salvo no remote `origin` expirou (401 na API do GitHub), ver Issues conhecidos abaixo.

**Backup pré-deploy:** `/root/pre_coexistence_backup_20260826.dump` (pg_dump -F c, 554KB) · `.env` original em `/root/dape/.env.bak-pre-coexistence-20260826`.

**Pendente (parado por decisão do usuário até nova autorização):** clicar em "Conectar WhatsApp Business + DAPLE" na DAPLE TEST e completar o Embedded Signup real com número já ativo no WhatsApp Business App (id 12, "Atendente 02"). Ver plano de teste E2E completo na conversa da sessão.

---

## Issues conhecidos
- **PAT do git remote (`origin`) expirou** (401 Unauthorized na API do GitHub, confirmado em 2026-08-26) — `git push`/`pull` não funcionam mais nem local nem em produção. Deploy desta sessão feito via `rsync` direto + commit local no servidor. Necessário gerar um novo PAT e reconfigurar o remote antes do próximo deploy baseado em git.
- SSH pro servidor Daple (`root@187.127.25.246`) às vezes tenta autenticar por chave pública antes da senha e trava esperando passphrase (nunca recebe). Forçar `-o PreferredAuthentications=password -o PubkeyAuthentication=no` no comando ssh/sshpass evita o travamento.

## Documentos no repositório
- BACKUP_RUNBOOK.md · DEPLOY_SPRINT1.md · SPRINT1_VALIDATION.md
- SPRINT2_REPORT.md · DEPLOY_SPRINT2.md · DEPLOY_SPRINT2_RESULTADO.md
- backend/src/__tests__/sprint1/ (5 testes) · sprint2/ (6 testes, 40 casos)
