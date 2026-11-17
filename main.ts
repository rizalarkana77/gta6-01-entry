// SOLMAR HEAT — a make.fun gta6-01 entry (Node 22, standard library only).
// The game is this directory's game/ folder: plain static files a desktop
// browser loads offline (game/index.html and its ES modules, no library and
// no network request). This program hands it in: it copies game/ and
// screenshots/ from beside this file to /output and writes
// /output/dossier.json, the summary the judge reads, with the vendored
// make.fun library. It is deterministic: two runs write byte-identical
// output.
//
// Serve the game locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Own validation: refuse to write an entry the gate would refuse, so a bad
// build fails loudly here instead of silently scoring 0.
function fail(msg) {
  throw new Error('SOLMAR HEAT entry refused: ' + msg);
}

function walk(dir, rel) {
  let out2 = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const r = rel ? rel + '/' + name : name;
    const st = statSync(p);
    if (st.isDirectory()) out2 = out2.concat(walk(p, r));
    else if (st.isFile()) out2.push({ path: r, size: st.size });
    else fail('not a plain file: ' + r);
  }
  return out2;
}

const shotDir = join(here, 'screenshots');
const shots = existsSync(shotDir) ? readdirSync(shotDir).filter((n) => !n.startsWith('.')) : [];
if (shots.length < 3 || shots.length > 4) fail('need 3-4 screenshots, have ' + shots.length);
for (const s of shots) {
  if (!/^[A-Za-z0-9._-]{1,128}$/.test(s) || s.startsWith('-')) fail('bad screenshot name: ' + s);
  const sz = statSync(join(shotDir, s)).size;
  if (sz > 262144) fail('screenshot over 256 KiB: ' + s + ' (' + sz + ' bytes)');
}
const gameFiles = walk(join(here, 'game'), '');
if (gameFiles.length > 993) fail('game/ over 993 files: ' + gameFiles.length);
let gameBytes = 0;
for (const f of gameFiles) {
  gameBytes += f.size;
  if (new TextEncoder().encode(f.path).length > 1000) fail('game path over 1000 bytes: ' + f.path);
}
if (gameBytes > 50331648) fail('game/ over 48 MiB: ' + gameBytes + ' bytes');
const indexStat = statSync(join(here, 'game', 'index.html'));
if (indexStat.size > 1048576) fail('game/index.html over 1 MiB: ' + indexStat.size + ' bytes');

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the
// bytes; the others refuse an entry the scorer would refuse (more than 4
// screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of
// game files, in all, or a path under game/ over 1000 bytes: game/ counts
// beside /output's own 1000-entry cap, its screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
