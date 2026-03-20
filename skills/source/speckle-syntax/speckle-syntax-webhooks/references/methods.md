# Webhook GraphQL Mutations and Query Reference

## Mutations

### webhookCreate

Creates a new webhook on a project/stream.

```graphql
mutation WebhookCreate($webhook: WebhookCreateInput!) {
  webhookCreate(webhook: $webhook)
}
```

**Returns:** `String!` -- the newly created webhook ID.

**Required scope:** `streams:write`
**Required role:** Stream Owner

#### WebhookCreateInput

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `streamId` | `String!` | YES | -- | Project/stream ID to attach the webhook to |
| `url` | `String!` | YES | -- | HTTPS endpoint URL that will receive POST requests |
| `description` | `String` | NO | `null` | Human-readable webhook description |
| `triggers` | `[String!]!` | YES | -- | Array of internal trigger strings (see Event Types) |
| `secret` | `String` | NO | `null` | Shared secret for HMAC signature verification |
| `enabled` | `Boolean` | NO | `true` | Whether the webhook is active |

---

### webhookUpdate

Updates an existing webhook.

```graphql
mutation WebhookUpdate($webhook: WebhookUpdateInput!) {
  webhookUpdate(webhook: $webhook)
}
```

**Returns:** `String!`

#### WebhookUpdateInput

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `String!` | YES | Webhook ID to update |
| `streamId` | `String!` | YES | Project/stream ID (for authorization) |
| `url` | `String` | NO | New endpoint URL |
| `description` | `String` | NO | New description |
| `triggers` | `[String!]` | NO | New trigger array (replaces ALL existing triggers) |
| `secret` | `String` | NO | New HMAC secret |
| `enabled` | `Boolean` | NO | Enable or disable the webhook |

**IMPORTANT:** When updating `triggers`, you MUST provide the COMPLETE list of desired triggers. The update REPLACES the entire triggers array -- it does NOT merge with existing triggers.

---

### webhookDelete

Deletes a webhook permanently.

```graphql
mutation WebhookDelete($webhook: WebhookDeleteInput!) {
  webhookDelete(webhook: $webhook)
}
```

**Returns:** `String!`

#### WebhookDeleteInput

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `String!` | YES | Webhook ID to delete |
| `streamId` | `String!` | YES | Project/stream ID (for authorization) |

---

## Query Fields

### project.webhooks

Returns all webhooks for a project, or a specific webhook when filtered by ID.

```graphql
query {
  project(id: $projectId) {
    webhooks(id: $optionalWebhookId) {
      totalCount
      items {
        id
        url
        description
        triggers
        enabled
        hasSecret
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

### Webhook Type Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | `String!` | Unique webhook identifier |
| `url` | `String!` | Delivery endpoint URL |
| `description` | `String` | Human-readable description |
| `triggers` | `[String!]!` | Array of active trigger strings |
| `enabled` | `Boolean!` | Whether webhook is currently active |
| `hasSecret` | `Boolean!` | Whether a secret is configured (actual value is NEVER returned) |
| `history` | `WebhookEventCollection` | Delivery history (accepts `limit` argument) |

### WebhookEvent Type Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | `String!` | Unique event identifier |
| `webhookId` | `String!` | Parent webhook ID |
| `status` | `Int!` | HTTP status code from delivery attempt |
| `statusInfo` | `String!` | Status details or error message |
| `retryCount` | `Int!` | Number of delivery attempts |
| `lastUpdate` | `DateTime!` | Timestamp of last attempt |
| `payload` | `String!` | JSON payload that was delivered |

### Collection Types

| Type | Items Field | Access |
|------|-------------|--------|
| `WebhookCollection` | `items: [Webhook!]!` | `project.webhooks` |
| `WebhookEventCollection` | `items: [WebhookEvent]` | `webhook.history(limit: N)` |

---

## Event Types (Complete Reference)

ALWAYS use the Internal Trigger String in `WebhookCreateInput.triggers`.

### Project Events

| Trigger String | Fires When |
|---------------|------------|
| `stream_update` | Project name, description, or visibility changes |
| `stream_delete` | Project is permanently deleted |
| `stream_permissions_add` | A collaborator is added to the project |
| `stream_permissions_remove` | A collaborator is removed from the project |

### Model Events

| Trigger String | Fires When |
|---------------|------------|
| `branch_create` | A new model is created in the project |
| `branch_update` | Model name or description is updated |
| `branch_delete` | A model is deleted |

### Version Events

| Trigger String | Fires When |
|---------------|------------|
| `commit_create` | A new version is created (most common trigger) |
| `commit_update` | Version message or metadata is updated |
| `commit_receive` | A version is marked as received by a connector |
| `commit_delete` | A version is deleted |

### Comment Events

| Trigger String | Fires When |
|---------------|------------|
| `comment_created` | A new comment thread is created |
| `comment_archived` | A comment is archived |
| `comment_replied` | A reply is added to an existing comment thread |
