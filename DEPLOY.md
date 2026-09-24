# Deployment

The production-shaped case-study deployment is one Cloudflare Worker plus one D1 database:

```text
Browser → Worker static assets + `/api/*` → D1
```

The Worker owns the authenticated governance boundary, deterministic allocation, durable workflow commands, audit events, and simulated receipts. The older Express/MongoDB and FastAPI/LangGraph services remain in the repository as research history; they are not required by, or synchronized with, the deployed application.

Firebase Hosting is not used.

## First deployment

Requirements: Node.js 20+, an authenticated Wrangler session, and access to the Cloudflare account configured for this repository.

```bash
npm install
npx wrangler d1 migrations apply syndimatch-governed-workflow --remote
npx wrangler secret put REVIEWER_PASSWORD_HASH
npm run typecheck
npm test
npm run deploy:worker
```

`REVIEWER_PASSWORD_HASH` must be the lowercase SHA-256 digest of a password of at least 12 characters, never the plaintext password:

```bash
printf '%s' 'replace-with-a-long-password' | shasum -a 256
```

The D1 binding, database ID, compatibility date, runtime flags, static-asset behavior, and non-secret variables are declared in `wrangler.jsonc`. Migrations are versioned in `migrations/` and should be applied before deploying code that depends on them.

## Subsequent releases

```bash
npx wrangler d1 migrations apply syndimatch-governed-workflow --remote
npm run typecheck
npm test
npm run deploy:worker
```

`npm run deploy:pages` is retained as a historical script name. It deploys the same Worker bundle under the `syndimatch-credit-desk` Worker name; it does not create a Cloudflare Pages project. Prefer `deploy:worker` for the canonical service.

## Local Worker + D1

```bash
npm install
npx wrangler d1 migrations apply syndimatch-governed-workflow --local
cp .dev.vars.example .dev.vars
npm run preview
```

Replace the placeholder in `.dev.vars` with a SHA-256 digest. Wrangler keeps the local D1 state under `.wrangler/`; both `.wrangler/` and `.dev.vars` are gitignored.

## Production verification

Set the deployed origin once and verify the API and SPA route:

```bash
SYNDIMATCH_URL='https://2601-syndimatch-lma.<account-subdomain>.workers.dev'
curl -fsS "$SYNDIMATCH_URL/api/health"
curl -fsSI "$SYNDIMATCH_URL/deal-room"
```

Expected health fields are `status: healthy`, `database: d1`, and `mode: simulation`. Exercise authentication, allocation, approval, and continuation through the Deal Room. A continuation receipt must report `fundsMoved: false`; no payment or custody rail exists in this deployment.

## Credential rotation

1. Generate and store a new long password in the team's password manager.
2. Hash it locally and update `REVIEWER_PASSWORD_HASH` with `wrangler secret put`.
3. Delete existing rows from `reviewer_sessions` as an administrative maintenance operation so old sessions cannot outlive the rotation.
4. Verify login with the new credential.

The single reviewer credential is suitable only for this controlled case study. A real multi-user deployment requires SSO, scoped roles, maker-checker separation, audit export, rate-limit tuning, and an incident-response process.

## Observability and failure behavior

- Worker observability is enabled in `wrangler.jsonc`.
- API errors return structured JSON and avoid exposing internal exception details.
- D1 batches make bid/capacity updates and workflow transitions atomic.
- Continuation uses a deterministic command ID, so retry returns the recorded result rather than repeating work.
- Login attempts are limited per hashed client/window and old counters are pruned.

Use Cloudflare's Worker logs and D1 query tools for operational diagnosis. Do not log reviewer passwords, session cookies, or raw secrets.

## Legacy services

The root `Dockerfile`, `server/`, and `agents/` represent the earlier local architecture. They are useful for examining the renovation history, but deploying them does not extend the canonical Worker workflow and risks creating split state. If revived, they need an explicit migration/integration design rather than a parallel production deployment.
