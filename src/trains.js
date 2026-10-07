/* Train art: a steam locomotive and one wagon type per card colour, as small inline SVGs (viewBox 48x24).
 * Shapes use currentColor, so each card tints them; light details sit on top. */
(function (root) {
  'use strict';
  const LIGHT = 'fill="#fff" opacity=".72"';
  const chassis = (a, b) => `<rect x="3" y="17" width="42" height="1.8" rx=".6"/><rect x="1" y="16.6" width="3" height="1.2"/><rect x="44" y="16.6" width="3" height="1.2"/>`
    + [a, b].map((x) => `<circle cx="${x - 3.4}" cy="20.4" r="2.6"/><circle cx="${x + 3.4}" cy="20.4" r="2.6"/>`).join('');
  const hub = (xs) => xs.map((x) => `<circle cx="${x}" cy="20.4" r="0.9" ${LIGHT}/>`).join('');
  const svg = (inner) => `<svg viewBox="0 0 48 24" aria-hidden="true" class="train-art">${inner}</svg>`;

  const LOCO = svg(`<g fill="currentColor">
      <path d="M1.5 19.2 6.5 14h2.6v5.2z"/>
      <rect x="8" y="8.6" width="23" height="8.4" rx="3.6"/>
      <rect x="9.4" y="2.8" width="3.8" height="6.6"/><path d="M8 2.9h6.6l-1-2h-4.6z"/>
      <path d="M16.6 8.8a3.1 3.1 0 016.2 0z"/><path d="M24.2 8.8a2.3 2.3 0 014.6 0z"/>
      <rect x="30" y="4.4" width="13.4" height="12.8" rx="1"/><rect x="28.6" y="2.8" width="16.2" height="2.2" rx="1"/>
      <rect x="5.5" y="16.4" width="40" height="1.9"/>
      <circle cx="12" cy="20.6" r="2.5"/><circle cx="21" cy="19.8" r="3.6"/><circle cx="30.2" cy="19.8" r="3.6"/><circle cx="40.4" cy="20.6" r="2.5"/></g>
    <rect x="33" y="6.6" width="7.4" height="5" rx=".7" ${LIGHT}/><circle cx="7.6" cy="11.6" r="1.4" fill="#ffe7a0"/>
    <path d="M21 19.8h9.2" stroke="#fff" stroke-width=".9" opacity=".7"/><circle cx="21" cy="19.8" r="1.2" ${LIGHT}/><circle cx="30.2" cy="19.8" r="1.2" ${LIGHT}/>
    <path d="M10 11.5h19" stroke="#fff" stroke-width=".5" opacity=".35"/>`);

  // purple: passenger coach, white: refrigerator van, blue: tank car, yellow: box car, orange: hopper,
  // black: coal wagon, red: caboose, green: flat car with logs.
  const WAGONS = [
    svg(`<g fill="currentColor"><path d="M4 16.6V7.4Q4 5 7 4.6L24 3.6l17 1q3 .4 3 2.8v9.2z"/>${chassis(13, 35)}</g>`
      + [8, 14, 20, 26, 32, 38].map((x) => `<rect x="${x}" y="7.4" width="3.6" height="4.4" rx=".6" ${LIGHT}/>`).join('') + `<path d="M5 13.4h38" stroke="#fff" stroke-width=".6" opacity=".45"/>${hub([9.6, 16.4, 31.6, 38.4])}`),
    svg(`<g fill="currentColor"><rect x="4" y="4.6" width="40" height="12" rx="1.2"/><rect x="3.2" y="3.4" width="41.6" height="2" rx=".8"/>${chassis(13, 35)}</g>`
      + `<rect x="7" y="7" width="34" height="2" ${LIGHT}/><rect x="20.5" y="9.6" width="7" height="6" rx=".5" fill="#fff" opacity=".45"/><path d="M7 12.6h12M29 12.6h12" stroke="#fff" stroke-width=".6" opacity=".5"/>${hub([9.6, 16.4, 31.6, 38.4])}`),
    svg(`<g fill="currentColor"><rect x="4" y="6.6" width="40" height="9.6" rx="4.8"/><rect x="21" y="3.4" width="6" height="4" rx="1"/><rect x="19.8" y="2.8" width="8.4" height="1.4" rx=".6"/>${chassis(13, 35)}</g>`
      + `<path d="M8 9.2h32" stroke="#fff" stroke-width="1.1" opacity=".55"/><path d="M14 7v9M34 7v9" stroke="#fff" stroke-width=".5" opacity=".4"/>${hub([9.6, 16.4, 31.6, 38.4])}`),
    svg(`<g fill="currentColor"><rect x="4" y="4.6" width="40" height="12" rx=".8"/><path d="M3.4 4.8 24 2.6l20.6 2.2z"/>${chassis(13, 35)}</g>`
      + `<rect x="19.6" y="6.4" width="8.8" height="9.6" fill="#fff" opacity=".28"/><path d="M19.6 6.4l8.8 9.6M28.4 6.4l-8.8 9.6" stroke="#fff" stroke-width=".6" opacity=".55"/>`
      + [8, 12, 16, 32, 36, 40].map((x) => `<path d="M${x} 5.4v10.8" stroke="#fff" stroke-width=".45" opacity=".35"/>`).join('') + hub([9.6, 16.4, 31.6, 38.4])),
    svg(`<g fill="currentColor"><path d="M3.4 5.2h41.2l-4 9.4-4.4 2.2H12l-4.4-2.2z"/>${chassis(13, 35)}</g>`
      + `<path d="M9 7.8h30" stroke="#fff" stroke-width="1" opacity=".5"/><path d="M15 9v7M24 9v7.4M33 9v7" stroke="#fff" stroke-width=".55" opacity=".4"/>${hub([9.6, 16.4, 31.6, 38.4])}`),
    svg(`<g fill="currentColor"><rect x="4" y="9" width="40" height="7.6" rx=".6"/><path d="M6 9.4q3-4.6 6-2 3-3.6 6-.6 3-4.2 6-1.4 3-3.4 6-.2 3-4 6-1.4 3-2.6 6 .6z" opacity=".85"/>${chassis(13, 35)}</g>`
      + `<path d="M5 12.6h38" stroke="#fff" stroke-width=".7" opacity=".5"/><path d="M14 9.6v6.6M24 9.6v6.6M34 9.6v6.6" stroke="#fff" stroke-width=".5" opacity=".35"/>${hub([9.6, 16.4, 31.6, 38.4])}`),
    svg(`<g fill="currentColor"><rect x="7" y="7.2" width="34" height="9.6" rx=".8"/><path d="M5.6 7.6 24 5.6l18.4 2z"/><rect x="18" y="2" width="12" height="5" rx=".6"/><path d="M17 2.2h14l-1-1.6H18z"/>`
      + `<rect x="4" y="12" width="3.4" height="4.8"/><rect x="40.6" y="12" width="3.4" height="4.8"/>${chassis(15, 33)}</g>`
      + `<rect x="20" y="3.2" width="3.4" height="2.4" ${LIGHT}/><rect x="24.6" y="3.2" width="3.4" height="2.4" ${LIGHT}/><rect x="10" y="9" width="4.4" height="3.6" rx=".5" ${LIGHT}/><rect x="33.6" y="9" width="4.4" height="3.6" rx=".5" ${LIGHT}/><rect x="21.6" y="9" width="4.8" height="7.8" rx=".5" fill="#fff" opacity=".35"/>${hub([11.6, 18.4, 29.6, 36.4])}`),
    svg(`<g fill="currentColor"><rect x="3" y="13.4" width="42" height="3.4" rx=".6"/><rect x="5" y="6" width="1.8" height="7.6"/><rect x="41.2" y="6" width="1.8" height="7.6"/>${chassis(13, 35)}</g>`
      + [[11, 11.2], [18.4, 11.2], [25.8, 11.2], [33.2, 11.2], [14.7, 7.6], [22.1, 7.6], [29.5, 7.6]].map(([x, y]) => `<circle cx="${x + 1.6}" cy="${y}" r="3.6" fill="currentColor"/><circle cx="${x + 1.6}" cy="${y}" r="1.5" fill="#fff" opacity=".55"/>`).join('') + hub([9.6, 16.4, 31.6, 38.4])),
  ];

  root.TrainArt = { LOCO, WAGONS, icon: (c) => (c === 8 ? LOCO : WAGONS[c] || LOCO) };
})(typeof self !== 'undefined' ? self : this);
