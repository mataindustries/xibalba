# Xibalba Pinball — Portfolio Copy

## Short Version

Xibalba Pinball is a premium browser pinball score attack with a five-ball arcade loop, responsive touch controls, synthesized audio, and a Cloudflare-backed global leaderboard.

## Medium Version

Xibalba Pinball is a polished browser pinball game set inside a neon-lit underworld temple. Built with Phaser, Matter.js, and TypeScript, it combines a five-ball score attack with tactile flippers, jackpots, Eclipse Multiball, responsive synthesized audio, three-letter initials, and a global Wall of Champions. A persistent Local Wall keeps the full score-chasing loop available whenever the Cloudflare D1 leaderboard is offline.

## Feature Highlights

- Premium portrait playfield designed for readable, fast desktop and mobile sessions.
- Five-ball arcade structure with jackpots, combos, ball save, and Eclipse Multiball.
- Local and global Walls of Champions with graceful offline fallback and duplicate-submit protection.

## Technical Highlights

- Phaser 3 scene architecture with Matter.js rigid-body physics.
- TypeScript and Vite production build.
- Touch, pointer, and keyboard input in a shared responsive canvas.
- Web Audio API synthesis with event-specific game feedback and mute control.
- Cloudflare Pages Functions API backed by D1.
- Defensive validation, safe JSON errors, recent-duplicate suppression, and local submission deduplication.
- Browser `localStorage` fallback for scores and submission state.
