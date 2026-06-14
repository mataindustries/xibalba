Xibalba Pinball — Phase 2 Roadmap Current Build Status Xibalba Pinball is 
now visually premium enough for early friend feedback. Current strengths: 
- Premium Xibalba / obsidian temple art direction - Clean v4 playfield 
background - Working launch lane - Working touch controls - Working 
flippers - Working bumpers - Working rollovers - Working jackpot / center 
feature - Working Eclipse Multiball - Improved ball containment - 
Improved visual guide rails / physical barrier readability - Good mobile 
playfield presentation - Local high score Known remaining polish: - Ball 
still needs a more metallic pinball look - Flippers should look more 
distinct from nearby guide walls - HUD can be slightly cleaner - Game 
needs a clear ball limit / game-over structure - Rules loop should be 
clearer to players - Leaderboard can come later --- Phase 2A — Immediate 
Visual Polish Goal: Make the game feel more like a real premium pinball 
table before wider sharing. 1. Metallic Ball Pass Priority: High Problem: 
The ball is readable but looks too much like a ping pong ball. Goal: Make 
the ball look like a polished real pinball. Requirements: - Silver/chrome 
metallic look - Strong specular highlight - Darker shaded edge - Subtle 
reflection/gloss - Keep ball highly visible - Do not change physics, 
radius, bounce, mass, friction, or launch tuning Acceptance: - Ball 
clearly reads as metal - Ball remains easy to track on mobile - Multiball 
balls all render correctly - Gameplay feel is unchanged --- 2. Flipper 
Identity Pass Priority: High Problem: Flippers look too similar to nearby 
angled guide walls. Goal: Make flippers look like distinct, interactive 
mechanical parts. Requirements: - More contrast than surrounding rails - 
Obsidian body or darker core - Aged gold trim - Jade glowing inlay or 
rune strip - Clear pivot/cap detail - Optional serpent/skull/temple 
engraving - Do not change flipper physics, length, angle, or collision 
bodies Acceptance: - Flippers instantly read as flippers - Flippers stand 
out from nearby guide rails - Ball visibility remains good - Touch and 
keyboard flipper controls still work --- 3. HUD Readability Pass 
Priority: Medium Goal: Improve readability without cluttering the premium 
playfield. Requirements: - Slightly larger score/high score/state text - 
Better pale bone/gold contrast - Compact mobile-friendly layout - Avoid 
covering important gameplay areas - Keep debug text hidden unless 
dev/debug mode is active Acceptance: - Score is readable at mobile size - 
Game state is clear - HUD feels premium, not debug/demo-like --- 4. 
Subtle Hit Effects Priority: Medium Goal: Make hits feel more satisfying 
without making the table noisy. Potential effects: - Bumper pulse on hit 
- Rollover flash - Jackpot glow - Ball save flash - Drain flash - 
Multiball start pulse Rules: - Keep effects short and readable - Avoid 
excessive screen shake - Do not hurt ball visibility Acceptance: - Hits 
feel more alive - Effects do not distract from gameplay - Performance 
remains smooth --- Phase 2B — Game Structure Goal: Make the game feel 
like a real score-chasing pinball game. 5. Ball Limit / Game Over 
Priority: High Recommended default: - 3 balls for standard arcade mode - 
5 balls can be used for friend-feedback/casual mode Implementation: - 
Centralize value in config:
  - ballsPerGame: 3 or 5 - HUD should show: - BALL 1/3 or BALL 1/5 - On 
drain:
  - if ball save is active, do not consume a ball - if multiball is 
  active and other balls remain, do not advance ball count - if final 
  active ball drains, advance ball count - after final ball drains, show 
  game over
