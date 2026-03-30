---
name: speckle-syntax-graphql
description: >
  Use when writing GraphQL queries, mutations, or subscriptions against the Speckle Server API.
  Prevents incorrect pagination patterns, missing variable declarations, and deprecated query usage.
  Covers all major queries (activeUser, project, workspace, serverInfo), mutations (CRUD for projects/models/versions/webhooks/tokens), subscriptions, cursor-based pagination, and nested query patterns.
  Keywords: speckle graphql, query, mutation, subscription, pagination, activeUser, project, model, version, cursor, fetch data, list projects, get versions, API query.
license: MIT
compatibility: "Designed for Claude Code. Requires Speckle Server 2.x/3.x, SpecklePy, Speckle.Sdk."
metadata:
  author: OpenAEC-Foundation
  version: "1.0"
---

# speckle-syntax-graphql

## Quick Reference

### GraphQL Endpoint

| Environment | URL |
|-------------|-----|
| Speckle Cloud | `https://app.speckle.systems/graphql` |
| Self-hosted | `https://<your-server-domain>/graphql` |

ALWAYS send requests as HTTP POST with JSON body containing `query`, `variables`, and optional `operationName`.

### Authentication

ALWAYS include the `Authorization` header for authenticated requests:

```
Authorization: Bearer <PERSONAL_ACCESS_TOKEN>
```

This applies to Personal Access Tokens (PATs) and OAuth2 access tokens. The only query available without authentication is `serverInfo`.

### Critical Warnings

**NEVER** omit the `limit` parameter on paginated fields -- Speckle has no default unlimited query. ALWAYS specify `limit` explicitly.

**NEVER** use offset-based pagination -- Speckle uses cursor-based pagination exclusively. ALWAYS use `cursor` + `limit`.

**NEVER** assume `cursor: null` means error -- a `null` cursor in the response means there are no more pages. ALWAYS check `cursor` to determine if more pages exist.

**NEVER** use `items` on `ObjectCollection` -- object children use the field name `objects`, not `items`. This is the only collection type with this inconsistency.

**NEVER** forget to declare GraphQL variables with their types in the operation signature -- missing `$variable: Type!` declarations cause parse errors.

**NEVER** use the legacy stream/branch/commit terminology in GraphQL queries -- ALWAYS use the current terminology: project (was stream), model (was branch), version (was commit).

**NEVER** use `query` or `orderBy` on `object.children` without understanding the performance cost -- these parameters trigger expensive SQL query paths on the server.

---

## Queries

### activeUser -- Authenticated User Profile

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

### activeUser with Projects (Paginated)

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
        role
        createdAt
        updatedAt
        workspaceId
      }
    }
  }
}
```

Filter fields: `search`, `onlyWithRoles`, `workspaceId`, `personalOnly`, `includeImplicitAccess`.

### project(id) -- Get a Specific Project

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

### project with Models (Nested, Paginated)

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
      totalCount
      cursor
      items {
        id
        name
        displayName
        description
        createdAt
        updatedAt
        author { id name avatar }
      }
    }
  }
}
```

Filter fields: `search`, `sourceApps`, `contributors`, `onlyWithVersions`, `ids`, `excludeIds`.

### model with Versions (Deeply Nested, Paginated)

```graphql
query ModelWithVersions(
  $projectId: String!
  $modelId: String!
  $versionsLimit: Int!
  $versionsCursor: String
) {
  project(id: $projectId) {
    model(id: $modelId) {
      id
      name
      versions(limit: $versionsLimit, cursor: $versionsCursor) {
        totalCount
        cursor
        items {
          id
          referencedObject
          message
          sourceApplication
          createdAt
          previewUrl
          authorUser { id name avatar }
        }
      }
    }
  }
}
```

The `referencedObject` field contains the object ID for use with the REST API to download geometry/data.

### serverInfo -- Server Metadata (No Auth Required)

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
    scopes { name description }
    authStrategies { id name icon }
    workspaces { workspacesEnabled }
  }
}
```

---

## Mutations

### Project Mutations

```graphql
# Create
mutation ProjectCreate($input: ProjectCreateInput) {
  projectMutations {
    create(input: $input) { id name description visibility }
  }
}

# Update
mutation ProjectUpdate($input: ProjectUpdateInput!) {
  projectMutations {
    update(update: $input) { id name description visibility }
  }
}

# Delete
mutation ProjectDelete($projectId: String!) {
  projectMutations {
    delete(id: $projectId)
  }
}
```

Visibility enum values: `PRIVATE`, `UNLISTED`, `PUBLIC`, `WORKSPACE`.

### Model Mutations

```graphql
# Create
mutation ModelCreate($input: CreateModelInput!) {
  modelMutations {
    create(input: $input) { id name displayName description }
  }
}

