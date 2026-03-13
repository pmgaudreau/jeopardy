# PDK NINE Trivia Night

A real-time Jeopardy-style trivia system for team-based game nights. Built with static HTML + Firebase Realtime Database — no server required.

## Files

| File | Purpose |
|------|---------|
| `admin.html` | Host control panel — create rooms, load questions, manage game flow, grade answers |
| `play.html` | Team interface — join room, pick avatar, submit answers (mobile-friendly) |
| `board.html` | Projector display — show Jeopardy grid, questions, timer, scores on a TV |
| `superadmin.html` | Manage all active rooms — clear or delete rooms |
| `config.js` | Shared Firebase config, avatar definitions, and helper functions (gitignored) |
| `config.example.js` | Template — copy to `config.js` and fill in your Firebase credentials |

## Quick Start

1. Copy `config.example.js` to `config.js` and add your Firebase credentials
2. Open `admin.html` on your laptop
3. Enter a room code (e.g. `TRIVIA`), upload your CSV, and click **Create Game Room**
4. Open `board.html?room=TRIVIA` in a browser connected to your TV/projector
5. Teams open `play.html` on their phones, enter the room code, pick an avatar, and join

## Features

### Jeopardy Board (5x5 Grid)
- Categories across the top, dollar values down the side
- Red ✕ marks completed questions
- ★ indicator on Daily Double cells
- Round 1 ($200–$1000), Double Jeopardy ($400–$2000), Final Jeopardy

### Projector Display (`board.html`)
- Full-screen display optimized for TVs
- Shows the Jeopardy board, active questions, and answers
- Large countdown timer with progress bar
- Sound effects: Daily Double reveal, question select, timer ticks, time's up buzzer
- Between-round scoreboard with animated rankings
- QR code overlay (toggle from admin) for teams to scan and join
- Score change animations (+/- indicators on score updates)
- Intermission screen with countdown and scoreboard
- Final Jeopardy reveal ceremony (team-by-team: score → wager → answer → final score)
- Game recap with auto-scrolling highlights (hardest question, longest streak, biggest gain, etc.)
- Game over screen with winner announcement

### Team Interface (`play.html`)
- 20 unique avatars, each with a unique color
- Once a team picks an avatar, it's grayed out for other teams
- Player count selector (1–5 per team)
- Session persistence — auto-rejoins on page refresh
- Offline indicator (red bar when connection drops)
- Haptic vibration cues (new question, answers open, timer danger zone)
- QR codes auto-fill the room code via `?room=` URL parameter

### Timer
- Configurable presets (15s, 30s, 45s, 60s) in admin
- Synced to Firebase — visible on team phones AND projector simultaneously
- Timer bar + countdown on the projector display
- Turns red in the last 5 seconds with tick sounds
- Buzzer sound when time expires
- Auto-closes answers when all teams have submitted

### Daily Double
- Flagged in CSV with `daily_double_flag` column
- Automatically assigned to the team with board control
- Team sets a wager before the question is revealed
- Other teams see a spectator screen

### Intermission
- Timed break (configurable: 3, 5, or 10 minutes)
- Countdown and scoreboard shown on all screens
- Auto-ends when countdown reaches zero

### Keyboard Shortcuts (Admin Question View)
- **Space** — Toggle accepting answers
- **R** — Reveal answer
- **Enter** — Complete & return to board

### QR Code
- Admin clicks the **QR** button in the top bar to toggle
- QR overlay appears on the projector display
- Encodes the `play.html` URL with the room code pre-filled

### Scoring
- Teams that don't submit an answer receive no point change
- Correct answers: +value, incorrect answers: −value
- Admin can manually adjust scores (± button in sidebar)
- Daily Double / Final Jeopardy: teams set their own wager
- Apply Scores button is disabled during write to prevent double-apply
- Board control passes to a correct-answering team after each question
- Hot streak tracking (🔥 badge after 3+ correct in a row)

### CSV Validation
- Warns about missing categories (fewer than 5 per round)
- Warns about missing questions within a category
- Warns if Final Jeopardy is missing

## CSV Format

```csv
round,category,question_number,question_text,answer_text,daily_double_flag,image_url
1,History,1,"Who was the first President?","George Washington",FALSE
1,History,2,"What year did WWII end?","1945",TRUE
2,Science,1,"Chemical symbol for gold?","Au",FALSE,https://example.com/gold.jpg
3,Potpourri,1,"What is the rarest blood type?","AB Negative",FALSE
```

- **round**: 1 (Round 1), 2 (Double Jeopardy), 3 (Final Jeopardy)
- **category**: Category name (5 per round)
- **question_number**: 1–5 (maps to dollar value)
- **question_text / answer_text**: The Q&A content. For accented characters (é, ñ, etc.): use **UTF-8** if from Google Sheets/Mac; use **Windows-1252** if from Excel on Windows (select before uploading).
- **daily_double_flag**: TRUE/FALSE (or 1/0, yes/no)
- **image_url** (optional): URL to an image shown alongside the question. Use a full URL (e.g. `https://example.com/photo.jpg`). Images display at 75% of the screen on the projector. For image-only questions, leave question_text empty and provide image_url.

Use the **Download Template CSV** button in admin for a full example.

## Firebase Setup

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Realtime Database** (start in test mode for game night)
3. Register a Web App and copy your config
4. Copy `config.example.js` to `config.js` and paste your Firebase credentials

### Recommended Security Rules (Realtime Database)

```json
{
  "rules": {
    "trivia-rooms": {
      "$room": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

## Deployment

Push to GitHub and deploy via Netlify (or any static host):

```bash
cd /path/to/trivia
git init
git add .
git commit -m "Initial trivia app"
git remote add origin https://github.com/YOUR_USER/trivia.git
git push -u origin main
```

On Netlify: **Add new site → Import existing project → GitHub → select repo → Deploy**.

Point a subdomain (e.g. `trivia.pdknine.com`) via a CNAME record to your Netlify URL.

## Game Day Checklist

1. Upload CSV to admin
2. Create room
3. Open `board.html?room=CODE` on the TV
4. Click **QR** so teams can scan to join
5. Click any user interaction on the TV page to enable sound (browser policy)
6. Select questions from the grid, open answers, grade, apply scores
7. Use **End Round →** to transition between rounds (auto-shows scoreboard for 8 seconds)
8. Use **☕ Break** for a timed intermission between rounds
9. Final Jeopardy: teams set wagers, reveal the question, open for answers, grade
10. Start End of Game Reveal for team-by-team score ceremony
11. Show Game Recap for auto-scrolling highlights
12. End Game for the "Thanks for Playing" screen
