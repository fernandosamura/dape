# DAPE — Status de Desenvolvimento

Última atualização: 2026-06-17

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

## Ultimo backup realizado
Local: /home/backup/dape_20260617_012410_channels_feature
Data: 2026-06-17 01:24:10

## Controle de Canais por Plano (2026-06-17)

Permite definir por plano quais canais ficam disponíveis nas Conexões:
- WhatsApp apenas
- WhatsApp + Instagram
- Todos (WhatsApp + Facebook + Instagram)

### Arquivos alterados
- DB: ALTER TABLE "Plans" ADD COLUMN "useFacebook" boolean DEFAULT true
- DB: ALTER TABLE "Plans" ADD COLUMN "useInstagram" boolean DEFAULT true
- backend/src/models/Plan.ts: campos useFacebook, useInstagram
- backend/src/services/CompanyService/ShowPlanCompanyService.ts: retorna os novos campos
- backend/src/dape/master/dapeMasterNative.controller.ts: CREATE/UPDATE propagam para Plans nativo
- frontend/src/pages/dape/master/DapeMasterPanel.js: toggles Facebook/Instagram no dialog de planos
- frontend/src/pages/Connections/index.js: filtra conexões e repassa planChannels ao modal
- frontend/src/components/WhatsAppModal/index.js: oculta botoes Facebook/Instagram baseado no plano

### Comportamento
- DEFAULT true para ambos (planos existentes mantem acesso completo)
- WhatsApp nunca e ocultado
- Conexoes existentes de Facebook/Instagram ficam ocultas mas nao deletadas
- Ao criar nova conexao, botoes nao aparecem se desabilitados no plano

## Issues conhecidos
- Nenhum no momento

## Proxima tarefa
- Sistema de canais por plano implementado e funcionando
