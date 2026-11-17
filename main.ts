// SOLMAR HEAT — entrypoint for gta6-01 (Node 22, standard library only).
// Hands the game in: copies game/ and screenshots/ from beside this file
// into the output directory and writes /output/dossier.json with the
// vendored make.fun library, then runs a few sanity gates of its own so a
// broken entry fails loudly here instead of at the grader.
//
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const gameDir = join(here, 'game');
const shotsDir = join(here, 'screenshots');

// Gate 1: the game must exist and have an index page to open.
if (!existsSync(join(gameDir, 'index.html'))) {
  throw new Error('gate: game/index.html is missing');
}

// Gate 2: at most four screenshots, each a JPEG under the 256 KiB cap.
const shots = existsSync(shotsDir) ? readdirSync(shotsDir).sort() : [];
if (shots.length > 4) throw new Error(`gate: ${shots.length} screenshots, at most 4 allowed`);
for (const name of shots) {
  const size = statSync(join(shotsDir, name)).size;
  if (size > 262144) throw new Error(`gate: screenshots/${name} is ${size} bytes, over 256 KiB`);
}

// Gate 3: the game tree stays inside the scorer's caps.
let gameFiles = 0;
let gameBytes = 0;
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p);
    else {
      gameFiles += 1;
      gameBytes += st.size;
    }
  }
})(gameDir);
if (gameFiles > 993) throw new Error(`gate: game/ has ${gameFiles} files, cap is 993`);
if (gameBytes > 50331648) throw new Error(`gate: game/ is ${gameBytes} bytes, cap is 48 MiB`);

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

console.log(
  `SOLMAR HEAT handed in: ${gameFiles} game files (${gameBytes} bytes), ${shots.length} screenshots -> ${out}`,
);
