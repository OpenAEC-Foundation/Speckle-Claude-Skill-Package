---
name: speckle-errors-auth
description: >
  Use when debugging Speckle authentication failures, token expiry issues, or permission denied errors.
  Prevents PAT scope mismatch, OAuth flow misconfiguration, and confusing server vs cloud authentication endpoints.
  Covers auth errors (token expiry, scope mismatch, OAuth flow errors), PAT vs application token confusion, server vs cloud auth differences, refresh token failures, SSO issues, and scope debugging.
  Keywords: speckle auth error, token expired, permission denied, scope mismatch, PAT, oauth error, 401, 403, unauthorized, forbidden, can't login, access denied, token not working.
license: MIT
compatibility: "Designed for Claude Code. Requires Speckle Server 2.x/3.x, SpecklePy or Speckle.Sdk."
metadata:
  author: OpenAEC-Foundation
  version: "1.0"
---

# speckle-errors-auth

## Quick Reference

### Authentication Error Decision Tree

```
Error encountered
├── HTTP 401 / GraphQL "UNAUTHENTICATED"
│   ├── No token provided → Add Authorization: Bearer <token> header
│   ├── Token malformed → Check for whitespace, newlines, or truncation in token string
│   ├── Token expired → Refresh token (OAuth) or generate new PAT
│   ├── Token revoked → Generate new token, check if admin revoked it
│   └── Wrong server URL → Verify token matches the target server instance
│
├── HTTP 403 / GraphQL "FORBIDDEN"
│   ├── Missing scope → Check required scope for the operation (see Scope Table)
│   ├── Wrong project role → User needs contributor/owner, has only viewer
│   ├── Resource-scoped token → Token is limited to specific projects/workspaces
│   └── Server role insufficient → User needs SERVER_USER or SERVER_ADMIN role
│
├── GraphQL "NOT_FOUND" (may mask auth error)
│   └── User lacks access to resource → Speckle returns NOT_FOUND instead of FORBIDDEN
│       for resources the user cannot see at all
│
├── OAuth flow failure
│   ├── Challenge mismatch → ALWAYS store and reuse the SAME challenge string
│   ├── Invalid redirect URI → URI MUST exactly match the registered redirect URI
│   ├── Expired access code → Exchange the code immediately after callback
│   └── Wrong appId/appSecret → Verify credentials match the registered application
│
└── Refresh token failure
    ├── Refresh token expired → User MUST re-authenticate from scratch
    ├── Refresh token already used → Tokens are single-use; store the NEW refresh token
    └── Wrong appId/appSecret → MUST use the same app credentials as original auth
```

### Error Code Quick Map

| Error | Protocol | Meaning | First Check |
|-------|----------|---------|-------------|
| `401 Unauthorized` | REST | No valid token present | Is `Authorization: Bearer <token>` header set? |
| `403 Forbidden` | REST | Valid token, insufficient permissions | Does token have required scopes? |
| `UNAUTHENTICATED` | GraphQL | Token missing, invalid, or expired | Is token valid? Test with `activeUser` query |
| `FORBIDDEN` | GraphQL | Token valid but lacks required scope or role | Check scope table below |
| `NOT_FOUND` | GraphQL | Resource missing OR user lacks all access | Verify resource exists with an admin account |

### Scope Requirements Table

| Operation | Required Scope | Required Role |
|-----------|---------------|---------------|
| Read projects/models/versions | `streams:read` | Any project role |
| Create/modify/delete projects | `streams:write` | Contributor or Owner |
| Delete a project | `streams:write` | Owner only |
| Read user profile | `profile:read` | — |
| Read user email | `profile:email` | — |
| Update user profile | `profile:write` | — |
| List API tokens | `tokens:read` | — |
| Create/revoke API tokens | `tokens:write` | — |
| Search/list users | `users:read` | — |
| Server admin operations | `server:setup` | SERVER_ADMIN |

---

## 401 vs 403: The Critical Distinction

### 401 Unauthorized (UNAUTHENTICATED)

The server does NOT recognize the caller as a valid user.

