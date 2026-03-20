---
name: speckle-core-api
description: >
  Use when connecting to Speckle Server, authenticating, or understanding the GraphQL/REST API surface.
  Prevents confusion between old terminology (Stream/Branch/Commit) and new (Project/Model/Version), and auth scope mismatches.
  Covers GraphQL endpoint, authentication (PAT, OAuth2+PKCE), REST endpoints, terminology mapping, rate limiting, and error handling.
  Keywords: speckle api, graphql, rest, authentication, PAT, oauth, project, stream, model, branch, version, commit.
license: MIT
compatibility: "Designed for Claude Code. Requires Speckle Server 2.x/3.x, SpecklePy, Speckle.Sdk."
metadata:
  author: OpenAEC-Foundation
  version: "1.0"
---

# speckle-core-api

## Quick Reference

### API Surface Overview

| API Layer | Protocol | Endpoint | Purpose |
|-----------|----------|----------|---------|
| GraphQL | HTTP POST | `https://<server>/graphql` | All metadata CRUD, subscriptions |
| REST Download | HTTP GET | `GET /objects/:projectId/:objectId` | Download object data (with children) |
| REST Download Single | HTTP GET | `GET /objects/:projectId/:objectId/single` | Download one object (no children) |
| REST Upload | HTTP POST | `POST /objects/:projectId` | Upload serialized objects |
| OAuth Token | HTTP POST | `POST /auth/token` | Exchange auth code or refresh token |

### Terminology Mapping (CRITICAL)

| Legacy Term (Deprecated) | Current Term | GraphQL Legacy Type | GraphQL Current Type |
|--------------------------|--------------|---------------------|----------------------|
| Stream | **Project** | `Stream` | `Project` |
| Branch | **Model** | `Branch` | `Model` |
| Commit | **Version** | `Commit` | `Version` |
| StreamCollaborator | **ProjectCollaborator** | `StreamCollaborator` | `ProjectCollaborator` |

**ALWAYS** use current terminology (`Project`, `Model`, `Version`) in new code. The legacy types exist for backward compatibility and will be removed in a future release.

### Authentication Header Format

```
Authorization: Bearer <YOUR_TOKEN>
```

This format applies to BOTH Personal Access Tokens and OAuth2 access tokens, for BOTH GraphQL and REST endpoints.

### Auth Scope Table

| Scope | Purpose |
|-------|---------|
| `streams:read` | Read project/model/version data |
| `streams:write` | Create/modify/delete projects, models, versions |
| `profile:read` | Read user profile |
| `profile:email` | Access user email |
| `profile:write` | Update user profile |
| `profile:delete` | Delete user account |
| `tokens:read` | List API tokens |
| `tokens:write` | Create/revoke API tokens |
| `users:read` | Search/list users |
| `apps:read` | List registered OAuth apps |
| `server:setup` | Server admin operations |

### Critical Warnings

**NEVER** use legacy queries (`stream`, `branch`, `commit`) in new code -- ALWAYS use current queries (`project`, `model`, `version`). Legacy queries are deprecated and will be removed.

**NEVER** embed Personal Access Tokens in client-side (browser) JavaScript -- ALWAYS use OAuth2 flow for browser applications. PATs are for server-side scripts and automation only.

**NEVER** commit tokens to version control -- ALWAYS store tokens in environment variables or secret managers.

**NEVER** hardcode `https://app.speckle.systems/graphql` -- ALWAYS make the server URL configurable. Users may run self-hosted Speckle servers.

**NEVER** use `project.object.data` GraphQL queries for large object trees -- ALWAYS use the REST endpoint `GET /objects/:projectId/:objectId` which supports gzip streaming.

**NEVER** use display names (`version_create`, `model_update`) as webhook trigger strings -- ALWAYS use internal legacy names (`commit_create`, `branch_update`).

**NEVER** ignore 429 responses -- ALWAYS read the `Retry-After` header and implement exponential backoff.

