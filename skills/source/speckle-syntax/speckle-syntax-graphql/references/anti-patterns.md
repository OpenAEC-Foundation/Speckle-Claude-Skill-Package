# speckle-syntax-graphql -- Anti-Patterns

> Common GraphQL mistakes when working with the Speckle Server API. Each anti-pattern includes what goes wrong and the correct approach.

---

## AP-001: Omitting the limit Parameter on Paginated Fields

**Wrong:**
```graphql
query {
  activeUser {
    projects {
      items { id name }
    }
  }
}
```

**Why it fails:** Speckle has no default unlimited query. Omitting `limit` causes a GraphQL validation error or returns unexpected results.

**Correct:**
```graphql
query {
  activeUser {
    projects(limit: 25) {
      items { id name }
      cursor
      totalCount
    }
  }
}
```

ALWAYS specify `limit` on every paginated field.

---

## AP-002: Using Offset-Based Pagination

**Wrong:**
```graphql
query {
  activeUser {
    projects(limit: 25, offset: 50) {
      items { id name }
    }
  }
}
```

**Why it fails:** Speckle does NOT support offset-based pagination. The `offset` parameter does not exist in the schema.

**Correct:**
```graphql
query {
  activeUser {
    projects(limit: 25, cursor: "returned-cursor-from-previous-page") {
      items { id name }
      cursor
    }
  }
}
```

ALWAYS use cursor-based pagination with the `cursor` parameter.

---

## AP-003: Using "items" on ObjectCollection

**Wrong:**
```graphql
query {
  project(id: "abc") {
    object(id: "xyz") {
      children(limit: 100) {
        items { id data }
      }
    }
  }
}
```

**Why it fails:** `ObjectCollection` uses the field name `objects`, not `items`. This is the only collection type with this naming difference.

**Correct:**
```graphql
query {
  project(id: "abc") {
    object(id: "xyz") {
      children(limit: 100) {
        objects { id data }
        cursor
        totalCount
      }
    }
  }
}
```

ALWAYS use `objects` for `ObjectCollection` and `items` for all other collection types.

---

## AP-004: Missing Variable Declarations in Operation Signature

**Wrong:**
```graphql
query {
  project(id: $projectId) {
    id
    name
  }
}
```

**Why it fails:** GraphQL requires all variables to be declared in the operation signature with their types. Missing declarations cause a parse error.

**Correct:**
```graphql
query Project($projectId: String!) {
  project(id: $projectId) {
    id
    name
  }
}
```

ALWAYS declare every `$variable` with its type in the operation definition.

---

## AP-005: Using Legacy Stream/Branch/Commit Terminology

**Wrong:**
```graphql
query {
  stream(id: "abc") {
    branches {
      items { id name }
    }
  }
}
```

**Why it fails:** The legacy API (stream/branch/commit) is deprecated. Speckle Server 2.x/3.x uses project/model/version terminology. Legacy queries may be removed in future versions.

**Correct:**
```graphql
query {
  project(id: "abc") {
    models(limit: 25) {
      items { id name }
      cursor
    }
  }
}
```

ALWAYS use the current terminology: `project` (not stream), `model` (not branch), `version` (not commit).

---

## AP-006: Not Checking for Errors in Response

**Wrong:**
```python
response = requests.post(url, json={"query": query}, headers=headers)
data = response.json()
projects = data["data"]["activeUser"]["projects"]  # May crash if errors exist
```

**Why it fails:** GraphQL ALWAYS returns HTTP 200, even for errors. The `data` field can be `null` when errors occur. A response can also contain BOTH `data` and `errors` (partial success).

**Correct:**
```python
response = requests.post(url, json={"query": query}, headers=headers)
data = response.json()

if "errors" in data:
    for error in data["errors"]:
        print(f"Error: {error['message']}")
    if data.get("data") is None:
        raise Exception("GraphQL request failed completely")

projects = data["data"]["activeUser"]["projects"]
```

ALWAYS check for the `errors` array in every GraphQL response before accessing `data`.

---

## AP-007: Using query/orderBy on object.children Without Understanding Cost

