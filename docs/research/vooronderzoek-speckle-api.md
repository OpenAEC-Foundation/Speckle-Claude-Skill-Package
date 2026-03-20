# Vooronderzoek: Speckle API (GraphQL, REST, Authentication)

> Status: RAW — not yet processed into core files
> Date: 2026-03-20
> Sources: Speckle Server GitHub repository (specklesystems/speckle-server), SpecklePy source code (specklesystems/specklepy), Speckle documentation site (docs.speckle.systems), Speckle legacy docs (speckle.guide)

---

## 1. GraphQL API Overview

### 1.1 Endpoint URL Pattern

Speckle exposes a single GraphQL endpoint powered by Apollo Server v5.x:

- **Speckle Cloud**: `https://app.speckle.systems/graphql`
- **Self-hosted**: `https://<your-server-domain>/graphql`

The endpoint accepts standard GraphQL POST requests with JSON body containing `query`, `variables`, and optional `operationName` fields. An embedded Apollo Sandbox is available at the GraphQL endpoint URL when accessed via a browser.

### 1.2 Authentication Headers

All authenticated requests MUST include the `Authorization` header with a Bearer token:

```
Authorization: Bearer <YOUR_PERSONAL_ACCESS_TOKEN>
```

This applies to both Personal Access Tokens (PATs) and OAuth2 access tokens. Some queries (like `serverInfo`) are available without authentication, but most queries and ALL mutations require a valid token.

### 1.3 Server Directives

The Speckle GraphQL schema uses custom directives for authorization:

- `@hasServerRole(role: SERVER_USER)` — requires the user to have at minimum a specific server role
- `@hasScope(scope: "streams:read")` — requires the token to include a specific scope
- `@hasScopes(scopes: ["users:read", "profile:read"])` — requires multiple scopes
- `@isOwner` — restricts field access to the resource owner only

---

## 2. GraphQL Queries

### 2.1 activeUser — Get Authenticated User Profile

```graphql
query ActiveUser {
  activeUser {
    id
    email
    name
    bio
    company
    avatar
    verified
    role
  }
}
```

Required scope: `profile:read`. Returns `null` if not authenticated.

### 2.2 activeUser with Projects (Paginated)

```graphql
query UserProjects($limit: Int!, $cursor: String, $filter: UserProjectsFilter) {
  activeUser {
    projects(limit: $limit, cursor: $cursor, filter: $filter) {
      totalCount
      cursor
      items {
        id
        name
        description
        visibility
        allowPublicComments
        role
        createdAt
        updatedAt
        sourceApps
        workspaceId
      }
    }
  }
}
```

Filter options in `UserProjectsFilter`: `search`, `onlyWithRoles`, `workspaceId`, `personalOnly`, `includeImplicitAccess`.

### 2.3 activeUser with Workspaces (Paginated)

```graphql
query ActiveUserWorkspaces($limit: Int!, $cursor: String, $filter: UserWorkspacesFilter) {
  activeUser {
    workspaces(limit: $limit, cursor: $cursor, filter: $filter) {
      cursor
      totalCount
      items {
        id
        name
        role
        slug
        logo
        createdAt
        updatedAt
        readOnly
        description
      }
    }
  }
}
```

### 2.4 project(id) — Get a Specific Project

```graphql
query Project($projectId: String!) {
  project(id: $projectId) {
    id
    name
    description
    visibility
    allowPublicComments
    role
    createdAt
    updatedAt
    sourceApps
    workspaceId
  }
}
```

### 2.5 project with Models (Paginated, Nested)

```graphql
query ProjectWithModels(
  $projectId: String!
  $modelsLimit: Int!
  $modelsCursor: String
  $modelsFilter: ProjectModelsFilter
) {
  project(id: $projectId) {
    id
    name
    models(limit: $modelsLimit, cursor: $modelsCursor, filter: $modelsFilter) {
      items {
        id
        name
        displayName
        description
        previewUrl
        createdAt
        updatedAt
        author {
          id
          name
          avatar
        }
      }
      cursor
      totalCount
    }
  }
}
```

Filter options in `ProjectModelsFilter`: `search`, `sourceApps`, `contributors`, `onlyWithVersions`, `ids`, `excludeIds`.

### 2.6 model with Versions (Deeply Nested, Paginated)

```graphql
query ModelWithVersions(
  $modelId: String!
  $projectId: String!
  $versionsLimit: Int!
  $versionsCursor: String
  $versionsFilter: ModelVersionsFilter
) {
  project(id: $projectId) {
    model(id: $modelId) {
      id
      name
      displayName
      description
      versions(limit: $versionsLimit, cursor: $versionsCursor, filter: $versionsFilter) {
        items {
          id
          referencedObject
          message
          sourceApplication
          createdAt
          previewUrl
          authorUser {
            id
            name
            avatar
          }
        }
        totalCount
        cursor
      }
    }
  }
}
```

