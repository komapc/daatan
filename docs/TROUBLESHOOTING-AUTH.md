# Troubleshooting: Auth & Sessions

---

## Symptom: clicking "Admin" shows the main feed instead of the admin panel

**Root cause:** The NextAuth JWT signing key (`NEXTAUTH_SECRET`) changed between when the user last signed in and now. Every user session is a JWT signed with this key. When the key changes (e.g. after a new instance is provisioned), existing tokens can no longer be verified by the Edge middleware — `req.auth` returns `null` — and the user is silently redirected.

The confusing part: the client-side `useSession()` still shows the user as authenticated (it trusts its cached cookie). So the "Admin" link appears in the sidebar, but navigating to `/admin` bounces the user back to `/`.

**Fix:**
1. **User:** sign out, then sign back in — the new JWT will be signed with the current key.
2. **Infra:** When provisioning a replacement instance, copy `NEXTAUTH_SECRET` from the existing Secrets Manager bundle — never generate a new value. See [SECRETS.md](../SECRETS.md#3-rotate-secrets--and-what-not-to-rotate-casually) for the full rotation policy.

**Historical incident:** April 2026 — new staging instance provisioned after the Gemini incident (`i-0286f62b47117b85c` → `i-0406d237ca5d92cdf`). A new `NEXTAUTH_SECRET` was generated for the new instance, invalidating all existing admin sessions.

---

## Symptom: Sign-in (Google OAuth) broken

Use this when **Sign in** works on staging but fails on production (or vice versa).  
See also: [SECRETS.md](../SECRETS.md) for where credentials live and how to rotate them.

---

## 1. Confirm what’s failing

- **Exact error**
  - After clicking “Continue with Google”, note the **URL** (e.g. `/auth/error?error=OAuthSignin`).
  - If Google shows an error page, note the message (e.g. `redirect_uri_mismatch`, `access_denied`, `invalid_client`).
- **Environment**
  - Staging: `https://staging.daatan.com`
  - Production: `https://daatan.com`

Common causes:

| Symptom | Likely cause |
|--------|----------------|
| `redirect_uri_mismatch` from Google | Prod redirect URI not in Google Cloud Console, or wrong `NEXTAUTH_URL`. |
| `OAuthSignin` on our error page | Wrong/missing credentials or redirect URI; check server `.env` and Console. |
| Callback returns but no session / loop to sign-in | Cookie/domain/path (e.g. missing `AUTH_TRUST_HOST` or cookie config). |
| “Session check failed” / `OAuthCallback` | State or PKCE cookie not sent on callback. Ensure nginx has a dedicated `location /api/auth/` with **no** `add_header` so all `Set-Cookie` headers pass through; clear site cookies and try again. |

---

## 2. Check app config (no secrets)

From your machine:

```bash
# Staging
curl -s "https://staging.daatan.com/api/health/auth" | jq .

# Production
curl -s "https://daatan.com/api/health/auth" | jq .
```

- **200 + `"status":"ok"`** → App has valid-looking `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`. It does **not** check that the redirect URI is allowed in Google.
- **Non-200 or errors in JSON** → Env missing or invalid on that server; fix `.env` and restart the app container.

Compare `NEXTAUTH_URL` in the response to the environment you’re testing (staging vs prod).

---

## 3. Check production server `.env`

Staging and production use **different EC2 instances** and **different** `~/app/.env` files. Production sign-in uses **only** the production instance’s `.env`.

All server access is via **AWS SSM** — port 22 is closed. Use the `/ssm` slash command
in Claude Code, or `aws ssm send-command` directly (prod instance tag: `Environment=prod`,
instance ID: `i-04ea44d4243d35624`).

1. **Inspect the production `.env` via SSM** (do not paste secrets into chat/slack):
   ```bash
   aws ssm send-command \
     --instance-ids i-04ea44d4243d35624 \
     --document-name AWS-RunShellScript \
     --parameters ‘commands=["grep -E \"^GOOGLE_CLIENT_ID=|^GOOGLE_CLIENT_SECRET=|^NEXTAUTH_URL=\" ~/app/.env"]’
   ```
   - `GOOGLE_CLIENT_ID` must look like `…something….apps.googleusercontent.com`.
   - `GOOGLE_CLIENT_SECRET` must be a long string (no placeholders like `your-google-client-secret`).
   - `NEXTAUTH_URL` must be exactly `https://daatan.com` for production.

2. **Optional: compare with staging**
   Run the same command against the staging instance (`i-0286f62b47117b85c`). If the **same**
   `GOOGLE_CLIENT_ID` is used for both, the OAuth client in Google must have **both** redirect
   URIs (see step 4).

---

## 4. Check Google Cloud Console (redirect URIs)

The OAuth client used by **production** must list the **production** callback URL.

1. Open [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials**.
2. Find the **OAuth 2.0 Client ID** whose **Client ID** matches `GOOGLE_CLIENT_ID` from the **production** server’s `.env`.
3. Open that client → **Authorized redirect URIs**.
4. Ensure this exact URI is present (no trailing slash):
   - **Production:** `https://daatan.com/api/auth/callback/google`
   - If the same client is used for staging: `https://staging.daatan.com/api/auth/callback/google`
5. Save. Changes can take a short time to propagate.

If you use **separate** OAuth clients for staging and prod, the production server’s `.env` must use the **production** client’s ID and secret, and that client must have `https://daatan.com/api/auth/callback/google`.

---

## 5. Restart the app after config changes

After changing **only** `.env` on the server (no code deploy), restart via SSM:

```bash
# Production instance
aws ssm send-command \
  --instance-ids i-04ea44d4243d35624 \
  --document-name AWS-RunShellScript \
  --parameters 'commands=["cd ~/app && docker compose -f docker-compose.prod.yml restart app"]'

# Staging instance (if you changed staging .env)
aws ssm send-command \
  --instance-ids i-0286f62b47117b85c \
  --document-name AWS-RunShellScript \
  --parameters 'commands=["cd ~/app && docker compose -f docker-compose.prod.yml restart app-staging"]'
```

After a **code/image deploy**, the deploy process already restarts the container; no extra step needed.

---

## 6. If it still fails: capture the exact error

1. **Browser**
   - Try sign-in again; note the final URL and any error message.
   - DevTools → **Network**: find the redirect to `accounts.google.com` and the redirect back; note query params and status codes.
2. **Server logs**
   - On the **production** instance (via SSM):
     ```bash
     aws ssm send-command \
       --instance-ids i-04ea44d4243d35624 \
       --document-name AWS-RunShellScript \
       --parameters 'commands=["docker logs daatan-app --tail 100 2>&1"]'
     ```
     Or use the `/logs prod` slash command in Claude Code.
   - Look for NextAuth/OAuth or `Configuration` errors (and ensure no secrets are shared when pasting logs).

With the exact error (e.g. `redirect_uri_mismatch`, `invalid_client`, or our `error=OAuthSignin`/`Configuration`) and the checks above, you can usually narrow it to: wrong/missing redirect URI, wrong client ID/secret on the server, or cookie/URL building (the codebase now sets `AUTH_TRUST_HOST` and explicit cookies for prod as well as staging to reduce that class of issue).
