// SOLMAR HEAT — gta6-01 entry program (Node 22, standard library only).
// It copies game/ and screenshots/ from beside this file to /output and
// writes /output/dossier.json with the vendored make.fun library, after its
// own gate checks refuse anything the scorer would refuse.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// --- Own gate validation (mirrors the scorer's reference/gate.json) ---
function fail(message) {
  throw new Error(`SOLMAR HEAT gate: ${message}`);
}

function walkGame(dir, rel = '') {
  let entries = 0;
  let bytes = 0;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const relPath = rel ? `${rel}/${name}` : name;
    const st = statSync(path);
    if (!st.isFile() && !st.isDirectory()) fail(`game/${relPath} is not a plain file or directory`);
    entries++;
    if (Buffer.byteLength(relPath, 'utf8') > 1000) fail(`game/${relPath} path is over 1000 bytes`);
    if (st.isFile()) bytes += st.size;
    else {
      const sub = walkGame(path, relPath);
      entries += sub.entries;
      bytes += sub.bytes;
    }
  }
  return { entries, bytes };
}

const gameDir = join(here, 'game');
if (!existsSync(join(gameDir, 'index.html'))) fail('game/index.html is missing');
if (statSync(join(gameDir, 'index.html')).size > 1024 * 1024) fail('game/index.html is over 1 MiB');
const gameStats = walkGame(gameDir);
if (gameStats.entries > 993) fail(`game/ holds ${gameStats.entries} entries, over the 993 cap`);
if (gameStats.bytes > 48 * 1024 * 1024) fail(`game/ holds ${gameStats.bytes} bytes, over the 48 MiB cap`);

const shotsDir = join(here, 'screenshots');
const shots = existsSync(shotsDir)
  ? readdirSync(shotsDir).filter((n) => !n.startsWith('.'))
  : [];
if (shots.length < 3 || shots.length > 4) fail(`screenshots/ holds ${shots.length} images, need 3 or 4`);
for (const name of shots) {
  if (!/^[A-Za-z0-9._-]+$/.test(name) || name.startsWith('-')) fail(`screenshot name ${name} is not allowed`);
  const size = statSync(join(shotsDir, name)).size;
  if (size > 256 * 1024) fail(`screenshot ${name} is ${size} bytes, over the 256 KiB cap`);
  if (!/\.(png|jpe?g)$/i.test(name)) fail(`screenshot ${name} is not a PNG or JPEG`);
}

// --- Hand the entry in ---
mkdirSync(out, { recursive: true });
cpSync(gameDir, join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(shotsDir)) cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });

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

console.log(`SOLMAR HEAT handed in: ${gameStats.entries} game entries, ${shots.length} screenshots, dossier written to ${join(out, 'dossier.json')}`);
