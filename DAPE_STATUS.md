# DAPE — Status de Desenvolvimento

Ultima atualizacao: 2026-06-25

## Servidor de Producao
- **VPS nova (Hostinger Brasil):** root@187.127.25.246
- **Dominio:** https://daple.pubplus.com.br
- **SSL:** Let's Encrypt — valido ate 23/09/2026 (renovacao automatica ativa)
- **VPS antiga (Hostinger EUA):** 2.25.196.154 — DESCOMISSIONADA em 2026-06-25

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
| Grupos WhatsApp    | OK      | OK       | OK        | Completo |

## Ultimo backup realizado
Local: /Volumes/PUBSERVER/PUB PLUS ADM/DAPLE PUB PLUS/backup_dape_completo_20260624.tar.gz
Data: 2026-06-24
Conteudo: public/ (midias .oga), brands/, instances.json, .env, backend/.env, dump PostgreSQL (320KB / 71 tabelas)

---

## Sessao 2026-06-25 — Migracao VPS + UI/UX

### 1. Migracao de Servidor (EUA -> Brasil)
- Nova VPS Hostinger Brasil: 187.127.25.246
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

### 5. UI — Chat Interno (Chat Interno bolhas + lista premium)
- ChatMessages.js: boxLeft (outro usuario) blue -> #daeeff (azul pastel claro)
- ChatMessages.js: boxRight (proprio usuario) green -> #d6f5e3 (verde pastel claro)
- Ambas com borderRadius 12px, boxShadow suave e borda semi-transparente
- ChatList.js: itens com borderRadius 8px, margin, hover com fundo sutil e sombra
- Item selecionado: borda azul #1976d2 + fundo rgba(25,118,210,0.08) + sombra

### 6. Grupos WhatsApp — multi-atendente (sessao anterior, commit e5c002c)
- Tabela TicketUsers (migration 20260624000003)
- Model TicketUser.ts + BelongsToMany em Ticket.ts
- Rotas: POST /tickets/:id/join, POST /tickets/:id/leave, GET /tickets/:id/users
- SendWhatsAppMessage: prefixo [Nome] em mensagens de grupo
- Frontend: botoes Entrar/Sair do Grupo + exibicao do remetente em grupos

## Commits desta sessao
- ec7eda6 feat: UI Chat Interno — bolhas pastel (azul/verde claro) + layout lista premium
- c18d068 fix: favicon com fundo transparente (RGBA, PNG embutido no ICO)
- 67f52af feat: substitui favicon pelo mascote DAPLE (robo no foguete)
- 28ded8c feat: UI/UX menu lateral — remove emojis, renomeia Open.Ai para Daple AI, move Assinatura
- 867e369 fix: converte req.user.id para Number no MessageController (TS type error)
- e5c002c feat: userId no MessageController + frontend grupos (join/leave/remetente)

---

## Correcoes aplicadas (2026-06-24 sessao 2) — handleOpenAi 4 melhorias

### 1. Roteamento para Fila corrigido
- Funcao transferQueue: status=pending, userId=null, chatbot=false
- Ticket aparece corretamente na aba Aguardando apos atendimento da IA

### 2. Delay Humanizado — Sammy Digitando
- sendWithTypingDelay: presenceSubscribe + sendPresenceUpdate(composing) + delay
- Delay = clamp(palavras x 60ms + jitter(0-400ms), 800ms, 4000ms)

### 3. Novos Modelos Gemini (familias 2.5 e 3.1)
- Gemini 2.5: flash, flash-lite, flash-preview-tts, pro, pro-preview
- Gemini 3.1: flash-lite, flash, flash-tts, pro, pro-preview, flash-live
- Adicionados: gemini-3.5-flash, gemini-3-flash-preview

### 4. Transcricao de Audio com Gemini Multimodal
- Audio enviado em base64 via inlineData direto no payload

---

## Correcoes aplicadas (2026-06-24 sessao 1) — DapeDeal + IA Rate Limit

### 1. DapeDeal — column does not exist
- Correcao: @Table({ underscored: true }) em DapeDeal.ts

### 2. Rate Limit IA: MAX_CALLS_PER_MINUTE 10 -> 50

### 3. Migrations: dape_ia_rate_limits, dape_ia_summaries, dape_ia_suggestions, colunas Prompts

---

## Correcoes anteriores (2026-06-18 a 2026-06-23)
- Billing/Asaas: tabelas dape_billing_invoices, dape_billing_events
- Constraints por empresa: Queues, Whatsapps, QueueIntegrations, Settings
- Parecer Tecnico Manus AI: 6 correcoes de backend

---

## Issues conhecidos
- Sessoes WhatsApp precisam de reconexao via QR Code na nova VPS
- git push configurado com PAT (token armazenado apenas temporariamente no remote URL)

## Proxima tarefa
- Reconectar conexoes WhatsApp (Pop e Pub Plus Brasil) via QR Code
- Monitorar logs em producao na nova VPS