**Causes (in order of likelihood):**

1. **Missing Authorization header** — The request has no `Authorization` header at all
2. **Malformed token** — Extra whitespace, newline characters, or truncated string
3. **Expired token** — OAuth access tokens have a limited lifetime
4. **Revoked token** — Admin or user revoked the token
5. **Wrong server** — Token was generated for `app.speckle.systems` but sent to a self-hosted instance (or vice versa)

**Diagnostic steps:**

```graphql
# Step 1: Test token validity: this query requires only profile:read
query { activeUser { id name } }
```

- If result is `null` → token is invalid or missing `profile:read` scope
- If result contains user data → token is valid; problem is elsewhere

```python
# SpecklePy: Test authentication
from specklepy.api.client import SpeckleClient

client = SpeckleClient(host="https://app.speckle.systems")
client.authenticate_with_token("YOUR_TOKEN")
# If this raises, the token is invalid for this server
user = client.active_user.get()
print(f"Authenticated as: {user.name}")
```

### 403 Forbidden (FORBIDDEN)

The server recognizes the caller but DENIES the requested operation.

**Causes (in order of likelihood):**

1. **Missing scope on token** — Token was created without the required scope
2. **Insufficient project role** — User is viewer but operation requires contributor/owner
3. **Resource-scoped token** — Token is limited to specific projects; current project is not in the allowed list
4. **Server role restriction** — Operation requires SERVER_ADMIN but user is SERVER_USER
5. **Workspace restriction** — Project is in a workspace where user has no membership

**Diagnostic steps:**

```graphql
# Step 1: Check what scopes the server supports
query { serverInfo { scopes { name description } } }

# Step 2: Check your role on a specific project
query { project(id: "<projectId>") { role } }

# Step 3: Check granular permissions on a project
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

---

## Personal Access Tokens (PATs)

### Common PAT Errors

#### Error: "UNAUTHENTICATED" with a PAT that previously worked

**Symptom:** A PAT that was working returns UNAUTHENTICATED.

**Cause:** PAT was revoked (by user or admin), or the Speckle server was reinstalled/migrated and tokens were invalidated.

**Fix:**
1. Go to Profile > Settings > Developer > Access Tokens
2. Check if the token still exists in the list
3. If not, generate a new token with the required scopes
4. Update the token in your environment variables or secret manager

#### Error: "FORBIDDEN" on streams:write operation with a PAT

**Symptom:** Token authenticates successfully but write operations fail.

**Cause:** PAT was created with only `streams:read` scope.

**Fix:**
1. Check the scopes assigned to your token (you cannot inspect scopes of an existing PAT after creation)
2. ALWAYS create a new PAT with the correct scopes — you CANNOT modify scopes of an existing token
3. Revoke the old token

#### Error: Operations work on some projects but not others

**Symptom:** Same token works for Project A but returns FORBIDDEN for Project B.

**Cause:** Token was created with `limitResources` restricting it to specific projects or workspaces.

**Fix:**
1. Create a new token without resource restrictions, OR
2. Add the target project/workspace to the allowed resources when creating the token

```graphql
mutation {
  apiTokenCreate(token: {
    name: "My Scoped Token"
    scopes: ["streams:read", "streams:write", "profile:read"]
    lifespan: 7776000
    limitResources: [
      { id: "<projectId>", type: project }
      { id: "<workspaceId>", type: workspace }
    ]
  })
}
```

### PAT Security Rules

- **NEVER** embed PATs in client-side JavaScript — use OAuth2 flow for browser apps
- **NEVER** commit tokens to version control — use environment variables
- **NEVER** create tokens with more scopes than needed — principle of least privilege
- **ALWAYS** set a `lifespan` (in seconds) when creating tokens programmatically
- **ALWAYS** rotate tokens periodically and revoke unused tokens
- **ALWAYS** revoke tokens immediately if compromised (see Token Compromise Response below)

---

## OAuth2 Flow Errors

Speckle implements OAuth2 Authorization Code flow with a challenge parameter (similar to PKCE).

### Challenge Mismatch Error

**Symptom:** Token exchange (`POST /auth/token`) returns an error after successful user authorization.

**Cause:** The `challenge` string sent in Step 4 (token exchange) does not match the one used in Step 2 (authorization redirect).

**Fix:**
1. Generate a cryptographically random challenge string ONCE
2. Store it in `localStorage` or session storage BEFORE redirecting
3. Retrieve the SAME string when exchanging the access code
4. NEVER regenerate the challenge between redirect and token exchange

```javascript
// CORRECT: Store challenge before redirect
const challenge = crypto.randomUUID();
localStorage.setItem('speckle_challenge', challenge);
window.location.href = `https://server/authn/verify/${appId}/${challenge}`;

