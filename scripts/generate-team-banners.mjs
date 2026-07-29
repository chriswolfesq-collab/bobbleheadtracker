// Builds public/team-banners/<slug>.png — the 2400x1000 skyline card that heads
// each team page (app/teams/[slug]/TeamPageClient.tsx). Every card is drawn as
// SVG and rasterized with sharp; there are no source photos to keep in sync.
//
// Run:  node scripts/generate-team-banners.mjs [slug ...]
//       (no args regenerates all 30 and writes a contact sheet to $TMPDIR)
//
// The est. year, city, team name and division are read straight out of
// lib/teams.ts, so the baked-in type can never drift from what the page renders
// beside it. Change a team's data there and re-run this — don't edit the PNGs.
//
// Each team below owns a seed and a scene() that composes the shared landmark
// primitives (bridges, mountains, palms, domes...). The seed drives every random
// building height and lit window, so re-running produces byte-identical art.
import { readFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const W = 2400, H = 1000;
const OUT = join(root, 'public', 'team-banners');
await mkdir(OUT, { recursive: true });

// ---------- utils ----------
function rng(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
const esc = s => s.replace(/&/g, '&amp;');

// ---------- sky palettes ----------
const SKIES = {
  sunsetOrange: ['#141b33', '#3a2a55', '#8a3f52', '#d96c3a', '#f5a85c'],
  goldSunset:   ['#1a1f38', '#4a3054', '#a85a48', '#e08840', '#f7c065'],
  duskPink:     ['#1b2140', '#4a3468', '#95486a', '#d9705c', '#f2a878'],
  redSunset:    ['#20142e', '#58263e', '#a03a40', '#d96038', '#f09a50'],
  nightBlue:    ['#0d1330', '#16204a', '#243566', '#3a4c80', '#5a6c9a'],
  deepNight:    ['#0a0f26', '#121a3c', '#1e2a54', '#2e3c6a', '#4a5580'],
  nightMono:    ['#15171c', '#22252c', '#33373f', '#4a4e57', '#666b74'],
  tealDusk:     ['#0f2038', '#1a3a55', '#2e5a70', '#57808c', '#8aab9f'],
  purpleDusk:   ['#191138', '#3a2260', '#6a3a78', '#a05578', '#d98868'],
};

function skyDefs(stops) {
  const pct = [0, 30, 55, 75, 100];
  return `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">${stops
    .map((c, i) => `<stop offset="${pct[i]}%" stop-color="${c}"/>`).join('')}</linearGradient>`;
}
function stars(r, n, maxY, op = 0.9) {
  let s = '';
  for (let i = 0; i < n; i++) {
    const x = r() * W, y = r() * maxY, rad = r() * 2 + 0.8;
    s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rad.toFixed(1)}" fill="#fff" opacity="${(r() * 0.5 + 0.2) * op}"/>`;
  }
  return s;
}
function sunGlow(cx, cy, rad, color, op = 0.75) {
  return `<radialGradient id="glow${cx}" cx="50%" cy="50%" r="50%">
    <stop offset="0%" stop-color="${color}" stop-opacity="${op}"/>
    <stop offset="100%" stop-color="${color}" stop-opacity="0"/></radialGradient>
    <ellipse cx="${cx}" cy="${cy}" rx="${rad}" ry="${rad * 0.6}" fill="url(#glow${cx})"/>`;
}
function clouds(r, n, y0, y1, color, op) {
  let s = '';
  for (let i = 0; i < n; i++) {
    const cx = r() * W, cy = y0 + r() * (y1 - y0), rx = 180 + r() * 320, ry = 14 + r() * 22;
    s += `<ellipse cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" rx="${rx.toFixed(0)}" ry="${ry.toFixed(0)}" fill="${color}" opacity="${(op * (0.5 + r() * 0.5)).toFixed(2)}"/>`;
  }
  return s;
}

// ---------- skyline ----------
// Procedural building strip. Returns svg string.
function buildings(r, { x0 = 0, x1 = W, baseY, minH = 120, maxH = 380, minW = 55, maxW = 130, color, winColor = '#ffd97a', winP = 0.5, gap = 6, spires = true, winOp = 0.9 }) {
  let s = '', x = x0;
  while (x < x1) {
    const bw = minW + r() * (maxW - minW);
    const bh = minH + r() * (maxH - minH);
    const by = baseY - bh;
    s += `<rect x="${x.toFixed(0)}" y="${by.toFixed(0)}" width="${bw.toFixed(0)}" height="${bh.toFixed(0)}" fill="${color}"/>`;
    // rooftop details
    const roof = r();
    if (spires && roof < 0.18) {
      s += `<rect x="${(x + bw / 2 - 3).toFixed(0)}" y="${(by - 30 - r() * 45).toFixed(0)}" width="6" height="80" fill="${color}"/>`;
    } else if (roof < 0.36) {
      s += `<rect x="${(x + bw * 0.2).toFixed(0)}" y="${(by - 14).toFixed(0)}" width="${(bw * 0.6).toFixed(0)}" height="16" fill="${color}"/>`;
    }
    if (winColor && winP > 0) {
      const cw = 9, ch = 12, gx = 20, gy = 26;
      const cols = Math.floor((bw - 20) / gx), rows = Math.floor((bh - 26) / gy);
      let wins = '';
      for (let c = 0; c < cols; c++)
        for (let rr = 0; rr < rows; rr++)
          if (r() < winP) {
            wins += `M${(x + 14 + c * gx).toFixed(0)} ${(by + 14 + rr * gy).toFixed(0)}h${cw}v${ch}h-${cw}z`;
          }
      if (wins) s += `<path d="${wins}" fill="${winColor}" opacity="${winOp}"/>`;
    }
    x += bw + gap + r() * 26;
  }
  return s;
}
function water(y0, top, bottom, r, lightColor = '#ffd97a', nLights = 60) {
  let s = `<linearGradient id="water" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="${top}"/><stop offset="100%" stop-color="${bottom}"/></linearGradient>
    <rect x="0" y="${y0}" width="${W}" height="${H - y0}" fill="url(#water)"/>`;
  for (let i = 0; i < nLights; i++) {
    const x = r() * W, len = 30 + r() * 110, y = y0 + 4 + r() * (H - y0 - 30);
    const w = 5 + r() * 9;
    s += `<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${w.toFixed(1)}" height="${len.toFixed(0)}" rx="${(w / 2).toFixed(1)}" fill="${lightColor}" opacity="${(0.05 + r() * 0.13).toFixed(2)}"/>`;
  }
  // horizontal ripple bands soften the reflections
  for (let i = 0; i < 26; i++) {
    const y = y0 + r() * (H - y0), rx = 200 + r() * 500;
    s += `<ellipse cx="${(r() * W).toFixed(0)}" cy="${y.toFixed(0)}" rx="${rx.toFixed(0)}" ry="${(2 + r() * 4).toFixed(1)}" fill="${lightColor}" opacity="${(0.04 + r() * 0.07).toFixed(2)}"/>`;
  }
  s += `<rect x="0" y="${y0}" width="${W}" height="5" fill="#000" opacity="0.35"/>`;
  return s;
}

// ---------- landmarks ----------
function suspensionBridge({ x0, x1, y, towerH = 210, color, deckH = 14, sag = 0.55 }) {
  const t1 = x0 + (x1 - x0) * 0.28, t2 = x0 + (x1 - x0) * 0.72;
  const sagY = y - towerH * (1 - sag);
  let s = `<rect x="${x0}" y="${y - deckH}" width="${x1 - x0}" height="${deckH}" fill="${color}"/>`;
  for (const t of [t1, t2]) {
    s += `<rect x="${t - 10}" y="${y - towerH}" width="20" height="${towerH}" fill="${color}"/>
          <rect x="${t - 16}" y="${y - towerH}" width="32" height="12" fill="${color}"/>`;
  }
  s += `<path d="M${x0} ${y - towerH * 0.55} Q ${(x0 + t1) / 2} ${sagY + towerH * 0.28} ${t1} ${y - towerH}" stroke="${color}" stroke-width="7" fill="none"/>`;
  s += `<path d="M${t1} ${y - towerH} Q ${(t1 + t2) / 2} ${sagY} ${t2} ${y - towerH}" stroke="${color}" stroke-width="7" fill="none"/>`;
  s += `<path d="M${t2} ${y - towerH} Q ${(t2 + x1) / 2} ${sagY + towerH * 0.28} ${x1} ${y - towerH * 0.55}" stroke="${color}" stroke-width="7" fill="none"/>`;
  // suspenders (mid span)
  for (let i = 1; i < 10; i++) {
    const x = t1 + ((t2 - t1) * i) / 10;
    const tt = (x - t1) / (t2 - t1);
    const cy = (1 - tt) * (1 - tt) * (y - towerH) + 2 * (1 - tt) * tt * sagY + tt * tt * (y - towerH);
    s += `<line x1="${x.toFixed(0)}" y1="${cy.toFixed(0)}" x2="${x.toFixed(0)}" y2="${y - deckH}" stroke="${color}" stroke-width="3"/>`;
  }
  return s;
}
function throughArchBridge({ x0, x1, y, archH = 150, color, deckH = 13 }) {
  const mid = (x0 + x1) / 2;
  let s = `<rect x="${x0}" y="${y - deckH}" width="${x1 - x0}" height="${deckH}" fill="${color}"/>`;
  s += `<path d="M${x0} ${y - deckH} Q ${mid} ${y - archH * 2} ${x1} ${y - deckH}" stroke="${color}" stroke-width="10" fill="none"/>`;
  for (let i = 1; i < 12; i++) {
    const x = x0 + ((x1 - x0) * i) / 12, t = i / 12;
    const cy = (1 - t) * (1 - t) * (y - deckH) + 2 * (1 - t) * t * (y - archH * 2) + t * t * (y - deckH);
    s += `<line x1="${x.toFixed(0)}" y1="${cy.toFixed(0)}" x2="${x.toFixed(0)}" y2="${y - deckH}" stroke="${color}" stroke-width="3.5"/>`;
  }
  return s;
}
function stoneArchBridge({ x0, x1, y, color, arches = 6, archH = 60, deckH = 16 }) {
  const span = (x1 - x0) / arches;
  let s = `<rect x="${x0}" y="${y - archH - deckH}" width="${x1 - x0}" height="${deckH}" fill="${color}"/>`;
  for (let i = 0; i < arches; i++) {
    const ax = x0 + i * span;
    s += `<path d="M${ax} ${y} L${ax} ${y - archH} Q ${ax + span / 2} ${y - archH - 44} ${ax + span} ${y - archH} L${ax + span} ${y} Z" fill="${color}"/>`;
  }
  // punch light arcs under each arch
  for (let i = 0; i < arches; i++) {
    const ax = x0 + i * span + span * 0.16;
    s += `<path d="M${ax} ${y} Q ${x0 + i * span + span / 2} ${y - archH * 1.1} ${x0 + (i + 1) * span - span * 0.16} ${y} Z" fill="#000" opacity="0.45"/>`;
  }
  return s;
}
function towerBridge({ x0, x1, y, color, accent, towerH = 300, deckH = 14 }) {
  const t1 = x0 + (x1 - x0) * 0.26, t2 = x0 + (x1 - x0) * 0.74, tw = 34;
  const topY = y - towerH;
  let s = '';
  // approach spans on piers, so daylight shows under the deck
  s += `<rect x="${x0}" y="${y - deckH}" width="${x1 - x0}" height="${deckH}" fill="${color}"/>`;
  for (const px of [x0 + 30, t1, t2, x1 - 30]) {
    s += `<rect x="${px - 9}" y="${y}" width="18" height="120" fill="${color}"/>`;
  }
  // portal towers, each a pair of legs braced top and bottom
  for (const t of [t1, t2]) {
    s += `<rect x="${t - tw}" y="${topY}" width="12" height="${towerH}" fill="${color}"/>
      <rect x="${t + tw - 12}" y="${topY}" width="12" height="${towerH}" fill="${color}"/>
      <rect x="${t - tw - 10}" y="${topY}" width="${tw * 2 + 20}" height="16" fill="${color}"/>
      <rect x="${t - tw}" y="${topY + 74}" width="${tw * 2}" height="10" fill="${color}"/>
      <rect x="${t - tw - 10}" y="${topY - 20}" width="${tw * 2 + 20}" height="20" fill="${accent}" opacity="0.75"/>`;
  }
  // the lift span rides between the towers, held clear of the deck
  s += `<rect x="${t1 - tw}" y="${topY + 104}" width="${t2 - t1 + tw * 2}" height="18" fill="${accent}" opacity="0.7"/>`;
  s += `<rect x="${t1 - tw}" y="${topY + 122}" width="${t2 - t1 + tw * 2}" height="8" fill="${color}"/>`;
  for (const t of [t1, t2]) {
    s += `<line x1="${t}" y1="${topY + 130}" x2="${t}" y2="${y - deckH}" stroke="${color}" stroke-width="8"/>`;
  }
  return s;
}
function cnTower({ x, y, h, color }) {
  const podY = y - h * 0.62;
  return `<path d="M${x - 16} ${y} L${x - 6} ${podY} L${x + 6} ${podY} L${x + 16} ${y} Z" fill="${color}"/>
    <ellipse cx="${x}" cy="${podY}" rx="34" ry="26" fill="${color}"/>
    <rect x="${x - 5}" y="${y - h * 0.88}" width="10" height="${h * 0.26}" fill="${color}"/>
    <rect x="${x - 2}" y="${y - h}" width="4" height="${h * 0.13}" fill="${color}"/>
    <circle cx="${x}" cy="${y - h}" r="4" fill="#ff6b6b"/>`;
}
function spaceNeedle({ x, y, h, color }) {
  const topY = y - h;
  return `<path d="M${x - 8} ${topY + h * 0.32} C ${x - 34} ${y - h * 0.28} ${x - 44} ${y - 22} ${x - 52} ${y}
      L ${x - 20} ${y} L ${x - 4} ${topY + h * 0.34} Z" fill="${color}"/>
    <path d="M${x + 8} ${topY + h * 0.32} C ${x + 34} ${y - h * 0.28} ${x + 44} ${y - 22} ${x + 52} ${y}
      L ${x + 20} ${y} L ${x + 4} ${topY + h * 0.34} Z" fill="${color}"/>
    <rect x="${x - 5}" y="${topY + h * 0.2}" width="10" height="${h * 0.55}" fill="${color}"/>
    <ellipse cx="${x}" cy="${topY + h * 0.22}" rx="58" ry="16" fill="${color}"/>
    <path d="M${x - 58} ${topY + h * 0.22} L ${x - 30} ${topY + h * 0.3} L ${x + 30} ${topY + h * 0.3} L ${x + 58} ${topY + h * 0.22} Z" fill="${color}"/>
    <rect x="${x - 2.5}" y="${topY}" width="5" height="${h * 0.2}" fill="${color}"/>`;
}
function empireState({ x, y, h, color }) {
  const w = 90;
  return `<rect x="${x - w / 2}" y="${y - h * 0.55}" width="${w}" height="${h * 0.55}" fill="${color}"/>
    <rect x="${x - w * 0.36}" y="${y - h * 0.78}" width="${w * 0.72}" height="${h * 0.25}" fill="${color}"/>
    <rect x="${x - w * 0.22}" y="${y - h * 0.9}" width="${w * 0.44}" height="${h * 0.14}" fill="${color}"/>
    <rect x="${x - 4}" y="${y - h}" width="8" height="${h * 0.12}" fill="${color}"/>`;
}
function gatewayArch({ cx, y, w, h, color, thick = 26 }) {
  const x0 = cx - w / 2, x1 = cx + w / 2;
  const ctrlY = y - h * 1.42;
  return `<path d="M${x0} ${y} Q ${cx} ${ctrlY} ${x1} ${y} L ${x1 - thick} ${y} Q ${cx} ${ctrlY + thick * 2.4} ${x0 + thick} ${y} Z" fill="${color}"/>`;
}
function obelisk({ x, y, h, color }) {
  const w = h * 0.11;
  return `<path d="M${x - w / 2} ${y} L ${x - w * 0.32} ${y - h * 0.82} L ${x} ${y - h} L ${x + w * 0.32} ${y - h * 0.82} L ${x + w / 2} ${y} Z" fill="${color}"/>`;
}
function domeMemorial({ x, y, w, color }) {
  const h = w * 0.62;
  let cols = '';
  for (let i = 0; i < 7; i++) {
    const cxx = x - w * 0.36 + (i * w * 0.72) / 6;
    cols += `<rect x="${(cxx - 4).toFixed(0)}" y="${y - h * 0.5}" width="8" height="${h * 0.5}" fill="${color}"/>`;
  }
  return `<path d="M${x - w * 0.42} ${y - h * 0.5} A ${w * 0.42} ${w * 0.42} 0 0 1 ${x + w * 0.42} ${y - h * 0.5} L ${x + w * 0.5} ${y - h * 0.5} L ${x + w * 0.5} ${y - h * 0.42} L ${x - w * 0.5} ${y - h * 0.42} L ${x - w * 0.5} ${y - h * 0.5} Z" fill="${color}"/>
    ${cols}<rect x="${x - w * 0.5}" y="${y - h * 0.06}" width="${w}" height="${h * 0.06}" fill="${color}"/>`;
}
function clockTower({ x, y, h, color, face = '#f7e8b0' }) {
  const w = 74;
  return `<rect x="${x - w / 2}" y="${y - h * 0.72}" width="${w}" height="${h * 0.72}" fill="${color}"/>
    <rect x="${x - w * 0.62}" y="${y - h * 0.74}" width="${w * 1.24}" height="14" fill="${color}"/>
    <rect x="${x - w * 0.34}" y="${y - h * 0.9}" width="${w * 0.68}" height="${h * 0.18}" fill="${color}"/>
    <circle cx="${x}" cy="${y - h * 0.63}" r="20" fill="${face}" opacity="0.95"/>
    <path d="M${x - w * 0.34} ${y - h * 0.9} L ${x} ${y - h} L ${x + w * 0.34} ${y - h * 0.9} Z" fill="${color}"/>
    <rect x="${x - 2.5}" y="${y - h - 26}" width="5" height="28" fill="${color}"/>`;
}
function waterTower({ x, y, h, color }) {
  const w = h * 0.62;
  return `<line x1="${x - w * 0.4}" y1="${y}" x2="${x - w * 0.26}" y2="${y - h * 0.5}" stroke="${color}" stroke-width="7"/>
    <line x1="${x + w * 0.4}" y1="${y}" x2="${x + w * 0.26}" y2="${y - h * 0.5}" stroke="${color}" stroke-width="7"/>
    <line x1="${x - w * 0.33}" y1="${y - h * 0.24}" x2="${x + w * 0.33}" y2="${y - h * 0.24}" stroke="${color}" stroke-width="5"/>
    <path d="M${x - w / 2} ${y - h * 0.5} L ${x + w / 2} ${y - h * 0.5} L ${x + w * 0.38} ${y - h * 0.82} L ${x - w * 0.38} ${y - h * 0.82} Z" fill="${color}"/>
    <path d="M${x - w * 0.42} ${y - h * 0.82} L ${x} ${y - h} L ${x + w * 0.42} ${y - h * 0.82} Z" fill="${color}"/>`;
}
function fountain({ x, y, color = '#eaf4ff' }) {
  let jets = '';
  for (const [dx, hh] of [[-70, 60], [-35, 90], [0, 120], [35, 90], [70, 60]]) {
    jets += `<path d="M${x + dx} ${y - 30} Q ${x + dx} ${y - 30 - hh} ${x + dx + 12} ${y - 26}" stroke="${color}" stroke-width="6" fill="none" opacity="0.85"/>`;
  }
  return `${jets}<rect x="${x - 95}" y="${y - 30}" width="190" height="12" fill="${color}" opacity="0.9"/>
    <rect x="${x - 55}" y="${y - 18}" width="110" height="18" fill="${color}" opacity="0.75"/>`;
}
function palm({ x, y, h, color, lean = 0 }) {
  const topX = x + lean, topY = y - h;
  let fronds = '';
  const fl = h * 0.42;
  for (let i = 0; i < 7; i++) {
    const ang = -Math.PI * 0.95 + (i * Math.PI * 0.9) / 6;
    const ex = topX + Math.cos(ang) * fl, ey = topY + Math.sin(ang) * fl * 0.75 + fl * 0.22;
    const mx = topX + Math.cos(ang) * fl * 0.5, my = topY + Math.sin(ang) * fl * 0.5 - fl * 0.18;
    fronds += `<path d="M${topX} ${topY} Q ${mx.toFixed(0)} ${my.toFixed(0)} ${ex.toFixed(0)} ${ey.toFixed(0)}" stroke="${color}" stroke-width="11" fill="none" stroke-linecap="round"/>`;
  }
  return `<path d="M${x} ${y} Q ${x + lean * 0.6} ${y - h * 0.55} ${topX} ${topY}" stroke="${color}" stroke-width="16" fill="none" stroke-linecap="round"/>${fronds}
  <circle cx="${topX}" cy="${topY + 6}" r="10" fill="${color}"/>`;
}
function lifeguardHut({ x, y, color = '#3ec6c0', roof = '#e8564f' }) {
  return `<rect x="${x - 34}" y="${y - 60}" width="10" height="60" fill="#2a2438"/>
    <rect x="${x + 24}" y="${y - 60}" width="10" height="60" fill="#2a2438"/>
    <rect x="${x - 44}" y="${y - 128}" width="88" height="70" fill="${color}"/>
    <rect x="${x - 30}" y="${y - 112}" width="26" height="26" fill="#173040"/>
    <path d="M${x - 56} ${y - 128} L ${x} ${y - 160} L ${x + 56} ${y - 128} Z" fill="${roof}"/>
    <path d="M${x + 34} ${y} L ${x + 76} ${y - 70} L ${x + 62} ${y - 74} L ${x + 26} ${y - 12} Z" fill="#2a2438"/>`;
}
function saguaro({ x, y, h, color }) {
  return `<rect x="${x - 13}" y="${y - h}" width="26" height="${h}" rx="13" fill="${color}"/>
    <path d="M${x - 13} ${y - h * 0.55} h -26 v -${h * 0.3} a 13 13 0 0 1 26 0 v ${h * 0.12} z" fill="${color}"/>
    <path d="M${x + 13} ${y - h * 0.42} h 26 v -${h * 0.42} a 13 13 0 0 0 -26 0 v ${h * 0.24} z" fill="${color}"/>`;
}
function mountains({ x0, x1, y, hMax, color, r, peaks = 5, snow = null }) {
  const pts = [[x0, y]];
  for (let i = 0; i <= peaks; i++) {
    const px = x0 + ((x1 - x0) * i) / peaks + (r() - 0.5) * 60;
    const py = y - (0.45 + r() * 0.55) * hMax;
    pts.push([px, py]);
    if (i < peaks) pts.push([x0 + ((x1 - x0) * (i + 0.5)) / peaks, y - (0.1 + r() * 0.2) * hMax]);
  }
  pts.push([x1, y]);
  let s = `<polygon points="${pts.map(p => p.map(v => v.toFixed(0)).join(',')).join(' ')}" fill="${color}"/>`;
  if (snow) {
    for (let i = 1; i < pts.length - 1; i += 2) {
      const [px, py] = pts[i];
      if (py < y - hMax * 0.5) {
        s += `<path d="M${px - 46} ${py + 52} L ${px} ${py} L ${px + 46} ${py + 52} L ${px + 26} ${py + 44} L ${px + 8} ${py + 58} L ${px - 12} ${py + 42} L ${px - 28} ${py + 56} Z" fill="${snow}" opacity="0.92"/>`;
      }
    }
  }
  return s;
}
function streetLamp({ x, y, h, color, glow = '#ffd98a' }) {
  return `<rect x="${x - 4}" y="${y - h}" width="8" height="${h}" fill="${color}"/>
    <rect x="${x - 14}" y="${y - h - 6}" width="28" height="8" fill="${color}"/>
    <path d="M${x - 11} ${y - h - 6} L ${x - 8} ${y - h - 30} L ${x + 8} ${y - h - 30} L ${x + 11} ${y - h - 6} Z" fill="${color}"/>
    <circle cx="${x}" cy="${y - h - 18}" r="26" fill="${glow}" opacity="0.28"/>
    <circle cx="${x}" cy="${y - h - 16}" r="8" fill="${glow}" opacity="0.95"/>`;
}
function brickRow(r, { x0, x1, baseY, color, winColor = '#ffd97a', h0 = 130, h1 = 210 }) {
  let s = '', x = x0;
  while (x < x1) {
    const bw = 150 + r() * 110, bh = h0 + r() * (h1 - h0), by = baseY - bh;
    s += `<rect x="${x.toFixed(0)}" y="${by.toFixed(0)}" width="${bw.toFixed(0)}" height="${bh.toFixed(0)}" fill="${color}"/>
      <rect x="${x.toFixed(0)}" y="${(by - 10).toFixed(0)}" width="${bw.toFixed(0)}" height="12" fill="${color}"/>`;
    const cols = Math.floor(bw / 46);
    for (let c = 0; c < cols; c++)
      for (let rr = 0; rr < Math.floor(bh / 64); rr++)
        if (r() < 0.62)
          s += `<rect x="${(x + 16 + c * 46).toFixed(0)}" y="${(by + 22 + rr * 64).toFixed(0)}" width="15" height="26" rx="7" fill="${winColor}" opacity="0.9"/>`;
    x += bw + 14;
  }
  return s;
}
function stadiumDome({ cx, y, w, color, lit = '#ffd97a' }) {
  const h = w * 0.3;
  let s = `<path d="M${cx - w / 2} ${y} Q ${cx} ${y - h * 2} ${cx + w / 2} ${y} Z" fill="${color}"/>`;
  s += `<path d="M${cx - w * 0.36} ${y - 8} Q ${cx} ${y - h * 1.5} ${cx + w * 0.36} ${y - 8}" stroke="${lit}" stroke-width="5" fill="none" opacity="0.55"/>`;
  for (let i = 0; i < 4; i++) {
    const lx = cx - w / 2 + 30 + i * ((w - 60) / 3);
    s += `<line x1="${lx}" y1="${y - 4}" x2="${lx - 8}" y2="${y - h * 1.15}" stroke="${color}" stroke-width="7"/>
      <rect x="${lx - 26}" y="${y - h * 1.15 - 14}" width="38" height="16" fill="${color}"/>
      <rect x="${lx - 24}" y="${y - h * 1.15 - 12}" width="34" height="12" fill="${lit}" opacity="0.85"/>`;
  }
  return s;
}

// ---------- text ----------
function topLabels(est, div) {
  const common = `font-family="Helvetica Neue" font-weight="bold" font-size="46" letter-spacing="7" fill="#ffffff"`;
  return `<text x="92" y="122" ${common} opacity="0.96">EST. ${est}</text>
    <text x="${W - 92}" y="122" text-anchor="end" ${common} opacity="0.96">${div}</text>`;
}
function titleBlock(city, team, scriptColor, cityFS = 190, teamFS = 340) {
  // Long names ("Washington D.C.", "DIAMONDBACKS") would run past the card edge
  // at the default size, so shrink to fit — never grow.
  const MAX_W = 2160;
  cityFS = Math.min(cityFS, MAX_W / (city.length * 0.44));
  teamFS = Math.min(teamFS, MAX_W / (team.length * 0.56));
  // shadow copies then fill
  const cityY = 345, teamY = 665;
  const teamFont = `font-family="Avenir Next Condensed" font-weight="900" font-size="${teamFS}" letter-spacing="5"`;
  return `
  <text x="${W / 2 + 5}" y="${cityY + 7}" text-anchor="middle" font-family="Brush Script MT" font-style="italic" font-size="${cityFS}" fill="#000" opacity="0.5">${esc(city)}</text>
  <text x="${W / 2}" y="${cityY}" text-anchor="middle" font-family="Brush Script MT" font-style="italic" font-size="${cityFS}" fill="${scriptColor}">${esc(city)}</text>
  <text x="${W / 2 + 7}" y="${teamY + 9}" text-anchor="middle" ${teamFont} fill="#000" opacity="0.55">${esc(team)}</text>
  <text x="${W / 2}" y="${teamY}" text-anchor="middle" ${teamFont} fill="#ffffff">${esc(team)}</text>`;
}
function vignette() {
  return `<radialGradient id="vig" cx="50%" cy="46%" r="75%">
      <stop offset="62%" stop-color="#000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0.38"/></radialGradient>
    <rect width="${W}" height="${H}" fill="url(#vig)"/>`;
}

// ---------- card assembly ----------
function card(t) {
  const r = rng(t.seed);
  const sky = SKIES[t.sky];
  const defs = skyDefs(sky);
  const horizonGlowColor = t.glowColor || sky[4];
  const parts = [];
  parts.push(`<rect width="${W}" height="${H}" fill="url(#sky)"/>`);
  if (t.stars) parts.push(stars(r, t.stars, H * 0.5));
  if (t.glow !== false) parts.push(sunGlow(t.glowX ?? W / 2, t.glowY ?? H * 0.78, t.glowR ?? 700, horizonGlowColor, t.glowOp ?? 0.55));
  if (t.clouds) parts.push(clouds(r, t.clouds, 120, 420, t.cloudColor || '#ffb98a', 0.2));
  parts.push(t.scene(r, t));
  parts.push(vignette());
  parts.push(topLabels(t.est, t.div));
  parts.push(titleBlock(t.city, t.team, t.scriptColor, t.cityFS, t.teamFS));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${defs}</defs>${parts.join('\n')}</svg>`;
}

// scene helpers: standard city = back layer + front layer (+water)
function cityScene({ backColor, frontColor, winColor = '#ffd97a', waterY = null, waterTop = '#131a30', waterBottom = '#090d1c', backH = [180, 420], frontH = [120, 330], winP = 0.5, extrasBack = null, extras = null, frontOpts = {}, backOpts = {} }) {
  return (r, t) => {
    const baseY = waterY ?? H;
    let s = '';
    s += buildings(r, { baseY: baseY + 4, minH: backH[0], maxH: backH[1], color: backColor, winColor: null, minW: 70, maxW: 160, gap: 2, ...backOpts });
    if (extrasBack) s += extrasBack(r, baseY);
    s += buildings(r, { baseY: baseY + 4, minH: frontH[0], maxH: frontH[1], color: frontColor, winColor, winP, ...frontOpts });
    if (extras) s += extras(r, baseY);
    if (waterY) s += water(waterY, waterTop, waterBottom, r, winColor);
    return s;
  };
}

// ---------- team data ----------
const NAVY = '#0e1526', NAVY2 = '#1c2740', INK = '#0a0f1e', INK2 = '#182036';
const TEAMS = [
  // ================= AL EAST =================
  {
    file: 'orioles', city: 'Baltimore', team: 'ORIOLES', est: 1954, div: 'AL EAST',
    scriptColor: '#ff9a3c', sky: 'sunsetOrange', seed: 101, clouds: 5,
    glowX: 600, glowY: 700, glowR: 900,
    scene: (r) => {
      const baseY = 840;
      let s = buildings(r, { baseY: baseY + 4, minH: 160, maxH: 380, color: '#241a2e', winColor: null, minW: 80, maxW: 170, gap: 2 });
      // Camden-style brick warehouse on right
      s += `<rect x="1520" y="${baseY - 250}" width="880" height="254" fill="#3a1f16"/>`;
      for (let c = 0; c < 18; c++)
        for (let rr = 0; rr < 3; rr++)
          s += `<path d="M${1552 + c * 47} ${baseY - 208 + rr * 74} a 14 14 0 0 1 28 0 v 40 h -28 z" fill="${rr < 2 && (c + rr) % 3 ? '#ffcf7a' : '#1c0f0a'}" opacity="0.92"/>`;
      s += `<rect x="1520" y="${baseY - 262}" width="880" height="14" fill="#2a1710"/>`;
      s += buildings(r, { x0: 0, x1: 1500, baseY: baseY + 4, minH: 130, maxH: 320, color: '#160f1c', winColor: '#ffcf7a', winP: 0.5 });
      s += streetLamp({ x: 180, y: baseY, h: 150, color: '#0c0810' });
      s += streetLamp({ x: 1380, y: baseY, h: 150, color: '#0c0810' });
      s += water(840, '#241626', '#0d0812', r, '#ffb45c', 80);
      return s;
    },
  },
  {
    file: 'red-sox', city: 'Boston', team: 'RED SOX', est: 1901, div: 'AL EAST',
    scriptColor: '#ff5a4e', sky: 'duskPink', seed: 102, clouds: 4, stars: 40,
    glowX: 1200, glowY: 760, glowR: 800,
    scene: (r) => {
      const baseY = 830;
      let s = buildings(r, { baseY, minH: 200, maxH: 430, color: '#221a38', winColor: null, minW: 80, maxW: 170, gap: 2 });
      s += buildings(r, { baseY, minH: 120, maxH: 330, color: '#120d24', winColor: '#ffd97a', winP: 0.5 });
      // Zakim-style cable bridge
      s += suspensionBridge({ x0: -80, x1: 2480, y: 942, towerH: 300, color: '#0a0716', sag: 0.5 });
      s += water(830, '#20183a', '#0b081a', r, '#ffd08a', 70);
      return s;
    },
  },
  {
    file: 'yankees', city: 'New York', team: 'YANKEES', est: 1903, div: 'AL EAST',
    scriptColor: '#ffffff', sky: 'deepNight', seed: 103, stars: 90,
    glowX: 1200, glowY: 820, glowR: 900, glowColor: '#8a97c0', glowOp: 0.4,
    scene: (r) => {
      const baseY = 850;
      let s = buildings(r, { baseY, minH: 260, maxH: 500, color: '#20283f', winColor: '#cfe0ff', winP: 0.34, winOp: 0.7, minW: 70, maxW: 150, gap: 2 });
      s += empireState({ x: 1750, y: baseY, h: 620, color: '#141b30' });
      s += buildings(r, { baseY, minH: 140, maxH: 360, color: '#0d1322', winColor: '#e8f0ff', winP: 0.5 });
      s += suspensionBridge({ x0: -100, x1: 1150, y: 952, towerH: 260, color: '#070b16' });
      s += water(850, '#131a2e', '#070b16', r, '#cfe0ff', 80);
      return s;
    },
  },
  {
    file: 'rays', city: 'Tampa Bay', team: 'RAYS', est: 1998, div: 'AL EAST',
    scriptColor: '#7fd0ff', sky: 'sunsetOrange', seed: 104, clouds: 6,
    glowX: 1750, glowY: 720, glowR: 950,
    scene: (r) => {
      const baseY = 845;
      let s = buildings(r, { x0: 350, x1: 2100, baseY, minH: 160, maxH: 380, color: '#251a30', winColor: null, gap: 2 });
      s += buildings(r, { x0: 420, x1: 2050, baseY, minH: 120, maxH: 300, color: '#140e1e', winColor: '#ffd08a', winP: 0.45 });
      // Skyway-style bridge over the bay
      s += suspensionBridge({ x0: 1250, x1: 2500, y: 936, towerH: 250, color: '#0c0814', sag: 0.45 });
      s += palm({ x: 120, y: 1000, h: 560, color: '#0a0712', lean: 26 });
      s += palm({ x: 250, y: 1000, h: 430, color: '#0d0916', lean: -18 });
      s += water(845, '#2a1830', '#0d0916', r, '#ffb45c', 60);
      return s;
    },
  },
  {
    file: 'blue-jays', city: 'Toronto', team: 'BLUE JAYS', est: 1977, div: 'AL EAST',
    scriptColor: '#5aa2ff', sky: 'nightBlue', seed: 105, stars: 70,
    scene: (r) => {
      const baseY = 855;
      let s = buildings(r, { baseY, minH: 220, maxH: 440, color: '#1a2545', winColor: null, gap: 2 });
      s += buildings(r, { x0: 0, x1: 2400, baseY, minH: 130, maxH: 340, color: '#0c1226', winColor: '#ffe1a0', winP: 0.48 });
      s += cnTower({ x: 350, y: baseY, h: 640, color: '#070c1a' });
      // Rogers-centre-ish dome
      s += stadiumDome({ cx: 700, y: baseY, w: 420, color: '#0a101f' });
      s += water(855, '#101a36', '#070c18', r, '#ffe1a0', 70);
      return s;
    },
  },
  // ================= AL CENTRAL =================
  {
    file: 'white-sox', city: 'Chicago', team: 'WHITE SOX', est: 1900, div: 'AL CENTRAL',
    scriptColor: '#e8e8ea', sky: 'nightMono', seed: 106, stars: 40,
    glowColor: '#9aa0ab', glowOp: 0.4,
    scene: (r) => {
      const baseY = 845;
      let s = buildings(r, { baseY, minH: 240, maxH: 480, color: '#3a3e47', winColor: null, gap: 2 });
      s += buildings(r, { baseY, minH: 140, maxH: 380, color: '#191c22', winColor: '#e6e8ec', winP: 0.42, winOp: 0.75 });
      // bascule bridge silhouette
      s += throughArchBridge({ x0: -60, x1: 1050, y: 948, archH: 130, color: '#0c0e12' });
      s += throughArchBridge({ x0: 1350, x1: 2460, y: 948, archH: 130, color: '#0c0e12' });
      s += water(845, '#25282f', '#0c0e12', r, '#e6e8ec', 60);
      return s;
    },
  },
  {
    file: 'guardians', city: 'Cleveland', team: 'GUARDIANS', est: 1901, div: 'AL CENTRAL',
    scriptColor: '#ff5a52', sky: 'nightBlue', seed: 107, stars: 55,
    glowColor: '#7a86b5', glowOp: 0.45,
    scene: (r) => {
      const baseY = 840;
      let s = buildings(r, { baseY, minH: 200, maxH: 420, color: '#1a2340', winColor: null, gap: 2 });
      // Terminal Tower-ish
      s += `<rect x="1130" y="${baseY - 480}" width="120" height="480" fill="#0d1328"/>
        <rect x="1150" y="${baseY - 560}" width="80" height="90" fill="#0d1328"/>
        <rect x="1168" y="${baseY - 620}" width="44" height="70" fill="#0d1328"/>
        <path d="M1168 ${baseY - 620} L1190 ${baseY - 680} L1212 ${baseY - 620} Z" fill="#0d1328"/>`;
      s += buildings(r, { baseY, minH: 130, maxH: 330, color: '#0c1224', winColor: '#ffd9a0', winP: 0.46 });
      s += stoneArchBridge({ x0: -40, x1: 2440, y: 1000, color: '#070c18', arches: 7, archH: 80 });
      s += water(840, '#111a34', '#080d1a', r, '#ffd9a0', 40);
      return s;
    },
  },
  {
    file: 'tigers', city: 'Detroit', team: 'TIGERS', est: 1901, div: 'AL CENTRAL',
    scriptColor: '#ff8c2e', sky: 'goldSunset', seed: 108, clouds: 5,
    glowX: 800, glowY: 700, glowR: 900,
    scene: (r) => {
      const baseY = 860;
      let s = buildings(r, { baseY, minH: 200, maxH: 420, color: '#2c1c26', winColor: null, gap: 2 });
      s += brickRow(r, { x0: 1350, x1: 2400, baseY, color: '#2a140e', h0: 150, h1: 260 });
      s += buildings(r, { x0: 0, x1: 1330, baseY, minH: 140, maxH: 340, color: '#150d16', winColor: '#ffcf7a', winP: 0.48 });
      s += waterTower({ x: 1560, y: baseY - 250, h: 230, color: '#0f0910' });
      s += water(860, '#281524', '#0e0812', r, '#ffb45c', 60);
      return s;
    },
  },
  {
    file: 'royals', city: 'Kansas City', team: 'ROYALS', est: 1969, div: 'AL CENTRAL',
    scriptColor: '#6fb2ff', sky: 'nightBlue', seed: 109, stars: 60,
    scene: (r) => {
      const baseY = 850;
      let s = mountains({ x0: 1500, x1: 2500, y: baseY, hMax: 260, color: '#182246', r, peaks: 4, snow: '#dfe8ff' });
      s += buildings(r, { x0: 0, x1: 1650, baseY, minH: 200, maxH: 440, color: '#16204040', winColor: null, gap: 2, color: '#16203e' });
      s += buildings(r, { x0: 0, x1: 1750, baseY, minH: 130, maxH: 340, color: '#0b1124', winColor: '#ffe0a0', winP: 0.48 });
      s += fountain({ x: 2050, y: baseY + 90 });
      s += fountain({ x: 1850, y: baseY + 140 });
      s += water(850, '#101a38', '#070c1a', r, '#ffe0a0', 55);
      return s;
    },
  },
  {
    file: 'twins', city: 'Minnesota', team: 'TWINS', est: 1961, div: 'AL CENTRAL',
    scriptColor: '#ff5a52', sky: 'deepNight', seed: 110, stars: 75,
    glowColor: '#7a86b5', glowOp: 0.4,
    scene: (r) => {
      const baseY = 830;
      let s = buildings(r, { baseY, minH: 200, maxH: 440, color: '#1a2342', winColor: null, gap: 2 });
      s += buildings(r, { baseY, minH: 130, maxH: 350, color: '#0c1226', winColor: '#ffd9a0', winP: 0.48 });
      // capella tower-ish crown
      s += `<circle cx="1900" cy="${baseY - 380}" r="60" fill="#0c1226"/><rect x="1840" y="${baseY - 380}" width="120" height="380" fill="#0c1226"/>`;
      s += stoneArchBridge({ x0: -40, x1: 2440, y: 1000, color: '#070b16', arches: 8, archH: 74 });
      s += water(830, '#101a36', '#070b16', r, '#ffd9a0', 45);
      return s;
    },
  },
  // ================= AL WEST =================
  {
    file: 'astros', city: 'Houston', team: 'ASTROS', est: 1962, div: 'AL WEST',
    scriptColor: '#ff9a3c', sky: 'sunsetOrange', seed: 111, clouds: 5,
    glowX: 1200, glowY: 740, glowR: 1000,
    scene: cityScene({ backColor: '#271b30', frontColor: '#130d1c', waterY: null, backH: [240, 470], frontH: [150, 400], winP: 0.5, extras: (r) => throughArchBridge({ x0: -60, x1: 900, y: 1000, archH: 120, color: '#0a0712' }) }),
  },
  {
    file: 'angels', city: 'Los Angeles', team: 'ANGELS', est: 1961, div: 'AL WEST',
    scriptColor: '#ff5a4e', sky: 'duskPink', seed: 112, clouds: 6,
    glowX: 1200, glowY: 740, glowR: 950,
    scene: (r) => {
      let s = mountains({ x0: -50, x1: 2450, y: 1000, hMax: 420, color: '#241a3e', r, peaks: 6, snow: '#f2c4b0' });
      s += buildings(r, { x0: 700, x1: 1750, baseY: 1004, minH: 140, maxH: 300, color: '#150e24', winColor: '#ffcf8a', winP: 0.42 });
      s += palm({ x: 200, y: 1000, h: 600, color: '#0e0918', lean: 30 });
      s += palm({ x: 420, y: 1000, h: 460, color: '#120b1e', lean: -20 });
      s += palm({ x: 2160, y: 1000, h: 580, color: '#0e0918', lean: -28 });
      s += palm({ x: 2320, y: 1000, h: 430, color: '#120b1e', lean: 16 });
      return s;
    },
  },
  {
    file: 'athletics', city: 'Sacramento', team: 'ATHLETICS', est: 1901, div: 'AL WEST',
    scriptColor: '#efb21e', sky: 'goldSunset', seed: 113, clouds: 4,
    glowX: 1200, glowY: 720, glowR: 950,
    scene: (r) => {
      const baseY = 850;
      let s = buildings(r, { x0: 850, x1: 2400, baseY, minH: 170, maxH: 380, color: '#2a1c28', winColor: null, gap: 2 });
      // Capitol dome anchors the right side
      s += domeMemorial({ x: 1980, y: baseY, w: 360, color: '#171018' });
      s += buildings(r, { x0: 900, x1: 1800, baseY, minH: 120, maxH: 300, color: '#150d16', winColor: '#ffcf8a', winP: 0.46 });
      // Tower Bridge: a golden vertical-lift span, Sacramento's signature
      s += towerBridge({ x0: 90, x1: 1020, y: 872, color: '#12090e', accent: '#d4a13c' });
      s += water(850, '#2a1a24', '#0d0912', r, '#ffcf8a', 70);
      return s;
    },
  },
  {
    file: 'mariners', city: 'Seattle', team: 'MARINERS', est: 1977, div: 'AL WEST',
    scriptColor: '#3ec6c0', sky: 'tealDusk', seed: 114, stars: 30, clouds: 4, cloudColor: '#9fc4c9',
    glowColor: '#9fd0c9', glowOp: 0.4,
    scene: (r) => {
      const baseY = 855;
      let s = mountains({ x0: -60, x1: 2460, y: baseY, hMax: 330, color: '#16324a', r, peaks: 5, snow: '#e8f4f4' });
      s += buildings(r, { baseY, minH: 150, maxH: 360, color: '#0c2032', winColor: '#ffe8b0', winP: 0.44 });
      s += spaceNeedle({ x: 380, y: baseY, h: 560, color: '#081624' });
      s += water(855, '#10283c', '#071420', r, '#ffe8b0', 60);
      return s;
    },
  },
  {
    file: 'rangers', city: 'Texas', team: 'RANGERS', est: 1972, div: 'AL WEST',
    scriptColor: '#ff5a52', sky: 'redSunset', seed: 115, clouds: 5,
    glowX: 1700, glowY: 720, glowR: 950,
    scene: (r) => {
      const baseY = 1000;
      let s = buildings(r, { x0: 250, x1: 2200, baseY: baseY + 4, minH: 200, maxH: 440, color: '#2c1626', winColor: null, gap: 2 });
      s += buildings(r, { x0: 300, x1: 2150, baseY: baseY + 4, minH: 130, maxH: 340, color: '#150a16', winColor: '#ffcf7a', winP: 0.48 });
      // modern glass stadium front
      s += stadiumDome({ cx: 1150, y: baseY, w: 700, color: '#0e0812' });
      return s;
    },
  },
  // ================= NL EAST =================
  {
    file: 'braves', city: 'Atlanta', team: 'BRAVES', est: 1871, div: 'NL EAST',
    scriptColor: '#ff5a52', sky: 'deepNight', seed: 116, stars: 80,
    glowColor: '#8a7ab5', glowOp: 0.35,
    scene: cityScene({ backColor: '#1c2440', frontColor: '#0d1326', frontH: [160, 420], backH: [260, 500], winP: 0.5, waterY: null }),
  },
  {
    file: 'marlins', city: 'Miami', team: 'MARLINS', est: 1993, div: 'NL EAST',
    scriptColor: '#3ec6c0', sky: 'sunsetOrange', seed: 117, clouds: 6,
    glowX: 1500, glowY: 700, glowR: 1000,
    scene: (r) => {
      const beachY = 870;
      let s = buildings(r, { x0: 0, x1: 1500, baseY: beachY + 4, minH: 180, maxH: 400, color: '#241830', winColor: null, gap: 2 });
      s += buildings(r, { x0: 0, x1: 1450, baseY: beachY + 4, minH: 120, maxH: 320, color: '#130c1e', winColor: '#ffcf8a', winP: 0.45 });
      s += water(beachY, '#2c1a2e', '#100a18', r, '#ffb45c', 60);
      // beach sand strip + lifeguard hut + palms
      s += `<path d="M1350 1000 L 2400 830 L 2400 1000 Z" fill="#1c1220"/>`;
      s += lifeguardHut({ x: 2050, y: 962 });
      s += palm({ x: 1750, y: 990, h: 480, color: '#0d0814', lean: 24 });
      s += palm({ x: 2320, y: 940, h: 420, color: '#0d0814', lean: -20 });
      return s;
    },
  },
  {
    file: 'mets', city: 'New York', team: 'METS', est: 1962, div: 'NL EAST',
    scriptColor: '#ff8c2e', sky: 'nightBlue', seed: 118, stars: 70,
    glowColor: '#7a86b5', glowOp: 0.4,
    scene: (r) => {
      const baseY = 855;
      let s = buildings(r, { baseY, minH: 240, maxH: 480, color: '#1a2445', winColor: null, gap: 2 });
      s += buildings(r, { baseY, minH: 150, maxH: 380, color: '#0c1226', winColor: '#ffd9a0', winP: 0.5 });
      s += suspensionBridge({ x0: 1250, x1: 2500, y: 952, towerH: 260, color: '#070c18' });
      s += water(855, '#101a36', '#070c18', r, '#ffd9a0', 65);
      return s;
    },
  },
  {
    file: 'phillies', city: 'Philadelphia', team: 'PHILLIES', est: 1883, div: 'NL EAST',
    scriptColor: '#ff5a52', sky: 'deepNight', seed: 119, stars: 70,
    glowColor: '#8a86b5', glowOp: 0.4, cityFS: 168,
    scene: (r) => {
      const baseY = 860;
      let s = buildings(r, { baseY, minH: 220, maxH: 460, color: '#1a2140', winColor: null, gap: 2 });
      s += buildings(r, { baseY, minH: 140, maxH: 360, color: '#0c1124', winColor: '#ffd9a0', winP: 0.48 });
      s += clockTower({ x: 1850, y: baseY, h: 660, color: '#070b16' });
      s += water(860, '#101832', '#070b16', r, '#ffd9a0', 55);
      return s;
    },
  },
  {
    file: 'nationals', city: 'Washington', team: 'NATIONALS', est: 2005, div: 'NL EAST',
    scriptColor: '#ff5a52', sky: 'duskPink', seed: 120, clouds: 5, stars: 30,
    glowX: 1200, glowY: 760, glowR: 900,
    scene: (r) => {
      const baseY = 845;
      let s = buildings(r, { x0: 0, x1: 1500, baseY, minH: 130, maxH: 260, color: '#241a38', winColor: null, gap: 2 });
      s += buildings(r, { x0: 0, x1: 1450, baseY, minH: 100, maxH: 220, color: '#140e24', winColor: '#ffd9a0', winP: 0.4 });
      s += obelisk({ x: 600, y: baseY, h: 560, color: '#0d0918' });
      s += domeMemorial({ x: 1950, y: baseY, w: 420, color: '#0d0918' });
      s += water(845, '#241a36', '#0d0918', r, '#ffd9a0', 60);
      return s;
    },
  },
  // ================= NL CENTRAL =================
  {
    file: 'cubs', city: 'Chicago', team: 'CUBS', est: 1876, div: 'NL CENTRAL',
    scriptColor: '#6fb2ff', sky: 'goldSunset', seed: 121, clouds: 5,
    glowX: 1000, glowY: 700, glowR: 950,
    scene: (r) => {
      const baseY = 1000;
      let s = buildings(r, { x0: 0, x1: 2400, baseY: baseY + 4, minH: 260, maxH: 480, color: '#2a1c28', winColor: null, gap: 2 });
      s += brickRow(r, { x0: -20, x1: 2420, baseY: baseY + 4, color: '#241209', h0: 200, h1: 330 });
      // Wrigley-style marquee corner hint: light posts
      s += streetLamp({ x: 300, y: baseY, h: 190, color: '#120a06' });
      s += streetLamp({ x: 2100, y: baseY, h: 190, color: '#120a06' });
      // el track hint
      s += `<rect x="0" y="${baseY - 168}" width="700" height="14" fill="#150c08"/>
        <rect x="40" y="${baseY - 156}" width="16" height="156" fill="#150c08"/>
        <rect x="300" y="${baseY - 156}" width="16" height="156" fill="#150c08"/>
        <rect x="560" y="${baseY - 156}" width="16" height="156" fill="#150c08"/>`;
      return s;
    },
  },
  {
    file: 'reds', city: 'Cincinnati', team: 'REDS', est: 1881, div: 'NL CENTRAL',
    scriptColor: '#ff5a52', sky: 'sunsetOrange', seed: 122, clouds: 5,
    glowX: 1300, glowY: 720, glowR: 950,
    scene: (r) => {
      const baseY = 845;
      let s = buildings(r, { baseY, minH: 180, maxH: 400, color: '#261a2e', winColor: null, gap: 2 });
      s += buildings(r, { baseY, minH: 120, maxH: 320, color: '#140d1c', winColor: '#ffd08a', winP: 0.46 });
      // Roebling suspension bridge
      s += suspensionBridge({ x0: 200, x1: 2200, y: 940, towerH: 290, color: '#0c0814', sag: 0.52 });
      s += water(845, '#281628', '#0d0814', r, '#ffb45c', 70);
      return s;
    },
  },
  {
    file: 'brewers', city: 'Milwaukee', team: 'BREWERS', est: 1970, div: 'NL CENTRAL',
    scriptColor: '#ffc94a', sky: 'nightBlue', seed: 123, stars: 60,
    scene: (r) => {
      const baseY = 850;
      let s = buildings(r, { baseY, minH: 190, maxH: 400, color: '#1a2242', winColor: null, gap: 2 });
      s += buildings(r, { baseY, minH: 120, maxH: 330, color: '#0c1124', winColor: '#ffe0a0', winP: 0.46 });
      // Hoan bridge arches
      s += throughArchBridge({ x0: -80, x1: 1200, y: 946, archH: 150, color: '#070b16' });
      s += throughArchBridge({ x0: 1200, x1: 2480, y: 946, archH: 150, color: '#070b16' });
      s += water(850, '#101a36', '#070b16', r, '#ffe0a0', 60);
      return s;
    },
  },
  {
    file: 'pirates', city: 'Pittsburgh', team: 'PIRATES', est: 1887, div: 'NL CENTRAL',
    scriptColor: '#ffc94a', sky: 'deepNight', seed: 124, stars: 75,
    glowColor: '#8a86b5', glowOp: 0.38,
    scene: (r) => {
      const baseY = 830;
      let s = buildings(r, { baseY, minH: 210, maxH: 450, color: '#1a2140', winColor: null, gap: 2 });
      s += buildings(r, { baseY, minH: 130, maxH: 350, color: '#0c1124', winColor: '#ffd9a0', winP: 0.5 });
      // Clemente bridge — golden through-arch
      s += throughArchBridge({ x0: 150, x1: 2250, y: 944, archH: 175, color: '#0d0a14' });
      s += `<path d="M150 931 Q 1200 ${944 - 350} 2250 931" stroke="#c99a3c" stroke-width="5" fill="none" opacity="0.5"/>`;
      s += water(830, '#101832', '#070b16', r, '#ffd9a0', 70);
      return s;
    },
  },
  {
    file: 'cardinals', city: 'St. Louis', team: 'CARDINALS', est: 1882, div: 'NL CENTRAL',
    scriptColor: '#ff5a52', sky: 'sunsetOrange', seed: 125, clouds: 5,
    glowX: 1900, glowY: 700, glowR: 1000,
    scene: (r) => {
      const baseY = 860;
      let s = buildings(r, { x0: 0, x1: 1600, baseY, minH: 180, maxH: 400, color: '#261a2c', winColor: null, gap: 2 });
      s += buildings(r, { x0: 0, x1: 1550, baseY, minH: 120, maxH: 320, color: '#150d1a', winColor: '#ffd08a', winP: 0.46 });
      s += gatewayArch({ cx: 1950, y: baseY, w: 760, h: 600, color: '#0d0814', thick: 30 });
      s += water(860, '#281628', '#0d0814', r, '#ffb45c', 65);
      return s;
    },
  },
  // ================= NL WEST =================
  {
    file: 'diamondbacks', city: 'Arizona', team: 'DIAMONDBACKS', est: 1998, div: 'NL WEST',
    scriptColor: '#ff5a52', sky: 'redSunset', seed: 126, clouds: 5, teamFS: 258,
    glowX: 1200, glowY: 720, glowR: 1050,
    scene: (r) => {
      let s = mountains({ x0: -60, x1: 2460, y: 1000, hMax: 380, color: '#2c1430', r, peaks: 5 });
      s += mountains({ x0: -60, x1: 2460, y: 1000, hMax: 200, color: '#160a1c', r, peaks: 7 });
      s += saguaro({ x: 260, y: 1000, h: 420, color: '#0d0614' });
      s += saguaro({ x: 500, y: 990, h: 280, color: '#120a18' });
      s += saguaro({ x: 2150, y: 1000, h: 460, color: '#0d0614' });
      s += saguaro({ x: 1900, y: 990, h: 250, color: '#120a18' });
      return s;
    },
  },
  {
    file: 'rockies', city: 'Colorado', team: 'ROCKIES', est: 1993, div: 'NL WEST',
    scriptColor: '#b48aff', sky: 'purpleDusk', seed: 127, stars: 50, clouds: 4, cloudColor: '#d9a0b5',
    scene: (r) => {
      let s = mountains({ x0: -60, x1: 2460, y: 1000, hMax: 470, color: '#241a44', r, peaks: 5, snow: '#efe6ff' });
      s += mountains({ x0: -60, x1: 2460, y: 1000, hMax: 260, color: '#120c26', r, peaks: 7 });
      // pines
      for (let i = 0; i < 26; i++) {
        const x = r() * W, h = 60 + r() * 110, y = 1000;
        s += `<path d="M${x - h * 0.3} ${y} L ${x} ${y - h} L ${x + h * 0.3} ${y} Z" fill="#0a0616"/>`;
      }
      return s;
    },
  },
  {
    file: 'dodgers', city: 'Los Angeles', team: 'DODGERS', est: 1883, div: 'NL WEST',
    scriptColor: '#4a90ff', sky: 'deepNight', seed: 128, stars: 85,
    glowColor: '#7a86c0', glowOp: 0.4,
    scene: (r) => {
      const baseY = 1000;
      let s = mountains({ x0: 1200, x1: 2460, y: baseY, hMax: 240, color: '#141c38', r, peaks: 4 });
      s += buildings(r, { x0: 550, x1: 1900, baseY: baseY + 4, minH: 180, maxH: 420, color: '#0d1326', winColor: '#ffe0a8', winP: 0.5 });
      s += palm({ x: 180, y: baseY, h: 620, color: '#070b16', lean: 30 });
      s += palm({ x: 380, y: baseY, h: 470, color: '#0a0f1e', lean: -22 });
      s += palm({ x: 2120, y: baseY, h: 600, color: '#070b16', lean: -30 });
      s += palm({ x: 2300, y: baseY, h: 440, color: '#0a0f1e', lean: 18 });
      return s;
    },
  },
  {
    file: 'padres', city: 'San Diego', team: 'PADRES', est: 1969, div: 'NL WEST',
    scriptColor: '#ffc94a', sky: 'sunsetOrange', seed: 129, clouds: 6,
    glowX: 900, glowY: 680, glowR: 1100,
    scene: (r) => {
      const baseY = 830;
      let s = buildings(r, { x0: 1100, x1: 2400, baseY, minH: 170, maxH: 390, color: '#261a2c', winColor: null, gap: 2 });
      s += buildings(r, { x0: 1150, x1: 2400, baseY, minH: 120, maxH: 310, color: '#140d1a', winColor: '#ffd08a', winP: 0.45 });
      // coastline cliffs on left
      s += `<path d="M0 1000 L 0 ${baseY + 40} Q 300 ${baseY + 20} 520 ${baseY + 90} Q 700 ${baseY + 150} 820 1000 Z" fill="#130c16"/>`;
      s += palm({ x: 240, y: baseY + 55, h: 420, color: '#0c0710', lean: 24 });
      s += palm({ x: 420, y: baseY + 80, h: 330, color: '#0c0710', lean: -16 });
      s += water(baseY, '#2c1a28', '#0e0814', r, '#ffb45c', 70);
      return s;
    },
  },
  {
    file: 'giants', city: 'San Francisco', team: 'GIANTS', est: 1883, div: 'NL WEST',
    scriptColor: '#ff8c2e', sky: 'sunsetOrange', seed: 130, clouds: 6, cityFS: 168,
    glowX: 1200, glowY: 700, glowR: 1000,
    scene: (r) => {
      const baseY = 855;
      let s = buildings(r, { x0: 1500, x1: 2400, baseY, minH: 150, maxH: 340, color: '#261a2c', winColor: null, gap: 2 });
      s += buildings(r, { x0: 1550, x1: 2400, baseY, minH: 110, maxH: 280, color: '#150d1a', winColor: '#ffd08a', winP: 0.44 });
      // fog bank
      s += `<ellipse cx="700" cy="${baseY - 60}" rx="800" ry="70" fill="#d98868" opacity="0.18"/>`;
      s += suspensionBridge({ x0: -150, x1: 1700, y: 930, towerH: 330, color: '#0e0710', sag: 0.5 });
      s += water(855, '#2c1826', '#0e0812', r, '#ffb45c', 75);
      return s;
    },
  },
];

// Canonical copy comes from lib/teams.ts so the baked-in text can never drift
// from what the team page renders next to it.
const teamsSrc = await readFile(join(root, 'lib', 'teams.ts'), 'utf8');
const TEAM_RE = /\{ slug: "([^"]+)", established: "([^"]+)", name: "([^"]+)", city: "([^"]+)", abbr: "[^"]+", league: "([^"]+)", division: "([^"]+)"/g;
const CANON = [...teamsSrc.matchAll(TEAM_RE)].map(([, slug, est, name, city, league, div]) => ({
  slug, est, name, city, league, div,
}));
if (CANON.length !== 30) {
  throw new Error(`parsed ${CANON.length} teams from lib/teams.ts, expected 30 — has the literal shape changed?`);
}

// ---------- render ----------
const only = process.argv[2] ? process.argv.slice(2) : null;
{
  for (const t of TEAMS) {
    if (only && !only.includes(t.file)) continue;
    const c = CANON.find(x => x.slug === t.file);
    if (!c) throw new Error(`no canonical team data for ${t.file}`);
    t.est = c.est;
    t.city = c.city;
    t.team = c.name.toUpperCase();
    t.div = `${c.league} ${c.div}`.toUpperCase();
    const svg = card(t);
    await sharp(Buffer.from(svg), { density: 72 }).png().toFile(join(OUT, `${t.file}.png`));
    console.log('rendered', t.file);
  }
  // A 5x6 contact sheet makes it possible to eyeball all 30 at once. It's a
  // review aid, not a site asset, so it lands in the temp dir rather than public/.
  if (!only) {
    const tw = 480, th = 200;
    const comps = [];
    for (let i = 0; i < TEAMS.length; i++) {
      const buf = await sharp(join(OUT, `${TEAMS[i].file}.png`)).resize(tw, th).toBuffer();
      comps.push({ input: buf, left: (i % 5) * tw, top: Math.floor(i / 5) * th });
    }
    const sheet = join(tmpdir(), 'team-banners-sheet.jpg');
    await sharp({ create: { width: tw * 5, height: th * 6, channels: 3, background: '#222' } })
      .composite(comps).jpeg({ quality: 88 }).toFile(sheet);
    console.log('contact sheet:', sheet);
  }
}
