/** Explicit, reusable effect programs. Text-only records without an audited program stay unavailable. */
const programs = {
  'CS1-281': {
    kind: 'heal', timing: 'main', target: 'allied-character', amount: 3500,
    bonus: { when: 'no-equipment', amount: 1500 }, perNamePerTurn: true
  },
  'CS1-433': {
    kind: 'heal', timing: 'opponent-attack-response', target: 'attacked-character', amount: 4000,
    requires: ['Healer'], perNamePerTurn: true
  }
};

export const getEffectProgram = (cardId) => programs[cardId] ?? null;
export const implementedEffectIds = () => Object.keys(programs);
