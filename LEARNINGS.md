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

- **Final Jeopardy**: scripted via `revealData = { teams, index, stage, podium, podiumTeams, podiumIndex, confirming }` in `admin.html`. Stages cycle per team: score → wager → answer → final score. Each reveal-team object also carries `preCorrect` — the team's `correctCount` snapshotted before FJ — so both the stage-4 and the podium bulk write can recompute `correctCount = preCorrect + (correct ? 1 : 0)` idempotently. After all teams, phase becomes **`fj-confirm`** (admin only): host sees a standings table with FJ win/loss, the live `teams[tk].correctCount`, and can edit final scores before clicking **Confirm Scores & Reveal Podium**. Projector shows “Stand by — host is verifying final scores”; players see a wait message. Then podium reveals 3rd → 2nd → 1st, full rankings, recap or stats.

### Team ranking & tiebreakers

Every site that ranks teams by score uses `compareScoreDesc(scoreA, correctA, scoreB, correctB)` from `helpers.js` — score descending, then `correctCount` descending. The cached `correctCount` lives on `teams/{tk}/correctCount` and is incremented by:

- `applyScores()` (R1/R2 and DD) — bumped for each team whose answer is graded correct (not passed) in the same batched `update`.
- FJ stage-4 commit and `startPodiumFromReveal()` bulk write — both set `correctCount = preCorrect + (correct ? 1 : 0)` so re-running them is safe.

Reveal-data sort sites read `teams[t.key].correctCount` when available (live) and fall back to `preCorrect + (correct ? 1 : 0)` if the team record is gone. Missing `correctCount` coerces to 0, so games started before this field existed degrade gracefully (ties revert to insertion order for that game only).
- **Daily Double**: same shape but for one team. Driven by `ddRevealData` and `state.phase === 'dd-reveal'`.

The board reads `state.phase` plus the relevant reveal node and animates accordingly.

### Score-display layouts (full-screen, masked, infinite-scroll)

Every full-screen "everyone's scores" view on the projector uses the same layout pattern so the visual feel is identical across between-round transitions, intermissions, and final rankings:

```
<div class="X-wrap">              ← masked viewport (overflow:hidden + linear-gradient mask)
    <div class="X-scroll" id=…>   ← rows container (flex column, will-change:transform)
        <!-- rowsHtml duplicated: rowsHtml + rowsHtml -->
    </div>
</div>
```

`startInfiniteScroll(el, {styleId, keyframeName, speed, minH})` in `board.html` measures `el.scrollHeight / 2` (because rows are duplicated for a seamless loop), injects a `@keyframes` rule, and applies it as a linear infinite animation. If the doubled content would only need to scroll less than `minH` pixels, the animation is suppressed and the list renders static — so small fields of teams stay readable instead of looping every 2 seconds.

Per-row entry animations (e.g. `slideIn` with a stagger) **must be suppressed** when the row lives inside one of these scroll containers (`.X-scroll .X-row { animation: none; }`), otherwise the duplicated copy re-triggers them visibly mid-scroll.

The in-game sidebar `#bd-scores` deliberately does **not** use this pattern — it's a small persistent live element next to the question grid, and an auto-scrolling pill cluster would compete with the active clue.

### Question display fits the viewport (image absorbs available space)

`#question-display` is a flex column where the image **slot** (`#qd-img-slot`, a `<div>`) is the only flex-grow child (`flex: 1 1 0; min-height: 0`) and every text/timer/answer/status row is `flex-shrink: 0`. The slot absorbs whatever vertical space is left after every other element takes its natural height, so the answer is always visible at the bottom regardless of the image's intrinsic dimensions.

**Why a wrapper, not `flex:1 1 0` on the `<img>` directly?** `<img>` elements use their intrinsic aspect ratio to declare a height to the flex algorithm — a portrait clue at `max-width: 80vw` declares a height of `80vw / aspect-ratio`, which can exceed the viewport. The flex algorithm doesn't reliably override that "preferred" height on `<img>` elements (cross-browser quirk), so the image overflows and pushes the answer off-screen. The wrapper `<div>` has no intrinsic size, takes the flex sizing cleanly, and the image inside is bounded by `max-width: 100%; max-height: 100%; object-fit: contain`.

