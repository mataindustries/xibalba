# Xibalba Global Leaderboard G3

Phase G3 hardens the live Cloudflare Pages Functions and D1 leaderboard while preserving the local Wall of Champions as the client fallback.

## API

### `GET /api/leaderboard`

Returns scores ordered by score descending, then oldest submission first for ties.

- Default: `limit=10`
- Minimum: `1`
- Maximum: `25`
- Invalid limits fall back to `10`

```json
{
  "ok": true,
  "scores": [
    {
      "initials": "SUN",
      "score": 250000,
      "createdAt": 1782518400
    }
  ],
  "source": "global"
}
```

### `POST /api/leaderboard`

```json
{
  "initials": "ABC",
  "score": 123456,
  "version": "g3"
}
```

Validation:

- `initials` is trimmed, uppercased, and must then match exactly three `A-Z` letters.
- `score` must be a safe integer from `1` through `MAX_REASONABLE_SCORE` (`999999999`).
- `version` is optional, limited to 32 safe version characters.
- `Content-Type` must be `application/json` (parameters such as `charset=utf-8` are accepted).
- Request bodies are limited to 2 KiB.
- Browser submissions with an `Origin` header must match the API origin.
- SQL uses bound prepared statements.

Successful POST requests return status `201`, the updated top 10, and `source: "global"`.

An exact `initials` and `score` match submitted during the previous hour is not inserted again. It returns status `200`:

```json
{
  "ok": true,
  "duplicate": true,
  "scores": [],
  "source": "global"
}
```

Errors use stable codes and never include stack traces:

```json
{
  "ok": false,
  "error": "invalid_score"
}
```

The duplicate check uses the existing `scores.created_at` field and indexes. G3 adds no migration.

G3 intentionally does not add accounts, IP storage, IP-based rate limiting, Turnstile, or score attestation. Reliable broader flood protection should be configured with a Cloudflare rate-limiting product or added later with an explicit privacy and retention policy.

## Production Setup

Wrangler must be authenticated against the Cloudflare account that owns the Pages project.

```bash
npx wrangler login
npx wrangler d1 create xibalba-global-leaderboard
```

Record the database ID printed by the create command. No database ID is committed in this repository.

Apply and verify the migration against the remote database:

```bash
npx wrangler d1 migrations apply xibalba-global-leaderboard --remote
npx wrangler d1 migrations list xibalba-global-leaderboard --remote
```

These migration commands are for a new database. An existing G1/G2 database needs no migration for G3.

Bind the database in the Cloudflare dashboard:

1. Open **Workers & Pages**.
2. Select the existing Xibalba Pages project.
3. Open **Settings > Bindings**.
4. Add a **D1 database** binding.
5. Set the variable name to exactly `DB`.
6. Select `xibalba-global-leaderboard`.
7. Save and redeploy the Pages project.

Cloudflare requires a redeploy before a new Pages binding is available to Functions. See the official [Pages D1 binding documentation](https://developers.cloudflare.com/pages/functions/bindings/#d1-databases).

For the existing Git-integrated deployment, commit and push these files so Pages builds the `functions/` directory. For a manual deployment:

```bash
npm run build
npx wrangler pages deploy dist --project-name REPLACE_WITH_PAGES_PROJECT_NAME
```

## Production Tests

Replace the domain before running:

```bash
curl -sS "https://REPLACE_WITH_PAGES_DOMAIN/api/leaderboard"
```

```bash
curl -sS -X POST "https://REPLACE_WITH_PAGES_DOMAIN/api/leaderboard" \
  -H "Content-Type: application/json" \
  --data '{"initials":"ABC","score":123456,"version":"g3"}'
```

```bash
curl -sS "https://REPLACE_WITH_PAGES_DOMAIN/api/leaderboard?limit=25"
```

## Optional Local D1 Test

Cloudflare Pages requires a Wrangler configuration for local D1 development. Copy the non-active example and replace its project name and database ID:

```bash
cp wrangler.example.jsonc wrangler.local.jsonc
npm run build
npx wrangler d1 migrations apply DB --local --config wrangler.local.jsonc
npx wrangler pages dev dist --config wrangler.local.jsonc
```

Then test `http://localhost:8788/api/leaderboard`. Local D1 data is persisted by Wrangler under `.wrangler/`.

The repository intentionally does not include an active `wrangler.jsonc`: for an existing Pages project, an active Wrangler configuration becomes configuration source of truth. The dashboard binding path avoids replacing unrelated live project settings. See the official [Pages Wrangler configuration documentation](https://developers.cloudflare.com/pages/functions/wrangler-configuration/) and [D1 migration commands](https://developers.cloudflare.com/d1/wrangler-commands/#d1-migrations-apply).

## Client duplicate guard

After a successful or server-deduplicated submission, the client records `INITIALS:SCORE` in:

```text
xibalba_submitted_global_scores
```

The value is a JSON array capped at 20 signatures. A known signature skips the POST and refreshes the global scores with GET. Failed submissions are not recorded, so a temporary API failure remains retryable. The submission body contains only initials, score, and version.
