# Admin Flow Review

## Current Flow Summary

### Normal Questions (R1/R2)
1. Select cell → Question view
2. Open for Answers → timer starts
3. Grade answers (✓/✕)
4. Apply Scores
5. Complete & Return to Board

### Daily Double
1. Select DD cell → Question hidden, wager prompt
2. DD team locks wager
3. Reveal Question to Teams
4. Open for Answers → timer starts
5. Grade answer
6. **Apply Scores** (required — DD reveal button only appears after)
7. Show Daily Double Reveal → 5-stage ceremony

### Final Jeopardy
1. Start Final Jeopardy → Question hidden, wager prompt
2. Teams lock wagers
3. Reveal Question to Teams
4. Open for Answers → timer starts
5. Grade all answers
6. Start End of Game Reveal (no Apply Scores required)

---

## Recommended Changes

### 1. **Hide Apply Scores for Final Jeopardy** ✓ Recommended
- **Why:** FJ doesn't require Apply Scores — scores are written during the reveal flow. Showing the button can confuse hosts ("Do I need to click it?").
- **Change:** Hide the Apply Scores row when in FJ. Flow becomes: Grade → Start End of Game Reveal.
- **Note:** Apply Scores for FJ does add to history; if you want FJ in the game recap/history, we could run it automatically when starting the reveal instead of showing the button.

### 2. **FJ Reveal Box: "Grade all answers above first"**
- **Current:** Team Answers section is above the FJ reveal box, so "above" is technically correct.
- **If still confusing:** Change to "Grade all answers in the Team Answers section above, then start the ceremony." Or simply: "Grade all answers, then start the ceremony." (avoids above/below entirely)

### 3. **Enter Key for FJ**
- **Current:** Enter triggers `completeAndReturn()`, which is hidden for FJ and would show an error.
- **Change:** When in FJ with all answers graded, make Enter trigger "Start End of Game Reveal" instead. Improves keyboard flow.

### 4. **DD vs FJ Consistency**
- DD: Apply Scores required before reveal
- FJ: Apply Scores not required (scores written during reveal)
- **Assessment:** This is intentional. DD needs Apply Scores to compute `appliedPoints` before the reveal. FJ uses `grading` directly. No change needed.

### 5. **Empty Answers Edge Case**
- If no teams submit answers in FJ, `allGraded` is vacuously true and the reveal can start. The reveal would show teams with pre-FJ scores. This is reasonable behavior.

### 6. **Back to Board During FJ**
- "← Back to Board" is still visible during FJ. Clicking it would return to the FJ board (single cell). That's correct — no change needed.

---

## Summary of Suggested Implementations

| Change | Impact | Effort |
|--------|--------|--------|
| Hide Apply Scores for FJ | Reduces confusion | Low |
| Simplify FJ box text ("Grade all answers, then start...") | Clearer copy | Low |
| Enter key triggers FJ reveal when ready | Better keyboard UX | Low |
