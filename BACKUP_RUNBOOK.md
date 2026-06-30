# Como funciona meu backup — DAPLE

**Última atualização:** 2026-06-30
**Configurado por:** SRE automatizado

---

## Resumo em uma linha

Todo dia às **03:00 da manhã** (horário de Brasília), o sistema faz uma cópia completa
do banco de dados e envia automaticamente para a **Cloudflare R2** (o mesmo armazenamento
que guarda as mídias do DAPLE). Nenhuma ação sua é necessária.

---

## Como funciona (explicado simples)

```
03:00 BRT todos os dias
       ↓
[Servidor] tira uma "foto" completa do banco de dados
       ↓
Comprime o arquivo (fica ~80% menor)
       ↓
Verifica se o arquivo ficou grande o suficiente (se falhar, para e registra o erro)
       ↓
Envia para a Cloudflare R2 (pasta: daplemidias/backups/)
       ↓
Apaga arquivos locais com mais de 30 dias
       ↓
Apaga arquivos no R2 com mais de 90 dias
       ↓
Registra "Backup OK" no log
```

---

## Onde ficam os backups

| Local | Caminho | Retenção |
|-------|---------|----------|
| Servidor (local) | `/opt/dape-backup/local/` | 30 dias |
| Cloudflare R2 | `daplemidias/backups/` | 90 dias |

---

## Como verificar se o backup está funcionando

### Opção 1 — Ver o log (mais fácil)
Acesse o servidor via SSH e rode:
```bash
tail -20 /var/log/dape-backup.log
```
Se a última linha diz algo como:
```
[2026-06-30 06:00:01] Backup finalizado com sucesso: dape_backup_20260630_060001.sql.gz (169K)
```
Está tudo certo ✅

Se mostrar `ERRO`, tem problema — veja a seção "O que fazer se o backup falhar".

### Opção 2 — Ver os arquivos no servidor
```bash
ls -lh /opt/dape-backup/local/
```
Deve ter um arquivo novo todo dia.

### Opção 3 — Ver no painel da Cloudflare
1. Acesse dash.cloudflare.com
2. Vá em **R2** → bucket **daplemidias** → pasta **backups/**
3. Deve ter um arquivo novo por dia

---

## Como RESTAURAR o banco (se algo der muito errado)

> ⚠️ Faça isso APENAS em emergência. Restaurar apaga os dados atuais.

**Passo 1 — Entre no servidor via SSH:**
```bash
ssh root@187.127.25.246
```

**Passo 2 — Escolha o backup que quer restaurar:**
```bash
ls -lh /opt/dape-backup/local/
```
Pegue o nome do arquivo mais recente (ex: `dape_backup_20260630_060001.sql.gz`)

**Passo 3 — Restaure:**
```bash
# Substitua NOME_DO_ARQUIVO pelo arquivo que escolheu
gunzip -c /opt/dape-backup/local/NOME_DO_ARQUIVO \
  | docker exec -i dape-postgres-1 pg_restore \
      -U postgres -d codatende \
      --clean --if-exists --no-privileges --no-owner
```

**Passo 4 — Reinicie o backend:**
```bash
cd /root/dape && docker compose restart backend
```

**Se o arquivo local não existir mais** (passou de 30 dias), baixe do R2:
```bash
# Veja quais estão disponíveis no R2:
R2_KEY=$(grep CLOUDFLARE_R2_ACCESS_KEY_ID /root/dape/.env | cut -d= -f2-)
R2_SECRET=$(grep CLOUDFLARE_R2_SECRET_ACCESS_KEY /root/dape/.env | cut -d= -f2-)
R2_EP=$(grep CLOUDFLARE_R2_ENDPOINT /root/dape/.env | cut -d= -f2-)
AWS_ACCESS_KEY_ID="$R2_KEY" AWS_SECRET_ACCESS_KEY="$R2_SECRET" \
  aws s3 ls s3://daplemidias/backups/ --endpoint-url "$R2_EP" --region auto

# Baixe o que quiser:
AWS_ACCESS_KEY_ID="$R2_KEY" AWS_SECRET_ACCESS_KEY="$R2_SECRET" \
  aws s3 cp s3://daplemidias/backups/NOME_DO_ARQUIVO /tmp/ \
  --endpoint-url "$R2_EP" --region auto
```

---

## O que fazer se o backup falhar

### Como saber que falhou
O log vai mostrar uma linha com `ERRO`. Por exemplo:
```
[2026-06-30 06:00:01] ERRO: variavel DB_USER esta vazia. Abortando.
```

### Causas mais comuns e soluções

| Erro no log | O que significa | O que fazer |
|-------------|-----------------|-------------|
| `variavel X esta vazia` | Uma configuração sumiu do `.env` | Chame o suporte técnico |
| `muito pequeno` | Dump gerou arquivo suspeito | Rode o backup manualmente e veja o erro |
| `NoSuchBucket` | Bucket R2 não encontrado | Verifique o painel Cloudflare R2 |
| `InvalidAccessKeyId` | Credenciais R2 expiraram | Gere novas chaves no painel Cloudflare |
| `cannot execute` | Docker não está rodando | `docker ps` — se vazio, `docker compose up -d` |

### Rodar o backup manualmente (para testar ou forçar)
```bash
ssh root@187.127.25.246
/opt/dape-backup/backup.sh
```
Você vai ver cada passo na tela em tempo real.

---

## Arquivos importantes no servidor

| Arquivo | Para que serve |
|---------|----------------|
| `/opt/dape-backup/backup.sh` | O script que faz o backup |
| `/opt/dape-backup/local/` | Pasta com os backups dos últimos 30 dias |
| `/var/log/dape-backup.log` | Registro de todos os backups (sucesso e falha) |
| `/etc/logrotate.d/dape-backup` | Faz o log não crescer indefinidamente |

---

## Teste de restauração realizado

**Data:** 2026-06-30 às 02:47 BRT
**Resultado:** ✅ Aprovado

Registros comparados entre backup restaurado e produção:

| Tabela | Produção | Backup Restaurado | Bate? |
|--------|----------|-------------------|-------|
| Usuários | 17 | 17 | ✅ |
| Empresas | 3 | 3 | ✅ |
| Mensagens | 163 | 163 | ✅ |

---

## Informações técnicas

- **Horário do cron:** `0 6 * * *` (06:00 UTC = 03:00 BRT)
- **Script:** `/opt/dape-backup/backup.sh`
- **Formato do arquivo:** PostgreSQL custom format, comprimido com gzip
- **Destino R2:** `s3://daplemidias/backups/`
- **Retenção local:** 30 dias
- **Retenção R2:** 90 dias
- **Tamanho médio do backup:** ~170 KB (banco atual de 15 MB)
- **Tempo médio de execução:** ~2 segundos
