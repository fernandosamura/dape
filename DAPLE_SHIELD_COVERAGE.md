# DAPLE Shield Coverage Report

Generated: 2026-06-29

## Shield API Summary

The Shield service (`dapleShield`) exposes:
- `evaluate(ctx: ShieldContext)` → `{ allowed, reason? }` — FAIL-OPEN (returns `{ allowed: true }` on any internal error)
- `reportSendError(whatsappId, companyId, errorMsg)` — triggers auto-quarantine after repeated failures
- `ensureDefaultConfig(companyId, whatsappId)` — creates default config row if missing
- `getStatus(companyId, whatsappId)` — returns current state

`ShieldContext` fields: `companyId`, `whatsappId`, `source` (`MessageSource`), `contactNumber?`, `messagePreview?`, `ticketId?`

`MessageSource` values: `"manual" | "campaign" | "schedule" | "bot" | "integration" | "api" | "flow" | "typebot"`

**Note:** The task specification used `connectionId` and `messageType`, but the actual Shield API uses `whatsappId` and `source`. All implementations follow the real API.

---

## Coverage Table

| Arquivo | Função | Tipo de Envio | Shield? | Risco | Ação |
|---------|--------|---------------|---------|-------|------|
| `src/services/WbotServices/SendWhatsAppMessage.ts` | `SendWhatsAppMessage` | manual (text) | ✅ YES (non-blocking) | MEDIUM | Added non-blocking shield + `reportSendError` in catch |
| `src/services/WbotServices/SendWhatsAppMedia.ts` | `SendWhatsAppMedia` | manual (media) | ✅ YES (non-blocking) | MEDIUM | Added non-blocking shield + `reportSendError` in catch |
| `src/services/WbotServices/SendWhatsAppMediaFlow.ts` | `SendWhatsAppMediaFlow` | flow/bot (media) | ⚠️ NO | LOW | Called from `ActionsWebhookService` which now has pre-shield; adding here would double-count. Acceptable. |
| `src/queues.ts` | `handleDispatchCampaign` | campaign | ✅ YES (blocking) | HIGH | Already present before this audit |
| `src/queues.ts` | `handleSendMessage` (MessageQueue) | api | ✅ YES (blocking) | HIGH | Added blocking shield — source: "api" |
| `src/queues.ts` | `handleSendScheduledMessage` | schedule | ✅ YES (blocking) | HIGH | Added blocking shield — source: "schedule" |
| `src/services/WbotServices/wbotMessageListener.ts` | `handleOpenAi` | ai/bot | ✅ YES (blocking) | HIGH | Added blocking shield — source: "bot" — right after module access check |
| `src/services/WbotServices/wbotMessageListener.ts` | `handleChartbot` | chatbot | ✅ YES (blocking) | HIGH | Added blocking shield — source: "bot" — at function entry |
| `src/services/WbotServices/wbotMessageListener.ts` | `verifyQueue` | chatbot/greeting | ✅ YES (blocking) | HIGH | Added blocking shield — source: "bot" — at function entry |
| `src/services/WbotServices/wbotMessageListener.ts` | `sendWithTypingDelay` | ai/bot | ✅ YES (via handleOpenAi) | HIGH | Shield is evaluated in `handleOpenAi` before this is called |
| `src/services/WbotServices/wbotMessageListener.ts` | `sendMessageImage` | bot/flow | ⚠️ NO (indirect) | MEDIUM | Called from within chatbot/flow context; shield applied at calling function level |
| `src/services/WbotServices/wbotMessageListener.ts` | `sendMessageLink` | bot/flow | ⚠️ NO (indirect) | MEDIUM | Called from within chatbot/flow context; shield applied at calling function level |
| `src/services/WbotServices/wbotMessageListener.ts` | Out-of-hours messages (company/queue) | bot | ✅ YES (non-blocking) | MEDIUM | Added non-blocking shield in `handleMessage` before scheduling block — source: "bot". Logs warning but does not block send. |
| `src/services/WbotServices/wbotMessageListener.ts` | Greeting message (connection-level) | bot | ✅ YES (non-blocking) | LOW | Covered by the same non-blocking shield evaluation added before the scheduling block in `handleMessage`. |
| `src/services/TicketServices/UpdateTicketService.ts` | Rating message send | bot/automation | ✅ YES (blocking) | HIGH | Added shield around `SendWhatsAppMessage` for rating |
| `src/services/TicketServices/UpdateTicketService.ts` | Completion message send | bot/automation | ✅ YES (blocking) | HIGH | Added shield around `SendWhatsAppMessage` for completion |
| `src/services/TicketServices/UpdateTicketService.ts` | Transfer messages (queue/agent) × 4 | bot/automation | ✅ YES (blocking) | HIGH | Added single shield evaluation, all 4 `wbot.sendMessage` blocks conditioned on result |
| `src/services/WbotServices/wbotClosedTickets.ts` | `ClosedAllOpenTickets` (expiry message) | bot/automation | ✅ YES (blocking) | HIGH | Added shield around `SendWhatsAppMessage` for auto-close |
| `src/services/WbotServices/wbotMonitor.ts` | Call-reject auto-message | bot | ✅ YES (blocking) | MEDIUM | Added shield around `wbot.sendMessage` for disabled-call response |
| `src/services/WebhookService/ActionsWebhookService.ts` | `ActionsWebhookService` (flow nodes) | flow | ✅ YES (blocking) | HIGH | Added shield at top of function, before for-loop over nodes — covers all `SendMessage`, `SendWhatsAppMessage`, `SendWhatsAppMediaFlow` calls within |
| `src/helpers/SendMessage.ts` | `SendMessage` | api/schedule | ⚠️ NO (indirect) | MEDIUM | Called via `handleSendMessage` (now shielded) and `handleSendScheduledMessage` (now shielded). Direct callers already protected upstream. |
| `src/helpers/SendMessageFlow.ts` | `SendMessageFlow` | flow | N/A | NONE | Function body is commented out (returns empty string) — no actual send occurs |
| `src/controllers/MessageController.ts` | `store` (manual send) | manual | ✅ YES (via SendWhatsAppMessage) | MEDIUM | Calls `SendWhatsAppMessage`/`SendWhatsAppMedia` which now have non-blocking shield |
| `src/controllers/MessageController.ts` | `send` (API send) | api | ✅ YES (via MessageQueue) | HIGH | Enqueues to `MessageQueue` which now has blocking shield |
| `src/controllers/MessageController.ts` | `sendMessageFlow` | flow | ⚠️ NO | LOW | Enqueues to `MessageQueue` (shielded) — covered upstream |
| `src/services/TypebotServices/typebotListener.ts` | `typebotListener` | typebot/bot | ✅ YES (blocking) | MEDIUM | Added blocking shield at function entry (source: "typebot") — uses `wbot.id` and `ticket.companyId`. `reportSendError` added in catch block. |
| `src/services/IntegrationsServices/OpenAiService.ts` | `handleOpenAi` (service) | ai | ⚠️ NO | MEDIUM | Separate from `handleOpenAi` in wbotMessageListener. Called from `ActionsWebhookService` which is now shielded. |
| `src/services/IntegrationServices/MkAuthIntegrationService.ts` | Various sends | integration | ✅ YES (blocking) | MEDIUM | Added blocking shield at function entry (source: "integration") — uses `ticket.companyId` and `ticket.whatsappId`. |
| `src/services/IntegrationServices/IxcIntegrationService.ts` | Various sends (boleto + religue) | integration | ✅ YES (blocking) | MEDIUM | Added blocking shield at entry of both `handleIxcBoleto` and `handleIxcReligue` (source: "integration"). |
| `src/services/IntegrationServices/AsaasIntegrationService.ts` | Various sends | integration | ✅ YES (blocking) | MEDIUM | Added blocking shield at function entry (source: "integration") — uses `ticket.companyId` and `ticket.whatsappId`. |

