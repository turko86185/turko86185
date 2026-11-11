/** "Golino", la mascotte originale del gioco: un pallone simpatico con cappellino e braccino che saluta */
export function Mascot({ size }: { size?: number }) {
  return (
    <svg className="mascot" viewBox="0 0 300 330" style={size ? { width: size } : undefined} aria-label="Golino la mascotte">
      <ellipse cx="150" cy="318" rx="80" ry="10" fill="rgba(0,0,0,0.25)" />
      {/* gambe */}
      <rect x="112" y="250" width="22" height="55" rx="10" fill="#1d3557" />
      <rect x="166" y="250" width="22" height="55" rx="10" fill="#1d3557" />
      <ellipse cx="118" cy="306" rx="24" ry="11" fill="#e63946" />
      <ellipse cx="182" cy="306" rx="24" ry="11" fill="#e63946" />
      {/* braccio sinistro */}
      <rect x="40" y="170" width="60" height="18" rx="9" fill="#ffd23f" transform="rotate(25 70 179)" />
      <circle cx="40" cy="196" r="14" fill="#fff" stroke="#333" strokeWidth="3" />
      {/* braccio che saluta */}
      <g className="arm">
        <rect x="200" y="110" width="18" height="75" rx="9" fill="#ffd23f" transform="rotate(30 209 182)" />
        <circle cx="248" cy="112" r="16" fill="#fff" stroke="#333" strokeWidth="3" />
      </g>
      {/* corpo-pallone */}
      <circle cx="150" cy="160" r="105" fill="#fff" stroke="#222" strokeWidth="5" />
      <polygon points="150,95 178,116 168,148 132,148 122,116" fill="#222" />
      <polygon points="70,140 92,128 104,152 92,176 68,170" fill="#222" />
      <polygon points="230,140 208,128 196,152 208,176 232,170" fill="#222" />
      <polygon points="110,232 130,214 170,214 190,232 150,258" fill="#222" />
      {/* occhi */}
      <ellipse cx="122" cy="178" rx="20" ry="24" fill="#fff" stroke="#222" strokeWidth="4" />
      <ellipse cx="178" cy="178" rx="20" ry="24" fill="#fff" stroke="#222" strokeWidth="4" />
      <circle cx="127" cy="182" r="10" fill="#1d3557" />
      <circle cx="173" cy="182" r="10" fill="#1d3557" />
      <circle cx="131" cy="177" r="4" fill="#fff" />
      <circle cx="177" cy="177" r="4" fill="#fff" />
      {/* bocca */}
      <path d="M118 210 Q150 245 182 210 Q150 228 118 210 Z" fill="#c1121f" stroke="#222" strokeWidth="4" />
      {/* guance */}
      <circle cx="96" cy="206" r="10" fill="#ff8fa3" opacity="0.7" />
      <circle cx="204" cy="206" r="10" fill="#ff8fa3" opacity="0.7" />
      {/* cappellino */}
      <path d="M70 105 Q150 20 230 105 Z" fill="#2a9d8f" stroke="#1b4d46" strokeWidth="4" />
      <path d="M210 100 Q270 100 280 118 Q240 118 205 112 Z" fill="#2a9d8f" stroke="#1b4d46" strokeWidth="4" />
      <circle cx="150" cy="48" r="10" fill="#ffd23f" />
      <text x="150" y="92" textAnchor="middle" fontSize="26" fontWeight="900" fill="#ffd23f" fontFamily="Arial">A</text>
    </svg>
  );
}
