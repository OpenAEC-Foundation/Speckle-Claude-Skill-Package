# speckle-syntax-graphql -- Examples

> Working GraphQL queries and mutations with variables, verified against Speckle Server 2.x/3.x.

---

## 1. Get Authenticated User Profile

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

**Variables:** None.

**Headers:**
```
Authorization: Bearer YOUR_PERSONAL_ACCESS_TOKEN
Content-Type: application/json
```

---

## 2. List User's Projects (First Page)

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

**Variables:**
```json
{
  "limit": 25,
  "cursor": null,
  "filter": {
    "search": "architecture"
  }
}
```

---

## 3. Paginate Through All Projects

```graphql
query UserProjects($limit: Int!, $cursor: String) {
  activeUser {
    projects(limit: $limit, cursor: $cursor) {
      totalCount
      cursor
      items {
        id
        name
      }
    }
  }
}
```

**Page 1 Variables:**
```json
{ "limit": 25, "cursor": null }
```

**Page 2 Variables (use cursor from page 1 response):**
```json
{ "limit": 25, "cursor": "eyJpZCI6IjY0ZjJhYjMxIn0=" }
```

ALWAYS stop when response `cursor` is `null`.

---

## 4. Get Project with Models

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
    description
    visibility
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
        author {
          id
          name
          avatar
        }
      }
    }
  }
}
```

**Variables:**
```json
{
  "projectId": "abc123def456",
  "modelsLimit": 25,
  "modelsCursor": null,
  "modelsFilter": {
    "onlyWithVersions": true
  }
}
```

---

## 5. Get Model with Versions (Deeply Nested)

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
      displayName
      description
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
          authorUser {
            id
            name
            avatar
          }
        }
      }
    }
  }
}
```

**Variables:**
```json
{
  "projectId": "abc123def456",
  "modelId": "model789",
  "versionsLimit": 10,
  "versionsCursor": null
}
```

---

## 6. Get Server Info (No Authentication)

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

**Variables:** None. **Headers:** No `Authorization` required.

---

## 7. Create a Project

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

**Variables:**
```json
{
  "input": {
    "name": "Office Tower BIM",
    "description": "Central model repository for the office tower project",
    "visibility": "PRIVATE"
  }
}
```

---

## 8. Create a Model in a Project

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

**Variables:**
```json
{
  "input": {
    "name": "Architecture",
    "description": "Main architecture model",
    "projectId": "abc123def456"
  }
}
```

---

## 9. Create a Version (After Object Upload)

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

**Variables:**
```json
{
  "input": {
    "objectId": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4",
    "modelId": "model789",
    "projectId": "abc123def456",
    "message": "Updated floor plans - revision 3",
    "sourceApplication": "Revit 2024"
  }
}
```

ALWAYS upload the object via the REST API first, then use the returned object hash as `objectId`.

---

## 10. Create a Webhook

```graphql
mutation WebhookCreate($webhook: WebhookCreateInput!) {
  webhookCreate(webhook: $webhook)
}
```

**Variables:**
```json
{
  "webhook": {
    "streamId": "abc123def456",
    "url": "https://your-server.com/api/speckle-webhook",
    "description": "Notify on new versions",
    "triggers": ["version_create", "model_update"],
    "secret": "my-hmac-secret-key",
    "enabled": true
  }
}
```

Returns the webhook ID as a string.

---

## 11. Create an API Token

```graphql
mutation TokenCreate($token: ApiTokenCreateInput!) {
  apiTokenCreate(token: $token)
}
```

**Variables:**
```json
{
  "token": {
    "name": "CI/CD Pipeline Token",
    "scopes": ["streams:read", "streams:write", "profile:read"],
    "lifespan": 3600000000000,
    "limitResources": [
      { "id": "abc123def456", "type": "project" }
    ]
  }
}
```

ALWAYS store the returned token immediately -- it cannot be retrieved again after creation.

---

## 12. Subscribe to Model Changes

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

**Variables:**
```json
{
  "id": "abc123def456",
  "modelIds": ["model789", "modelABC"]
}
```

The `type` field indicates the change: `CREATED`, `UPDATED`, or `DELETED`.

---

## 13. Subscribe to Version Changes

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

**Variables:**
```json
{
  "id": "abc123def456"
}
```

---

## 14. Move Versions Between Models

```graphql
mutation VersionMoveToModel($input: MoveVersionsInput!) {
  versionMutations {
    moveToModel(input: $input) {
      id
    }
  }
}
```

**Variables:**
```json
{
  "input": {
    "projectId": "abc123def456",
    "targetModelName": "Structure",
    "versionIds": ["ver001", "ver002"]
  }
}
```

---

## 15. cURL Example -- Full HTTP Request

```bash
curl -X POST https://app.speckle.systems/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "query": "query Project($projectId: String!) { project(id: $projectId) { id name description visibility } }",
    "variables": { "projectId": "abc123def456" }
  }'
```

---

## 16. Python Example -- Using requests

```python
import requests

SPECKLE_URL = "https://app.speckle.systems/graphql"
TOKEN = "YOUR_PERSONAL_ACCESS_TOKEN"

query = """
query UserProjects($limit: Int!) {
  activeUser {
    projects(limit: $limit) {
      totalCount
      cursor
      items { id name visibility }
    }
  }
}
"""

response = requests.post(
    SPECKLE_URL,
    json={"query": query, "variables": {"limit": 25}},
    headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
)

data = response.json()
if "errors" in data:
    raise Exception(f"GraphQL errors: {data['errors']}")

projects = data["data"]["activeUser"]["projects"]["items"]
```
