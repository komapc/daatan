# Troubleshooting: Sign-in (Google OAuth)

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
| “Session check failed” / `OAuthCallback` | State or PKCE cookie not sent on callback. Nginx must have a dedicated `location /api/auth/` where the only `add_header` is `Cache-Control` (so server-level `add_header` are not inherited and upstream `Set-Cookie` pass through); clear site cookies and try again. |

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

1. **SSH to the production instance**  
   (Use your normal method; see DEPLOYMENT.md / SECRETS.md. Prod instance tag: `Environment=prod`.)

2. **Inspect (do not paste secrets into chat/slack):**
   ```bash
   cd ~/app
   grep -E '^GOOGLE_CLIENT_ID=|^GOOGLE_CLIENT_SECRET=|^NEXTAUTH_URL=' .env
   ```
   - `GOOGLE_CLIENT_ID` must look like `…something….apps.googleusercontent.com`.
   - `GOOGLE_CLIENT_SECRET` must be a long string (no placeholders like `your-google-client-secret`).
   - `NEXTAUTH_URL` must be exactly `https://daatan.com` for production.

3. **Optional: compare with staging**  
   SSH to staging instance and run the same `grep`. If the **same** `GOOGLE_CLIENT_ID` is used for both, the OAuth client in Google must have **both** redirect URIs (see step 4).

---

## 4. What to check on Google Cloud Console

Use the **same** OAuth client as in your production server’s `GOOGLE_CLIENT_ID` (from `~/app/.env`).

### Where to go

1. [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials**.
2. Under **OAuth 2.0 Client IDs**, open the client whose **Client ID** matches prod’s `GOOGLE_CLIENT_ID`.

### Checklist

| What to check | What it should be |
|---------------|-------------------|
| **Application type** | “Web application” (not Desktop or other). |
| **Authorized JavaScript origins** | Add if you need JS-based flows. For NextAuth server-side flow you often only need redirect URIs. |
| **Authorized redirect URIs** | Must contain **exactly** (no trailing slash, correct scheme/host): |
| → Production | `https://daatan.com/api/auth/callback/google` |
| → Staging (if same client) | `https://staging.daatan.com/api/auth/callback/google` |

- **Typical mistake:** Wrong host (e.g. `http://` or `staging.daatan.com` in prod), or extra/missing path (e.g. `/api/auth/callback` without `/google`).
- After editing, click **Save**. Changes can take a minute to propagate.
- If you use **separate** OAuth clients for staging and prod, the production instance’s `.env` must use the **production** client’s ID and secret, and that client’s redirect URIs must include **only** `https://daatan.com/api/auth/callback/google` (staging client has staging URL).

---

## 5. Restart the app after config changes

After changing **only** `.env** on the server (no code deploy):

```bash
# On production instance
cd ~/app
docker compose -f docker-compose.prod.yml restart app

# On staging instance (if you changed staging .env)
docker compose -f docker-compose.prod.yml restart app-staging
```

After a **code/image deploy**, the deploy process already restarts the container; no extra step needed.

---

## 6. Server check when you see OAuthCallback / "Session check failed"

**On the production EC2 instance** (SSH in, then):

```bash
cd ~/app
./scripts/verify-auth-server.sh
```

(The deploy workflow copies this script to `~/app/scripts/`; if it’s missing, run the checks from the script manually or re-deploy.)

This checks:
- Whether `nginx-ssl.conf` has `location /api/auth/` with only a **Cache-Control** `add_header` (so server-level headers aren’t inherited and Set-Cookie passes through).
- Whether nginx config is valid and reloaded.
- Recent app logs for NextAuth/callback errors.
- That `AUTH_TRUST_HOST` is set in the app container.

If the script reports **"location /api/auth/ NOT FOUND"**, the deployed nginx config is old. Then either:
- Re-run a production deploy (e.g. push tag `v*` again) so the workflow writes the latest `nginx-ssl.conf`, or
- Manually copy the repo’s current `nginx-ssl.conf` into `~/app/nginx-ssl.conf` and run:
  ```bash
  docker compose -f docker-compose.prod.yml exec -T nginx nginx -s reload
  ```

---

## 7. If it still fails: capture the exact error

1. **Browser**
   - Try sign-in again; note the final URL and any error message.
   - DevTools → **Network**: find the redirect to `accounts.google.com` and the redirect back; note query params and status codes.
2. **Server logs**
   - On the **production** instance:
     ```bash
     docker logs daatan-app --tail 200 2>&1
     ```
   - Look for lines like `NextAuth error: CALLBACK_*` or `NextAuth error: ...` (our logger records these). Share the **error code** (not secrets) if you need help.

With the exact error (e.g. `redirect_uri_mismatch`, `invalid_client`, or our `error=OAuthSignin`/`Configuration`) and the checks above, you can usually narrow it to: wrong/missing redirect URI, wrong client ID/secret on the server, or cookie/URL building (the codebase sets `AUTH_TRUST_HOST` and explicit cookies for prod; nginx must have `location /api/auth/` without `add_header` so cookies pass through).
