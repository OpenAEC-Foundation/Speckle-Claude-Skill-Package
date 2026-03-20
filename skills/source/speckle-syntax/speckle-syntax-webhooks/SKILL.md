---
name: speckle-syntax-webhooks
description: >
  Use when setting up Speckle webhooks, handling webhook payloads, or automating reactions to Speckle events.
  Prevents incorrect event trigger strings, missing webhook security validation, and exceeded webhook limits.
  Covers webhook lifecycle (create/update/delete), all 14 event types with trigger strings, payload structure, configuration limits, security, and retry behavior.
  Keywords: speckle webhook, event, trigger, payload, webhookCreate, commit_create, stream_update, branch_create.
license: MIT
compatibility: "Designed for Claude Code. Requires Speckle Server 2.x/3.x, SpecklePy, Speckle.Sdk."
metadata:
  author: OpenAEC-Foundation
  version: "1.0"
---

# speckle-syntax-webhooks

## Quick Reference

### Webhook CRUD Operations

| Operation | Mutation | Input Type | Returns | Required Role |
|-----------|----------|-----------|---------|---------------|
| Create | `webhookCreate` | `WebhookCreateInput!` | `String!` (webhook ID) | Stream Owner |
| Update | `webhookUpdate` | `WebhookUpdateInput!` | `String!` | Stream Owner |
| Delete | `webhookDelete` | `WebhookDeleteInput!` | `String!` | Stream Owner |
| Query | `project.webhooks` | `id: String` (optional filter) | `WebhookCollection` | Stream Owner |

### WebhookCreateInput Type

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `streamId` | `String!` | YES | The project/stream ID |
| `url` | `String!` | YES | HTTPS endpoint URL that receives POST requests |
| `description` | `String` | NO | Human-readable description |
| `triggers` | `[String!]!` | YES | Array of trigger strings (MUST use internal names) |
| `secret` | `String` | NO | Shared secret for HMAC signature verification |
| `enabled` | `Boolean` | NO | Defaults to `true` |

### All 14 Event Types (Trigger Strings)

**ALWAYS use the Internal Trigger String when calling `webhookCreate`. NEVER use the Display Name.**

| Internal Trigger String | Display Name | Description |
|------------------------|--------------|-------------|
| `stream_update` | project_update | Project metadata changed |
| `stream_delete` | project_delete | Project deleted |
| `branch_create` | model_create | New model created |
| `branch_update` | model_update | Model metadata updated |
| `branch_delete` | model_delete | Model deleted |
| `commit_create` | version_create | New version created |
| `commit_update` | version_update | Version metadata updated |
| `commit_receive` | version_receive | Version marked as received |
| `commit_delete` | version_delete | Version deleted |
| `comment_created` | comment_created | New comment/thread created |
| `comment_archived` | comment_archived | Comment archived |
| `comment_replied` | comment_replied | Reply added to comment thread |
| `stream_permissions_add` | project_permissions_add | Collaborator added |
| `stream_permissions_remove` | project_permissions_remove | Collaborator removed |

### Configuration Limits

| Limit | Value |
|-------|-------|
| Max webhooks per stream/project | **100** (`MAX_STREAM_WEBHOOKS = 100`) |
| Webhook history query limit | Up to 25 events per query |
| Required scope | `streams:write` |
| Required role | Stream Owner |

### Critical Warnings

**NEVER** use display names (e.g., `version_create`, `model_update`) as trigger strings -- the API uses legacy/internal terminology. ALWAYS use `commit_create`, `branch_update`, etc. The UI shows modern names, but the GraphQL API requires legacy names.

**NEVER** assume the webhook secret is returned in queries -- Speckle exposes only a `hasSecret` boolean field. The actual secret value is NEVER returned after creation. Store it securely at creation time.

**NEVER** skip payload validation in your webhook endpoint -- ALWAYS verify the `webhook.id` in the payload matches your expected webhook. Without validation, any POST to your endpoint could be processed as a legitimate event.

**NEVER** exceed 100 webhooks per project -- the server enforces `MAX_STREAM_WEBHOOKS = 100`. Attempting to create more will fail. If you need more event handlers, consolidate triggers into fewer webhooks.

**NEVER** expect sensitive fields in webhook payloads -- `server.id`, `user.passwordDigest`, `user.email`, and `webhook.secret` are ALWAYS stripped before delivery.

---

## Webhook Lifecycle

### 1. Create a Webhook

```graphql
mutation WebhookCreate($webhook: WebhookCreateInput!) {
  webhookCreate(webhook: $webhook)
}
```

Variables:
```json
{
  "webhook": {
    "streamId": "<projectId>",
    "url": "https://your-endpoint.com/webhook",
    "description": "CI/CD trigger on new versions",
    "triggers": ["commit_create", "branch_update"],
    "secret": "your-hmac-secret-here",
    "enabled": true
  }
}
```

Returns the webhook ID as `String!`. Store this ID for future update/delete operations.

### 2. Update a Webhook

```graphql
mutation WebhookUpdate($webhook: WebhookUpdateInput!) {
  webhookUpdate(webhook: $webhook)
}
```

Variables:
```json
{
  "webhook": {
    "id": "<webhookId>",
    "streamId": "<projectId>",
    "url": "https://new-endpoint.com/webhook",
    "enabled": false
  }
}
```

All fields except `id` and `streamId` are optional -- only include fields you want to change.

### 3. Delete a Webhook

```graphql
mutation WebhookDelete($webhook: WebhookDeleteInput!) {
  webhookDelete(webhook: $webhook)
}
```

