# Xibalba Pinball

> A premium browser pinball score attack set in a neon-lit underworld temple.

**Live build:** [xibalba.pages.dev](https://xibalba.pages.dev/)

**Status:** Playable portfolio build

Xibalba Pinball is a five-ball arcade game built for quick desktop and mobile sessions. Complete rollover lanes, light the temple jackpot, trigger Eclipse Multiball, and carve a three-letter score into the Wall of Champions.

## Key Features

- Premium Xibalba-inspired playfield with a readable chrome pinball.
- Five-ball game structure with ball save, jackpot, combo, and Eclipse Multiball systems.
- Keyboard and touch controls with responsive synthesized audio and an in-game mute control.
- Three-letter initials flow with persistent local scores.
- Cloudflare D1 global leaderboard with a Local Wall fallback for offline or failed requests.
- Compact Local / Global Wall controls with graceful loading and fallback states.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Start / launch | `Space` or `Down` | Tap to start; hold and release the launcher area |
| Left flipper | `A` or `Left` | Press the left side of the playfield |
| Right flipper | `D` or `Right` | Press the right side of the playfield |
| Pause / resume | `P` | — |
| Restart | `R` | Use the start/restart flow |
| Mute / unmute | — | Tap the speaker control |

Development tools remain hidden during normal play and are available through the existing dev-mode keyboard gate.

## Global Leaderboard

The Global Wall is served by a Cloudflare Pages Function backed by D1. Every qualifying score is saved locally first; if the global API is unavailable, the Local Wall remains usable and gameplay is never blocked.

Global submissions contain only initials, score, and build version. The API validates submissions, rejects unreasonable scores, and suppresses recent exact duplicates. This is a lightweight portfolio leaderboard, not an authenticated competitive ranking system.

See [Global Leaderboard documentation](docs/GLOBAL_LEADERBOARD.md) for the API contract and deployment notes.

## Tech Stack

- TypeScript
- Phaser 3
- Matter.js physics
- Vite
- Web Audio API synthesis
- Cloudflare Pages and Pages Functions
- Cloudflare D1
- Browser `localStorage`

## Local Development

```bash
npm ci
npm run dev
```

Production verification:

```bash
npm run build
```

The static build is written to `dist/`. Cloudflare Pages Functions are under `functions/`; production expects a D1 binding named `DB`.

## Portfolio and QA

- [Reusable portfolio copy](docs/PORTFOLIO_COPY.md)
- [Final playtest checklist and feedback prompt](docs/PLAYTEST_CHECKLIST.md)
- [Global leaderboard setup](docs/GLOBAL_LEADERBOARD.md)

## Known Issues / Future Roadmap

- Mobile browser audio requires an initial user gesture before sound can start.
- The table is portrait-first; broader small-screen, landscape, and browser compatibility testing remains useful.
- Global scores are client-submitted and intentionally use lightweight abuse protection rather than account-based score attestation.
- Future work could add a clearer rules primer, richer end-of-run statistics, stronger leaderboard attestation/rate limiting, and further accessibility testing.