The `referencedObject` field is the object ID that can be used with the REST API to download the actual geometry/data.

### 2.7 version — Get a Specific Version

```graphql
query VersionGet($projectId: String!, $versionId: String!) {
  project(id: $projectId) {
    version(id: $versionId) {
      id
      referencedObject
      message
      sourceApplication
      createdAt
      previewUrl
      authorUser {
        id
        name
        bio
        company
        verified
        role
        avatar
      }
    }
  }
}
```

### 2.8 serverInfo — Server Metadata

```graphql
query ServerInfo {
  serverInfo {
    name
    company
    description
    adminContact
    canonicalUrl
    version
    automateUrl
    configuration {
      objectSizeLimitBytes
      objectMultipartUploadSizeLimitBytes
    }
    scopes {
      name
      description
    }
    authStrategies {
      id
      name
      icon
    }
    workspaces {
      workspacesEnabled
    }
  }
}
```

This query does NOT require authentication and is useful for server capability discovery.

### 2.9 Object Query

```graphql
query ProjectObject($projectId: String!, $objectId: String!) {
  project(id: $projectId) {
    object(id: $objectId) {
      id
      speckleType
      createdAt
      totalChildrenCount
      data
      children(limit: 100, depth: 50, select: ["speckleType", "name"]) {
        totalCount
        cursor
        objects {
          id
          speckleType
          data
        }
      }
    }
  }
}
```

The `data` field returns the full JSON object. The `children` query supports `select` (field filtering), `query` (JSON filter), and `orderBy` parameters. **WARNING**: Using `query` or `orderBy` triggers a much more expensive SQL query path.

### 2.10 Project Permissions Check

```graphql
query ProjectPermissions($projectId: String!) {
  project(id: $projectId) {
    permissions {
      canCreateModel { authorized code message }
      canDelete { authorized code message }
      canLoad { authorized code message }
      canPublish { authorized code message }
    }
  }
}
```

---

## 3. GraphQL Mutations

### 3.1 Project Mutations

**Create Project:**
```graphql
mutation ProjectCreate($input: ProjectCreateInput) {
  projectMutations {
    create(input: $input) {
      id
      name
      description
      visibility
    }
  }
}
```

Variables: `{ "input": { "name": "My Project", "description": "Optional", "visibility": "PRIVATE" } }`

Visibility enum: `PRIVATE`, `UNLISTED`, `PUBLIC`, `WORKSPACE`.

**Create Workspace Project:**
```graphql
mutation WorkspaceProjectCreate($input: WorkspaceProjectCreateInput!) {
  workspaceMutations {
    projects {
      create(input: $input) {
        id
        name
        workspaceId
      }
    }
  }
}
```

**Update Project:**
```graphql
mutation ProjectUpdate($input: ProjectUpdateInput!) {
  projectMutations {
    update(update: $input) {
      id
      name
      description
      visibility
      allowPublicComments
    }
  }
}
```

Variables: `{ "input": { "id": "<projectId>", "name": "New Name", "description": "Updated", "visibility": "PUBLIC", "allowPublicComments": true } }`

**Delete Project:**
```graphql
mutation ProjectDelete($projectId: String!) {
  projectMutations {
    delete(id: $projectId)
  }
}
```

Returns `Boolean!`.

**Batch Delete Projects:**
```graphql
mutation ProjectBatchDelete($ids: [String!]!) {
  projectMutations {
    batchDelete(ids: $ids)
  }
}
```

**Update Project Role:**
```graphql
mutation ProjectUpdateRole($input: ProjectUpdateRoleInput!) {
  projectMutations {
    updateRole(input: $input) {
      id
      team {
        id
        role
        user { id name }
      }
    }
  }
}
```

Variables: `{ "input": { "projectId": "<id>", "userId": "<userId>", "role": "stream:contributor" } }`

**Leave Project:**
```graphql
mutation ProjectLeave($id: String!) {
  projectMutations {
    leave(id: $id)
  }
}
```

### 3.2 Model Mutations

**Create Model:**
```graphql
mutation ModelCreate($input: CreateModelInput!) {
  modelMutations {
    create(input: $input) {
      id
      name
      displayName
      description
    }
  }
}
```

Variables: `{ "input": { "name": "Architecture", "description": "Main architecture model", "projectId": "<projectId>" } }`

**Update Model:**
```graphql
mutation ModelUpdate($input: UpdateModelInput!) {
  modelMutations {
    update(input: $input) {
      id
      name
      displayName
      description
    }
  }
}
```

**Delete Model:**
```graphql
mutation ModelDelete($input: DeleteModelInput!) {
  modelMutations {
    delete(input: $input)
  }
}
```

Returns `Boolean!`. Variables: `{ "input": { "id": "<modelId>", "projectId": "<projectId>" } }`

### 3.3 Version Mutations

