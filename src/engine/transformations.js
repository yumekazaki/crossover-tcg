/** Explicit transformation entry conditions keyed by the canonical form card ID. */
const requirements = Object.freeze({
  'CS1-027': { kind: 'distinct-equipment', count: 2 },
  'CS1-028': { kind: 'distinct-equipment-cost', count: 2, minimumPrintedResourceTotal: 6 },
  'CS1-029': { kind: 'at-most-half-hp' },
  'CS1-030': { kind: 'distinct-equipment', count: 2 },
  'CS1-058': { kind: 'dominant-or-continue-count', count: 10 },
  'CS1-148': { kind: 'controlled-franchises', count: 3 },
  'CS1-158': { kind: 'at-most-half-hp' },
  'CS1-166': { kind: 'equipment-count', count: 2 }
});

export const supportedTransformationIds = () => Object.keys(requirements);

function attachedTo(state, hostId) {
  return Object.values(state.instances).filter((instance) => instance.zone === 'attached' && instance.attachedTo === hostId);
}

export function transformationRequirementMet(state, form, base, player, cards) {
  const rule = requirements[form.id];
  if (!rule || !base?.battlefield) return false;
  const equipment = attachedTo(state, base.instanceId);
  if (rule.kind === 'distinct-equipment') return new Set(equipment.map((gear) => cards.get(gear.cardId)?.name)).size >= rule.count;
  if (rule.kind === 'distinct-equipment-cost') {
    const definitions = equipment.map((gear) => cards.get(gear.cardId)).filter(Boolean);
    return definitions.some((first, i) => definitions.some((second, j) => j > i && first.name !== second.name
      && (first.cost?.light ?? 0) + (first.cost?.darkness ?? 0) + (second.cost?.light ?? 0) + (second.cost?.darkness ?? 0) >= rule.minimumPrintedResourceTotal));
  }
  if (rule.kind === 'equipment-count') return equipment.length >= rule.count;
  if (rule.kind === 'at-most-half-hp') return base.battlefield.currentHp <= base.battlefield.maxHp / 2;
  if (rule.kind === 'dominant-or-continue-count') {
    const controlsDominant = [player.center, ...player.party].filter((id) => id && id !== base.instanceId).some((id) => (cards.get(state.instances[id]?.cardId)?.subtypes ?? []).includes('Dominant'));
    return controlsDominant || player.zones.continue.length >= rule.count;
  }
  if (rule.kind === 'controlled-franchises') {
    const franchises = new Set([player.center, ...player.party].filter(Boolean).map((id) => cards.get(state.instances[id]?.cardId)?.franchise));
    franchises.delete(undefined);
    return franchises.size >= rule.count;
  }
  return false;
}