**NEVER** skip pagination -- ALWAYS implement cursor-based pagination for collections. There is no unlimited query.

---

## GraphQL Endpoint

### Connection URL

- **Speckle Cloud**: `https://app.speckle.systems/graphql`
- **Self-hosted**: `https://<your-server-domain>/graphql`

The endpoint accepts standard GraphQL POST requests with JSON body containing `query`, `variables`, and optional `operationName`. An Apollo Sandbox explorer is available when accessing the URL in a browser.

### Server Discovery

ALWAYS query `serverInfo` first to discover server capabilities:

```graphql
query ServerInfo {
  serverInfo {
    name
    version
    canonicalUrl
    automateUrl
    configuration {
      objectSizeLimitBytes
      objectMultipartUploadSizeLimitBytes
    }
    scopes { name description }
    authStrategies { id name }
    workspaces { workspacesEnabled }
  }
}
```

This query does NOT require authentication.

---

## Authentication

### Decision Tree: PAT vs OAuth2

```
Is this a server-side script, CLI tool, or CI/CD pipeline?
├─ YES → Use Personal Access Token (PAT)
│        - Simple: one header, no flow
│        - Scope to minimal permissions
│        - Rotate periodically
└─ NO → Is this a browser/desktop app with user interaction?
         ├─ YES → Use OAuth2 + Challenge flow
         │        - Register an OAuth app on the server
         │        - Redirect user for consent
         │        - Exchange code + challenge for token
         └─ NO → Is this a Speckle Automate function?
                  └─ YES → Token is injected by the Automate runtime
                           - Use the provided token directly
```

### Personal Access Tokens (PATs)

**Create**: Profile > Settings > Developer > Access Tokens > "New Token"

**Use**: Include in every request header:
```
Authorization: Bearer <token>
```

**Resource-scoped tokens**: Tokens can be limited to specific projects or workspaces via the `limitResources` parameter in `ApiTokenCreateInput`. This restricts the token to only operate on the specified resources.

**Security rules**:
- ALWAYS apply principle of least privilege (minimal scopes)
- ALWAYS store in environment variables or secret managers
- ALWAYS rotate periodically
- ALWAYS revoke immediately if compromised

### OAuth2 + Challenge Flow

Speckle implements a custom OAuth2 variant with a challenge parameter (similar to PKCE).

**Flow summary**:
1. Register app on server (get App ID + App Secret)
2. Generate random challenge string, store locally
3. Redirect user to `https://<server>/authn/verify/<appId>/<challenge>`
4. User authorizes; Speckle redirects to your URI with `access_code`
5. Exchange code for tokens via `POST /auth/token`
6. Use access token; refresh when expired

See [references/examples.md](references/examples.md) for complete code examples.

---

## REST API

The REST API handles ONLY object upload/download. All other operations MUST use GraphQL.

### Download Objects (with children)

```
GET /objects/:projectId/:objectId
Authorization: Bearer <token>
Accept: application/json
```

Returns the root object AND all children as gzip-compressed stream. Use the `referencedObject` from a Version to get the full data tree.

### Download Single Object

```
GET /objects/:projectId/:objectId/single
Authorization: Bearer <token>
```

Returns ONLY the requested object (no children). Useful for inspecting metadata without downloading the tree.

### Upload Objects

```
POST /objects/:projectId
Authorization: Bearer <token>
Content-Type: application/gzip | text/plain | application/json
```

Returns HTTP 201 on success. ALWAYS check `serverInfo.configuration.objectMultipartUploadSizeLimitBytes` before uploading.

### Standard Send/Receive Workflow

```
1. Authenticate (PAT or OAuth2)
2. [Send] Serialize objects → POST /objects/:projectId (REST)
3. [Send] Create version → versionMutations.create (GraphQL)
4. [Receive] Get version → project.version (GraphQL) → get referencedObject
5. [Receive] Download objects → GET /objects/:projectId/:objectId (REST)
6. [Receive] Deserialize objects
```

