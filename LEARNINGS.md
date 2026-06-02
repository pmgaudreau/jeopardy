# Learnings & Design Notes

A running reference for anyone (human or agent) editing this project. Captures intended behavior, known trade-offs, recurring gotchas, and past fixes worth not re-breaking.

For setup, CSV format, and game-day instructions, see `README.md`. This doc is about the **inside** of the app.

---

## Architecture at a glance

Static HTML + Firebase Realtime Database. No backend.

```
admin.html      board.html       play.html        superadmin.html
   │              │                 │                 │
   └──── tokens.css ── helpers.js ── config.js ──────┘
                          │
                          ▼
              trivia-rooms / {ROOM_CODE} / …
                ├── state        ← single source of truth for the game
                ├── teams/{tk}   ← name, avatar, score, wager, streak
                ├── currentAnswers/{tk}  ← per-clue answer or pass flag
                ├── history/q{ts}        ← finalised clue results
                └── board/{round}/{cat}/{n}  ← loaded clues
```

`state` is the only object every client watches. Changing `state.phase`, `state.questionKey`, etc. is how the host drives every other surface.

- `admin.html` is the only writer of `state` and `board`.
- `play.html` only writes its own `teams/{tk}` and `currentAnswers/{tk}` records.
- `board.html` is read-only.
- `superadmin.html` only writes (clears/deletes) entire rooms.

All four pages load `config.js` → `helpers.js` before their own script. `helpers.js` is the single source of truth for `AVATARS`, `avatarImg`, `avatarColor`, `normalizeQuotes`, `esc`, `ROUND_LABELS`, `defaultGameState`, and `safeWrite`.

All four pages also link `tokens.css` before their own `<style>` block. `tokens.css` owns every design token (`--surface`, `--text-sec`, `--gold`, `--gold-soft`, `--r-card`, `--r-panel`, `--r-pill`, font stacks, etc.) and the base primitives (`.btn` + modifiers, `.btn-cta`, `input`, `.pill`, `.hidden`). Page-specific layout CSS stays inline. **Do not redefine tokens or base primitives in the inline `<style>` block** — extend them there if you need a page-specific variant.

---

## Intended behavior (non-obvious bits)

### Optimistic UI + `safeWrite`

Host actions update the local UI synchronously and fire the Firebase write asynchronously. `safeWrite(promise, errMsg)` resolves to `true` on success and `false` on failure (after showing an alert). It **never rejects**, so callers can ignore the return value or branch on the boolean if they need to roll back UI state.

```js
safeWrite(roomRef.update(patch), 'Failed to load the clue.');
// fire-and-forget is fine; alert pops on failure

safeWrite(roomRef.update(patch), msg).then(ok => {
    if (!ok) { rollbackUI(); return; }
    advanceUI();
});
```

### Player resync on wake

`play.html` registers a `visibilitychange` listener that calls `db.goOnline()` and `resyncMyState()`. `resyncMyState` re-reads state, teams, and currentAnswers in parallel and re-ingests them. This is what prevents wager loss when a phone sleeps between rounds — without it, the `.on('value')` listener could miss the questionKey transition.

State is consumed via three helpers in `play.html`: `ingestState`, `ingestTeam`, `ingestAnswer`. They **mutate** module-level state (`GS`, `cachedScore`, `hasSubmitted`, etc.) — the `ingest` name is the signal that they're not pure.

### Wager lock-in gates

Daily Double and Final Jeopardy hide the question from everyone — including the host — until `state.fjQuestionRevealed === true`. The host can't open answers, reveal the question, or read it themselves until they explicitly click "Reveal Question to Teams". `updateQuestionVisibility()` in `admin.html` enforces this, and `toggleAccepting()` short-circuits if the gate is still closed.

### Score freeze on the player during Final Jeopardy

