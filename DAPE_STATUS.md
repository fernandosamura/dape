# DAPE — Status de Desenvolvimento

Última atualização: 2026-06-15

## Módulos

| Módulo           | Backend | Frontend | Migration | Status         |
|------------------|---------|----------|-----------|----------------|
| DAPE Foundation  | ✅      | ✅       | ✅        | Completo       |
| DAPE Pipeline    | ✅      | ✅       | ✅        | Completo       |
| DAPE Analytics   | ✅      | ✅       | ✅        | Completo       |
| DAPE IA          | ✅      | ✅       | ✅        | Completo       |
| DAPE Growth      | ✅      | ✅       | ✅        | Completo       |
| DAPE Intelligence| ✅      | ✅       | ✅        | Completo       |
| DAPE Radar       | ✅      | ✅       | ✅        | Completo       |
| DAPE Automation  | ✅      | —        | ✅        | Completo       |

Legenda: ✅ Completo | 🔄 Em andamento | ⬜ Pendente | ❌ Com erro

## Último backup realizado
Local: /home/backup/dape_auto_20260615_143722
Data: 2026-06-15 14:37:22

## DAPE Automation — COMPLETO (2026-06-15)

### Migration 007 — Manutenção e Retenção de Dados
- Índice `idx_dape_access_log_accessed_at` para limpeza eficiente
- Status `archived` adicionado ao radar (+ coluna `archived_at`)
- Tabela `dape_maintenance_log` para auditoria das limpezas
- Função `dape_run_maintenance()` centraliza todas as limpezas

### Jobs Automáticos — dapeAutomation.cron.ts
Arquivo: `/root/dape/backend/src/dape/dapeAutomation.cron.ts`
Registrado em: `server.ts` via `startDapeAutomation()`

| Job | Horário | Função |
|-----|---------|--------|
| Manutenção banco | Diário 02:00 | Limpa logs >90d, sugestões não usadas >30d, arquiva radar descartados >60d, deduplica score events |
| Campaign Results automáticos | Diário 23:50 | Calcula leads/contratos/receita do dia de campanhas ativas |
| Score por inatividade | A cada 4h | Aplica -10pts (3 dias sem resposta) e -20pts (7 dias) automaticamente |
| Score por palavras-chave | A cada 4h | Detecta "orçamento/proposta/reunião" nas mensagens e pontua leads |
| Resumo IA automático | A cada 4h | Gera resumo IA para leads HOT sem análise nas últimas 6h (max 5/empresa/ciclo) |
| Intelligence recálculo | Segunda 06:00 | Recalcula digital_presence_score de perfis com >6 dias sem atualização |
| Snapshot incremental | A cada 4h | Salva 5 métricas essenciais em tempo real no dape_analytics_snapshots |

### Regras de detecção automática de score:
- `orcamento` (+25): palavras "orçamento", "cotação", "quanto custa", "preço", "proposta de preço"
- `abriu_proposta` (+15): palavras "proposta", "apresentação", "envia proposta"
- `reuniao` (+20): palavras "reunião", "agendar", "call", "meet", "teams"
- Deduplicação: não pontua mesmo evento no mesmo contato em <3 dias

### Proteções implementadas:
- Rate limit IA: máx 5 tickets por empresa por ciclo + delay 2s entre chamadas
- Deduplicação score: verifica eventos dos últimos 3 dias antes de pontuar
- Inatividade: verifica janelas 3-7d e 7d+ separadamente (não sobrepõe)
- Batch Intelligence: 50 perfis por rodada com delay 50ms entre updates
- Snapshot incremental: usa ON CONFLICT para sobrescrever (não acumula)
- Todos os jobs logam em `dape_maintenance_log` via `dape_run_maintenance()`

## Foundation (Sessão 0) — COMPLETO
- 6 tabelas dape_: modules, plans, plan_modules, tenant_plans, overrides, access_log
- Planos: Master (todos), Starter (Pipeline+Analytics), Pro (+IA+Growth), Enterprise (todos)
- moduleGuard, masterGuard, useDapeModules, DapeModuleGuard, DapeMasterPanel

## Pipeline (Sessões 1 e 2) — COMPLETO
- Migration 001: dape_lead_scores, dape_score_events
- Score +10/+15/+20/+25 / -10/-20 | cold/warm/hot | probabilidade score×0.95 máx 95%
- DapeScoreBadge, DapeScoreEventModal, DapeLeadScoreWidget, DapePipelineSummary
- Widget no ContactDrawer | Menu: 📊 Pipeline | Rota: /dape/pipeline

