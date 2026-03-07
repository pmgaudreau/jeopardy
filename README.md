# PDK NINE Trivia Night

A real-time Jeopardy-style trivia system for team-based game nights. Built with static HTML + Firebase Realtime Database — no server required.

## Files

| File | Purpose |
|------|---------|
| `admin.html` | Host control panel — create rooms, load questions, manage game flow, grade answers |
| `play.html` | Team interface — join room, pick avatar, submit answers (mobile-friendly) |
| `board.html` | Projector display — show Jeopardy grid, questions, timer, scores on a TV |

## Quick Start

1. Open `admin.html` on your laptop
2. Enter a room code (e.g. `TRIVIA`), upload your CSV, and click **Create Game Room**
3. Open `board.html?room=TRIVIA` in a browser connected to your TV/projector
4. Teams open `play.html` on their phones, enter the room code, pick an avatar, and join

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

### Team Avatars
- 12 unique avatars: Dragon, Wizard, Swords, Dice, Castle, Fox, Wolf, Eagle, Target, Crystal, Shield, Masks
- Each avatar has a unique color
- Once a team picks an avatar, it's grayed out for other teams
- Avatars appear on the scoreboard, projector display, and answer cards

### Timer
- Configurable presets (15s, 30s, 45s, 60s) in admin
- Synced to Firebase — visible on team phones AND projector simultaneously
- Timer bar + countdown on the projector display
- Turns red in the last 5 seconds with tick sounds
- Buzzer sound when time expires

### Daily Double
- Flagged in CSV with `daily_double_flag` column
- Admin selects which team answers — other teams see a spectator screen
- Worth double the face value

### QR Code
- Admin clicks the **QR** button in the top bar to toggle
- QR overlay appears on the projector display
- Encodes the `play.html` URL with the room code pre-filled

### Scoring
- Teams that don't submit an answer receive no point change
- Correct answers: +value, incorrect answers: −value
- Admin can manually adjust scores (± button in sidebar)
- Final Jeopardy: teams set their own wager

## CSV Format

```csv
round,category,question_number,question_text,answer_text,daily_double_flag
1,History,1,"Who was the first President?","George Washington",FALSE
1,History,2,"What year did WWII end?","1945",TRUE
2,Science,1,"Chemical symbol for gold?","Au",FALSE
3,Potpourri,1,"What is the rarest blood type?","AB Negative",FALSE
```

- **round**: 1 (Round 1), 2 (Double Jeopardy), 3 (Final Jeopardy)
- **category**: Category name (5 per round)
- **question_number**: 1–5 (maps to dollar value)
- **question_text / answer_text**: The Q&A content
- **daily_double_flag**: TRUE/FALSE (or 1/0, yes/no)

Use the **Download Template CSV** button in admin for a full example.

## Firebase Setup

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Realtime Database** (start in test mode for game night)
3. Register a Web App and copy your config
4. Replace the `firebaseConfig` object in all three HTML files

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
7. Use round tabs to transition between rounds (auto-shows scoreboard)
8. Final Jeopardy: teams set wagers, then you open the question
