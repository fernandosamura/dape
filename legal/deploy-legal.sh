#!/usr/bin/env bash
# Deploy seguro das paginas legais estaticas do DAPLE (Politica de
# Privacidade, Termos de Uso, Exclusao de Dados) para /var/www/daple-legal/,
# de onde o nginx serve essas rotas diretamente (fora do app React, sem
# autenticacao). Roda no servidor, a partir do checkout do repositorio.
#
# NAO reinicia nem toca em containers, backend, frontend, banco de dados ou
# qualquer integracao com WhatsApp/Meta - so copia arquivos HTML estaticos.
#
# Uso (executar como root, no servidor):
#   ./deploy-legal.sh            # modo interativo, pede confirmacao
#   ./deploy-legal.sh --yes      # pula a confirmacao (use com cuidado)
#
# Rollback:
#   Cada arquivo publicado ganha um backup em
#   /var/www/daple-legal/<arquivo>.bak-<timestamp> criado ANTES da
#   sobrescrita. Para reverter um arquivo especifico:
#     cp /var/www/daple-legal/politica-privacidade.html.bak-20260714024431 \
#        /var/www/daple-legal/politica-privacidade.html
#   Nao e necessario reiniciar nada depois do rollback - o nginx serve o
#   arquivo direto do disco a cada requisicao (alias, sem cache em memoria
#   de conteudo).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROD_DIR="/var/www/daple-legal"
FILES=(politica-privacidade.html termos-de-uso.html exclusao-de-dados.html)
TIMESTAMP="$(date +%Y%m%d%H%M%S)"
AUTO_YES=false

for arg in "$@"; do
  case "$arg" in
    --yes|-y) AUTO_YES=true ;;
  esac
done

if [ "$EUID" -ne 0 ]; then
  echo "Este script precisa rodar como root (para escrever em $PROD_DIR e chamar nginx)." >&2
  exit 1
fi

if [ ! -d "$PROD_DIR" ]; then
  echo "Diretorio de producao $PROD_DIR nao existe. Abortando (nao crio automaticamente)." >&2
  exit 1
fi

echo "== Deploy de paginas legais DAPLE =="
echo "Origem : $SCRIPT_DIR"
echo "Destino: $PROD_DIR"
echo

# 1. Validacao basica de HTML - nao substitui um validador completo, mas
# pega os erros mais comuns: arquivo vazio, sem DOCTYPE, tag <html>/<head>/
# <body> desbalanceada, placeholder esquecido ou segredo exposto.
echo "-- Validando HTML --"
for f in "${FILES[@]}"; do
  src="$SCRIPT_DIR/$f"
  if [ ! -f "$src" ]; then
    echo "ERRO: $f nao encontrado em $SCRIPT_DIR" >&2
    exit 1
  fi
  if [ ! -s "$src" ]; then
    echo "ERRO: $f esta vazio" >&2
    exit 1
  fi
  if ! grep -qi "<!DOCTYPE html>" "$src"; then
    echo "ERRO: $f nao tem <!DOCTYPE html>" >&2
    exit 1
  fi
  for tag in html head body; do
    open=$(grep -oi "<$tag[ >]" "$src" | wc -l | tr -d ' ')
    close=$(grep -oi "</$tag>" "$src" | wc -l | tr -d ' ')
    if [ "$open" != "$close" ]; then
      echo "ERRO: $f tem tag <$tag> desbalanceada (abre=$open fecha=$close)" >&2
      exit 1
    fi
  done
  if grep -qE '\[[A-Z_]+\]|a confirmar|TODO|FIXME' "$src"; then
    echo "ERRO: $f ainda tem placeholder pendente:" >&2
    grep -nE '\[[A-Z_]+\]|a confirmar|TODO|FIXME' "$src" >&2
    exit 1
  fi
  if grep -qiE "api[_-]?key|access[_-]?token|client[_-]?secret|senha *:|password *:" "$src"; then
    echo "ERRO: $f parece conter um segredo/token - revise antes de publicar" >&2
    exit 1
  fi
  echo "OK: $f"
done
echo

# 2. Mostra o que vai mudar antes de tocar em producao
echo "-- Diferencas em relacao a producao --"
for f in "${FILES[@]}"; do
  if [ -f "$PROD_DIR/$f" ]; then
    if diff -q "$SCRIPT_DIR/$f" "$PROD_DIR/$f" > /dev/null 2>&1; then
      echo "$f: sem alteracoes"
    else
      echo "$f: DIFERENTE (sera atualizado)"
    fi
  else
    echo "$f: NOVO (nao existe em producao ainda)"
  fi
done
echo

# 3. Confirmacao explicita antes de sobrescrever producao
if [ "$AUTO_YES" != true ]; then
  read -r -p "Confirma a publicacao em $PROD_DIR? [y/N] " resp
  case "$resp" in
    [yY][eE][sS]|[yY]) ;;
    *) echo "Cancelado. Nada foi alterado."; exit 0 ;;
  esac
fi

# 4. Backup antes de sobrescrever - sempre, mesmo se o script for rodado
# de novo sem mudancas reais.
echo
echo "-- Backup --"
for f in "${FILES[@]}"; do
  if [ -f "$PROD_DIR/$f" ]; then
    cp "$PROD_DIR/$f" "$PROD_DIR/$f.bak-$TIMESTAMP"
    echo "Backup: $PROD_DIR/$f.bak-$TIMESTAMP"
  fi
done

# 5. Publica os arquivos, preservando dono/permissao esperados
echo
echo "-- Publicando --"
for f in "${FILES[@]}"; do
  cp "$SCRIPT_DIR/$f" "$PROD_DIR/$f"
  chown root:root "$PROD_DIR/$f"
  chmod 644 "$PROD_DIR/$f"
  echo "Publicado: $f"
done

# 6. Testa a config do nginx ANTES de recarregar - se falhar, aborta sem
# recarregar (nginx continua rodando com a config anterior, que era valida).
echo
echo "-- Validando e recarregando nginx --"
if ! nginx -t; then
  echo "ERRO: nginx -t falhou. NAO vou recarregar o nginx." >&2
  echo "Os arquivos HTML ja foram publicados (o nginx serve esse conteudo" >&2
  echo "direto do disco via 'alias', sem precisar de reload) - mas a config" >&2
  echo "geral do nginx esta com problema e precisa ser corrigida a parte." >&2
  exit 1
fi
systemctl reload nginx
echo "nginx recarregado com sucesso."

echo
echo "Concluido."
echo "Rollback, se necessario:"
for f in "${FILES[@]}"; do
  echo "  cp $PROD_DIR/$f.bak-$TIMESTAMP $PROD_DIR/$f"
done