## Analytics (Sessões 3 e 4) — COMPLETO
- Migration 002: dape_analytics_snapshots, dape_conversion_events
- Cron 23:59 (snapshot completo) + snapshot incremental a cada 4h (5 métricas)
- Dashboard recharts: KPIs + linha + barras + funil + tabela | Filtros Hoje/7d/30d/90d
- Menu: 📈 Analytics | Rota: /dape/analytics

## IA (Sessões 5 e 6) — COMPLETO
- Migration 003: dape_ia_summaries, dape_ia_suggestions, dape_ia_rate_limits
- gpt-4o-mini: summarize, suggestReply (3 opções), nextAction | rate limit 10/min
- Auto-summarize de leads HOT (a cada 4h, máx 5/empresa)
- DapeIASummary no ContactDrawer | DapeIAReplyModal | botão 🤖 no MessageInput

## Growth (Sessão 7) — COMPLETO
- Migration 004: dape_campaigns, dape_campaign_results, dape_goals
- Campaign results calculados automaticamente às 23:50 (leads, contratos, receita do dia)
- DapeGrowth: cards metas, barras progresso, lista campanhas, modais criar/editar/resultado
- Menu: 🚀 Growth | Rota: /dape/growth

## Intelligence (Sessão 8) — COMPLETO
- Migration 005: dape_company_profiles
- Score automático recalculado toda segunda às 06:00 (digital presence + potential)
- DapeIntelligencePanel + DapeIntelligencePage
- Menu: 🏢 Intelligence | Rota: /dape/intelligence

## Radar (Sessão 9) — COMPLETO
- Migration 006: dape_radar_opportunities (+ status 'archived' adicionado em 007)
- Score automático ao criar/editar | Auto-archive de descartados >60 dias
- DapeRadarPage: cards, filtros, tabela paginada, bulk import JSON
- Menu: 📡 Radar | Rota: /dape/radar

## Issues conhecidos
- Nenhum no momento

## Próxima tarefa
Sistema DAPE 100% completo com automações ativas.
Possíveis evoluções futuras:
- Dashboard executivo consolidado (todos os módulos em uma tela)
- Integração Radar com Google Maps API
- Webhook outbound para integração com CRMs externos
- Relatório semanal automático por email

## Infraestrutura (referência)
- Servidor: root@dape.pubplus.com.br
- DB: docker exec dape-postgres-1 psql -U postgres codatende
- Rede Docker: dape_app-network
- Nginx: 80/443 → frontend:3001, /api/ → backend:3000
- OpenAI: Settings.key='openaiApiKey' por empresa ou env OPENAI_API_KEY
- Reiniciar backend: docker restart dape-backend-1
- Reiniciar frontend: docker restart dape-frontend-1
- Ver logs automação: docker logs dape-backend-1 --tail 50 | grep 'DAPE Automation'
- Ver log manutenção: docker exec dape-postgres-1 psql -U postgres codatende -c "SELECT * FROM dape_maintenance_log ORDER BY run_at DESC LIMIT 20;"

## Central de Administração Unificada (2026-06-15)

### Integração Realizada
O menu DAPE Master foi expandido para ser a **única central de administração** do sistema.

**Backend — dapeMasterNative.controller.ts:**
-  — lista empresas com plano nativo + plano DAPE unificados
-  — cria empresa com plano nativo e DAPE em um formulário
-  — edita empresa (nome, email, plano sistema, plano DAPE, vencimento)
-  — remove empresa + dados DAPE relacionados
-  — lista planos nativos com contagem de empresas
-  — cria plano nativo
-  — edita plano nativo
-  — remove plano (com proteção: não remove se tem empresas)

**Frontend — DapeMasterPanel.js (novo, 5 abas):**
- Tab 0 🏢 Empresas: tabela unificada com plano nativo + DAPE + vencimento + status + ações
  - Criar empresa: seleciona Plano Sistema E Plano DAPE no mesmo formulário
  - Editar empresa: todos os campos em um dialog
  - Excluir com confirmação (mantém tickets/contatos nativos, remove dados DAPE)
- Tab 1 📋 Planos Sistema: CRUD de planos nativos em cards (users/connections/queues/features)
- Tab 2 ⚡ Planos DAPE: visualização dos planos de módulos (read-only, gestão via admin DAPE)
- Tab 3 🔧 Módulos: override de módulos por empresa (antigo comportamento, preservado)
- Tab 4 📊 Monitoramento: uso dos módulos nos últimos 30 dias

**SettingsCustom — Redirecionamento:**
- Abas Empresas e Planos em Configurações mantidas (retrocompatibilidade)
- Banner amarelo informativo adicionado com link direto para o DAPE Master
- CompaniesManager e PlansManager originais continuam funcionando como fallback
