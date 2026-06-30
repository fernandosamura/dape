# Instruções de Deploy — Sprint 2
**Branch:** `sprint2/seguranca-resiliencia`
**Servidor:** root@187.127.25.246
**Janela de manutenção:** ~10 minutos
**Impacto:** ~2 min de indisponibilidade durante restart do backend

> ⚠️ **NÃO faça isso agora.** Este arquivo é para ser executado na janela de manutenção autorizada.
> Avise os usuários com 30 minutos de antecedência.

---

## ANTES DE COMEÇAR — Avise os usuários

Mensagem sugerida para o grupo/canal de avisos:
> "O sistema DAPLE ficará em manutenção por ~10 minutos às [HORA].
> Após a manutenção, as conexões WhatsApp precisarão de novo QR Code.
> Usuários não precisarão fazer login novamente."

---

## PASSO 0 — Confirme que o backup rodou hoje

```bash
ssh root@187.127.25.246
tail -3 /var/log/dape-backup.log
```
Deve mostrar `Backup finalizado com sucesso` com a data de hoje.
**Se não mostrar — NÃO prossiga. Rode o backup manualmente primeiro:**
```bash
/opt/dape-backup/backup.sh
```

---

## PASSO 1 — Crie a tag de rollback ANTES de tudo

```bash
ssh root@187.127.25.246
cd /root/dape
git tag pre-sprint2-$(date +%Y%m%d)
```

---

## PASSO 2 — Adicione CSRF_SECRET ao .env (obrigatório)

```bash
# Gere a chave segura
CSRF_KEY=$(openssl rand -hex 32)
echo "CSRF_SECRET=$CSRF_KEY" >> /root/dape/.env

# Confirme que foi adicionada
grep CSRF_SECRET /root/dape/.env
```

---

## PASSO 3 — Faça o deploy

```bash
cd /root/dape

# Atualiza o código
git fetch origin
git checkout sprint2/seguranca-resiliencia
git pull origin sprint2/seguranca-resiliencia

# Rebuild e restart apenas do backend
docker compose up -d --build backend

# Aguarda o container subir (normalmente 30-60 segundos)
sleep 30
```

---

## PASSO 4 — Execute a migration 018 (idempotente, pode rodar com segurança)

```bash
docker exec dape-postgres-1 psql -U postgres -d codatende \
  -f /dev/stdin << 'SQL'
$(cat /root/dape/backend/src/dape/migrations/018_billing_events_unique.sql)
SQL
```

Alternativa se o heredoc acima não funcionar:

```bash
# Copia o arquivo para dentro do container e executa
docker cp /root/dape/backend/src/dape/migrations/018_billing_events_unique.sql \
  dape-postgres-1:/tmp/018.sql

docker exec dape-postgres-1 psql -U postgres -d codatende -f /tmp/018.sql
```

Saída esperada: `DO` (sem erros)

---

## PASSO 5 — Smoke tests (execute TODOS antes de declarar sucesso)

### 5.1 — Health check
```bash
curl -s http://localhost:3000/health
# Esperado: {"status":"ok","db":"ok","ts":"..."}
```

### 5.2 — CSRF token
```bash
curl -s -c /tmp/cookies.txt http://localhost:3000/csrf-token
# Esperado: {"token":"...algum token..."}
```

### 5.3 — Rate limit (confirma que não bloqueia uso normal)
```bash
# Deve retornar 200, não 429
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health
```

### 5.4 — Login via interface web
Abra o painel DAPLE no navegador e faça login com seu usuário.
Deve funcionar normalmente sem solicitar novo login.

### 5.5 — Webhook Asaas (teste com payload simulado)
```bash
curl -s -X POST http://localhost:3000/webhooks/asaas \
  -H "Content-Type: application/json" \
  -H "asaas-access-token: $(grep ASAAS_WEBHOOK_TOKEN /root/dape/.env | cut -d= -f2-)" \
  -d '{"id":"TEST_EVT_001","event":"PAYMENT_CONFIRMED","payment":{"id":"TEST_PAY_001"}}'
# Esperado: {"status":"received"}

# Segunda requisição com mesmo ID — deve ser idempotente
curl -s -X POST http://localhost:3000/webhooks/asaas \
  -H "Content-Type: application/json" \
  -H "asaas-access-token: $(grep ASAAS_WEBHOOK_TOKEN /root/dape/.env | cut -d= -f2-)" \
  -d '{"id":"TEST_EVT_001","event":"PAYMENT_CONFIRMED","payment":{"id":"TEST_PAY_001"}}'
# Esperado: {"status":"already_processed"}
```

### 5.6 — QR Code das conexões WhatsApp
Acesse o painel → Conexões e reescaneie o QR Code de todas as conexões
que aparecerem com status `qrcode`.

---

## Sinais de que algo deu errado (rollback imediato)

| Sinal | O que fazer |
|-------|-------------|
| `/health` retorna 503 | Rollback (passo abaixo) |
| `docker logs dape-backend-1` mostra `CSRF_SECRET` ou `CRYPTO_SECRET_KEY` ausente | Adicionar chave ao .env e reiniciar |
| Erro `SequelizeConnectionAcquireTimeoutError` repetido | Aumentar DB_POOL_MAX ou verificar conexões abertas no Postgres |
| Frontend não consegue fazer login (403 em toda requisição POST) | Verificar se CSRF_SECRET foi adicionado corretamente |
| Frontend mostra erro 403 em rotas protegidas | Limpar cookies do navegador (CSRF cookie inválido do deploy anterior) |

---

## ROLLBACK — Se precisar reverter

```bash
ssh root@187.127.25.246
cd /root/dape

# Volta para o código do Sprint 1
git checkout pre-sprint2-$(date +%Y%m%d)
docker compose up -d --build backend

# Confirma que voltou
curl -s http://localhost:3000/health
```

> A migration 018 (constraint nomeada) é segura de manter mesmo após rollback.
> Ela não remove dados nem altera comportamento do banco.

---

## Após o deploy — checklist de 24h

- [ ] Verificar `/var/log/dape-backup.log` às 03:00 BRT do dia seguinte
- [ ] Verificar Sentry: nenhum `CSRF_INVALID` legítimo (pode ter alguns minutos após deploy enquanto cookies propagam)
- [ ] Verificar BillingQueue no Redis (se tiver acesso ao Bull Board): jobs devem estar sendo processados
- [ ] Confirmar que conexões WhatsApp importantes foram reconectadas via QR
