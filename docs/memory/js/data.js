// Memory Kids — dati di gioco (categorie, modalità, livelli, premi, temi)

export const CATEGORIES = [
  { id: 'animali', name: 'Animali', icon: '🐶', color: ['#ffb36b', '#ff7eb6'],
    items: ['🐶','🐱','🐰','🐻','🐼','🐨','🦁','🐯','🐮','🐷','🐸','🐵','🐔','🐧','🦊','🐴','🦒','🐘','🦔','🐢'] },
  { id: 'fantasia', name: 'Unicorni e Magia', icon: '🦄', color: ['#c38bff', '#ff8ad8'],
    items: ['🦄','🐉','🐲','🧚‍♀️','🧜‍♀️','🧞‍♀️','🧙‍♀️','🧝‍♀️','🪄','🌈','🏰','🔮','💫','🦋','🍄','🎠','💎','🌙'] },
  { id: 'principesse', name: 'Principesse', icon: '👸', color: ['#ff9ad5', '#ffc76b'],
    items: ['👸','👑','💍','🏰','👗','👠','🪞','💄','🎀','🌹','💐','🦢','🩰','👛','🫖','🎻','🍰','👒'] },
  { id: 'dinosauri', name: 'Dinosauri', icon: '🦕', color: ['#7ee08a', '#3fbfa6'],
    items: ['🦕','🦖','🐊','🦎','🐢','🥚','🌋','🦴','🌴','🪨','🦣','🐍','🦤','🪺','🌿','🐚','☄️','🐸'] },
  { id: 'frutta', name: 'Frutta e Verdura', icon: '🍓', color: ['#ff7b7b', '#ffd25e'],
    items: ['🍎','🍌','🍇','🍓','🍉','🍊','🍍','🥝','🍒','🍑','🍐','🥕','🌽','🥦','🍅','🍆','🥑','🥒','🫐','🍋'] },
  { id: 'dolci', name: 'Dolci e Gelati', icon: '🍦', color: ['#ffa3c8', '#a98bff'],
    items: ['🍦','🍨','🍧','🍰','🎂','🧁','🍩','🍪','🍫','🍬','🍭','🍮','🥧','🍯','🥞','🧇','🍡','🥨'] },
  { id: 'mare', name: 'Animali Marini', icon: '🐠', color: ['#5ec8ff', '#4f7dff'],
    items: ['🐠','🐟','🐡','🐬','🐳','🐋','🦈','🐙','🦑','🦀','🦞','🦐','🐚','🐢','🦭','🦦','🪸','🌊','⚓','🏝️'] },
  { id: 'emoji', name: 'Faccine', icon: '😀', color: ['#ffd84d', '#ff9a3d'],
    items: ['😀','😂','😍','😎','🤩','😜','🥳','😴','🤗','🤔','😇','🤠','😋','🤓','😮','😊','🙃','😺'] },
  { id: 'natura', name: 'Fiori e Natura', icon: '🌻', color: ['#8be06b', '#ffd35c'],
    items: ['🌸','🌻','🌹','🌷','🌼','🌺','🍀','🌳','🌲','🌵','🍁','🍂','🌾','☀️','⛅','🐞','🐝','🦋','🐌','🌈'] },
  { id: 'oggetti', name: 'Oggetti di Casa', icon: '🎒', color: ['#6bd6ff', '#9e8bff'],
    items: ['⏰','📱','💡','🔑','✏️','📚','🎒','✂️','🧸','🪥','🧦','👟','🎈','☂️','🛁','🪑','🖍️','🧽','🥄','🚲'] },
  { id: 'spazio', name: 'Spazio e Pianeti', icon: '🚀', color: ['#6f6bff', '#2b2f8f'],
    items: ['🚀','🌍','🌙','☀️','⭐','🪐','☄️','🛸','👽','👩‍🚀','🔭','🛰️','🌌','🌠','🌑','🌕','💫','🌞'] },
  { id: 'personaggi', name: 'Personaggi Buffi', icon: '🤖', color: ['#ff8f6b', '#ff5fa2'],
    items: ['🤖','👻','🎅','🦸‍♀️','🧑‍🍳','👷‍♀️','👩‍🎤','👨‍🎨','👩‍🚒','🧑‍🔬','🕵️‍♀️','💂','🧑‍🌾','👩‍🏫','🤹','🏄‍♀️','⛄','🐣'] },
];