**Wrong:**
```graphql
query {
  project(id: "abc") {
    object(id: "xyz") {
      children(limit: 100, query: [{ field: "speckleType", value: "Objects.Geometry.Mesh" }], orderBy: { field: "createdAt" }) {
        objects { id data }
      }
    }
  }
}
```

**Why it is dangerous:** The `query` and `orderBy` parameters trigger a significantly more expensive SQL query path on the server. On large objects with thousands of children, this can cause timeouts or excessive server load.

**Correct approach:** Fetch children without `query`/`orderBy` and filter client-side when possible. Use `select` to limit returned fields instead:

```graphql
query {
  project(id: "abc") {
    object(id: "xyz") {
      children(limit: 100, select: ["speckleType", "name"]) {
        objects { id data }
        cursor
      }
    }
  }
}
```

NEVER use `query` or `orderBy` on `object.children` unless you have confirmed the dataset is small or the query is necessary.

---

## AP-008: Hardcoding Pagination Instead of Looping

**Wrong:**
```python
# Only fetches the first page
result = client.execute(query, variables={"limit": 100})
items = result["data"]["activeUser"]["projects"]["items"]
# Missing: cursor check and subsequent pages
```

**Why it fails:** If the total count exceeds the limit, you silently lose data. There is no way to know you have all results without checking the cursor.

**Correct:**
```python
all_items = []
cursor = None

while True:
    result = client.execute(query, variables={"limit": 100, "cursor": cursor})
    page = result["data"]["activeUser"]["projects"]
    all_items.extend(page["items"])
    cursor = page["cursor"]
    if cursor is None:
        break
```

ALWAYS implement a pagination loop that continues until `cursor` is `null`.

---

## AP-009: Forgetting Authentication Header

**Wrong:**
```bash
curl -X POST https://app.speckle.systems/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ activeUser { id name } }"}'
```

**Why it fails:** Without the `Authorization` header, `activeUser` returns `null` instead of raising an error. This is a silent failure that is easy to miss.

**Correct:**
```bash
curl -X POST https://app.speckle.systems/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"query": "{ activeUser { id name } }"}'
```

ALWAYS include the `Authorization: Bearer <token>` header for any query that requires authentication. Only `serverInfo` works without authentication.

---

## AP-010: Using streamId Instead of projectId in Webhook Input

**Wrong (conceptually):**
```json
{
  "webhook": {
    "projectId": "abc123",
    "url": "https://example.com/hook",
    "triggers": ["version_create"]
  }
}
```

**Why it fails:** The `WebhookCreateInput` type uses the legacy field name `streamId`, not `projectId`. Even though the rest of the API uses "project", webhooks still require `streamId`.

**Correct:**
```json
{
  "webhook": {
    "streamId": "abc123",
    "url": "https://example.com/hook",
    "triggers": ["version_create"],
    "enabled": true
  }
}
```

ALWAYS use `streamId` (not `projectId`) in webhook mutation inputs. This is a known inconsistency in the Speckle schema.

---

## AP-011: Not Requesting cursor and totalCount on Paginated Queries

**Wrong:**
```graphql
query {
  project(id: "abc") {
    models(limit: 25) {
      items { id name }
    }
  }
}
```

**Why it is problematic:** Without `cursor`, you cannot fetch subsequent pages. Without `totalCount`, you cannot determine progress or whether all data has been retrieved.

**Correct:**
```graphql
query {
  project(id: "abc") {
    models(limit: 25) {
      items { id name }
      cursor
      totalCount
    }
  }
}
```

ALWAYS request both `cursor` and `totalCount` on paginated collections, even if you expect only one page.

---

## AP-012: Treating Null Cursor as an Error

**Wrong:**
```python
cursor = result["data"]["project"]["models"]["cursor"]
if cursor is None:
    raise Exception("Pagination failed - no cursor returned")
```

**Why it fails:** A `null` cursor is the normal signal that there are no more pages. It is NOT an error condition.

**Correct:**
```python
cursor = result["data"]["project"]["models"]["cursor"]
if cursor is None:
    # All pages have been fetched successfully
    break
```

NEVER treat a `null` cursor as an error. It ALWAYS means pagination is complete.
