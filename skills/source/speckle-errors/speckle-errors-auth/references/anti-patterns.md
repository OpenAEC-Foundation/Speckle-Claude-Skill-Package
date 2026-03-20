# speckle-errors-auth — Anti-Patterns Reference

## AP-AUTH-1: Embedding PATs in Client-Side Code

**Symptom:** Personal Access Token visible in browser DevTools, page source, or bundled JavaScript.

**Cause:** Developer hardcoded the PAT directly in frontend code or included it in a client-side config file.

**Why it is wrong:** PATs have full access to the user's account within their scope. Anyone viewing the page source can extract and abuse the token.

**Fix:** ALWAYS use the OAuth2 flow for browser-based applications. PATs are ONLY for server-side scripts, CI/CD pipelines, and automation tools where the token is stored in environment variables or secret managers.

---

## AP-AUTH-2: Creating Tokens with Excessive Scopes

**Symptom:** Token has `streams:write`, `profile:delete`, `tokens:write`, `server:setup` when only `streams:read` is needed.

**Cause:** Developer selected all scopes "just in case" when creating the PAT.

**Why it is wrong:** If the token is compromised, the attacker gains access to ALL those operations — including deleting the user's account or modifying server settings.

**Fix:** ALWAYS apply the principle of least privilege. Create tokens with ONLY the scopes required for the specific use case. Create separate tokens for different applications with different scope needs.

---

## AP-AUTH-3: Not Storing the Challenge in OAuth2 Flow

**Symptom:** Token exchange (`POST /auth/token`) fails after user successfully authorizes the application.

**Cause:** The challenge string was generated but not persisted between the redirect and the callback. This happens when:
- Using a variable that goes out of scope after redirect
- Storing in memory instead of `localStorage`/session storage
- Browser clearing storage between pages

**Why it is wrong:** Speckle validates that the challenge in the token exchange request matches the challenge used in the authorization redirect. Without storing it, the challenge is lost.

**Fix:** ALWAYS store the challenge in `localStorage` or a server-side session BEFORE redirecting the user. Retrieve the SAME challenge string in the callback handler. NEVER regenerate the challenge between redirect and callback.

---

## AP-AUTH-4: Reusing Refresh Tokens

**Symptom:** Token refresh works the first time but fails on subsequent attempts.

**Cause:** Developer stores the initial refresh token and keeps reusing it. Speckle refresh tokens are single-use — each refresh returns a new refresh token that invalidates the previous one.

**Why it is wrong:** After the first refresh, the original refresh token is invalidated. Using it again will fail and may trigger security measures.

**Fix:** ALWAYS store the NEW refresh token returned from each token refresh operation. Replace the stored refresh token every time you refresh.

---

## AP-AUTH-5: Using the Wrong Server URL for Token

**Symptom:** Token that works in the browser fails in API calls. Or token works for one server but not another.

**Cause:** Developer generated a token on `app.speckle.systems` (cloud) but is making API calls to a self-hosted instance (or vice versa). Tokens are server-specific and NEVER transferable between servers.

**Why it is wrong:** Each Speckle server instance has its own user database and token store. A token from Server A is meaningless to Server B.

**Fix:** ALWAYS verify that the token was generated on the same server instance you are making API calls to. Use the `serverInfo` query (no auth required) to confirm the server identity:
```graphql
query { serverInfo { canonicalUrl name } }
```

---

## AP-AUTH-6: Ignoring Resource-Scoped Token Limitations

**Symptom:** Token works for some projects but returns FORBIDDEN for others that the user definitely has access to.

**Cause:** Token was created with `limitResources` restricting it to specific projects or workspaces. The developer forgot about this restriction when trying to access other resources.

**Why it is wrong:** Resource-scoped tokens are intentionally limited. Treating them as full-access tokens leads to confusing permission errors.

**Fix:** When creating resource-scoped tokens, document which resources they are limited to. When debugging FORBIDDEN errors, check if the token is resource-scoped. Create a separate token for accessing resources outside the original scope, or create a token without `limitResources`.

---

## AP-AUTH-7: Not Handling Token Expiry Gracefully

**Symptom:** Application crashes or shows a generic error when the token expires mid-session.

**Cause:** Developer assumed the token would last forever and did not implement token refresh or re-authentication logic.

**Why it is wrong:** PATs with a `lifespan` and OAuth access tokens ALWAYS expire eventually. Applications MUST handle this gracefully.

**Fix:** ALWAYS implement one of these strategies:
1. **For OAuth apps:** Detect 401/UNAUTHENTICATED responses and trigger token refresh using the stored refresh token. If refresh fails, redirect user to re-authenticate.
2. **For PAT-based scripts:** Detect 401 errors and exit with a clear message instructing the user to generate a new token.
3. **NEVER** silently swallow auth errors — ALWAYS surface them with actionable guidance.

---

## AP-AUTH-8: Committing Tokens to Version Control

**Symptom:** Token appears in Git history, making it accessible to anyone with repo access.

**Cause:** Developer hardcoded the token in a config file, `.env` file, or script that was committed.

**Why it is wrong:** Even if the commit is later removed, the token remains in Git history. Anyone with access to the repository (including public repos) can extract and use it.

**Fix:**
1. ALWAYS use environment variables or secret managers for tokens
2. ALWAYS add `.env` files to `.gitignore`
3. If a token was committed: revoke it IMMEDIATELY and generate a new one
4. Use `git filter-branch` or BFG Repo-Cleaner to remove the token from history

---

## AP-AUTH-9: Exposing App Secret in Frontend Code

**Symptom:** App Secret visible in client-side JavaScript bundle.

**Cause:** Developer included the App Secret in the frontend OAuth implementation instead of using a backend proxy.

**Why it is wrong:** The App Secret is equivalent to a password for your registered application. With it, an attacker can impersonate your application and generate tokens on behalf of any user who authorizes it.

**Fix:**
- ALWAYS handle token exchange on the backend (server-side) where the App Secret is secure
- For pure frontend apps: use the `speckle-auth` community package which implements a public client flow
- NEVER pass App Secret to the browser under any circumstance

---

## AP-AUTH-10: Confusing GraphQL FORBIDDEN with NOT_FOUND

**Symptom:** Developer assumes a resource does not exist when the actual problem is insufficient permissions.

**Cause:** Speckle returns `NOT_FOUND` when a user has zero access to a resource (cannot even see that it exists). This is a security feature to prevent resource enumeration.

**Why it is wrong:** Debugging based on the wrong assumption wastes time. The developer looks for a missing resource when the real issue is missing permissions.

**Fix:** When receiving `NOT_FOUND` for a resource you believe exists:
1. Verify the resource exists using an admin account or the Speckle web UI
2. Check if the user/token has ANY role on the project
3. If the resource exists but the user has no access, the fix is to add the user as a collaborator or use a token with appropriate access

---

## AP-AUTH-11: Using OAuth2 Flow for Server-Side Automation

**Symptom:** Automation script implements a complex OAuth2 flow with redirect URI handling for a non-interactive process.

**Cause:** Developer used the OAuth2 pattern for a server-side script that has no browser interaction.

**Why it is wrong:** OAuth2 with redirects is designed for interactive browser-based authentication. Server-side automation has no browser to redirect to.

**Fix:** ALWAYS use Personal Access Tokens (PATs) for server-side automation, CI/CD pipelines, and scripts. PATs are designed for non-interactive authentication. Reserve OAuth2 for web applications where users log in through a browser.