When the slot is hidden (text-only clue), `tokens.css`'s `.hidden { display: none }` removes it from the flex flow and `justify-content: center` centers the remaining items as before. **All three JS callsites that toggle image visibility must toggle the `hidden` class on `#qd-img-slot`, not on `#qd-img`** — hiding the image without hiding its wrapper would leave the wrapper greedily consuming vertical space.

### Board audio (SFX + Final Jeopardy music)

`board.html` owns all audio. `SFX` is a closure with a private `AudioContext` used for procedurally generated tones (correct, wrong, tick, reveal, etc.) plus an HTMLAudio element for the looping Final Jeopardy thinking-music MP3.

Browsers gate audio on **two** independent rails:

1. **AudioContext** — constructed outside a user gesture, the context starts `suspended`. Every `tone()` call silently schedules audio that never plays.
2. **HTMLMediaElement** — `.play()` is rejected for elements created/triggered outside a user gesture.

Both gates are **per-document**. The host clicking on the admin window does *nothing* for the board. The user must interact with the board window itself. Because the board is often projected and never clicked, a center-screen `audio-unlock-overlay` modal is shown immediately on page load (the corner pill we tried first was too easy to miss on a projected display). The `unlockAudio()` handler watches for any `pointerdown`/`touchstart`/`keydown`/`click` and, on first fire, calls `SFX.unlock()` (resumes the context), `SFX.thinkMusic.prime()` (plays the MP3 at volume 0 then pauses, satisfying the media autoplay gate), hides the overlay, and plays a `questionReveal` confirmation tone after 80 ms so the host gets immediate audible verification. `console.info('[SFX] audio unlocked')` logs the success.

**Don't** revert to the old `new AudioContext(); c.resume(); c.close();` pattern — that creates a *separate* context and does nothing for the SFX module's internal one. **Don't** make `thinkMusic.start()` construct a fresh `Audio` element each time — the priming was done on a specific element; replacing it loses the autoplay-unlocked status.

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
- **Player vibrations are platform-gated.** iOS Safari doesn't implement `navigator.vibrate` at all (no plan to). Android Chrome supports it but requires sticky user activation (typically granted automatically once the player has joined). The three `try{navigator.vibrate(...)}catch(e){}` calls in `play.html` are correct — they silently no-op on platforms that don't support it.

---

## Common gotchas when editing