When the questionKey becomes `final` and round is 3, `play.html` snapshots the player's score into `fjBaseScore`. `updateScoreDisplay()` shows the frozen score until the phase reaches `final-rankings` / `recap` / `stats` / `gameover`. This keeps the per-team reveal a surprise on the player's own phone while the projector ceremony plays out.

### Reveal ceremonies

- **Final Jeopardy**: scripted via `revealData = { teams, index, stage, podium, podiumTeams, podiumIndex }` in `admin.html`. Stages cycle per team: score → wager → answer → final score. After all teams, the podium reveals 3rd → 2nd → 1st with manual button presses, then the full rankings, then recap or stats.
- **Daily Double**: same shape but for one team. Driven by `ddRevealData` and `state.phase === 'dd-reveal'`.

The board reads `state.phase` plus the relevant reveal node and animates accordingly.

### Recap vs stats

End-of-game has two views the host can toggle between:

- `phase === 'recap'`: auto-scrolling highlight callouts (hardest clue, longest streak, etc.).
- `phase === 'stats'`: grid view with rows = teams, columns = the 12 metrics computed from `history`. Top performer in each column gets a crown.

Highlights & stats both derive from `history`; no separate aggregation step.

### Custom photo avatars

Stored as base64 `data:image/jpeg` URLs directly in `teams/{tk}/avatar`. `avatarImg(id, sz)` checks for the `data:` prefix and renders the URL directly; otherwise it falls back to `avatars/{id}.png`. Photos are downsized to ≤512px and JPEG-compressed client-side before upload, with hard caps on file type, original size (10 MB), and decode errors.

### Board control

After scoring, the next team to pick is computed by `determineBoardControl(grading, answers)`:
1. If the current holder answered correctly, they keep control.
2. Otherwise, pick a random correct team.
3. If nobody got it right, keep current control.

Written to `state.boardControl`.

---

## Known limitations & acceptable trade-offs

- **Open by design**: no auth, anyone with the URL + room code can read or write the room. Documented in `README.md` → "Security model". The super-admin passphrase is cosmetic.
- **Firebase rules expire in test mode**: by default Firebase blocks writes after 30 days of test-mode rules. Use the rules block in `README.md` to keep the room readable/writable, accepting the open-by-design trade-off.
- **Alert-based error UX**: every host-facing error is `alert()`. Fine for a single host laptop; would be ugly for players.
- **Removed teams aren't ejected**: removing a team from admin nulls their `teams/{tk}` and `currentAnswers/{tk}` records but their `play.html` session continues to render stale state until the next questionKey change.
- **Custom photos live in Firebase**: each is ~30 – 60 KB of base64. Fine for ~20 teams; not designed for hundreds.
- **`currentAnswers/{tk}` being nulled doesn't reset `hasSubmitted` on the player** — only a `questionKey` change does. This is intentional (avoids flicker when the host clears an answer), but means an admin who manually clears a single answer mid-clue won't see that team's UI reset.

---

## Common gotchas when editing

1. **Adding a helper?** Put it in `helpers.js` and use it everywhere. Don't redefine inline. The dedupe of `esc()` and `ROUND_LABELS` had to be done after they'd already drifted across 4 files. Same rule applies to CSS: tokens and base primitives go in `tokens.css`, not inline.
2. **Adding a new field to `state`?** Add it to `defaultGameState()` in `helpers.js` so every reset path (admin init, `createRoom`, `returnToSetup`, superadmin `clearRoom`) picks it up.
3. **Don't edit `build.sh` to duplicate helper logic.** `build.sh` generates **only** the Firebase config block on Netlify. The previous bug where production avatars broke was caused by `build.sh` overwriting `config.js` with a stale `avatarImg()`. `helpers.js` is the only place these live now.
4. **Player listeners**: when adding new player-side state, extend `ingestState`/`ingestTeam`/`ingestAnswer` and `resyncMyState` together. Wake-up resync depends on those being in sync with the `.on('value')` listeners.
5. **Host-side writes**: wrap with `safeWrite` so a dropped connection produces an alert instead of a silent no-op. Check the boolean return if the UI advanced optimistically and needs to roll back.
6. **Firebase keys**: team names are slugified to `teamKey` (alphanumeric + underscore). Non-alphanumeric-only names produce an empty key, which corrupts Firebase. Both `play.html joinRoom()` and `admin.html addTeamManual()` fall back to a random `team_{ts}` key when the slug is empty — preserve that.
7. **Inline timers**: `setTimeout` IDs for round transitions live in `roundTransTimeout`. Anything that short-circuits a transition (e.g. manually starting FJ before the auto-advance fires) needs `clearTimeout(roundTransTimeout)` first.
8. **CSV quote normalization**: smart quotes break CSV parsing. `normalizeQuotes(s)` in `helpers.js` converts curly to straight; use it for every user-supplied string field.