# Update
mutation ModelUpdate($input: UpdateModelInput!) {
  modelMutations {
    update(input: $input) { id name displayName description }
  }
}

# Delete
mutation ModelDelete($input: DeleteModelInput!) {
  modelMutations {
    delete(input: $input)
  }
}
```

`CreateModelInput` requires: `name`, `projectId`. Optional: `description`.

### Version Mutations

```graphql
# Create
mutation VersionCreate($input: CreateVersionInput!) {
  versionMutations {
    create(input: $input) { id referencedObject message createdAt }
  }
}

# Move to different model
mutation VersionMoveToModel($input: MoveVersionsInput!) {
  versionMutations {
    moveToModel(input: $input) { id }
  }
}

# Delete
mutation VersionDelete($input: DeleteVersionsInput!) {
  versionMutations {
    delete(input: $input)
  }
}
```

`CreateVersionInput` requires: `objectId`, `modelId`, `projectId`. Optional: `message`, `sourceApplication`, `parents`.

### Webhook Mutations

```graphql
mutation WebhookCreate($webhook: WebhookCreateInput!) {
  webhookCreate(webhook: $webhook)
}

mutation WebhookUpdate($webhook: WebhookUpdateInput!) {
  webhookUpdate(webhook: $webhook)
}

mutation WebhookDelete($webhook: WebhookDeleteInput!) {
  webhookDelete(webhook: $webhook)
}
```

`WebhookCreateInput` fields: `streamId` (project ID), `url`, `description`, `triggers`, `secret`, `enabled`. Requires `streams:write` scope and Stream Owner role.

### API Token Mutations

```graphql
mutation TokenCreate($token: ApiTokenCreateInput!) {
  apiTokenCreate(token: $token)
}

mutation TokenRevoke($token: String!) {
  apiTokenRevoke(token: $token)
}
```

Both require scope: `tokens:write`. `apiTokenCreate` returns the token string -- ALWAYS store it immediately as it cannot be retrieved again.

---

## Subscriptions

Speckle uses WebSocket-based GraphQL subscriptions. ALWAYS authenticate with the same Bearer token.

```graphql
subscription UserProjectsUpdated {
  userProjectsUpdated {
    id
    type
    project { id name visibility role }
  }
}

subscription ProjectModelsUpdated($id: String!, $modelIds: [String!]) {
  projectModelsUpdated(id: $id, modelIds: $modelIds) {
    id
    type
    model { id name displayName updatedAt }
  }
}

subscription ProjectVersionsUpdated($id: String!) {
  projectVersionsUpdated(id: $id) {
    id
    modelId
    type
    version { id referencedObject message createdAt }
  }
}
```

Subscription `type` values: `CREATED`, `UPDATED`, `DELETED` (models/versions) or `ADDED`, `REMOVED` (user projects).

---

## Cursor-Based Pagination

Every paginated collection follows this structure:

```graphql
type SomeCollection {
  totalCount: Int!
  cursor: String       # null when no more pages
  items: [SomeType!]!  # EXCEPTION: ObjectCollection uses "objects"
}
```

### Pagination Loop Pattern

```graphql
# Page 1: omit cursor
query { project(id: "abc") { models(limit: 25) { items { id name } cursor totalCount } } }

# Page N: pass returned cursor
query { project(id: "abc") { models(limit: 25, cursor: "returned-cursor") { items { id name } cursor totalCount } } }
```

ALWAYS stop iterating when `cursor` is `null`. Typical limits: 25 for models/versions, 100 for objects.

### Collection Types

| Collection | Items Field | Parent Context |
|------------|-------------|----------------|
| `UserProjectCollection` | `items` | `activeUser.projects` |
| `ModelCollection` | `items` | `project.models` |
| `VersionCollection` | `items` | `model.versions` |
| `ObjectCollection` | `objects` | `object.children` |
| `WebhookCollection` | `items` | `project.webhooks` |

---

## Error Response Format

GraphQL errors follow the standard format:

```json
{
  "errors": [
    {
      "message": "You do not have the required server role",
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": null
}
```

ALWAYS check for the `errors` array in responses. A response can contain BOTH `data` and `errors` (partial success).

Common error codes: `FORBIDDEN`, `UNAUTHENTICATED`, `STREAM_NOT_FOUND`, `BAD_USER_INPUT`.

---

## Reference Links

- [references/methods.md](references/methods.md) -- Complete query/mutation/subscription catalog
- [references/examples.md](references/examples.md) -- Working GraphQL queries with variables
- [references/anti-patterns.md](references/anti-patterns.md) -- Common GraphQL query mistakes

### Official Sources

- https://docs.speckle.systems/
- https://app.speckle.systems/graphql (Apollo Sandbox)
- https://github.com/specklesystems/speckle-server