**Create Version:**
```graphql
mutation VersionCreate($input: CreateVersionInput!) {
  versionMutations {
    create(input: $input) {
      id
      referencedObject
      message
      sourceApplication
      createdAt
    }
  }
}
```

The `CreateVersionInput` requires: `objectId` (the uploaded object hash), `modelId`, `projectId`, and optionally `message`, `sourceApplication`, `parents` (previous version IDs).

**Update Version:**
```graphql
mutation VersionUpdate($input: UpdateVersionInput!) {
  versionMutations {
    update(input: $input) {
      id
      message
    }
  }
}
```

**Move Version to Different Model:**
```graphql
mutation VersionMoveToModel($input: MoveVersionsInput!) {
  versionMutations {
    moveToModel(input: $input) {
      id
    }
  }
}
```

**Delete Versions:**
```graphql
mutation VersionDelete($input: DeleteVersionsInput!) {
  versionMutations {
    delete(input: $input)
  }
}
```

Returns `Boolean!`.

**Mark Version as Received:**
```graphql
mutation MarkReceived($input: MarkReceivedVersionInput!) {
  versionMutations {
    markReceived(input: $input)
  }
}
```

### 3.4 Webhook Mutations

**Create Webhook:**
```graphql
mutation WebhookCreate($webhook: WebhookCreateInput!) {
  webhookCreate(webhook: $webhook)
}
```

Returns the webhook ID as `String!`. Variables:
```json
{
  "webhook": {
    "streamId": "<projectId>",
    "url": "https://your-endpoint.com/webhook",
    "description": "My webhook",
    "triggers": ["version_create", "model_update"],
    "secret": "optional-secret-for-hmac",
    "enabled": true
  }
}
```

Required scope: `streams:write`. Required role: Stream Owner.

**Update Webhook:**
```graphql
mutation WebhookUpdate($webhook: WebhookUpdateInput!) {
  webhookUpdate(webhook: $webhook)
}
```

Variables: `{ "webhook": { "id": "<webhookId>", "streamId": "<projectId>", "url": "...", "enabled": false } }`

**Delete Webhook:**
```graphql
mutation WebhookDelete($webhook: WebhookDeleteInput!) {
  webhookDelete(webhook: $webhook)
}
```

Variables: `{ "webhook": { "id": "<webhookId>", "streamId": "<projectId>" } }`

### 3.5 API Token Mutations

**Create Token:**
```graphql
mutation TokenCreate($token: ApiTokenCreateInput!) {
  apiTokenCreate(token: $token)
}
```

Returns the token string. Variables:
```json
{
  "token": {
    "name": "My API Token",
    "scopes": ["streams:read", "streams:write", "profile:read"],
    "lifespan": 3600000000000,
    "limitResources": [
      { "id": "<projectId>", "type": "project" }
    ]
  }
}
```

Resource limiting (`limitResources`) restricts the token to specific projects or workspaces. Types: `project`, `workspace`.

**Revoke Token:**
```graphql
mutation TokenRevoke($token: String!) {
  apiTokenRevoke(token: $token)
}
```

Both require scope: `tokens:write`.

### 3.6 User Mutations

**Update Active User:**
```graphql
mutation ActiveUserUpdate($input: UserUpdateInput!) {
  activeUserMutations {
    update(user: $input) {
      id
      name
      bio
      company
    }
  }
}
```

---

## 4. GraphQL Subscriptions

Speckle uses WebSocket-based GraphQL subscriptions for real-time updates. Subscriptions require authentication via the same Bearer token.

### 4.1 userProjectsUpdated

Fires when the authenticated user's project list changes (added/removed).

```graphql
subscription UserProjectsUpdated {
  userProjectsUpdated {
    id
    type
    project {
      id
      name
      description
      visibility
      role
    }
  }
}
```

`type` values: `ADDED`, `REMOVED`.

### 4.2 projectUpdated

Fires when a specific project is updated or deleted.

```graphql
subscription ProjectUpdated($id: String!) {
  projectUpdated(id: $id) {
    id
    type
    project {
      id
      name
      description
      visibility
    }
  }
}
```

`type` values: `UPDATED`, `DELETED`.

### 4.3 projectModelsUpdated

Fires when models in a project change. Optionally filter by specific model IDs.

```graphql
subscription ProjectModelsUpdated($id: String!, $modelIds: [String!]) {
  projectModelsUpdated(id: $id, modelIds: $modelIds) {
    id
    type
    model {
      id
      name
      displayName
      description
      updatedAt
    }
  }
}
```

`type` values: `CREATED`, `UPDATED`, `DELETED`.

### 4.4 projectVersionsUpdated

Fires when versions in a project change.

```graphql
subscription ProjectVersionsUpdated($id: String!) {
  projectVersionsUpdated(id: $id) {
    id
    modelId
    type
    version {
      id
      referencedObject
      message
      sourceApplication
      createdAt
    }
  }
}
```

