/** Explicit, reusable effect programs. Text-only records without an audited program stay unavailable. */
const programs = {
  'CS1-281': {
    kind: 'heal', timing: 'main', target: 'allied-character', amount: 3500,
    bonus: { when: 'no-equipment', amount: 1500 }, perNamePerTurn: true
  },
  'CS1-433': {
    kind: 'heal', timing: 'opponent-attack-response', target: 'attacked-character', amount: 4000,
    requires: ['Healer'], perNamePerTurn: true
  },
  'CS1-316': {
    kind: 'aether-channel', timing: 'main', requires: ['Mage', 'Warrior'], differentNames: true,
    resourceChoices: ['light', 'darkness'], amount: 2, locksEquipment: true, perNamePerTurn: true
  },
  'CS1-319': {
    kind: 'theurgy-charge', timing: 'main', requires: ['Persona User', 'Persona User'], differentNames: true,
    cost: { handToMainDeckBottom: 1 }, gain: { momentum: 2 }, locksFinisher: true, perNamePerTurn: true
  }
};

// Equipment is executable only when an exact, reviewed program is listed here.
const equipmentPrograms = Object.freeze({});

export const getEffectProgram = (cardId) => programs[cardId] ?? null;
export const implementedEffectIds = () => Object.keys(programs);
export const getEquipmentProgram = (cardId) => equipmentPrograms[cardId] ?? null;
export const implementedEquipmentEffectIds = () => Object.keys(equipmentPrograms);