// In callback handler:
const challenge = localStorage.getItem('speckle_challenge');
const response = await fetch('https://server/auth/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    accessCode: receivedCode,
    appId: APP_ID,
    appSecret: APP_SECRET,
    challenge: challenge  // MUST match
  })
});
```

### Redirect URI Mismatch

**Symptom:** User sees an error page during authorization instead of being redirected back.

**Cause:** The redirect URI in the authorization request does not exactly match the URI registered for the application.

**Fix:**
- The redirect URI MUST be an exact string match (including trailing slashes, port numbers, protocol)
- `http://localhost:3000/callback` does NOT match `http://localhost:3000/callback/`
- Register separate applications for development (`localhost`) and production environments

### Expired Access Code

**Symptom:** Token exchange fails even though the challenge matches.

**Cause:** The access code received in the callback has a short validity window.

**Fix:** Exchange the access code for tokens immediately in the callback handler. NEVER store access codes for later use.

### App Secret in Client-Side Code

**Symptom:** Security vulnerability, not a runtime error.

**Cause:** App Secret embedded in frontend JavaScript is visible to anyone inspecting the page.

**Fix:**
- **NEVER** include App Secret in client-side code
- Use a backend proxy to handle token exchange
- For pure frontend apps, use the `speckle-auth` community package which handles public client flow

---

## Server vs Cloud Authentication

### Endpoint Differences

| Aspect | Speckle Cloud | Self-Hosted Server |
|--------|--------------|-------------------|
| GraphQL endpoint | `https://app.speckle.systems/graphql` | `https://<your-domain>/graphql` |
| Auth redirect | `https://app.speckle.systems/authn/verify/...` | `https://<your-domain>/authn/verify/...` |
| Token exchange | `https://app.speckle.systems/auth/token` | `https://<your-domain>/auth/token` |
| PAT creation | Cloud UI: Settings > Developer | Server UI: Settings > Developer |

### Common Cross-Server Errors

#### Error: Token works in browser but not in script

**Symptom:** User can access the Speckle frontend but API calls with their token fail.

**Cause:** Token was generated on a different server instance. Common when users have both cloud and self-hosted accounts.

**Fix:**
1. Verify which server the token belongs to
2. Use `serverInfo` query (no auth required) to confirm you are hitting the correct server:
   ```graphql
   query { serverInfo { name canonicalUrl version } }
   ```
3. Generate a token on the correct server

#### Error: SSO login works but API token does not

**Symptom:** User authenticates via SSO (Azure AD, Google, GitHub) in browser but PAT fails.

**Cause:** On self-hosted servers with SSO, user accounts are created through the SSO provider. PATs are still generated through the Speckle UI and are independent of SSO session tokens. If the SSO-created account is deactivated or the server enforces re-authentication, existing PATs may be invalidated.

**Fix:**
1. Verify the user account is still active on the server
2. Generate a new PAT through the Speckle UI (after SSO login)
3. Check with the server admin if token-based access is restricted

#### Error: Self-hosted server returns unexpected auth strategy

**Symptom:** OAuth flow fails because the server uses a different authentication strategy.

**Cause:** Self-hosted servers can configure custom auth strategies (local, Azure AD, Google, GitHub, OIDC).

**Fix:**
```graphql
# Discover available auth strategies
query { serverInfo { authStrategies { id name icon } } }
```