`type` values: `CREATED`, `UPDATED`, `DELETED`.

### 4.5 projectVersionsPreviewGenerated

Fires when a version preview image is generated.

```graphql
subscription ProjectVersionsPreviewGenerated($id: String!) {
  projectVersionsPreviewGenerated(id: $id) {
    projectId
    modelId
    versionId
    objectId
  }
}
```

---

## 5. Pagination Patterns

Speckle uses **cursor-based pagination** consistently across all collection types.

### Pattern

Every collection type follows this structure:

```graphql
type SomeCollection {
  totalCount: Int!
  cursor: String       # opaque cursor for next page, null when no more pages
  items: [SomeType!]!  # or `objects` for ObjectCollection
}
```

### Usage

```graphql
# First page
query { project(id: "...") { models(limit: 25) { items { id name } cursor totalCount } } }

# Next page
query { project(id: "...") { models(limit: 25, cursor: "returned-cursor") { items { id name } cursor totalCount } } }
```

Rules:
- ALWAYS specify `limit` — there is no default unlimited query
- When `cursor` is `null` in the response, there are no more pages
- `totalCount` gives the total number of items across all pages
- Typical limits: 25 for models/versions, 100 for objects

### Collection Types

| Collection | Items Field | Parent |
|---|---|---|
| `UserProjectCollection` | `items: [Project!]!` | `activeUser.projects` |
| `ModelCollection` | `items: [Model!]!` | `project.models` |
| `VersionCollection` | `items: [Version!]!` | `model.versions` |
| `ObjectCollection` | `objects: [Object!]!` | `object.children` |
| `WebhookCollection` | `items: [Webhook!]!` | `project.webhooks` |
| `WebhookEventCollection` | `items: [WebhookEvent]` | `webhook.history` |

Note: `ObjectCollection` uses `objects` instead of `items` — this is an inconsistency in the schema.

---

## 6. REST API

The REST API is limited to object upload/download operations. All other operations (projects, models, versions, users) MUST use the GraphQL API.

### 6.1 Download Object with Children

```
GET /objects/:projectId/:objectId
Authorization: Bearer <token>
Accept: application/json  (or text/plain)
```

- Returns the root object AND all its children as a gzip-compressed stream
- With `Accept: application/json`: returns a JSON array
- With `Accept: text/plain`: returns `{id}\t{data_json}\n` per line (tab-separated)
- Response header: `Content-Encoding: gzip`

This is the primary endpoint for receiving Speckle data. Use the `referencedObject` from a Version to get the full commit data tree.

### 6.2 Download Single Object

```
GET /objects/:projectId/:objectId/single
Authorization: Bearer <token>
```

- Returns ONLY the requested object (no children)
- Response: `application/json`
- Useful for inspecting a specific object without downloading the entire tree

### 6.3 Upload Objects

```
POST /objects/:projectId
Authorization: Bearer <token>
Content-Type: application/gzip | text/plain | application/json | application/octet-stream
```

- Accepts multipart form-data with file uploads
- Payload: JSON array of objects
- Maximum file size enforced by server configuration (`objectMultipartUploadSizeLimitBytes` from `serverInfo`)
- Returns HTTP 201 on success
- Error responses: 400 (invalid format), 413 (too large), 401/403 (unauthorized)

### 6.4 When to Use REST vs GraphQL

| Operation | Use |
|---|---|
| Query project/model/version metadata | GraphQL |
| Create/update/delete projects, models, versions | GraphQL |
| Manage users, teams, permissions | GraphQL |
| Download object data (geometry, properties) | REST |
| Upload object data | REST |
| Real-time subscriptions | GraphQL (WebSocket) |
| Webhook management | GraphQL |

The typical workflow is:
1. **GraphQL**: Query for a version's `referencedObject`
2. **REST**: Download the object tree via `GET /objects/:projectId/:referencedObject`
3. **REST**: Upload new objects via `POST /objects/:projectId`
4. **GraphQL**: Create a new version pointing to the uploaded root object

---

## 7. Authentication

### 7.1 Personal Access Tokens (PATs)

**Creation**: Profile > Settings > Developer > Access Tokens > "New Token"

**Scopes available**:

| Scope | Purpose |
|---|---|
| `streams:read` | Read project/model/version data |
| `streams:write` | Create/modify/delete projects, models, versions |
| `profile:read` | Read user profile |
| `profile:email` | Access user email |
| `profile:write` | Update user profile |
| `profile:delete` | Delete user account |
| `tokens:read` | List API tokens |
| `tokens:write` | Create/revoke API tokens |
| `users:read` | Search/list users |
| `apps:read` | List registered apps |
| `server:setup` | Server admin operations |

**Usage**: Include in every request as `Authorization: Bearer <token>`.

**Security rules**:
- NEVER use PATs in client-side (browser) code
- NEVER commit tokens to version control
- Store in environment variables or secret managers
- Apply principle of least privilege (minimal scopes)
- Rotate tokens periodically
- Revoke immediately if compromised

