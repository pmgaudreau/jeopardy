/* PDK NINE Trivia — Shared helpers (single source of truth) */

const AVATARS = [
    { id:'dragon',  name:'Dragon',     color:'#e63946' },
    { id:'wizard',  name:'Wizard',     color:'#7c3aed' },
    { id:'d20',     name:'Nat 20',     color:'#4a90d9' },
    { id:'castle',  name:'Castle',     color:'#f59e0b' },
    { id:'ghost',   name:'Ghastly',    color:'#a78bfa' },
    { id:'squid',   name:'Squidward',  color:'#f472b6' },
    { id:'shroom',  name:'Shroom',     color:'#dc2626' },
    { id:'octopus', name:'Tentacles',  color:'#e879f9' },
    { id:'fox',     name:'Vulpix',     color:'#f97316' },
    { id:'turtle',  name:'Squirtle',   color:'#38bdf8' },
    { id:'flame',   name:'Charizard',  color:'#fb923c' },
    { id:'crystal', name:'Nat 1',      color:'#8b5cf6' },
    { id:'shield',  name:'Paladin',    color:'#14b8a6' },
    { id:'skull',   name:'Necro',      color:'#64748b' },
    { id:'invader', name:'Invader',    color:'#6366f1' },
    { id:'jester',  name:'Jester',     color:'#facc15' },
    { id:'fancylad',name:'Fancy Lad',  color:'#a3e635' },
    { id:'brain',   name:'Big Brain',  color:'#fb7185' },
    { id:'cactus',  name:'Pokey',      color:'#4ade80' },
    { id:'ufo',     name:'X-Files',    color:'#22d3ee' },
];

function avatarImg(id, sz) {
    if (!id) return '';
    const style = typeof sz === 'string'
        ? 'width:' + sz + ';height:' + sz
        : 'width:' + (sz || 24) + 'px;height:' + (sz || 24) + 'px';
    const src = id.startsWith('data:') ? id : 'avatars/' + id + '.png';
    return '<img src="' + src + '" style="' + style + ';border-radius:50%;object-fit:cover;vertical-align:middle" alt="">';
}

function avatarColor(id) {
    const a = AVATARS.find(x => x.id === id);
    return a ? a.color : '#FFD700';
}

function normalizeQuotes(s) {
    if (s == null || typeof s !== 'string') return '';
    return s
        .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
        .replace(/[\u2018\u2019\u201A\u201B]/g, "'");
}

function defaultGameState() {
    return {
        round: 1, phase: 'board', category: '', value: 0, questionText: '',
        accepting: false, dailyDouble: false, ddTeam: '', questionKey: '',
        showQR: false, boardProjectorMode: 'gameStart',
        timerEnd: 0, timerRunning: false, answerRevealed: false,
        wageringOpen: false, imageUrl: '', boardControl: '', intermissionEnd: 0
    };
}

// Wraps a Firebase write so a failure surfaces to the user instead of
// silently dropping the action. Use for any host-initiated mutation.
function safeWrite(promise, errMsg) {
    return promise.catch(err => {
        const detail = err && err.message ? '\n\n' + err.message : '';
        alert((errMsg || 'Action failed. Check your connection and try again.') + detail);
        throw err;
    });
}
