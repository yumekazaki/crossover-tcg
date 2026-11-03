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

// Equipment is executable only when an exact, reviewed program is listed here.
const equipmentPrograms = Object.freeze({});

export const getEffectProgram = (cardId) => programs[cardId] ?? null;
export const implementedEffectIds = () => Object.keys(programs);
export const getEquipmentProgram = (cardId) => equipmentPrograms[cardId] ?? null;
export const implementedEquipmentEffectIds = () => Object.keys(equipmentPrograms);