**Resource-scoped tokens**: Tokens can be limited to specific projects or workspaces using `limitResources` in `ApiTokenCreateInput`. This restricts the token to only operate on the specified resources.

### 7.2 OAuth2 Authorization Code Flow with Challenge

Speckle implements a custom variant of OAuth2 with a challenge parameter (similar in purpose to PKCE).

**Step 1: Register an Application**

Navigate to Profile > Settings > Developer > Apps > "New App". Provide:
- Application name
- Redirect URI (e.g., `http://localhost:3000/callback` for development)
- Required scopes
- Description

This yields an **App ID** and **App Secret**.

**Step 2: Redirect User to Authorization**

Generate a random challenge string and redirect the user to:

```
https://<server>/authn/verify/<appId>/<challenge>?suuid=<optional-session-id>
```

The challenge MUST be stored locally (e.g., in `localStorage`) — it is needed for token exchange.

**Step 3: Handle Callback**

After the user authorizes, Speckle redirects to your registered redirect URI with an `access_code` parameter.

**Step 4: Exchange Code for Tokens**

```
POST https://<server>/auth/token
Content-Type: application/json

{
  "accessCode": "<received-access-code>",
  "appId": "<your-app-id>",
  "appSecret": "<your-app-secret>",
  "challenge": "<the-same-challenge-from-step-2>"
}
```

Response:
```json
{
  "token": "<access-token>",
  "refreshToken": "<refresh-token>"
}
```

If the challenge does not match, the request FAILS.

**Step 5: Use the Token**

```
Authorization: Bearer <token>
```

**Step 6: Refresh Token**

When the access token expires, exchange the refresh token for a new pair:

```
POST https://<server>/auth/token
Content-Type: application/json

{
  "refreshToken": "<refresh-token>",
  "appId": "<your-app-id>",
  "appSecret": "<your-app-secret>"
}
```

**Frontend applications** are treated as OAuth public applications — they cannot keep secrets safe. The community package `speckle-auth` automates challenge generation, state management, and token exchange.

**Security considerations**:
- NEVER expose App Secret in client-side code
- Store App Secret in environment variables
- Use HTTPS for all redirect URIs in production
- Register separate apps for development and production environments

### 7.3 Token Compromise Response

1. Immediately revoke the compromised token (Settings > Developer > Access Tokens)
2. Generate a replacement token
3. Update application configuration
4. Review access logs for unauthorized activity
5. If App Secret is exposed: regenerate it

---

## 8. Webhooks

### 8.1 Event Types (Trigger Strings)

The following trigger strings are used when creating webhooks. The internal names use legacy terminology (stream/branch/commit) while display names use modern terminology (project/model/version):

| Trigger String | Display Name | Description |
|---|---|---|
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

IMPORTANT: When calling `webhookCreate`, you MUST use the **internal trigger string** (left column), NOT the display name.

### 8.2 Webhook Payload Structure

When a webhook fires, the payload includes:

```json
{
  "streamId": "<projectId>",
  "stream": { "id": "...", "name": "...", "description": "..." },
  "userId": "<triggeringUserId>",
  "user": { "id": "...", "name": "...", "bio": "...", "company": "...", "avatar": "..." },
  "server": { "name": "...", "canonicalUrl": "https://app.speckle.systems" },
  "webhook": { "id": "...", "streamId": "...", "url": "...", "description": "...", "triggers": [...] },
  "event": { ... }
}
```

Sensitive fields are ALWAYS stripped from payloads:
- `server.id` is removed
- `user.passwordDigest` is removed
- `user.email` is removed
- `webhook.secret` is removed

### 8.3 Webhook Configuration

- Maximum **100 webhooks per stream/project** (`MAX_STREAM_WEBHOOKS = 100`)
- Webhooks expose a `hasSecret` boolean field (the actual secret is never returned)
- History is available via `webhook.history(limit: 25)` returning `WebhookEventCollection`
- Each `WebhookEvent` includes: `id`, `webhookId`, `status` (HTTP code), `statusInfo`, `retryCount`, `lastUpdate`, `payload`

### 8.4 Querying Webhooks

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

## 9. Rate Limiting

Speckle implements rate limiting at the REST/GraphQL middleware level:

- **Identification priority**: User ID > Token ID (substring from position 10) > IP address > "unknown"
- **GraphQL batched requests**: Each operation in a batch counts as a separate hit
- **Response headers on 429 (Too Many Requests)**:
  - `Retry-After`: milliseconds until next allowed request
  - `X-RateLimit-Reset`: ISO timestamp of reset
  - `X-RateLimit-Remaining`: available points (on successful requests)
  - `X-Speckle-Meditation`: humorous message

Exact rate limits (requests per window) are server-configurable and depend on the deployment. The Speckle Cloud limits are not publicly documented but can be discovered through the response headers.