export const MODES = [
  { id: 'classic', name: 'Classica', icon: '🃏', color: ['#ff7eb6', '#ff9f5a'],
    desc: 'Trova tutte le coppie uguali!' },
  { id: 'time', name: 'A Tempo', icon: '⏱️', color: ['#5ec8ff', '#6f6bff'],
    desc: 'Trova le coppie prima che finisca il tempo!' },
  { id: 'challenge', name: 'Sfida', icon: '🏔️', color: ['#ffb84d', '#ff6b6b'],
    desc: 'Tappe sempre più difficili. Arriva in cima!' },
  { id: 'relax', name: 'Relax', icon: '🌙', color: ['#8be0c4', '#6bb8ff'],
    desc: 'Niente orologio, niente fretta. Solo gioco!' },
  { id: 'super', name: 'Super Memory', icon: '🧠', color: ['#c38bff', '#6f6bff'],
    desc: 'Tantissime carte per una memoria da campioni!' },
];

// Livelli comuni a Classica, A Tempo e Relax
export const LEVELS = [
  { n: 1, cards: 6 },
  { n: 2, cards: 8 },
  { n: 3, cards: 12 },
  { n: 4, cards: 16 },
  { n: 5, cards: 20 },
  { n: 6, cards: 24 },
  { n: 7, cards: 30 },
];

// Super Memory: più carte e categorie mescolate
export const SUPER_LEVELS = [
  { n: 1, cards: 24, mix: 2 },
  { n: 2, cards: 30, mix: 3 },
  { n: 3, cards: 36, mix: 4 },
  { n: 4, cards: 40, mix: 6 },
];

// Sfida: tappe con difficoltà crescente. preview = secondi in cui le carte si vedono all'inizio
export const CHALLENGE_STAGES = [
  { n: 1, cards: 6, preview: 3 },
  { n: 2, cards: 8, preview: 3 },
  { n: 3, cards: 8, preview: 2 },
  { n: 4, cards: 12, preview: 3 },
  { n: 5, cards: 12, preview: 2 },
  { n: 6, cards: 16, preview: 2 },
  { n: 7, cards: 16, preview: 1 },
  { n: 8, cards: 20, preview: 2 },
  { n: 9, cards: 20, preview: 1 },
  { n: 10, cards: 24, preview: 1 },
  { n: 11, cards: 24, preview: 0 },
  { n: 12, cards: 30, preview: 0 },
];

export function timeLimitFor(pairs) {
  return 20 + pairs * 7; // secondi, generosi per bambini
}

export const RANKS = [
  { xp: 0, name: 'Semino', icon: '🌱' },
  { xp: 150, name: 'Germoglio', icon: '🌿' },
  { xp: 400, name: 'Fiorellino', icon: '🌼' },
  { xp: 800, name: 'Farfalla', icon: '🦋' },
  { xp: 1400, name: 'Stellina', icon: '⭐' },
  { xp: 2200, name: 'Cometa', icon: '☄️' },
  { xp: 3300, name: 'Arcobaleno', icon: '🌈' },
  { xp: 4800, name: 'Supernova', icon: '🌟' },
  { xp: 6800, name: 'Leggenda della Memoria', icon: '👑' },
];

export const THEMES = [
  { id: 'arcobaleno', name: 'Arcobaleno', icon: '🌈', stars: 0,
    bg: ['#ffd1ec', '#c9e7ff', '#d8ffd6'], back: ['#a06bff', '#ff6bb5'], pattern: '⭐' },
  { id: 'caramella', name: 'Caramella', icon: '🍬', stars: 8,
    bg: ['#ffe0f0', '#ffd6e8', '#fff1c9'], back: ['#ff5fa2', '#ffb04d'], pattern: '💗' },
  { id: 'oceano', name: 'Oceano', icon: '🐳', stars: 20,
    bg: ['#c9f1ff', '#a9dcff', '#d6fff4'], back: ['#2fa8ff', '#21d4b4'], pattern: '🫧' },
  { id: 'foresta', name: 'Bosco Magico', icon: '🍄', stars: 40,
    bg: ['#e2ffd1', '#c8f5d0', '#fff6c9'], back: ['#3fbf6b', '#a3d94a'], pattern: '🍀' },
  { id: 'notte', name: 'Notte Stellata', icon: '🌙', stars: 65,
    bg: ['#3a2f86', '#5d3fa8', '#2b4f9e'], back: ['#ffcd4d', '#ff8a4d'], pattern: '🌙', dark: true },
  { id: 'unicorno', name: 'Unicorno', icon: '🦄', stars: 95,
    bg: ['#f3d6ff', '#ffd6f0', '#d6f0ff'], back: ['#d36bff', '#6bc5ff'], pattern: '🦄' },
  { id: 'oro', name: 'Tesoro d\'Oro', icon: '👑', stars: 140,
    bg: ['#fff4c2', '#ffe08a', '#ffd1a6'], back: ['#f2b100', '#ff7a00'], pattern: '👑' },
];

