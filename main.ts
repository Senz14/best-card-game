// Emberfall Duel — hand-in program for make.fun bounty
// best-card-game-20261122-1826.
//
// The game itself is the static site in game/ (open game/index.html in a
// desktop browser, no build step, no network). This program hands it in:
// it copies game/ and screenshots/ next to this file into the output
// directory and writes dossier.json there with the vendored make.fun
// library, byte for byte the way the scorer rebuilds it.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Play it locally with:  node serve.ts   (then http://localhost:8080)

import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-game.ts";

const root = fileURLToPath(new URL(".", import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";

mkdirSync(outDir, { recursive: true });
cpSync(join(root, "game"), join(outDir, "game"), { recursive: true });
mkdirSync(join(outDir, "screenshots"), { recursive: true });
const shotsDir = join(root, "screenshots");
if (existsSync(shotsDir)) {
  cpSync(shotsDir, join(outDir, "screenshots"), { recursive: true });
}

// The caps mirror the scorer's own limits, so an entry the scorer would
// refuse is refused here first instead: at most 4 screenshots of 256 KiB,
// at most 993 files / 48 MiB under game/, paths at most 1000 bytes.
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, "dossier.json"), dossier);
console.log("Emberfall Duel handed in: game/, screenshots/ and dossier.json written to", outDir);
