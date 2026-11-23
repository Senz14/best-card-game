// Emberfall Duel — the card pool. Every name, creature and spell here is
// original to this game. A card is either a creature (atk/hp, stays on the
// table) or a spell (one-shot effect). "Spark" effects fire the moment a
// creature is played; "Guard" creatures must be attacked before any other
// target on their side.

export const CARDS = {
  imp: {
    id: "imp", name: "Cinder Imp", cost: 1, type: "creature", atk: 2, hp: 1,
    text: "Small, loud, flammable.", hue: 18,
  },
  tortoise: {
    id: "tortoise", name: "Mossback Tortoise", cost: 2, type: "creature", atk: 1, hp: 4,
    text: "Guard. Slow is a strategy.", guard: true, hue: 110,
  },
  archer: {
    id: "archer", name: "Ember Archer", cost: 2, type: "creature", atk: 2, hp: 2,
    text: "Spark: deal 1 damage to the enemy duelist.", spark: "sparkHero1", hue: 32,
  },
  herald: {
    id: "herald", name: "Storm Herald", cost: 3, type: "creature", atk: 3, hp: 3,
    text: "Arrives with thunder, leaves with thunder.", hue: 255,
  },
  witch: {
    id: "witch", name: "Gloam Witch", cost: 3, type: "creature", atk: 2, hp: 4,
    text: "Spark: restore 2 health to your duelist.", spark: "sparkHeal2", hue: 285,
  },
  golem: {
    id: "golem", name: "Ironwood Golem", cost: 4, type: "creature", atk: 4, hp: 5,
    text: "Guard. A forest that learned to punch.", guard: true, hue: 80,
  },
  dragon: {
    id: "dragon", name: "Pyre Dragon", cost: 5, type: "creature", atk: 5, hp: 4,
    text: "Spark: deal 2 damage to the enemy duelist.", spark: "sparkHero2", hue: 0,
  },
  phoenix: {
    id: "phoenix", name: "Ash Phoenix", cost: 6, type: "creature", atk: 6, hp: 5,
    text: "It has burned before. It will burn again.", hue: 45,
  },
  kindling: {
    id: "kindling", name: "Kindling", cost: 1, type: "spell",
    text: "Draw a card.", spell: "draw1", hue: 40,
  },
  lash: {
    id: "lash", name: "Flame Lash", cost: 2, type: "spell",
    text: "Deal 3 damage to a creature or duelist.", spell: "lash3", needsTarget: true, hue: 8,
  },
  dew: {
    id: "dew", name: "Mending Dew", cost: 2, type: "spell",
    text: "Restore 4 health to your duelist.", spell: "heal4", hue: 160,
  },
  surge: {
    id: "surge", name: "Ember Surge", cost: 2, type: "spell",
    text: "Gain +1 max Ember, permanently.", spell: "surge", hue: 200,
  },
  ashfall: {
    id: "ashfall", name: "Ashfall", cost: 4, type: "spell",
    text: "Deal 2 damage to ALL enemy creatures.", spell: "ashfall", hue: 220,
  },
};

// Two of the cheap cards, a spread of midrange, one of each finisher and
// spell: 24 cards, shuffled by the caller's rng.
const DECK_RECIPE = [
  "imp", "imp", "tortoise", "tortoise", "archer", "archer",
  "herald", "herald", "witch", "golem", "golem", "dragon",
  "phoenix", "kindling", "kindling", "lash", "lash", "dew",
  "surge", "ashfall", "imp", "archer", "herald", "witch",
];

export function buildDeck(rng) {
  const deck = DECK_RECIPE.slice();
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