Game Over screen: - GAME OVER - Final score - High score - New high score 
message if applicable - Tap / Press Space to Restart Acceptance: - Ball 
count advances correctly - Ball save does not consume a ball - Multiball 
does not consume multiple balls incorrectly - Restart resets score, ball 
count, rollovers, game state, and serves a new ball --- 6. Clearer Rules 
Loop Priority: High Goal: Make players understand what to aim for. Simple 
loop: 1. Complete rollovers 2. Light center temple/jackpot 3. Hit target 
banks to build jackpot value 4. Shoot center shot for jackpot 5. Build 
toward Eclipse Multiball 6. Multiball becomes the big scoring event 
Acceptance: - Player has obvious goals - Rollover completion feels 
rewarding - Center shot feels important - Multiball feels earned --- 7. 
Multiball Polish Priority: Medium Current: Eclipse Multiball works and 
spawn behavior has improved. Next: - Improve multiball start presentation 
- Add premium “ECLIPSE MULTIBALL” banner - Add short lighting pulse - 
Confirm spawn positions are fair - Confirm draining one multiball ball 
does not end the turn if others remain Acceptance: - Multiball feels like 
a major event - Balls enter active play naturally - No immediate unfair 
center drain from spawn --- Phase 2C — Replayability Goal: Give players a 
reason to play again. 8. Local High Score Flow Priority: Medium Current: 
Local high score exists. Improve: - Clear high score celebration - New 
high score banner - Optional initials/name entry later - Store top scores 
locally Acceptance: - New high score feels rewarding - Restart flow is 
clean --- 9. End-of-Run Summary Priority: Medium Show: - Final score - 
High score - Rollovers completed - Jackpots scored - Multiballs started - 
Time survived if easy to track - Play Again prompt Acceptance: - End of 
game feels complete - Player understands what they accomplished --- 10. 
Local Leaderboard Priority: Medium-Low Before online leaderboard: - Store 
top 5 local scores in localStorage - Show on title/game-over screen 
Acceptance: - Multiple scores are saved locally - No backend required --- 
Phase 2D — Shareable Feedback Build Goal: Deploy and collect useful 
feedback from friends. 11. Cloudflare Pages Deployment Priority: High 
after Phase 2A or 2B Recommended settings: - Framework: Vite - Build 
command: npm run build - Output directory: dist Acceptance: - Game has 
stable public URL - GitHub pushes auto-deploy - Friends can open on 
mobile --- 12. Feedback Questions Ask testers only a few questions: 1. 
Did the ball feel good to hit? 2. Did anything feel unfair or confusing? 
3. Did you know what to aim for? 4. Did you want to play again? 5. What 
was the most satisfying moment? Avoid asking: - “What do you think?” - 
“Is it good?” - “Any feedback?” Those are too vague. --- Phase 2E — 
Premium Finish Goal: Make the game feel more like a finished commercial 
mini-game. 13. Audio Pass Priority: Medium Add: - Flipper click - Bumper 
hit - Rollover tone - Target tick - Jackpot sting - Drain sound - Ball 
save sound - Multiball callout - Subtle ambient underworld loop 
Acceptance: - Sounds feel responsive - Audio is not annoying - Mobile 
performance remains good --- 14. Screen Juice Priority: Medium-Low Add 
carefully: - Tiny screen shake on jackpot/multiball only - Short flash on 
big events - Subtle vignette pulse - No constant shaking Acceptance: - 
Big events feel bigger - Gameplay remains readable --- 15. Themed 
Callouts Priority: Medium-Low Possible callouts: - TEMPLE LIT - ROLLOVER 
COMPLETE - JACKPOT READY - XIBALBA JACKPOT - ECLIPSE MULTIBALL - BALL 
SAVED - FINAL BALL - GAME OVER Acceptance: - Callouts improve clarity - 
They match the Xibalba theme - They do not clutter the screen --- 
Recommended Execution Order Next 7 Steps 1. Metallic ball visual pass 2. 
Flipper identity visual pass 3. HUD readability pass 4. Ball limit / 
game-over structure 5. Rules loop clarity pass 6. Deploy to Cloudflare 
Pages 7. Friend playtest with 3–5 people --- Do Not Prioritize Yet Avoid 
for now: - Online accounts - Online leaderboard - Complex backend - 
Cosmetic unlock system - Multiple tables - Advanced bonus math - 
Overcomplicated missions - Large layout redesign --- Definition of Phase 
2 Success Phase 2 is successful when: - The ball looks like a real 
metallic pinball - Flippers read clearly as flippers - The game has a 
real ball limit and game-over flow - The main scoring loop is 
understandable - The game is deployed to a public URL - At least 3 
friends play it
- Feedback is specific enough to guide Phase 3