---

## Changes Made

### Files Modified (11)

1. **`/tmp/dape_push/backend/src/services/WbotServices/SendWhatsAppMessage.ts`**
   - Added `import { dapleShield }` and `import { logger }`
   - Added non-blocking shield evaluation at top of function (source: `"manual"`)
   - Added `reportSendError()` call in catch block

2. **`/tmp/dape_push/backend/src/services/WbotServices/SendWhatsAppMedia.ts`**
   - Added `import { dapleShield }` and `import { logger }`
   - Added non-blocking shield evaluation before send (source: `"manual"`)
   - Added `reportSendError()` call in catch block

3. **`/tmp/dape_push/backend/src/queues.ts`**
   - Already had shield in `handleDispatchCampaign` (source: `"campaign"`) ✓
   - **Added** blocking shield in `handleSendMessage` (source: `"api"`)
   - **Added** blocking shield in `handleSendScheduledMessage` (source: `"schedule"`)

4. **`/tmp/dape_push/backend/src/services/WbotServices/wbotMessageListener.ts`**
   - Added `import { dapleShield }`
   - **Added** blocking shield in `handleOpenAi` (source: `"bot"`) after module access check
   - **Added** blocking shield in `handleChartbot` (source: `"bot"`) at entry
   - **Added** blocking shield in `verifyQueue` (source: `"bot"`) at entry

5. **`/tmp/dape_push/backend/src/services/TicketServices/UpdateTicketService.ts`**
   - Added `import { dapleShield }` and `import { logger }`
   - **Added** blocking shield around rating message send (source: `"bot"`)
   - **Added** blocking shield around completion message send (source: `"bot"`)
   - **Added** blocking shield evaluation controlling all 4 transfer message blocks (source: `"bot"`)

