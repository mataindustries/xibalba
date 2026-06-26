# Xibalba Global Leaderboard G1

Phase G1 adds a Cloudflare Pages Functions API and D1 schema. The Phaser client does not call this API yet; the local Wall of Champions remains authoritative in-game.

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
  ]
}
```

### `POST /api/leaderboard`

```json
{
  "initials": "ABC",
  "score": 123456,
  "version": "g1"
}
```

Validation:

- `initials` is trimmed, uppercased, and must then match exactly three `A-Z` letters.
- `score` must be an integer from `1` through `999999999`.
- `version` is optional, limited to 32 safe version characters.
- Request bodies are limited to 2 KiB.
- Browser submissions with an `Origin` header must match the API origin.
- SQL uses bound prepared statements.

Successful POST requests return status `201` and the updated top 10. Errors use JSON without stack traces:

```json
{
  "ok": false,
  "error": "Initials must contain exactly three letters A-Z."
}
```

G1 intentionally has no account system, authentication, rate limiting, Turnstile, or score attestation.

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
  --data '{"initials":"ABC","score":123456,"version":"g1"}'
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

## G2

G2 still needs to:

- fetch the global leaderboard in the Phaser client;
- keep the local Wall of Champions as an offline fallback;
- submit a qualifying score only after initials confirmation;
- present network loading, error, and retry states;
- define stronger abuse controls before treating global scores as trusted.
