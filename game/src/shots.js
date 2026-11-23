// Screenshot scenes behind ?shot=title|table|win|loss&seed=N. Each scene
// starts a real game and steers it with the engine's own playCard, attack
// and endTurn calls, so every frame is the live table exactly as a player
// would see it — the scenes only choose which cards get fetched from the
// deck and which targets get clicked, like a patient player would.

import { attack, endTurn, newGame, playCard } from "./game.js";

/** Move a card from a side's deck into its hand (scene steering only). */
function fetchCard(state, side, cardId) {
  const d = state[side];
  const inDeck = d.deck.indexOf(cardId);
  if (inDeck >= 0) {
    d.deck.splice(inDeck, 1);
    d.hand.push({ uid: 9000 + d.hand.length + Math.floor(state.rng() * 500), cardId });
    return;
  }
  if (!d.hand.some((c) => c.cardId === cardId)) {
    d.hand.push({ uid: 9500 + d.hand.length, cardId });
  }
}

function playById(state, side, cardId, target) {
  fetchCard(state, side, cardId);
  const held = state[side].hand.find((c) => c.cardId === cardId);
  return playCard(state, side, held.uid, target);
}

/** Every ready creature attacks: Guards first (the rules demand it), then face. */
function attackWithAll(state, side) {
  const foe = side === "player" ? "ai" : "player";
  for (const c of state[side].board.slice()) {
    if (state.winner) return;
    const still = state[side].board.find((x) => x.uid === c.uid);
    if (!still || !still.canAttack) continue;
    const guard = state[foe].board.find((x) => x.cardId === "tortoise" || x.cardId === "golem");
    if (guard) attack(state, side, still.uid, { kind: "creature", uid: guard.uid });
    else attack(state, side, still.uid, { kind: "hero" });
  }
}

/** Three turns of honest plays that fill both sides of the table. */
function tableScene(seed) {
  const state = newGame(seed);
  playById(state, "player", "imp");
  endTurn(state); // Warden
  playById(state, "ai", "imp");
  endTurn(state); // turn 2
  playById(state, "player", "tortoise");
  endTurn(state);
  playById(state, "ai", "archer"); // Spark singes the player for 1
  endTurn(state); // turn 3
  playById(state, "player", "herald");
  endTurn(state);
  playById(state, "ai", "herald");
  endTurn(state); // turn 4, player's move, full table
  return state;
}

function winScene(seed) {
  const state = tableScene(seed);
  let guard = 0;
  while (!state.winner && guard < 12) {
    guard += 1;
    attackWithAll(state, "player");
    if (state.winner) break;
    endTurn(state); // Warden passes in the scene
    endTurn(state); // back to the player
  }
  return state;
}

function lossScene(seed) {
  const state = tableScene(seed);
  let guard = 0;
  while (!state.winner && guard < 12) {
    guard += 1;
    endTurn(state); // player passes in the scene
    attackWithAll(state, "ai");
    if (state.winner) break;
    endTurn(state); // back to the player
  }
  return state;
}

/** Returns {state, screen} for the requested scene. */
export function setupScene(name, seed) {
  if (name === "table") return { state: tableScene(seed), screen: "game" };
  if (name === "win") return { state: winScene(seed), screen: "end" };
  if (name === "loss") return { state: lossScene(seed), screen: "end" };
  return { state: newGame(seed), screen: "title" };
}
