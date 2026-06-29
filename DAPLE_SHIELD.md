# DAPLE Shield
**Camada inteligente de proteção operacional que monitora o comportamento das conexões, reduz riscos de bloqueio e mantém o atendimento seguro mesmo em cenários de instabilidade.**

---

## O que é

O DAPLE Shield é um módulo de proteção que intercepta **todos os envios ativos de mensagens WhatsApp** antes que cheguem ao Baileys/API. Ele avalia o risco da operação em tempo real e decide: permitir, bloquear ou registrar alertas.

---

## Tabelas do Banco de Dados

### `daple_shield_config`
Configuração por empresa + conexão WhatsApp.

| Campo | Tipo | Padrão | Descrição |
|---|---|---|---|
| `company_id` | INT | — | ID da empresa |
| `whatsapp_id` | INT | — | ID da conexão WhatsApp |
| `is_enabled` | BOOL | TRUE | Liga/desliga o Shield para essa conexão |
| `max_msgs_per_minute` | INT | 20 | Máximo de mensagens por minuto |
| `max_msgs_per_hour` | INT | 200 | Máximo de mensagens por hora |
| `max_msgs_per_day` | INT | 1000 | Cota diária de mensagens |
| `respect_business_hours` | BOOL | FALSE | Bloqueia envios fora do horário comercial |
| `business_hours_start` | TIME | NULL | Início do horário comercial (ex: 08:00) |
| `business_hours_end` | TIME | NULL | Fim do horário comercial (ex: 22:00) |
| `auto_quarantine_enabled` | BOOL | TRUE | Quarentena automática por erros acumulados |
| `quarantine_threshold_min` | INT | 5 | Erros em 5min para acionar quarentena |
| `quarantine_duration_min` | INT | 30 | Duração da quarentena em minutos |

### `daple_shield_audit_log`
Log imutável de todas as tentativas de envio.

| Campo | Descrição |
|---|---|
| `source` | Origem: `manual`, `campaign`, `schedule`, `bot`, `integration`, `api`, `flow`, `typebot` |
| `decision` | `ALLOW` ou `BLOCK` |
| `block_reason` | `RATE_LIMIT`, `QUOTA_EXCEEDED`, `BUSINESS_HOURS`, `QUARANTINE`, `DISABLED` |
| `msgs_in_last_minute/hour/today` | Contadores no momento da avaliação |

### `daple_shield_counters`
Contadores por janela de tempo (minuto/hora/dia). Incrementados a cada mensagem permitida.

### `daple_shield_quarantine`
Estado de quarentena ativa. Uma conexão em quarentena tem todos os envios bloqueados até `quarantine_until`.

---

## Fontes de Mensagem (source)

| Source | Descrição | Prioridade |
|---|---|---|
| `manual` | Atendente humano via interface | Máxima |
| `bot` | Chatbot automático / respostas de IA | Alta |
| `schedule` | Mensagem agendada pelo usuário | Média |
| `flow` | Flow builder / webhook | Média |
| `typebot` | Integração Typebot | Média |
| `api` | API externa autenticada | Baixa |
| `integration` | MkAuth / IXC / Asaas (cobranças) | Baixa |
| `campaign` | Campanha bulk | Mínima |

---

## Endpoints REST

Base: `/api/dape/shield/`

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/stats` | Estatísticas 7 dias por conexão |
| `GET` | `/:whatsappId/status` | Status atual (config + contadores + quarentena) |
| `GET` | `/:whatsappId/config` | Configuração da conexão |
| `PUT` | `/:whatsappId/config` | Salvar/atualizar configuração |
| `GET` | `/:whatsappId/audit` | Log de auditoria (paginado) |
| `DELETE` | `/:whatsappId/quarantine` | Liberar quarentena manualmente |

---

## Limites Recomendados por Caso de Uso

| Caso | msg/min | msg/hora | msg/dia |
|---|---|---|---|
| Atendimento humano normal | 30 | 300 | 2000 |
| Bot de suporte | 20 | 200 | 1000 |
| Campanhas B2B pequenas | 10 | 100 | 500 |
| Campanhas B2C | 5 | 60 | 300 |
| Integrações de cobrança | 15 | 150 | 800 |

---

## Comportamento de Falha

O Shield é **fail-open**: se ocorrer qualquer erro interno (banco indisponível, query falhando), a mensagem é **permitida automaticamente**. O Shield nunca bloqueia por erro próprio.

Se não existir configuração para uma conexão, todas as mensagens são permitidas (pass-through).

---

## Pontos de Integração Atuais

| Ponto | Arquivo | Source |
|---|---|---|
| Campanhas bulk | `queues.ts` → `handleDispatchCampaign` | `campaign` |
| Rotas REST (config/audit/stats) | `dape/shield/dapleShield.routes.ts` | — |

---

## Próximos Passos (Fase 2)

1. Integrar `SendWhatsAppMessage.ts` — envios manuais e bot
2. Integrar `helpers/SendMessage.ts` — fila messageQueue e schedules
3. Criar `ShieldedSend.ts` — wrapper para integrações MkAuth/IXC/Asaas
4. Adicionar frontend: painel DAPLE Shield em Conexões
5. Alertas em tempo real via WebSocket quando conexão entrar em quarentena
6. Limpeza automática de contadores com mais de 30 dias
7. Relatório semanal de risco por empresa