// Medaglie: piccoli traguardi
export const MEDALS = [
  { id: 'first', icon: '🎉', name: 'Prima Partita', desc: 'Completa la tua prima partita' },
  { id: 'games5', icon: '🥉', name: 'Giocatore', desc: 'Completa 5 partite' },
  { id: 'games25', icon: '🥈', name: 'Appassionato', desc: 'Completa 25 partite' },
  { id: 'games60', icon: '🥇', name: 'Instancabile', desc: 'Completa 60 partite' },
  { id: 'threeStars', icon: '⭐', name: 'Tre Stelle', desc: 'Prendi 3 stelle in una partita' },
  { id: 'perfect', icon: '💎', name: 'Memoria Perfetta', desc: 'Finisci una partita (almeno 8 carte) senza nessun errore' },
  { id: 'combo3', icon: '🔥', name: 'Combo x3', desc: 'Trova 3 coppie di fila' },
  { id: 'combo5', icon: '⚡', name: 'Combo x5', desc: 'Trova 5 coppie di fila' },
  { id: 'speedy', icon: '🐇', name: 'Velocissimo', desc: 'Finisci una partita da 12+ carte in meno di 40 secondi' },
  { id: 'timeWin', icon: '⏱️', name: 'Batti il Tempo', desc: 'Vinci una partita A Tempo' },
  { id: 'relaxed', icon: '🌙', name: 'Tutto Tranquillo', desc: 'Completa una partita Relax' },
  { id: 'superOne', icon: '🧠', name: 'Super Cervello', desc: 'Completa una partita Super Memory' },
  { id: 'cats6', icon: '🧭', name: 'Esploratore', desc: 'Gioca con 6 categorie diverse' },
  { id: 'cats12', icon: '🗺️', name: 'Giramondo', desc: 'Gioca con tutte le 12 categorie' },
  { id: 'pairs100', icon: '🃏', name: '100 Coppie', desc: 'Trova 100 coppie in totale' },
  { id: 'pairs500', icon: '🎴', name: '500 Coppie', desc: 'Trova 500 coppie in totale' },
  { id: 'challenge6', icon: '⛺', name: 'A Metà Montagna', desc: 'Supera la tappa 6 della Sfida' },
  { id: 'theme', icon: '🎨', name: 'Stilista', desc: 'Sblocca un nuovo tema' },
];

// Trofei: grandi traguardi
export const TROPHIES = [
  { id: 'allLevels', icon: '🏆', name: 'Trofeo dei Livelli', desc: 'Completa tutti i 7 livelli' },
  { id: 'champion', icon: '🏅', name: 'Trofeo del Campione', desc: '3 stelle in tutti i livelli Classica' },
  { id: 'summit', icon: '🏔️', name: 'Trofeo della Vetta', desc: 'Completa tutte le 12 tappe della Sfida' },
  { id: 'superAll', icon: '🧠', name: 'Trofeo Super Memory', desc: 'Completa tutti i livelli Super Memory' },
  { id: 'stars150', icon: '🌟', name: 'Trofeo delle Stelle', desc: 'Raccogli 150 stelle' },
  { id: 'legend', icon: '👑', name: 'Trofeo Leggenda', desc: 'Diventa Leggenda della Memoria' },
];

export const MSG = {
  welcome: ['Ciao! Giochiamo insieme? 😊', 'Che bello rivederti! 🌈', 'Pronta per una nuova avventura? ✨', 'Allena la memoria con me! 🧠'],
  start: ['Trova le coppie uguali!', 'Gira due carte alla volta!', 'Forza, ce la fai! 💪', 'Ricorda dove sono le carte!'],
  match: ['Evviva! 🎉', 'Super! ⭐', 'Che memoria! 🧠', 'Fantastico! ✨', 'Grande! 💪', 'Bravissima! 🌟', 'Perfetto! 💖', 'Wow! 🤩'],
  combo: ['Sei inarrestabile! 🔥', 'Un\'altra di fila! ⚡', 'Combo magica! 🌈'],
  miss: ['Quasi! Riprova 😊', 'Ricordati dove sono! 👀', 'Non importa, continua! 💪', 'Ora sai dove sono! 😉', 'Ci sei quasi! ✨'],
  win: ['Ce l\'hai fatta! 🏆', 'Sei una campionessa! 🌟', 'Che bravura! 🎉', 'Memoria fantastica! 🧠'],
  timeUp: ['Il tempo è finito, ma sei stata bravissima! 💖', 'Hai fatto un ottimo lavoro! Vuoi altro tempo? ⏰'],
  pause: ['Una pausa ci vuole! ☕', 'Ti aspetto qui! 😊'],
};
