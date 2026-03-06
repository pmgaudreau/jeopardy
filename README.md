# Trivia Night — Answer Submission System

Two self-contained HTML files that let you run team-based Jeopardy-style trivia at your shop. The host controls rounds, categories, and values from a laptop while teams submit answers from their phones — all synced in real time via Firebase.

## Files

- **`admin.html`** — Host control panel (laptop/tablet). Manage rounds, open/close answers, grade submissions, track scores.
- **`play.html`** — Team submission page (phone). Join with a room code, see the current question, submit answers, wager in Final Jeopardy.

## Setup (one-time, ~5 minutes)

### 1. Create a Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com/)
2. Click **Add project** → name it anything (e.g. "trivia-night") → click through the defaults
3. On the project dashboard, click the **web icon** (`</>`) to add a web app
4. Name it anything → **do not** check "Firebase Hosting" → click **Register app**
5. You'll see a config block like this — copy it:

```js
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "trivia-night-xxxxx.firebaseapp.com",
  databaseURL: "https://trivia-night-xxxxx-default-rtdb.firebaseio.com",
  projectId: "trivia-night-xxxxx",
  storageBucket: "trivia-night-xxxxx.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

### 2. Enable the Realtime Database

1. In the Firebase console sidebar, click **Build → Realtime Database**
2. Click **Create Database**
3. Choose a location (any is fine) → click **Next**
4. Select **Start in test mode** → click **Enable**

> Test mode allows open read/write for 30 days. For a one-off event this is fine. You can extend it later in **Database → Rules** by updating the expiry timestamp.

### 3. Paste your config into both HTML files

Open `admin.html` and `play.html`. Near the top of each `<script>` section, find:

```js
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    ...
};
```

Replace the entire object with your config from step 1. Both files need the **same** config.

### 4. Upload to your website

Upload both HTML files to your website the same way you hosted your March Madness bracket. For example:

- `yoursite.com/trivia/admin.html` (you'll open this on your laptop)
- `yoursite.com/trivia/play.html` (teams open this on their phones)

## Running the Event

### Before the event
1. Open `admin.html` on your laptop
2. Enter a room code (e.g. `TRIVIA` or `GAME42`) and click **Create Game Room**
3. Write the room code and the `play.html` URL on a whiteboard so teams can join

### During each question
1. **Set the round** using the Round 1 / Round 2 / Final tabs
2. **Type the category** name and click Set
3. **Select the dollar value** from the grid
4. **Open for Answers** — teams can now submit on their phones (optional timer auto-closes)
5. **Close Answers** when ready (or let the timer close automatically)
6. **Grade** each team's answer with the checkmark (correct) or X (incorrect)
7. **Apply Scores** — points are added/subtracted and the scoreboard updates
8. **Next Question** — clears answers and gets ready for the next one

### Final Jeopardy
1. Switch to the **Final** round tab and set the category
2. Teams see the category on their phones and **lock in a wager** (up to their current score)
3. You can see each team's wager on the admin panel
4. When all wagers are in, click **Open for Answers** (reveal the question on your third-party display)
5. Grade and apply as usual — correct adds the wager, incorrect subtracts it

### Score adjustments
Click the **+/-** buttons next to any team's score on the scoreboard to manually adjust. A prompt lets you enter any positive or negative amount.

## Tips

- Teams that close their browser can rejoin with the same room code and team name — their score persists.
- The admin can rejoin an existing room using the "Rejoin Room" option on the setup screen.
- The question history panel at the bottom of the admin page logs every graded question for reference.
- No manual refresh needed — Firebase syncs changes to all devices automatically.