6. **`/tmp/dape_push/backend/src/services/WbotServices/wbotClosedTickets.ts`**
   - Added `import { dapleShield }` and `import { logger }`
   - **Added** blocking shield around auto-close expiry message (source: `"bot"`)

7. **`/tmp/dape_push/backend/src/services/WbotServices/wbotMonitor.ts`**
   - Added `import { dapleShield }`
   - **Added** blocking shield around call-reject auto-message (source: `"bot"`)

8. **`/tmp/dape_push/backend/src/services/WebhookService/ActionsWebhookService.ts`**
   - Added `import { dapleShield }`
   - **Added** blocking shield at top of `ActionsWebhookService` main body, before all flow node processing (source: `"flow"`)

9. **`/tmp/dape_push/backend/src/services/TypebotServices/typebotListener.ts`**
   - Added `import { dapleShield }` from shield service
   - **Added** blocking shield at function entry (source: `"typebot"`) using `wbot.id` and `ticket.companyId`
   - **Added** `reportSendError()` call in catch block

10. **`/tmp/dape_push/backend/src/services/IntegrationServices/MkAuthIntegrationService.ts`**
    - Added `import { dapleShield }` and `import { logger }`
    - **Added** blocking shield at entry of `handleMkAuthBoleto` (source: `"integration"`) using `ticket.companyId` and `ticket.whatsappId`

11. **`/tmp/dape_push/backend/src/services/IntegrationServices/IxcIntegrationService.ts`**
    - Added `import { dapleShield }` and `import { logger }`
    - **Added** blocking shield at entry of `handleIxcBoleto` (source: `"integration"`)
    - **Added** blocking shield at entry of `handleIxcReligue` (source: `"integration"`)

12. **`/tmp/dape_push/backend/src/services/IntegrationServices/AsaasIntegrationService.ts`**
    - Added `import { dapleShield }` and `import { logger }`
    - **Added** blocking shield at entry of `handleAsaasBoleto` (source: `"integration"`) using `ticket.companyId` and `ticket.whatsappId`

13. **`/tmp/dape_push/backend/src/services/WbotServices/wbotMessageListener.ts`** (additional, session 2)
    - **Added** non-blocking shield evaluation in `handleMessage` before the out-of-hours scheduling block (source: `"bot"`) — covers company out-of-hours, queue out-of-hours, and connection-level greeting messages

### Files Created (1)

- **`/tmp/dape_push/DAPLE_SHIELD_COVERAGE.md`** — this report

---

## Shield Behavior Summary

| Source type | Behavior | Files |
|-------------|----------|-------|
| `"manual"` | Non-blocking — logs warning, send proceeds | `SendWhatsAppMessage`, `SendWhatsAppMedia` |
| `"campaign"` | Blocking — skips send, logs warning | `queues.ts → handleDispatchCampaign` |
| `"schedule"` | Blocking — sets status ERRO, logs warning | `queues.ts → handleSendScheduledMessage` |
| `"api"` | Blocking — skips queued send, logs warning | `queues.ts → handleSendMessage` |
| `"bot"` | Blocking — returns early, logs warning | `wbotMessageListener`, `UpdateTicketService`, `wbotClosedTickets`, `wbotMonitor` |
| `"flow"` | Blocking — aborts entire flow, logs warning | `ActionsWebhookService` |

---

## Items Requiring Human Review

1. **`sendMessageImage` / `sendMessageLink` in `wbotMessageListener.ts`** — These helper functions are called from bot/chatbot flows. They are indirectly covered because their callers (`handleChartbot`, `verifyQueue`) now have shield. However, if these helpers are ever called from outside a shielded context, they would be unprotected.

2. **`OpenAiService.ts` (IntegrationsServices)** — Called from `ActionsWebhookService` which is now shielded upstream. Direct shield not required unless called from an unshielded path in the future.

---

## Completed Items (previously deferred)

1. **`typebotListener.ts`** — Implemented blocking shield at function entry with source `"typebot"`. Uses `wbot.id` as `whatsappId` and `ticket.companyId`. `reportSendError` added in catch block.

2. **`MkAuthIntegrationService.ts`, `IxcIntegrationService.ts`, `AsaasIntegrationService.ts`** — Implemented blocking shield at entry of each function (and both functions in IxcIntegrationService). Source: `"integration"`. Uses `ticket.companyId` and `ticket.whatsappId`.

3. **Out-of-hours and greeting messages in `handleMessage`** — Implemented non-blocking shield evaluation before the scheduling/out-of-hours block. Covers all debounced sends for company out-of-hours, queue out-of-hours, and connection-level greeting messages.

---

## Build Result

**TypeScript compilation: SUCCESS (0 errors)**

Command: `./node_modules/.bin/tsc --noEmit`

Last verified: 2026-06-29 (after session 2 changes)
