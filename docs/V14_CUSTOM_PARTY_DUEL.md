# OUTLIER v1.4 — Custom Party Showdown

The original two-person **Pass & Play Duel** is now a customizable local game-night mode. This release does **not** enable online multiplayer and never writes scores to the official guest daily history, player streaks, online league, paid entitlements, or global rankings.

## House rules

The setup screen provides:
- **2–8 named players.** Names are capped at 18 characters and must be distinct (case-insensitive). Blank names default to `PLAYER N`. Names are escaped in all DOM output.
- **1–7 games** per series. Each game has seven questions: four Stand Out rare-answer prompts and three Fit In crowd predictions. Each turn has the familiar 45-second timer.
- **One, several, or all twelve Stand Out categories.** Selected topics filter the four Stand Out questions. Fit In remains a cross-category crowd-prediction round. Each game's slate has unique question IDs; multiple games favor unused material from each selected group's shuffled deck. When the selected source pool is exhausted between games, questions may repeat in later games rather than silently changing topics.
- An on-screen preview confirming the player and game counts, plus category selection.

There are no fake online opponents, no membership requirements, and no real-money wagers.

## Match flow and the reveal

1. Player 1 begins Game 1. The client shows a sealed score in the game header; the accepted-answer feedback page is replaced by an **Answer Sealed** screen after every submitted or skipped answer.
2. After seven rounds, the phone goes to a **Pass the Device** handoff. The next player receives the **exact same game slate**, without seeing another player's scored results.
3. After all players finish, a **reveal curtain** appears. Players choose when to reveal each of the seven questions, one at a time. Answers and individual round points are displayed in a responsive card layout, with special treatment for highest-scoring picks. There is no cumulative scoreboard until the seventh reveal is complete.
4. After the seventh reveal, the **game scoreboard** appears. All players tied for the highest score earn one game win each.
5. When more games remain, Game N+1 generates a new slate and everyone plays again. After the last game's reveal, players first see the final game's scoreboard and then explicitly advance to the **series champion** screen.
6. The series champion is determined by **game wins first**, then **combined points**. A perfect tie after both criteria produces co-champions, not an arbitrary winner.
7. The champion screen shows a ranked table, the game-by-game history, and a shareable spoiler-free final summary. **Run It Back** starts a new series with the same settings; **Change House Rules** returns to the editor.

The reveal uses manual next-step controls (not timeouts), and animations honor the operating system's reduced-motion preference. No one is forced through an animation to continue. Results remain in the current tab only and are not treated as authoritative ranked data; because this is a local-browser mode, a player with browser developer access could inspect them.

## Architecture

- `src/party-duel.js`: pure config normalization, topic-respecting shuffled decks, one-slate-per-game building, verified per-game completion constraints, point standings, and per-round reveals. Tests are in `test/party-duel.test.js`.
- `src/app.js`: the setup form, player handoffs, secret answer screen, staged reveal, game result, champion screen, rematch, and sharing.
- `styles/editorial.css`: compact mobile-responsive game setup, cards, podium, standings, and reduced-motion styling.
- `e2e/browser-smoke.mjs`: real Chromium run of a **three-player, two-game** series with two selected topics; verifies every player handoff, scoreboard secrecy, seven reveal stages per game, shared-champion result, local storage isolation, and narrow screen layout.

## Acceptance checks

1. `npm run check` — syntax plus pure logic and scoring tests.
2. `npm run audit:content` — standard approved answer bank validation.
3. `npm run test:browser` with the existing Playwright/Chromium setup — complete home/daily/tutorial and new party playthrough. CI runs all of these.
4. Manual QA on an iPhone-sized screen and at 320px width. Check long names, many selected categories, all eight players, multiple games, skip, timeout, keyboard-only navigation, and native clipboard fallback.

**Unchanged:** The official daily 4 Stand Out + 3 Fit In one-attempt scoring, online authenticated league logic, consent and question review services. Party mode remains separate from all official statistics.