---

## 10. Terminology Mapping (v2 Legacy vs Current)

This is one of the most critical topics for developers working with the Speckle API. The GraphQL schema maintains BOTH old and new terminology, with old terms marked as deprecated.

### 10.1 Complete Mapping

| Legacy Term (v2) | Current Term | GraphQL Legacy Type | GraphQL Current Type |
|---|---|---|---|
| Stream | Project | `Stream` | `Project` |
| Branch | Model | `Branch` | `Model` |
| Commit | Version | `Commit` | `Version` |
| StreamCollaborator | ProjectCollaborator | `StreamCollaborator` | `ProjectCollaborator` |

### 10.2 Query Mapping

| Legacy Query | Current Query | Status |
|---|---|---|
| `stream(id)` | `project(id)` | Legacy DEPRECATED |
| `streams(...)` | `activeUser { projects(...) }` | Legacy DEPRECATED |
| `stream.branches(...)` | `project.models(...)` | Legacy DEPRECATED |
| `stream.branch(name)` | `project.model(id)` / `project.modelByName(name)` | Legacy DEPRECATED |
| `stream.commits(...)` | `model.versions(...)` | Legacy DEPRECATED |
| `stream.commit(id)` | `project.version(id)` | Legacy DEPRECATED |
| `stream.object(id)` | `project.object(id)` | Legacy DEPRECATED |

### 10.3 Mutation Mapping

| Legacy Mutation | Current Mutation |
|---|---|
| `streamCreate` | `projectMutations.create` |
| `streamUpdate` | `projectMutations.update` |
| `streamDelete` | `projectMutations.delete` |
| `streamsDelete` | `projectMutations.batchDelete` |
| `streamUpdatePermission` | `projectMutations.updateRole` |
| `streamRevokePermission` | `projectMutations.updateRole` (with null role) |
| `streamLeave` | `projectMutations.leave` |
| `branchCreate` | `modelMutations.create` |
| `branchUpdate` | `modelMutations.update` |
| `branchDelete` | `modelMutations.delete` |
| `commitCreate` | `versionMutations.create` |
| `commitUpdate` | `versionMutations.update` |
| `commitDelete` | `versionMutations.delete` |
| `commitsMove` | `versionMutations.moveToModel` |
| `commitReceive` | `versionMutations.markReceived` |

### 10.4 Subscription Mapping

| Legacy Subscription | Current Subscription |
|---|---|
| `userStreamAdded` / `userStreamRemoved` | `userProjectsUpdated` |
| `streamUpdated` / `streamDeleted` | `projectUpdated` |
| `branchCreated` / `branchUpdated` / `branchDeleted` | `projectModelsUpdated` |
| `commitCreated` / `commitUpdated` / `commitDeleted` | `projectVersionsUpdated` |

### 10.5 Webhook Triggers Still Use Legacy Names

CRITICAL: Webhook trigger strings STILL use legacy terminology (`stream_update`, `branch_create`, `commit_create`). The display names in the UI show modern terms, but the API values are legacy. This is a major source of confusion.

### 10.6 SDK Differences

