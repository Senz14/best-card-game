// Emberfall Duel — rules engine. Pure state and transitions; rendering and
// input live elsewhere, so the screenshot scenes and the AI drive exactly
// the same functions a human player's clicks do.

import { CARDS, buildDeck } from "./cards.js";

export const START_HP = 20;
export const MAX_ENERGY = 8;
export const BOARD_MAX = 5;
export const HAND_MAX = 7;

/** Deterministic rng (mulberry32) so a seed always deals the same game. */
export function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let nextUid = 1;

function newDuelist(name) {
  return {
    name, hp: START_HP, maxHp: START_HP,
    energy: 0, maxEnergy: 0,
    deck: [], hand: [], board: [],
  };
}

export function newGame(seed) {
  const rng = makeRng(seed);
  const state = {
    rng, turn: 1, active: "player", winner: null, log: [],
    player: newDuelist("You"),
    ai: newDuelist("The Ashen Warden"),
  };
  state.player.deck = buildDeck(rng);
  state.ai.deck = buildDeck(rng);
  draw(state, "player", 3);
  draw(state, "ai", 3);
  startTurn(state, "player");
  return state;
}

function foe(state, side) { return side === "player" ? state.ai : state.player; }
function me(state, side) { return side === "player" ? state.player : state.ai; }

export function draw(state, side, n) {
  const d = me(state, side);
  for (let i = 0; i < n; i += 1) {
    if (d.deck.length === 0) return;
    if (d.hand.length >= HAND_MAX) return;
    d.hand.push({ uid: nextUid++, cardId: d.deck.pop() });
  }
}

function startTurn(state, side) {
  const d = me(state, side);
  d.maxEnergy = Math.min(MAX_ENERGY, d.maxEnergy + 1);
  d.energy = d.maxEnergy;
  for (const c of d.board) c.canAttack = true;
  if (!(state.turn === 1 && side === "player")) draw(state, side, 1);
}

export function endTurn(state) {
  if (state.winner) return;
  const next = state.active === "player" ? "ai" : "player";
  if (next === "player") state.turn += 1;
  state.active = next;
  startTurn(state, next);
}

function damageCreature(state, side, uid, amount) {
  const d = me(state, side);
  const c = d.board.find((x) => x.uid === uid);
  if (!c) return;
  c.hp -= amount;
  if (c.hp <= 0) {
    d.board = d.board.filter((x) => x.uid !== uid);
    state.log.push(`${CARDS[c.cardId].name} falls.`);
  }
}

export function damageHero(state, side, amount) {
  const d = me(state, side);
  d.hp -= amount;
  if (d.hp <= 0 && !state.winner) {
    state.winner = side === "player" ? "ai" : "player";
  }
}

function healHero(state, side, amount) {
  const d = me(state, side);
  d.hp = Math.min(d.maxHp, d.hp + amount);
}

function applySpark(state, side, card) {
  const enemy = side === "player" ? "ai" : "player";
  if (card.spark === "sparkHero1") damageHero(state, enemy, 1);
  if (card.spark === "sparkHero2") damageHero(state, enemy, 2);
  if (card.spark === "sparkHeal2") healHero(state, side, 2);
}

function applySpell(state, side, card, target) {
  const enemy = side === "player" ? "ai" : "player";
  switch (card.spell) {
    case "draw1": draw(state, side, 1); break;
    case "heal4": healHero(state, side, 4); break;
    case "surge": {
      const d = me(state, side);
      d.maxEnergy = Math.min(MAX_ENERGY + 2, d.maxEnergy + 1);
      d.energy += 1;
      break;
    }
    case "ashfall": {
      const ids = foe(state, side).board.map((c) => c.uid);
      for (const uid of ids) damageCreature(state, enemy, uid, 2);
      break;
    }
    case "lash3": {
      if (!target) return false;
      if (target.kind === "hero") damageHero(state, enemy, 3);
      else damageCreature(state, enemy, target.uid, 3);
      break;
    }
    default: return false;
  }
  return true;
}

/**
 * Play the hand card `uid` for `side`. `target` is only used by targeted
 * spells: {kind:"hero"} or {kind:"creature", uid}. Returns true if played.
 */
export function playCard(state, side, uid, target) {
  if (state.winner || state.active !== side) return false;
  const d = me(state, side);
  const idx = d.hand.findIndex((c) => c.uid === uid);
  if (idx < 0) return false;
  const card = CARDS[d.hand[idx].cardId];
  if (card.cost > d.energy) return false;
  if (card.type === "creature" && d.board.length >= BOARD_MAX) return false;
  if (card.type === "spell" && card.needsTarget && !target) return false;
  d.energy -= card.cost;
  d.hand.splice(idx, 1);
  state.log.push(`${d.name} ${side === "player" ? "play" : "plays"} ${card.name}.`);
  if (card.type === "creature") {
    d.board.push({
      uid: nextUid++, cardId: card.id,
      atk: card.atk, hp: card.hp, maxHp: card.hp, canAttack: false,
    });
    applySpark(state, side, card);
  } else {
    applySpell(state, side, card, target);
  }
  return true;
}

export function guardsUp(state, side) {
  return me(state, side).board.some((c) => CARDS[c.cardId].guard);
}

/**
 * Attack with creature `uid` of `side` at `target` ({kind:"hero"} or
 * {kind:"creature", uid} on the enemy side). Guard creatures must be
 * attacked first. Creatures deal damage to each other simultaneously.
 */
export function attack(state, side, uid, target) {
  if (state.winner || state.active !== side) return false;
  const d = me(state, side);
  const c = d.board.find((x) => x.uid === uid);
  if (!c || !c.canAttack) return false;
  const enemy = side === "player" ? "ai" : "player";
  if (guardsUp(state, enemy)) {
    if (target.kind !== "creature") return false;
    const t = foe(state, side).board.find((x) => x.uid === target.uid);
    if (!t || !CARDS[t.cardId].guard) return false;
  }
  c.canAttack = false;
  if (target.kind === "hero") {
    damageHero(state, enemy, c.atk);
  } else {
    const t = foe(state, side).board.find((x) => x.uid === target.uid);
    if (!t) return false;
    const back = t.atk;
    damageCreature(state, enemy, t.uid, c.atk);
    damageCreature(state, side, c.uid, back);
  }
  return true;
}