Variables:
```json
{
  "webhook": {
    "id": "<webhookId>",
    "streamId": "<projectId>"
  }
}
```

### 4. Query Webhooks

```graphql
query ProjectWebhooks($projectId: String!) {
  project(id: $projectId) {
    webhooks {
      totalCount
      items {
        id
        url
        description
        triggers
        enabled
        hasSecret
        history(limit: 5) {
          totalCount
          items {
            id
            status
            statusInfo
            retryCount
            lastUpdate
          }
        }
      }
    }
  }
}
```

Filter for a specific webhook: `webhooks(id: "<webhookId>")`.

---

## Payload Structure

When a webhook fires, the receiving endpoint gets a POST request with this JSON body:

```json
{
  "streamId": "<projectId>",
  "stream": {
    "id": "abc123",
    "name": "My Project",
    "description": "Project description"
  },
  "userId": "<triggeringUserId>",
  "user": {
    "id": "user123",
    "name": "Jane Doe",
    "bio": "Engineer",
    "company": "ACME",
    "avatar": "https://..."
  },
  "server": {
    "name": "Speckle",
    "canonicalUrl": "https://app.speckle.systems"
  },
  "webhook": {
    "id": "webhook123",
    "streamId": "abc123",
    "url": "https://your-endpoint.com/webhook",
    "description": "CI/CD trigger",
    "triggers": ["commit_create"]
  },
  "event": {
    "event_name": "commit_create",
    "data": { }
  }
}
```

### Stripped Fields (Security)

The following fields are ALWAYS removed from payloads before delivery:
- `server.id`
- `user.passwordDigest`
- `user.email`
- `webhook.secret`

---

## Security: HMAC Signature Verification

When you provide a `secret` during webhook creation, Speckle signs the payload using HMAC. Your endpoint MUST verify this signature to ensure the request is authentic.

### Verification Pattern

1. Extract the signature from the request headers
2. Compute HMAC-SHA256 of the raw request body using your stored secret
3. Compare the computed signature with the received signature using constant-time comparison
4. Reject requests where signatures do not match

```python
import hmac
import hashlib

def verify_webhook_signature(payload_body: bytes, secret: str, received_signature: str) -> bool:
    """Verify the HMAC signature of a Speckle webhook payload."""
    computed = hmac.new(
        secret.encode("utf-8"),
        payload_body,
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(computed, received_signature)
```

**ALWAYS** use constant-time comparison (`hmac.compare_digest`) -- NEVER use `==` for signature comparison, as it is vulnerable to timing attacks.

---

## Webhook History and Retry Behavior

### Querying Delivery History

Each webhook maintains a delivery history accessible via `webhook.history(limit: N)`:

```graphql
{
  project(id: $projectId) {
    webhooks(id: $webhookId) {
      items {
        history(limit: 25) {
          totalCount
          items {
            id
            webhookId
            status
            statusInfo
            retryCount
            lastUpdate
            payload
          }
        }
      }
    }
  }
}
```

### WebhookEvent Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | `String!` | Unique event ID |
| `webhookId` | `String!` | Parent webhook ID |
| `status` | `Int!` | HTTP response status code from your endpoint |
| `statusInfo` | `String!` | Additional status information or error message |
| `retryCount` | `Int!` | Number of delivery attempts made |
| `lastUpdate` | `DateTime!` | Timestamp of the last delivery attempt |
| `payload` | `String!` | The JSON payload that was sent |

### Retry Behavior

When a webhook delivery fails (non-2xx response or connection error), Speckle retries the delivery. The `retryCount` field on `WebhookEvent` tracks how many attempts have been made. Monitor `webhook.history` to detect persistent delivery failures and take corrective action.

**ALWAYS** return a 2xx HTTP status code from your webhook endpoint promptly -- long-running processing MUST be deferred to a background queue. A slow response or timeout triggers retries and may cause duplicate processing.

---

## Webhook Integration Pattern

The standard pattern for integrating with Speckle webhooks:

```
1. Create webhook via webhookCreate mutation (store the returned ID)
2. Receive POST requests at your endpoint
3. Validate the payload:
   a. Verify HMAC signature (if secret was configured)
   b. Confirm webhook.id matches your expected webhook
4. Extract event data from the payload
5. Return 2xx immediately
6. Process the event asynchronously (background job/queue)
7. Query additional details via GraphQL if needed
```

---

## Collection Types

| Type | Fields | Access Pattern |
|------|--------|---------------|
| `WebhookCollection` | `items: [Webhook!]!`, `totalCount: Int!` | `project.webhooks` |
| `WebhookEventCollection` | `items: [WebhookEvent]`, `totalCount: Int!` | `webhook.history(limit: N)` |

---

## Reference Links

- [references/methods.md](references/methods.md) -- GraphQL mutations, input types, and query fields for webhooks
- [references/examples.md](references/examples.md) -- Complete working examples for webhook CRUD and payload handling
- [references/anti-patterns.md](references/anti-patterns.md) -- Common webhook configuration mistakes and how to avoid them

### Official Sources

- Speckle Server GitHub -- Webhooks Schema: `github.com/specklesystems/speckle-server/.../webhooks.graphql`
- Speckle Server GitHub -- Webhook Services: `github.com/specklesystems/speckle-server/.../webhooks/services/webhooks.ts`
- Speckle Server GitHub -- Webhook Types: `github.com/specklesystems/speckle-server/.../webhooks/domain/types.ts`
- Speckle Frontend -- Webhook Composables: `github.com/specklesystems/speckle-server/.../webhooks.ts`
