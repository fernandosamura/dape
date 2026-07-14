# Páginas legais públicas do DAPLE

Este diretório versiona o conteúdo das três páginas legais públicas exigidas
pela Análise do Aplicativo da Meta:

| Arquivo | URL pública |
|---|---|
| `politica-privacidade.html` | https://daple.pubplus.com.br/politica-privacidade |
| `termos-de-uso.html` | https://daple.pubplus.com.br/termos-de-uso |
| `exclusao-de-dados.html` | https://daple.pubplus.com.br/exclusao-de-dados |

## Como funciona em produção

Essas páginas **não fazem parte do app React** e **não passam por
autenticação**. São arquivos HTML estáticos, autocontidos (CSS inline, sem
dependências externas além de fontes/imagem OG), servidos **diretamente pelo
nginx** através de blocos `location =` dedicados, independente do
container do frontend:

```nginx
location = /politica-privacidade {
    alias /var/www/daple-legal/politica-privacidade.html;
    default_type text/html;
    add_header Cache-Control 'no-store, no-cache, must-revalidate, proxy-revalidate';
}
```

O mesmo padrão existe para `/termos-de-uso` e `/exclusao-de-dados`, já
configurado em `/etc/nginx/sites-enabled/dape-frontend` no servidor.

**Por que esse desenho:** garante que os crawlers da Meta (e qualquer
visitante) recebam o HTML completo, com todas as metatags, sem depender de
JavaScript/React carregar — e mantém essas páginas completamente isoladas do
restante do sistema (autenticação, banco, WhatsApp, containers).

## Editando o conteúdo

1. Edite o arquivo `.html` correspondente aqui no repositório.
2. Se alterar um dado de contato/endereço, **atualize os três arquivos**,
   nunca só um — as três páginas devem sempre mostrar exatamente o mesmo
   endereço e os mesmos e-mails de contato.
3. Não deixe placeholders do tipo `[ALGUMA_COISA]` na versão publicada.
4. Rode `./deploy-legal.sh` (veja abaixo) para publicar.

## Publicando (deploy)

O script `deploy-legal.sh` roda **no servidor**, como root, a partir do
checkout do repositório (ex: `/root/dape/legal/`):

```bash
cd /root/dape && git pull
cd legal
./deploy-legal.sh
```

O script:
1. Valida o HTML de cada arquivo (DOCTYPE presente, tags balanceadas, sem
   placeholder pendente, sem segredo/token exposto).
2. Mostra o diff entre o que está no repo e o que está em produção.
3. **Pede confirmação explícita antes de sobrescrever qualquer coisa** —
   nunca publica sozinho sem você digitar "y". Use `--yes` só se quiser pular
   isso conscientemente (ex: automação futura).
4. Faz backup de cada arquivo de produção antes de sobrescrever
   (`<arquivo>.bak-<timestamp>` em `/var/www/daple-legal/`).
5. Copia os arquivos novos, com dono/permissão corretos (`root:root`, `644`).
6. Roda `nginx -t` antes de recarregar. Se a config tiver algum problema, o
   script **aborta sem recarregar** — o nginx continua rodando com a config
   anterior (que era válida).

O script **não toca em containers, backend, frontend, banco de dados ou
qualquer integração com WhatsApp/Meta** — só arquivos estáticos em
`/var/www/daple-legal/` e um `reload` (não restart) do nginx.

## Rollback

Cada publicação gera backups com timestamp. Para reverter um arquivo
específico:

```bash
cp /var/www/daple-legal/politica-privacidade.html.bak-20260714024431 \
   /var/www/daple-legal/politica-privacidade.html
```

Não é necessário reiniciar nada depois — o nginx serve o conteúdo direto do
disco a cada requisição (`alias`, sem cache de conteúdo em memória).

## Adicionando uma nova página legal no futuro

1. Crie o `.html` aqui em `legal/`, seguindo o mesmo padrão visual das
   outras três (mesmo CSS inline, mesmo rodapé com links recíprocos —
   lembre de adicionar o link da nova página nas outras também).
2. Adicione o link recíproco também nas três páginas já existentes.
3. Adicione ao array `FILES` no topo de `deploy-legal.sh`.
4. Adicione o bloco `location =` correspondente em
   `/etc/nginx/sites-enabled/dape-frontend` no servidor (isso **não** é
   automatizado por este script — é uma mudança de configuração do nginx,
   feita manualmente uma única vez por página nova, com `nginx -t` antes de
   qualquer `reload`).

## Dados institucionais usados nestas páginas

Estes dados devem ser **idênticos** nas três páginas e devem ser mantidos
sincronizados com o cadastro verificado da empresa no Meta Business:

- Razão social: Pub Plus Brasil Ltda
- CNPJ: 55.106.802/0001-72
- Endereço: Avenida Caramuru, 2.200, Ribeirão Preto - SP, CEP 14.025-710
- E-mail de suporte e de privacidade: contato@pubplus.com.br
- Foro: comarca de Ribeirão Preto, Estado de São Paulo

Se qualquer um desses dados mudar, atualize os três arquivos juntos e rode
`deploy-legal.sh` de novo.
