# DAPLE Multi-Provider Channel Architecture

## Overview
DAPLE supports two WhatsApp providers:
- **session** (default): Baileys via QR Code
- **meta_cloud**: Meta Cloud API (WhatsApp Business API official)

## Routing
`MessageController.ts` checks `whatsapp.providerType`:
1. `meta_cloud` → `SendMetaCloudMessage.ts`
2. Default (session) → `SendWhatsAppMessage.ts` (Baileys)
3. Facebook channel → `SendFacebookMessage.ts`
4. Instagram channel → `SendInstagramMessage.ts`

## Fields added to Whatsapps table
| Field | Type | Description |
|---|---|---|
| providerType | STRING(50) DEFAULT 'session' | Active provider |
| wabaId | STRING | WhatsApp Business Account ID |
| phoneNumberId | STRING | Meta Cloud phone number ID |
| metaAccessToken | TEXT | AES-256 encrypted access token |
| tokenExpiresAt | DATE | Token expiration |
| embeddedSignupSessionId | STRING | Embedded signup session reference |
| migrationStatus | STRING(50) DEFAULT 'none' | none/migrating/completed/failed |
| previousProviderType | STRING | For rollback |

## Security
- `metaAccessToken` encrypted with AES-256-CBC via `cryptoHelper.ts`
- Token NEVER returned in API responses
- Webhook verified with HMAC-SHA256 (X-Hub-Signature-256)
- Authenticated routes use `isAuth` middleware
- Webhook routes are public (called directly by Meta)

## Environment variables required
```
META_APP_ID=           # Meta App ID (from Meta Developer Portal)
META_APP_SECRET=       # Meta App Secret (for webhook signature verification)
META_WEBHOOK_VERIFY_TOKEN= # Token to verify webhook subscription
CRYPTO_SECRET_KEY=     # 32-char key for AES-256 encryption of tokens
```

## Files created/modified
- `backend/src/database/migrations/20260629000001-add-meta-cloud-provider.ts`
- `backend/src/models/Whatsapp.ts` — new fields added
- `backend/src/helpers/cryptoHelper.ts` — AES-256 encrypt/decrypt
- `backend/src/services/MetaCloudServices/SendMetaCloudMessage.ts`
- `backend/src/services/MetaCloudServices/MetaCloudWebhookService.ts`
- `backend/src/controllers/MetaCloudWebhookController.ts`
- `backend/src/controllers/EmbeddedSignupController.ts`
- `backend/src/routes/metaCloud.routes.ts`
- `backend/src/routes/index.ts` — metaCloudRoutes registered
- `backend/src/controllers/MessageController.ts` — meta_cloud routing added
- `backend/.env.example` — new vars documented
- `frontend/src/components/EmbeddedSignupButton/index.js`
- `frontend/src/pages/Connections/index.js` — badge + button added

## API Endpoints
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /meta-cloud/embedded-signup | isAuth | Exchange Meta code, save credentials |
| POST | /meta-cloud/rollback | isAuth | Revert to previous provider |
| GET | /meta-cloud/webhook | public | Meta webhook verification |
| POST | /meta-cloud/webhook | public | Receive Meta webhook events |

## Migration — Embedded Signup Flow
1. User clicks "Conectar WhatsApp Oficial" button in Connections page
2. Facebook SDK opens login popup
3. User authorizes WhatsApp Business permissions
4. Frontend POSTs code to `/meta-cloud/embedded-signup`
5. Backend exchanges code for token, fetches WABA/phone info
6. Token encrypted and stored; `providerType` set to `meta_cloud`
7. All subsequent messages routed via Meta Cloud API

## Rollback
POST `/meta-cloud/rollback` with `{ whatsappId }` to revert to the previous provider (stored in `previousProviderType`). Clears all Meta credentials.
