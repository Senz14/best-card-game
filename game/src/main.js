// Emberfall Duel — entry point. Builds the three screens (title, table,
// end), owns the live game's state box, and honours the ?shot= scenes the
// screenshots were taken with.

import { newGame } from "./game.js";
import { makeHandlers, render, sfx } from "./render.js";
import { setupScene } from "./shots.js";

const titleRoot = document.getElementById("title-screen");
const tableRoot = document.getElementById("table-root");
const endRoot = document.getElementById("end-screen");

let box = { state: null, ui: { attacker: null, pendingSpell: null } };
const handlers = makeHandlers(
  () => box,
  (ui) => { box.ui = ui; },
  () => draw(),
);

function show(screen) {
  titleRoot.hidden = screen !== "title";
  tableRoot.hidden = screen === "title";
  endRoot.hidden = screen !== "end";
}

function draw() {
  if (!box.state) return;
  render(tableRoot, box.state, box.ui, handlers);
  if (box.state.winner) {
    const won = box.state.winner === "player";
    endRoot.innerHTML = "";
    const card = document.createElement("div");
    card.className = `end-card ${won ? "won" : "lost"}`;
    const h = document.createElement("h2");
    h.textContent = won ? "VICTORY" : "DEFEAT";
    const p = document.createElement("p");
    p.textContent = won
      ? `The Ashen Warden crumbles on turn ${box.state.turn}. The ember is yours.`
      : `Your flame gutters out on turn ${box.state.turn}. The Warden keeps the ember… this time.`;
    const again = document.createElement("button");
    again.className = "big-btn";
    again.textContent = "Play Again";
    again.addEventListener("click", () => startLive());
    card.append(h, p, again);
    endRoot.append(card);
    show("end");
  } else {
    show("game");
  }
}

function startLive() {
  box = { state: newGame((Math.random() * 1e9) | 0), ui: { attacker: null, pendingSpell: null } };
  draw();
}

document.getElementById("start-btn").addEventListener("click", () => { sfx.turn(); startLive(); });
document.addEventListener("keydown", (e) => {
  if (!box.state || box.state.winner) return;
  if (e.key === "Escape") { box.ui = { attacker: null, pendingSpell: null }; draw(); }
  if ((e.key === "Enter" || e.key.toLowerCase() === "e") && titleRoot.hidden) handlers.onEndTurn();
});

const params = new URLSearchParams(location.search);
if (params.has("shot")) {
  const seed = Number(params.get("seed") ?? 11) || 11;
  const scene = setupScene(params.get("shot"), seed);
  box = { state: scene.state, ui: { attacker: null, pendingSpell: null } };
  if (scene.screen === "title") show("title");
  else draw();
} else {
  show("title");
}
