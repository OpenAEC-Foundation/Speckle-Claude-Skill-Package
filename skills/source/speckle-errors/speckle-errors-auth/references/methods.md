# speckle-errors-auth — Methods Reference

## Token Creation (GraphQL)

### apiTokenCreate

Creates a Personal Access Token.

```graphql
mutation TokenCreate($token: ApiTokenCreateInput!) {
  apiTokenCreate(token: $token)
}
```

**Input type — `ApiTokenCreateInput`:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `String!` | Yes | Human-readable token name |
| `scopes` | `[String!]!` | Yes | List of scope strings |
| `lifespan` | `BigInt` | No | Token lifetime in seconds (null = no expiry) |
| `limitResources` | `[TokenResourceIdentifierInput!]` | No | Restrict to specific resources |

**`TokenResourceIdentifierInput`:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | `String!` | Resource ID (project or workspace) |
| `type` | `TokenResourceIdentifierType!` | `project` or `workspace` |

**Returns:** `String!` — the token string. ALWAYS store this immediately; it is NOT retrievable after creation.

### apiTokenRevoke

Revokes an existing token.

```graphql
mutation TokenRevoke($token: String!) {
  apiTokenRevoke(token: $token)
}
```

**Required scope:** `tokens:write`

**Returns:** `Boolean!`

---

## Token Verification (GraphQL)

### activeUser

Tests token validity. Returns `null` if not authenticated.

```graphql
query { activeUser { id name email role } }
```

**Required scope:** `profile:read` (for basic fields), `profile:email` (for email)

### serverInfo (no auth required)

Discovers server capabilities and available auth strategies.

```graphql
query {
  serverInfo {
    name
    canonicalUrl
    version
    scopes { name description }
    authStrategies { id name icon }
  }
}
```

**Required scope:** None — this query is ALWAYS available without authentication.

---

## Permission Checks (GraphQL)

### project.permissions

Returns structured authorization results for the current user on a project.

```graphql
query {
  project(id: "<projectId>") {
    permissions {
      canLoad { authorized code message }
      canCreateModel { authorized code message }
      canDelete { authorized code message }
      canPublish { authorized code message }
    }
  }
}
```

**Return type per permission:**

| Field | Type | Description |
|-------|------|-------------|
| `authorized` | `Boolean!` | Whether the operation is allowed |
| `code` | `String` | Error code if not authorized (e.g., `FORBIDDEN`) |
| `message` | `String` | Human-readable explanation |

### project.role

Returns the current user's role on a project.

```graphql
query { project(id: "<projectId>") { role } }
```

**Possible values:** `owner`, `contributor`, `reviewer`, `null` (no access)

---

## OAuth2 Endpoints (REST)

### Authorization Redirect

```
GET https://<server>/authn/verify/<appId>/<challenge>?suuid=<optional-session-id>
```

| Parameter | Source | Description |
|-----------|--------|-------------|
| `appId` | URL path | Registered application ID |
| `challenge` | URL path | Random string, MUST be stored locally |
| `suuid` | Query param | Optional session identifier |

### Token Exchange

```
POST https://<server>/auth/token
Content-Type: application/json
```

**Request body (initial exchange):**

| Field | Type | Description |
|-------|------|-------------|
| `accessCode` | `String` | Code received in callback redirect |
| `appId` | `String` | Registered application ID |
| `appSecret` | `String` | Application secret |
| `challenge` | `String` | MUST match the challenge from authorization redirect |

**Request body (refresh):**

| Field | Type | Description |
|-------|------|-------------|
| `refreshToken` | `String` | Refresh token from previous exchange |
| `appId` | `String` | Registered application ID |
| `appSecret` | `String` | Application secret |

**Response (both cases):**

```json
{
  "token": "<access-token>",
  "refreshToken": "<refresh-token>"
}
```

---

## SpecklePy Authentication Methods

### SpeckleClient.authenticate_with_token

```python
from specklepy.api.client import SpeckleClient

client = SpeckleClient(host="https://app.speckle.systems")
client.authenticate_with_token("your_pat_or_oauth_token")
```

**Raises:** `SpeckleException` if the token is invalid or the server is unreachable.

### SpeckleClient.authenticate_with_account

```python
from specklepy.api.client import SpeckleClient
from specklepy.api.credentials import get_default_account

account = get_default_account()
client = SpeckleClient(host=account.serverInfo.url)
client.authenticate_with_account(account)
```

**Raises:** `SpeckleException` if no default account is found or account is invalid.

### get_default_account / get_local_accounts

```python
from specklepy.api.credentials import get_default_account, get_local_accounts

# Get the default account from Speckle Manager
default = get_default_account()  # Returns Account or raises SpeckleException

# List all accounts configured in Speckle Manager
accounts = get_local_accounts()  # Returns List[Account]
```

---

## Available Scopes

| Scope | Operations Allowed |
|-------|-------------------|
| `streams:read` | Read projects, models, versions, objects |
| `streams:write` | Create, update, delete projects/models/versions |
| `profile:read` | Read own user profile |
| `profile:email` | Access own email address |
| `profile:write` | Update own profile |
| `profile:delete` | Delete own account |
| `tokens:read` | List own API tokens |
| `tokens:write` | Create and revoke API tokens |
| `users:read` | Search and list other users |
| `apps:read` | List registered applications |
| `server:setup` | Server administration (SERVER_ADMIN only) |

---

## GraphQL Authorization Directives

These directives are applied in the Speckle GraphQL schema. They are NOT called directly but determine which operations require which permissions:

| Directive | Applied To | Effect |
|-----------|-----------|--------|
| `@hasServerRole(role: SERVER_USER)` | Queries/Mutations | Requires minimum server role |
| `@hasScope(scope: "...")` | Queries/Mutations | Requires specific token scope |
| `@hasScopes(scopes: [...])` | Queries/Mutations | Requires all listed scopes |
| `@isOwner` | Fields | Restricts access to resource owner |