---

## Pagination

Speckle uses cursor-based pagination for ALL collections:

```graphql
type SomeCollection {
  totalCount: Int!
  cursor: String       # null when no more pages
  items: [SomeType!]!  # "objects" for ObjectCollection
}
```

Rules:
- ALWAYS specify `limit` -- there is no default unlimited query
- When `cursor` is `null` in response, there are no more pages
- `ObjectCollection` uses `objects` instead of `items` (schema inconsistency)
- Typical limits: 25 for models/versions, 100 for objects

---

## Rate Limiting

- **Identification priority**: User ID > Token ID > IP address > "unknown"
- **Batched GraphQL**: Each operation in a batch counts separately
- **Response headers on 429**:
  - `Retry-After`: milliseconds until next request
  - `X-RateLimit-Reset`: ISO timestamp of reset
  - `X-RateLimit-Remaining`: available points (on success)

---

## Error Handling

### GraphQL Errors

```json
{
  "errors": [{
    "message": "You do not have access to this resource.",
    "path": ["project"],
    "extensions": { "code": "FORBIDDEN" }
  }],
  "data": null
}
```

| Error Code | Meaning |
|------------|---------|
| `FORBIDDEN` | Wrong role or missing scope |
| `UNAUTHENTICATED` | Missing or invalid token |
| `NOT_FOUND` | Resource does not exist or no access |
| `BAD_USER_INPUT` | Invalid input parameters |

### REST API Errors

| HTTP Code | Meaning |
|-----------|---------|
| 401 | Unauthorized (no/invalid token) |
| 403 | Forbidden (valid token, insufficient permissions) |
| 404 | Object not found |
| 413 | Payload too large |
| 429 | Rate limited (check `Retry-After`) |

---

## GraphQL Schema Directives

The schema uses custom directives for authorization:

| Directive | Purpose |
|-----------|---------|
| `@hasServerRole(role: SERVER_USER)` | Requires minimum server role |
| `@hasScope(scope: "streams:read")` | Requires specific token scope |
| `@hasScopes(scopes: [...])` | Requires multiple scopes |
| `@isOwner` | Restricts to resource owner |

---

## Webhook Trigger Terminology (CRITICAL)

Webhook triggers STILL use legacy internal names. The display names in the UI differ:

| Internal Name (use THIS) | Display Name (UI only) |
|---------------------------|----------------------|
| `stream_update` | project_update |
| `stream_delete` | project_delete |
| `branch_create` | model_create |
| `branch_update` | model_update |
| `branch_delete` | model_delete |
| `commit_create` | version_create |
| `commit_update` | version_update |
| `commit_receive` | version_receive |
| `commit_delete` | version_delete |
| `comment_created` | comment_created |
| `comment_archived` | comment_archived |
| `comment_replied` | comment_replied |
| `stream_permissions_add` | project_permissions_add |
| `stream_permissions_remove` | project_permissions_remove |

---

## API Version Differences (Server 2.x vs 3.x)

| Aspect | Server 2.x | Server 3.x |
|--------|-----------|-----------|
| Legacy queries | Available (deprecated) | Removal planned |
| Current queries | Full support | Full support |
| Workspaces | Not available | Available (check `serverInfo`) |
| Webhook triggers | Legacy names only | Legacy names only |
| Object REST endpoints | Same | Same |

ALWAYS query `serverInfo.version` to determine which features are available.

---

## Reference Links

- [references/methods.md](references/methods.md) -- GraphQL schema: queries, mutations, subscriptions
- [references/examples.md](references/examples.md) -- Working GraphQL + REST examples
- [references/anti-patterns.md](references/anti-patterns.md) -- API misuse patterns

### Official Sources

- https://docs.speckle.systems/
- https://github.com/specklesystems/speckle-server
- https://github.com/specklesystems/specklepy
- https://speckle.guide/dev/apps.html (legacy OAuth docs)
