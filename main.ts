// SOLMAR HEAT — the entrypoint program for gta6-01 (Node 22, stdlib only).
// It hands the game in: copies game/ and screenshots/ from beside this file
// into /output (or MAKEFUN_OUTPUT_DIR outside the grader) and writes
// /output/dossier.json with the kit's vendored buildDossier library, exactly
// as the scorer expects it. Before writing anything it runs its own gate:
// the game must exist with an index.html, screenshots must fit the caps
// (at most 4, each at most 256 KiB), and the finished dossier must fit its
// 1.5 MiB cap. Any violation throws instead of handing in a bad entry.

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const gameDir = join(here, 'game');
const shotsDir = join(here, 'screenshots');

const MAX_SCREENSHOTS = 4;
const MAX_SCREENSHOT_BYTES = 262144;
const DOSSIER_MAX_BYTES = 1572864;

function fail(message) {
  throw new Error(`SOLMAR HEAT entrypoint gate: ${message}`);
}

// --- Gate: the game itself -------------------------------------------------
if (!existsSync(join(gameDir, 'index.html'))) fail('game/index.html is missing');
const gameEntries = readdirSync(gameDir, { recursive: true });
if (gameEntries.length > 993) fail(`game/ holds ${gameEntries.length} entries, over the 993 cap`);
let gameBytes = 0;
for (const entry of gameEntries) {
  const full = join(gameDir, entry);
  if (statSync(full).isFile()) gameBytes += statSync(full).size;
}
if (gameBytes > 50331648) fail(`game/ is ${gameBytes} bytes, over the 48 MiB cap`);

// --- Gate: the screenshots ---------------------------------------------------
if (existsSync(shotsDir)) {
  const shots = readdirSync(shotsDir).filter((name) => statSync(join(shotsDir, name)).isFile());
  if (shots.length > MAX_SCREENSHOTS) fail(`${shots.length} screenshots, over the ${MAX_SCREENSHOTS} cap`);
  for (const name of shots) {
    const size = statSync(join(shotsDir, name)).size;
    if (size > MAX_SCREENSHOT_BYTES) fail(`screenshots/${name} is ${size} bytes, over the 256 KiB cap`);
  }
}

// --- Hand in -----------------------------------------------------------------
mkdirSync(out, { recursive: true });
cpSync(gameDir, join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(shotsDir)) cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });

const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: MAX_SCREENSHOTS, max_bytes: MAX_SCREENSHOT_BYTES },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
if (Buffer.byteLength(dossier, 'utf8') > DOSSIER_MAX_BYTES) {
  fail(`dossier.json is over the 1.5 MiB cap`);
}
writeFileSync(join(out, 'dossier.json'), dossier);
console.log(`SOLMAR HEAT handed in: ${join(out, 'dossier.json')} (${Buffer.byteLength(dossier, 'utf8')} bytes)`);
