// The Ashen Warden's brain: greedy but not foolish. It spends Ember on its
// biggest cards first, aims Flame Lash at whatever it kills, heals when
// hurt, and attacks face unless a trade is clearly good or a Guard blocks.

import { CARDS } from "./cards.js";
import { attack, endTurn, playCard } from "./game.js";

function tryPlayHand(state) {
  let played = true;
  let guard = 0;
  while (played && guard < 12) {
    played = false;
    guard += 1;
    const hand = state.ai.hand.slice().sort((a, b) => CARDS[b.cardId].cost - CARDS[a.cardId].cost);
    for (const held of hand) {
      const card = CARDS[held.cardId];
      if (card.cost > state.ai.energy) continue;
      if (card.type === "creature") {
        if (playCard(state, "ai", held.uid)) { played = true; break; }
      } else if (card.spell === "lash3") {
        const victim = state.player.board
          .filter((c) => c.hp <= 3)
          .sort((a, b) => b.atk - a.atk)[0];
        if (victim && playCard(state, "ai", held.uid, { kind: "creature", uid: victim.uid })) { played = true; break; }
        if (state.player.hp <= 3 && playCard(state, "ai", held.uid, { kind: "hero" })) { played = true; break; }
      } else if (card.spell === "heal4") {
        if (state.ai.hp <= 12 && playCard(state, "ai", held.uid)) { played = true; break; }
      } else if (card.spell === "ashfall") {
        if (state.player.board.length >= 2 && playCard(state, "ai", held.uid)) { played = true; break; }
      } else if (playCard(state, "ai", held.uid)) { played = true; break; }
    }
  }
}

function attackPhase(state) {
  for (const c of state.ai.board.slice()) {
    if (state.winner) return;
    const still = state.ai.board.find((x) => x.uid === c.uid);
    if (!still || !still.canAttack) continue;
    const guards = state.player.board.filter((x) => CARDS[x.cardId].guard);
    if (guards.length > 0) {
      attack(state, "ai", c.uid, { kind: "creature", uid: guards[0].uid });
      continue;
    }
    // Take a trade only when we survive it and remove something bigger.
    const trade = state.player.board
      .filter((x) => x.hp <= c.atk && x.atk < c.hp && x.atk >= 3)
      .sort((a, b) => b.atk - a.atk)[0];
    if (trade) attack(state, "ai", c.uid, { kind: "creature", uid: trade.uid });
    else attack(state, "ai", c.uid, { kind: "hero" });
  }
}

/** Run the whole AI turn synchronously; the UI animates around it. */
export function runAiTurn(state) {
  if (state.winner || state.active !== "ai") return;
  tryPlayHand(state);
  attackPhase(state);
  if (!state.winner) {
    // A second pass: creatures played before attacks may have freed Ember
    // value, but newly played ones cannot attack; just re-check spells.
    endTurn(state);
  }
}