1. **Adding a helper?** Put it in `helpers.js` and use it everywhere. Don't redefine inline. The dedupe of `esc()` and `ROUND_LABELS` had to be done after they'd already drifted across 4 files. Same rule applies to CSS: tokens and base primitives go in `tokens.css`, not inline.
2. **Ranking teams by score?** Use `compareScoreDesc` from `helpers.js`. Don't write `(b.score - a.score)` inline — ties will become non-deterministic again. Any new write path that affects a correct/incorrect outcome must also keep `teams/{tk}/correctCount` in sync.
3. **Adding a new field to `state`?** Add it to `defaultGameState()` in `helpers.js` so every reset path (admin init, `createRoom`, `returnToSetup`, superadmin `clearRoom`) picks it up.
4. **Don't edit `build.sh` to duplicate helper logic.** `build.sh` generates **only** the Firebase config block on Netlify. The previous bug where production avatars broke was caused by `build.sh` overwriting `config.js` with a stale `avatarImg()`. `helpers.js` is the only place these live now.
5. **Player listeners**: when adding new player-side state, extend `ingestState`/`ingestTeam`/`ingestAnswer` and `resyncMyState` together. Wake-up resync depends on those being in sync with the `.on('value')` listeners.
6. **Host-side writes**: wrap with `safeWrite` so a dropped connection produces an alert instead of a silent no-op. Check the boolean return if the UI advanced optimistically and needs to roll back.
7. **Firebase keys**: team names are slugified to `teamKey` (alphanumeric + underscore). Non-alphanumeric-only names produce an empty key, which corrupts Firebase. Both `play.html joinRoom()` and `admin.html addTeamManual()` fall back to a random `team_{ts}` key when the slug is empty — preserve that.
8. **Inline timers**: `setTimeout` IDs for round transitions live in `roundTransTimeout`. Anything that short-circuits a transition (e.g. manually starting FJ before the auto-advance fires) needs `clearTimeout(roundTransTimeout)` first.
9. **CSV quote normalization**: smart quotes break CSV parsing. `normalizeQuotes(s)` in `helpers.js` converts curly to straight; use it for every user-supplied string field.
10. **Adding a new full-screen "scores" view on the projector?** Use the `X-wrap` + `X-scroll` + `startInfiniteScroll(...)` pattern (see "Score-display layouts"). Don't reach for plain `overflow-y:auto` — it breaks the visual continuity with the rest of the game. Remember to suppress per-row entry animations inside the scroll container.
11. **Don't put fixed `max-height: Xvh` on a child of `#question-display`.** That was the cause of answers being pushed off-screen by tall images. The layout relies on `#qd-img-slot` being the only flex-grow child — every other element must keep `flex-shrink: 0` (covered by the universal `#question-display > *` rule, but easy to break with an inline `style="height: …"`).
12. **Don't put `flex:1 1 0` on an `<img>` directly.** The intrinsic aspect ratio fights the flex algorithm and the image won't reliably shrink in a column flex container. Wrap it in a `<div>` slot and put the flex sizing on the slot. Toggle `.hidden` on the slot, not on the image.
13. **`renderAnswers()` sorts by `curAnswers[tk].timestamp` ascending — preserve that.** Don't "tidy" it back to `Object.keys()` order. The host grades top-to-bottom; sorting by submission time guarantees late submissions append at the bottom instead of inserting into the middle and shifting which row is next-to-grade. Server timestamp comes from `firebase.database.ServerValue.TIMESTAMP` set in `play.html`'s `submitAnswer()`/`passAnswer()`.

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
| Tied teams ranked in non-deterministic insertion order | Every sort site wrote `(b.score - a.score)` inline; JS's stable sort fell back to discovery order on ties | `compareScoreDesc(scoreA, correctA, scoreB, correctB)` in `helpers.js`, applied to all 11 sort sites; `teams/{tk}/correctCount` cached and bumped in `applyScores` + FJ stage-4/podium writes |
| Intermission and final-rankings score lists felt inconsistent with between-round transitions | The transition view had its own bespoke infinite-scroll JS; the other two used plain `overflow:auto` | Generalised `startInfiniteScroll(el, opts)` helper in `board.html`; transition, recap, intermission, and rankings all call it with their own keyframe name + style id |
| Tall clue images pushed the revealed answer off the bottom of the projector | `#qd-img` had a fixed `max-height: 50vh` and competed with stacked text/timer/answer rows for the column height. A first-pass fix put `flex: 1 1 0` on the `<img>` directly, but the image's intrinsic aspect ratio (portrait clues at `max-width: 80vw` declare a height > viewport) fought the flex-shrink algorithm and the image still overflowed. | Wrapped image in `#qd-img-slot`; the slot owns `flex: 1 1 0; min-height: 0`; image inside is `max-width: 100%; max-height: 100%; object-fit: contain`. JS toggles `.hidden` on the slot, not the image. |
| All board SFX silently failed; Final Jeopardy music never autoplayed | The audio-unlock click handler created a *throwaway* `AudioContext`, resumed it, and closed it — never touching the SFX module's actual context. `thinkMusic.start()` also rebuilt the `Audio` element on every play, so the autoplay-unlock applied to one element didn't carry over. | `SFX.unlock()` resumes the module's own context; `SFX.thinkMusic.prime()` plays the looping MP3 at volume 0 once during the first user gesture so subsequent `start()` calls bypass the media-autoplay gate. A `🔈 Click for sound` pill appears after ~1.2 s if no gesture has primed audio yet. |

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
