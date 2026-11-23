// Emberfall Duel — DOM rendering and pointer input. The whole table is
// rebuilt from state on every change; cards are real DOM so their values
// stay readable at any size, and every interactive element is a button.

import { CARDS } from "./cards.js";
import { attack, endTurn, playCard } from "./game.js";
import { runAiTurn } from "./ai.js";

let audioCtx = null;
function beep(freq, dur, type = "sine", gain = 0.05, when = 0) {
  try {
    audioCtx = audioCtx ?? new (window.AudioContext || window.webkitAudioContext)();
    const t = audioCtx.currentTime + when;
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = type; osc.frequency.value = freq;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(audioCtx.destination);
    osc.start(t); osc.stop(t + dur);
  } catch { /* sound is a garnish, never a blocker */ }
}
export const sfx = {
  play: () => { beep(520, 0.09, "triangle"); beep(780, 0.1, "triangle", 0.04, 0.06); },
  attack: () => beep(140, 0.16, "sawtooth", 0.07),
  turn: () => beep(660, 0.07, "sine", 0.04),
  win: () => { [523, 659, 784, 1046].forEach((f, i) => beep(f, 0.16, "triangle", 0.05, i * 0.11)); },
  lose: () => { [392, 330, 262, 196].forEach((f, i) => beep(f, 0.18, "triangle", 0.05, i * 0.12)); },
};

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}

function artSvg(card) {
  const hue = card.hue;
  const path = card.type === "spell"
    ? "M32 4 L39 25 L61 25 L43 38 L49 59 L32 46 L15 59 L21 38 L3 25 L25 25 Z"
    : "M32 2 C38 14 48 20 48 34 A16 16 0 1 1 16 34 C16 20 26 14 32 2 Z";
  return `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="${path}" fill="hsl(${hue} 85% 58%)" stroke="hsl(${hue} 90% 30%)" stroke-width="2"/></svg>`;
}

function cardNode(state, held, owner, ui, handlers) {
  const card = CARDS[held.cardId];
  const node = el("button", `card ${card.type}`);
  node.style.setProperty("--hue", card.hue);
  node.dataset.uid = held.uid;
  const top = el("span", "card-top");
  top.append(el("span", "cost", String(card.cost)), el("span", "card-name", card.name));
  node.append(top);
  const art = el("span", "card-art");
  art.innerHTML = artSvg(card);
  node.append(art);
  node.append(el("span", "card-text", card.text));
  if (card.type === "creature") {
    const stats = el("span", "card-stats");
    stats.append(el("span", "atk", String(card.atk)), el("span", "hp", String(card.hp)));
    node.append(stats);
  }
  if (owner === "hand") {
    if (card.cost > state.player.energy || state.active !== "player") node.classList.add("unaffordable");
    if (ui.pendingSpell === held.uid) node.classList.add("selected");
    node.addEventListener("click", () => handlers.onHandCard(held.uid));
  }
  return node;
}

function boardCardNode(state, c, owner, ui, handlers) {
  const card = CARDS[c.cardId];
  const node = el("button", `card on-board ${card.type}`);
  node.style.setProperty("--hue", card.hue);
  const top = el("span", "card-top");
  top.append(el("span", "cost", String(card.cost)), el("span", "card-name", card.name));
  node.append(top);
  const art = el("span", "card-art");
  art.innerHTML = artSvg(card);
  node.append(art);
  node.append(el("span", "card-text", card.text));
  const stats = el("span", "card-stats");
  stats.append(el("span", "atk", String(c.atk)), el("span", "hp", String(c.hp)));
  if (c.hp < c.maxHp) stats.lastChild.classList.add("hurt");
  node.append(stats);
  if (owner === "player") {
    if (c.canAttack && state.active === "player" && !state.winner) node.classList.add("ready");
    if (ui.attacker === c.uid) node.classList.add("selected");
    node.addEventListener("click", () => handlers.onOwnCreature(c.uid));
  } else {
    if (ui.attacker || ui.pendingSpell) node.classList.add("targetable");
    node.addEventListener("click", () => handlers.onEnemyCreature(c.uid));
  }
  return node;
}

function portrait(state, side, ui, handlers) {
  const d = side === "player" ? state.player : state.ai;
  const wrap = el("div", `portrait ${side}`);
  const face = el("button", "face", side === "player" ? "Y" : "W");
  face.title = d.name;
  if (side === "ai" && (ui.attacker || ui.pendingSpell)) face.classList.add("targetable");
  if (side === "ai") face.addEventListener("click", () => handlers.onEnemyHero());
  const info = el("div", "portrait-info");
  info.append(el("div", "pname", d.name));
  info.append(el("div", "php", `HP ${Math.max(0, d.hp)} / ${d.maxHp}`));
  info.append(el("div", "pdeck", `Deck ${d.deck.length} · Hand ${d.hand.length}`));
  if (side === "player" || side === "ai") {
    info.append(el("div", "penergy", `Ember ${d.energy} / ${d.maxEnergy}`));
  }
  wrap.append(face, info);
  return wrap;
}

