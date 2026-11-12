// Memory Kids — "Stellina", la mascotte originale del gioco (SVG disegnato in codice)

function starPoints(cx, cy, R, r, n = 5) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const ang = -Math.PI / 2 + (i * Math.PI) / n;
    const rad = i % 2 === 0 ? R : r;
    pts.push(`${(cx + rad * Math.cos(ang)).toFixed(1)},${(cy + rad * Math.sin(ang)).toFixed(1)}`);
  }
  return pts.join(' ');
}

let uid = 0;

export function mascotSVG() {
  const id = `m${uid++}`;
  const pts = starPoints(100, 112, 80, 46);
  return `
<svg class="mascot-svg" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <radialGradient id="${id}g" cx="40%" cy="35%" r="75%">
      <stop offset="0" stop-color="#fff6a8"/>
      <stop offset=".55" stop-color="#ffd23f"/>
      <stop offset="1" stop-color="#ffa62b"/>
    </radialGradient>
    <linearGradient id="${id}b" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ff8ad8"/><stop offset="1" stop-color="#ff4f9a"/>
    </linearGradient>
  </defs>
  <ellipse class="m-shadow" cx="100" cy="192" rx="46" ry="6" fill="rgba(60,30,90,.18)"/>
  <g class="m-body">
    <polygon points="${pts}" fill="#ffa62b" stroke="#ffa62b" stroke-width="26" stroke-linejoin="round"/>
    <polygon points="${pts}" fill="url(#${id}g)" stroke="url(#${id}g)" stroke-width="18" stroke-linejoin="round"/>
    <ellipse cx="72" cy="78" rx="14" ry="8" fill="#fff" opacity=".55" transform="rotate(-30 72 78)"/>
    <!-- fiocco -->
    <g class="m-bow" transform="translate(132 46) rotate(20)">
      <path d="M0 0 L-22 -14 Q-28 0 -22 14 Z" fill="url(#${id}b)"/>
      <path d="M0 0 L22 -14 Q28 0 22 14 Z" fill="url(#${id}b)"/>
      <circle r="7" fill="#ff4f9a"/><circle r="3" cx="-2" cy="-2" fill="#ffc2e4"/>
    </g>
    <!-- guance -->
    <ellipse cx="66" cy="128" rx="11" ry="7" fill="#ff7eb6" opacity=".6"/>
    <ellipse cx="134" cy="128" rx="11" ry="7" fill="#ff7eb6" opacity=".6"/>
    <!-- occhi aperti -->
    <g class="m-eyes">
      <ellipse cx="80" cy="108" rx="10" ry="13" fill="#3b2a4f"/>
      <ellipse cx="120" cy="108" rx="10" ry="13" fill="#3b2a4f"/>
      <circle cx="84" cy="102" r="4.5" fill="#fff"/><circle cx="124" cy="102" r="4.5" fill="#fff"/>
      <circle cx="77" cy="113" r="2" fill="#fff"/><circle cx="117" cy="113" r="2" fill="#fff"/>
    </g>
    <!-- occhi felici chiusi -->
    <g class="m-eyes-happy" fill="none" stroke="#3b2a4f" stroke-width="5" stroke-linecap="round">
      <path d="M70 110 Q80 98 90 110"/><path d="M110 110 Q120 98 130 110"/>
    </g>
    <!-- bocche -->
    <path class="m-mouth m-smile" d="M88 128 Q100 142 112 128" fill="none" stroke="#3b2a4f" stroke-width="5" stroke-linecap="round"/>
    <g class="m-mouth m-open">
      <path d="M86 126 Q100 152 114 126 Z" fill="#7a2547" stroke="#3b2a4f" stroke-width="4" stroke-linejoin="round"/>
      <path d="M93 136 Q100 144 107 136 Q100 132 93 136Z" fill="#ff7b9c"/>
    </g>
    <ellipse class="m-mouth m-wow" cx="100" cy="134" rx="7" ry="9" fill="#7a2547" stroke="#3b2a4f" stroke-width="4"/>
  </g>
  <g class="m-sparkles" fill="#fff">
    <path d="M22 50 l4 10 l10 4 l-10 4 l-4 10 l-4 -10 l-10 -4 l10 -4z" fill="#ffd23f"/>
    <path d="M176 92 l3 7 l7 3 l-7 3 l-3 7 l-3 -7 l-7 -3 l7 -3z" fill="#ff8ad8"/>
    <path d="M168 20 l3 7 l7 3 l-7 3 l-3 7 l-3 -7 l-7 -3 l7 -3z" fill="#7ad7ff"/>
  </g>
</svg>`;
}

/** Crea l'elemento mascotte con nuvoletta. */
export function createMascot(el) {
  el.classList.add('mascot', 'mood-smile');
  el.innerHTML = `${mascotSVG()}<div class="bubble" role="status" aria-live="polite"></div>`;
  const bubble = el.querySelector('.bubble');
  let hideT = null;
  let moodT = null;
  return {
    say(text, ms = 2600) {
      bubble.textContent = text;
      bubble.classList.remove('show');
      void bubble.offsetWidth;
      bubble.classList.add('show');
      clearTimeout(hideT);
      if (ms) hideT = setTimeout(() => bubble.classList.remove('show'), ms);
    },
    hush() { bubble.classList.remove('show'); },
    mood(m, ms = 1400) {
      el.classList.remove('mood-smile', 'mood-happy', 'mood-wow', 'mood-open');
      el.classList.add(`mood-${m}`);
      clearTimeout(moodT);
      if (ms) moodT = setTimeout(() => this.mood('smile', 0), ms);
    },
    act(anim) {
      el.classList.remove('jump', 'dance', 'shake', 'spin');
      void el.offsetWidth;
      el.classList.add(anim);
    },
  };
}