Use the returned strategies to determine the correct authentication flow.

---

## Refresh Token Errors

### Refresh Token Expired

**Symptom:** `POST /auth/token` with refresh token returns an error.

**Cause:** Refresh tokens have a limited lifetime. When expired, no programmatic renewal is possible.

**Fix:** The user MUST re-authenticate through the full OAuth2 flow (browser redirect).

### Refresh Token Already Used

**Symptom:** Refresh succeeds once but subsequent refreshes with the same token fail.

**Cause:** Speckle refresh tokens are single-use. Each refresh returns a NEW access token AND a NEW refresh token.

**Fix:**
- **ALWAYS** store the new refresh token returned from each refresh operation
- **NEVER** reuse an old refresh token — it is invalidated after first use

```javascript
// CORRECT: Always update stored refresh token
const response = await fetch('https://server/auth/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    refreshToken: storedRefreshToken,
    appId: APP_ID,
    appSecret: APP_SECRET
  })
});
const { token, refreshToken } = await response.json();
// MUST store the new refreshToken for next refresh cycle
saveToken(token);
saveRefreshToken(refreshToken);  // CRITICAL: save the NEW refresh token
```

---

## Token Compromise Response

If a token (PAT or OAuth) is compromised:

1. **Immediately** revoke the token: Settings > Developer > Access Tokens
2. Generate a replacement token with the same scopes
3. Update all applications using the compromised token
4. Review server access logs for unauthorized activity
5. If an App Secret is exposed: regenerate the app secret and update all deployments

---

## SpecklePy Authentication Errors

### Common SpecklePy Auth Patterns

```python
from specklepy.api.client import SpeckleClient
from specklepy.api.credentials import get_default_account

# Pattern 1: Authenticate with PAT
client = SpeckleClient(host="https://app.speckle.systems")
client.authenticate_with_token("your_token_here")

# Pattern 2: Use stored account (from Speckle Manager)
account = get_default_account()
client = SpeckleClient(host=account.serverInfo.url)
client.authenticate_with_account(account)
```

### Error: "SpeckleException: Authentication failed"

**Cause:** Token is invalid, expired, or for a different server.

**Fix:**
1. Verify the token is for the correct server URL
2. Test the token with a simple `activeUser` query
3. If using `get_default_account()`, ensure Speckle Manager has an active account configured

### Error: "SpeckleException: No default account found"

**Cause:** No account is configured in Speckle Manager, or the accounts database is corrupted.

**Fix:**
1. Open Speckle Manager and log in to your server
2. Alternatively, authenticate directly with a token instead of using `get_default_account()`

---

## GraphQL Authorization Directives

Speckle uses custom GraphQL directives for fine-grained authorization:

| Directive | Purpose | Failure Code |
|-----------|---------|-------------|
| `@hasServerRole(role: SERVER_USER)` | Requires minimum server role | `FORBIDDEN` |
| `@hasScope(scope: "streams:read")` | Requires token to have specific scope | `FORBIDDEN` |
| `@hasScopes(scopes: [...])` | Requires multiple scopes | `FORBIDDEN` |
| `@isOwner` | Restricts to resource owner | `FORBIDDEN` |

When a directive check fails, the GraphQL response contains:

```json
{
  "errors": [
    {
      "message": "You do not have the required server role",
      "extensions": { "code": "FORBIDDEN" }
    }
  ],
  "data": null
}
```

**ALWAYS** check the `extensions.code` field to distinguish between `FORBIDDEN` and `UNAUTHENTICATED`.

---

## Reference Links

- [references/methods.md](references/methods.md) -- Auth-related API methods, token creation, scope verification
- [references/examples.md](references/examples.md) -- Working auth code examples for PAT, OAuth2, and token refresh
- [references/anti-patterns.md](references/anti-patterns.md) -- Auth anti-patterns with symptom/cause/fix format

### Official Sources

- https://docs.speckle.systems/developers/authentication
- https://speckle.guide/dev/tokens.html
- https://speckle.guide/dev/apps.html
- https://github.com/specklesystems/speckle-server
