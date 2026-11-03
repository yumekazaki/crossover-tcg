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
  },
  'CS1-339': {
    kind: 'blade-awakening', timing: 'main', requires: ['Driver'], excludes: ['Blade'],
    revealSubtype: 'Blade', discardType: 'Ability', addTo: 'party', suppressSpecialsUntilOwnerTurn: true,
    ignoresStandardAddAllowance: true, perNamePerTurn: true
  },
  'CS1-311': {
    kind: 'armiger-preparation', timing: 'main', requires: ['Sword Wielder'],
    minimumAttachedEquipment: 3, gain: { light: 1, darkness: 1 }, suppressNextEquipmentAbilities: true, perNamePerTurn: true
  },
  'CS1-394': {
    kind: 'curaga-response', timing: 'opponent-attack-response', targetCount: 2,
    requires: ['Healer'], amount: 2500, opponentSpeedReward: { resource: 'momentum', amount: 1 }, perNamePerTurn: true
  },
  'CS1-436': {
    kind: 'soul-sever', timing: 'opponent-speed-response', reduceHealing: 3000, perNamePerTurn: true
  }
};

// Equipment is executable only when an exact, reviewed program is listed here.
const equipmentPrograms = Object.freeze({});
const triggerPrograms = Object.freeze({
  'CS1-011': {
    event: 'character-defeated', kind: 'mickey-defeat', perNamePerTurn: true,
    requiresOtherAlliedCharacter: true, healMain: 3000, drawDiscardIfNoParty: true
  }
});

export const getEffectProgram = (cardId) => programs[cardId] ?? null;
export const implementedEffectIds = () => Object.keys(programs);
export const getEquipmentProgram = (cardId) => equipmentPrograms[cardId] ?? null;
export const implementedEquipmentEffectIds = () => Object.keys(equipmentPrograms);
export const getTriggerProgram = (cardId) => triggerPrograms[cardId] ?? null;
export const implementedTriggerIds = () => Object.keys(triggerPrograms);