export function render(root, state, ui, handlers) {
  root.innerHTML = "";
  const table = el("div", "table");
  const topRow = el("div", "row top-row");
  topRow.append(portrait(state, "ai", ui, handlers));
  const aiHand = el("div", "hand backs");
  for (const _ of state.ai.hand) aiHand.append(el("div", "card-back"));
  topRow.append(aiHand);
  table.append(topRow);

  const aiBoard = el("div", "board ai-board");
  if (state.ai.board.length === 0) aiBoard.append(el("div", "empty-board", "The Warden's side is empty"));
  for (const c of state.ai.board) aiBoard.append(boardCardNode(state, c, "ai", ui, handlers));
  table.append(aiBoard);

  const mid = el("div", "midline");
  const banner = state.winner
    ? (state.winner === "player" ? "The Warden is ash. You win!" : "Your flame gutters out. You lose.")
    : state.active === "player" ? `Your turn — turn ${state.turn}` : "The Warden is thinking…";
  mid.append(el("div", "banner", banner));
  mid.append(el("div", "logline", state.log[state.log.length - 1] ?? ""));
  table.append(mid);

  const myBoard = el("div", "board my-board");
  if (state.player.board.length === 0) myBoard.append(el("div", "empty-board", "Your side is empty — play a creature"));
  for (const c of state.player.board) myBoard.append(boardCardNode(state, c, "player", ui, handlers));
  table.append(myBoard);

  const bottom = el("div", "row bottom-row");
  bottom.append(portrait(state, "player", ui, handlers));
  const hand = el("div", "hand");
  for (const held of state.player.hand) hand.append(cardNode(state, held, "hand", ui, handlers));
  bottom.append(hand);
  const endBtn = el("button", "end-turn", "End Turn ⏎");
  endBtn.disabled = state.active !== "player" || !!state.winner;
  endBtn.addEventListener("click", () => handlers.onEndTurn());
  bottom.append(endBtn);
  table.append(bottom);
  root.append(table);
}

/** Wire the standard human input flow for a live game. */
export function makeHandlers(get, set, rerender) {
  const handlers = {
    onHandCard(uid) {
      const { state, ui } = get();
      if (state.active !== "player" || state.winner) return;
      const held = state.player.hand.find((c) => c.uid === uid);
      if (!held) return;
      const card = CARDS[held.cardId];
      if (card.needsTarget) {
        set({ ...ui, pendingSpell: ui.pendingSpell === uid ? null : uid, attacker: null });
        rerender();
        return;
      }
      if (playCard(state, "player", uid)) { sfx.play(); set({ attacker: null, pendingSpell: null }); }
      rerender();
    },
    onOwnCreature(uid) {
      const { state, ui } = get();
      if (state.active !== "player" || state.winner) return;
      set({ ...ui, attacker: ui.attacker === uid ? null : uid, pendingSpell: null });
      rerender();
    },
    onEnemyCreature(uid) {
      const { state, ui } = get();
      if (state.winner) return;
      if (ui.pendingSpell) {
        if (playCard(state, "player", ui.pendingSpell, { kind: "creature", uid })) sfx.attack();
        set({ ...ui, pendingSpell: null });
      } else if (ui.attacker) {
        if (attack(state, "player", ui.attacker, { kind: "creature", uid })) sfx.attack();
        set({ ...ui, attacker: null });
      }
      rerender();
    },
    onEnemyHero() {
      const { state, ui } = get();
      if (state.winner) return;
      if (ui.pendingSpell) {
        if (playCard(state, "player", ui.pendingSpell, { kind: "hero" })) sfx.attack();
        set({ ...ui, pendingSpell: null });
      } else if (ui.attacker) {
        if (attack(state, "player", ui.attacker, { kind: "hero" })) sfx.attack();
        set({ ...ui, attacker: null });
      }
      rerender();
    },
    onEndTurn() {
      const { state } = get();
      if (state.active !== "player" || state.winner) return;
      sfx.turn();
      set({ attacker: null, pendingSpell: null });
      endTurn(state);
      rerender();
      window.setTimeout(() => {
        if (!state.winner && state.active === "ai") {
          runAiTurn(state);
          if (state.winner) (state.winner === "player" ? sfx.win : sfx.lose)();
        }
        rerender();
      }, 650);
    },
  };
  return handlers;
}