---

## Past fixes worth remembering

These are issues that have been fixed already — don't re-introduce them.

| Issue | Root cause | Fix location |
|---|---|---|
| Wager lost when phone sleeps | `.on('value')` missed events while page was hidden | `visibilitychange` → `db.goOnline()` + `resyncMyState()` in `play.html` |
| Photo avatars broken in production | `build.sh` overwrote `config.js` with stale `avatarImg()` | Extracted to `helpers.js`; `build.sh` only writes Firebase config |
| FJ scores leaked to players before reveal | Score listener fired immediately on score write | `fjBaseScore` freeze + `updateScoreDisplay()` in `play.html` |
| Host could double-apply scores | No guard on the Apply button | `scoresApplied` flag + confirm alert in `applyScores()` |
| Host could read DD/FJ question before wagers locked | Question DOM always rendered | `state.fjQuestionRevealed` flag + `q-wager-lock` overlay + `updateQuestionVisibility()` |
| FJ timer race when manually starting early | `roundTransTimeout` still pending | `clearTimeout(roundTransTimeout)` at top of `startFinal()` |
| "Reveal answer" highlight came before "Open for answers" | Old `acceptedAt` from the previous clue made the guard pass | `acceptedAt: 0` in the `statePatch` of `activateQ()` and `startFinal()` |
| Empty `teamKey` for symbol-only names | Slug produced empty string, corrupted Firebase | Fallback to `team_{ts}` in `play.html joinRoom()` + `admin.html addTeamManual()` |
| `safeWrite` produced unhandled promise rejections | Re-threw after alerting; most callers don't `.catch()` | Now resolves `true`/`false`; one caller (`applyScores`) checks the boolean |
| `currentAnswers` left orphaned when removing a team | `removeTeam` only deleted `teams/{tk}` | Now batches `teams/{tk}: null` and `currentAnswers/{tk}: null` |
| Design tokens defined four times with two naming conventions (`--bg-card` vs `--card`, `--text-sec` vs `--tsec`, …) | Each HTML file declared its own `:root`; same colors, divergent names | Extracted to `tokens.css`; all pages link it before their inline styles |
| Three different `.btn` definitions for the same name | Each page redefined the base button (padding, font, text-transform drifted) | `tokens.css` owns `.btn` (desktop pill) and `.btn-cta` (mobile chunky); play.html markup uses `.btn-cta` |

---

## Smoke-test checklist after touching shared code

If you change `helpers.js`, `state` shape, or a player-side listener, walk through:

1. Open `admin.html`, create a room, load a CSV.
2. Open `board.html?room=CODE` on a second window.
3. Open `play.html?room=CODE` on a phone (or a third browser); join with a photo avatar.
4. Run one regular clue end-to-end (open → grade → apply → return).
5. Run a Daily Double (verify question stays hidden until reveal; reveal ceremony plays).
6. Run a Final Jeopardy (verify per-team reveal; verify player score is frozen until their team is revealed).
7. Background the player tab during the questionKey transition; bring it back; verify state caught up.
8. Force the host laptop offline mid-write; verify the alert fires and the action can be retried.