- **SpecklePy**: Uses modern terminology in the current API resources (`ProjectResource`, `ModelResource`, `VersionResource`). Legacy resources use `StreamResource`, `BranchResource`, `CommitResource`.
- **Speckle Sharp (C#)**: Similar split between legacy and current API clients.
- **GraphQL input types**: Some still reference `streamId` even in current mutations (e.g., `WebhookCreateInput.streamId`, `CreateModelInput.projectId`).

---

## 11. Error Handling Patterns

### 11.1 GraphQL Errors

GraphQL errors follow the standard format:

```json
{
  "errors": [
    {
      "message": "You do not have access to this resource.",
      "locations": [{ "line": 2, "column": 3 }],
      "path": ["project"],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": null
}
```

Common error codes:
- `FORBIDDEN` — insufficient permissions (wrong role or missing scope)
- `UNAUTHENTICATED` — missing or invalid token
- `NOT_FOUND` — resource does not exist or user lacks access
- `BAD_USER_INPUT` — invalid input parameters

### 11.2 Authorization Error Structure

The permissions system returns structured authorization results:

```graphql
{
  authorized: false,
  code: "FORBIDDEN",
  message: "You do not have the required permissions."
}
```

### 11.3 REST API Errors

- `401` — Unauthorized (no token or invalid token)
- `403` — Forbidden (valid token but insufficient permissions)
- `404` — Object not found
- `413` — Payload too large (exceeds `objectMultipartUploadSizeLimitBytes`)
- `429` — Rate limited (check `Retry-After` header)

---

## 12. Anti-Patterns and Common Mistakes

### AP-1: Using Legacy API in New Code

**Wrong**: Using `stream`, `branch`, `commit` queries/mutations in new applications.
**Right**: ALWAYS use `project`, `model`, `version` (current) API surface. The legacy surface will be removed in a future release.

### AP-2: Not Paginating Collections

**Wrong**: Assuming all items are returned in a single query.
**Right**: ALWAYS implement cursor-based pagination. Check if `cursor` is non-null and fetch next page.

### AP-3: Using Object children() with query/orderBy

**Wrong**: `object.children(query: [...], orderBy: {...})` for basic data retrieval.
**Right**: Use the plain `object.children(limit: 100)` for standard traversal. The `query`/`orderBy` parameters trigger expensive SQL queries meant only for advanced filtering.

### AP-4: Using PATs in Client-Side Code

**Wrong**: Embedding Personal Access Tokens in browser JavaScript.
**Right**: Use OAuth2 flow for browser applications. PATs are for server-side scripts and automation only.

### AP-5: Not Handling Rate Limits

**Wrong**: Ignoring 429 responses and retrying immediately.
**Right**: Read the `Retry-After` header and wait before retrying. Implement exponential backoff.

### AP-6: Using GraphQL for Object Data Download

**Wrong**: Using `project.object.data` GraphQL query for large object trees.
**Right**: Use the REST endpoint `GET /objects/:projectId/:objectId` for streaming large datasets. The REST endpoint supports gzip compression and streaming, making it far more efficient for large models.

### AP-7: Webhook Triggers with Display Names

**Wrong**: `{ "triggers": ["version_create", "model_update"] }` (display names).
**Right**: `{ "triggers": ["commit_create", "branch_update"] }` (internal trigger strings). The API uses legacy terminology for webhook triggers even though the UI shows modern names.

### AP-8: Forgetting the Challenge in OAuth2

**Wrong**: Not storing/matching the challenge parameter during OAuth2 flow.
**Right**: Generate a random challenge, store it locally, and pass the SAME challenge when exchanging the access code. Mismatched challenges cause token exchange failure.

### AP-9: Over-Requesting Fields

**Wrong**: Requesting all fields on deeply nested queries (users with projects with models with versions).
**Right**: Request only the fields you need. Use separate queries for different data needs. Deep nesting with many fields causes slow queries.

### AP-10: Hardcoding Server URL

**Wrong**: Hardcoding `https://app.speckle.systems/graphql` in your application.
**Right**: Make the server URL configurable. Users may use self-hosted Speckle servers with different URLs.

### AP-11: Not Using Aliases for Nested Mutations

**Wrong**: Accessing deeply nested mutation results without understanding the response structure.
**Right**: The SpecklePy SDK uses `data:` aliases (e.g., `data:projectMutations { data:create(...) }`) to simplify response parsing. When writing raw GraphQL, use similar aliases or understand the nested response path.

### AP-12: Ignoring objectSizeLimitBytes

**Wrong**: Uploading arbitrarily large objects without checking server limits.
**Right**: Query `serverInfo.configuration.objectSizeLimitBytes` and `objectMultipartUploadSizeLimitBytes` first, then split uploads accordingly.

---

## 13. Open Questions for Skills

1. **Exact rate limits on Speckle Cloud**: What are the specific request-per-minute limits? This needs to be discovered through testing or Speckle team confirmation.
2. **WebSocket transport for subscriptions**: What WebSocket library/protocol does Speckle use? Is it `graphql-ws` or the older `subscriptions-transport-ws`?
3. **OAuth2 refresh token expiry**: How long are refresh tokens valid? Is there a maximum lifetime?
4. **Webhook retry policy**: How many retries are attempted for failed webhook deliveries? What is the retry interval?
5. **Token resource scoping**: How does `limitResources` interact with workspace-level permissions? Can a project-scoped token access workspace-level queries?
6. **Diff endpoints**: The server has `diffDownload.ts` and `diffUpload.ts` REST endpoints — what are their URL patterns and when are they used?
7. **File uploads via REST**: The `fileuploads/rest/router.ts` handles IFC/DWG/OBJ uploads — what is the endpoint pattern and how does it differ from the object upload?
8. **Automate function triggers**: How do Automate functions interact with the webhook system? Are they separate event streams?
9. **Batch operations**: Beyond `batchDelete`, are there other batch mutation patterns for bulk model/version operations?
10. **Server migration fields**: What do `ServerMigration.movedFrom` and `movedTo` indicate? Is this for server-to-server migration?

---

## 14. Key Implementation Patterns

### 14.1 The Standard Send/Receive Workflow

```
1. Authenticate (PAT or OAuth2)
2. [Send] Serialize objects → POST /objects/:projectId (REST)
3. [Send] Create version → versionMutations.create (GraphQL)
4. [Receive] Get version → project.version (GraphQL) → get referencedObject
5. [Receive] Download objects → GET /objects/:projectId/:objectId (REST)
6. [Receive] Deserialize objects
```

### 14.2 Real-Time Monitoring Pattern

```
1. Authenticate
2. Subscribe to projectVersionsUpdated (GraphQL WebSocket)
3. On new version → query version details (GraphQL)
4. Download changed objects (REST)
5. Process changes
```

### 14.3 Webhook Integration Pattern

```
1. Create webhook via webhookCreate mutation
2. Receive POST requests at your endpoint
3. Validate payload (check webhook.id matches)
4. Extract event data from payload
5. Query additional details via GraphQL if needed
6. Process the event
```

---

## 15. Server Configuration Discovery

Before building integrations, query `serverInfo` to discover:

- `version` — the server version (determines available features)
- `configuration.objectSizeLimitBytes` — maximum single object size
- `configuration.objectMultipartUploadSizeLimitBytes` — maximum upload file size
- `scopes` — available permission scopes
- `authStrategies` — available authentication methods
- `automateUrl` — whether Speckle Automate is available
- `workspaces.workspacesEnabled` — whether workspace features are enabled

---

## Sources Consulted

| Source | URL | Accessed |
|---|---|---|
| Speckle Server GitHub - Project Schema | `github.com/specklesystems/speckle-server/.../projects.graphql` | 2026-03-20 |
| Speckle Server GitHub - Models & Versions Schema | `github.com/specklesystems/speckle-server/.../modelsAndVersions.graphql` | 2026-03-20 |
| Speckle Server GitHub - Streams Schema (deprecated) | `github.com/specklesystems/speckle-server/.../streams.graphql` | 2026-03-20 |
| Speckle Server GitHub - Branches & Commits Schema (deprecated) | `github.com/specklesystems/speckle-server/.../branchesAndCommits.graphql` | 2026-03-20 |
| Speckle Server GitHub - Webhooks Schema | `github.com/specklesystems/speckle-server/.../webhooks.graphql` | 2026-03-20 |
| Speckle Server GitHub - API Token Schema | `github.com/specklesystems/speckle-server/.../apitoken.graphql` | 2026-03-20 |
| Speckle Server GitHub - Server Schema | `github.com/specklesystems/speckle-server/.../server.graphql` | 2026-03-20 |
| Speckle Server GitHub - Objects Schema | `github.com/specklesystems/speckle-server/.../objects.graphql` | 2026-03-20 |
| Speckle Server GitHub - User Schema | `github.com/specklesystems/speckle-server/.../user.graphql` | 2026-03-20 |
| Speckle Server GitHub - REST Download Handler | `github.com/specklesystems/speckle-server/.../rest/download.ts` | 2026-03-20 |
| Speckle Server GitHub - REST Upload Handler | `github.com/specklesystems/speckle-server/.../rest/upload.ts` | 2026-03-20 |
| Speckle Server GitHub - Rate Limiter | `github.com/specklesystems/speckle-server/.../rest/ratelimiter.ts` | 2026-03-20 |
| Speckle Server GitHub - Webhook Services | `github.com/specklesystems/speckle-server/.../webhooks/services/webhooks.ts` | 2026-03-20 |
| Speckle Server GitHub - Webhook Types | `github.com/specklesystems/speckle-server/.../webhooks/domain/types.ts` | 2026-03-20 |
| Speckle Server GitHub - Generated GraphQL Types | `github.com/specklesystems/speckle-server/.../generated/graphql.ts` | 2026-03-20 |
| SpecklePy GitHub - Project Resource | `github.com/specklesystems/specklepy/.../project_resource.py` | 2026-03-20 |
| SpecklePy GitHub - Model Resource | `github.com/specklesystems/specklepy/.../model_resource.py` | 2026-03-20 |
| SpecklePy GitHub - Version Resource | `github.com/specklesystems/specklepy/.../version_resource.py` | 2026-03-20 |
| SpecklePy GitHub - Subscription Resource | `github.com/specklesystems/specklepy/.../subscription_resource.py` | 2026-03-20 |
| SpecklePy GitHub - Active User Resource | `github.com/specklesystems/specklepy/.../active_user_resource.py` | 2026-03-20 |
| SpecklePy GitHub - Server Resource | `github.com/specklesystems/specklepy/.../server_resource.py` | 2026-03-20 |
| SpecklePy GitHub - Operations | `github.com/specklesystems/specklepy/.../operations.py` | 2026-03-20 |
| Speckle Frontend - Webhook Composables | `github.com/specklesystems/speckle-server/.../webhooks.ts` | 2026-03-20 |
| Speckle Docs - Authentication | `docs.speckle.systems/developers/authentication` | 2026-03-20 |
| Speckle Docs - llms.txt (doc index) | `docs.speckle.systems/llms.txt` | 2026-03-20 |
| Speckle Legacy Docs - OAuth Apps | `speckle.guide/dev/apps.html` | 2026-03-20 |
| Speckle Legacy Docs - Tokens | `speckle.guide/dev/tokens.html` | 2026-03-20 |
