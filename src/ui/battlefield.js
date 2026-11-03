import { getArtwork } from '../data/cards.js';

/**
 * Render the two local practice seats in a face-to-face layout.
 * This view is presentation only: all actions remain owned by the rules engine.
 */
export function renderBattlefield({
  state,
  cards = [],
  actorId = null,
  localPlayerId = 'p1',
  onInspect = () => {},
  onSelectCard = () => {},
  selectedInstanceId = null,
  sandboxMode = false,
  onResourceAdjust = () => {},
  legalActions = [],
  statusText = '',
  statusDetail = '',
} = {}) {
  const cardById = new Map(cards.map((card) => [card.id, card]));
  const instanceById = state?.instances ?? {};
  const players = state?.players ?? {};
  const localId = players[localPlayerId] ? localPlayerId : Object.keys(players)[0];
  const opponentId = Object.keys(players).find((id) => id !== localId);

  const root = el('div', 'battlefield-seats');
  if (!state || !localId || !opponentId) {
    root.append(el('p', 'battlefield-empty', 'The battlefield will appear when a match begins.'));
    return root;
  }

  const highlighted = getLegalHighlights(legalActions, actorId, players);
  root.append(renderPlayerSide({
    player: players[opponentId], playerId: opponentId, side: 'opponent', isLocal: false,
    actorId, instanceById, cardById, highlighted, onInspect, onSelectCard, selectedInstanceId, sandboxMode, onResourceAdjust,
  }));
  root.append(renderCenterStatus({ state, players, statusText, statusDetail }));
  root.append(renderPlayerSide({
    player: players[localId], playerId: localId, side: 'local', isLocal: true,
    actorId, instanceById, cardById, highlighted, onInspect, onSelectCard, selectedInstanceId, sandboxMode, onResourceAdjust,
  }));
  return root;
}

function renderPlayerSide({ player, playerId, side, isLocal, actorId, instanceById, cardById, highlighted, onInspect, onSelectCard, selectedInstanceId, sandboxMode, onResourceAdjust }) {
  const seat = el('section', `battlefield-seat battlefield-seat--${side}`);
  seat.dataset.playerId = playerId;
  const header = el('header', 'battlefield-seat__header');
  const identity = el('div', 'battlefield-seat__identity');
  identity.append(el('span', 'battlefield-seat__side-label', isLocal ? 'YOUR SIDE' : 'OPPONENT'),
    el('h3', '', player.name || (isLocal ? 'Player One' : 'Player Two')));
  if (playerId === actorId) identity.append(el('span', 'battlefield-seat__turn-badge', 'ACTION PLAYER'));

  const resources = el('div', 'battlefield-resources');
  resources.setAttribute('aria-label', `${player.name || playerId} resources and life`);
  resources.append(resource('life', '♥', 'LIFE', player.life, playerId),
    resource('momentum', '✦', 'MOMENTUM', player.resources?.momentum, playerId, sandboxMode, onResourceAdjust),
    resource('light', '☼', 'LIGHT', player.resources?.light, playerId, sandboxMode, onResourceAdjust),
    resource('darkness', '◐', 'DARKNESS', player.resources?.darkness, playerId, sandboxMode, onResourceAdjust));
  header.append(identity, resources);
  seat.append(header);

  // This build is local practice; never expose the rival's private hand on the shared screen.
  const handOwner = isLocal;
  const hand = renderHand(player, handOwner, instanceById, cardById, highlighted, onInspect, onSelectCard, selectedInstanceId);

  const field = el('div', 'battlefield-seat__field');
  const party = Array.isArray(player.party) ? player.party : [];
  const centerId = player.center;
  const characterRow = el('div', 'battlefield-character-row');
  characterRow.append(renderCharacterZone({
    instanceId: centerId, label: 'CENTER · MAIN', index: -1,
    isCenter: true, instanceById, cardById, highlighted, onSelectCard, selectedInstanceId,
  }));

  const partyGrid = el('div', 'battlefield-party-grid');
  for (let index = 0; index < 6; index += 1) {
    partyGrid.append(renderCharacterZone({
      instanceId: party[index] ?? null, label: `PARTY ${index + 1}`, index,
      isCenter: false, instanceById, cardById, highlighted, onSelectCard, selectedInstanceId,
      deploymentAvailable: highlighted.deployments.get(playerId)?.has(index) ?? false,
    }));
  }
  field.append(characterRow, partyGrid);

  const equipment = renderEquipment(player, instanceById, cardById, onInspect);
  seat.append(hand, field, equipment, renderZoneSummary(player, cardById));
  return seat;
}

function renderCharacterZone({ instanceId, label, index, isCenter, instanceById, cardById, highlighted, onSelectCard, selectedInstanceId, deploymentAvailable = false }) {
  const instance = instanceId ? instanceById[instanceId] : null;
  const card = instance ? cardById.get(instance.cardId) : null;
  const classes = ['battlefield-zone', isCenter ? 'battlefield-zone--center' : 'battlefield-zone--party'];
  if (!card) classes.push('is-empty');
  else classes.push('has-character');
  if (!isCenter && deploymentAvailable && !card) classes.push('is-legal-deployment');
  if (instanceId && highlighted.hosts.has(instanceId)) classes.push('is-legal-target');
  if (instanceId && highlighted.attackers.has(instanceId)) classes.push('is-attack-ready');
  if (instanceId && highlighted.targets.has(instanceId)) classes.push('is-attack-target');
  if (instanceId && highlighted.guards.has(instanceId)) classes.push('is-legal-guard');
  if (instanceId && highlighted.sources.has(instanceId)) classes.push('has-available-action');
  if (instanceId === selectedInstanceId) classes.push('is-selected');

  const zone = el('button', classes.join(' '));
  zone.type = 'button';
  if (!card) {
    zone.disabled = true;
    zone.setAttribute('aria-label', `${isCenter ? 'Center Zone' : `Party Zone ${index + 1}`} empty${deploymentAvailable ? ', placement available through the legal action menu' : ''}`);
    zone.append(el('span', 'battlefield-zone__label', label), el('span', 'battlefield-zone__empty-mark', '+'),
      el('span', 'battlefield-zone__empty-copy', deploymentAvailable ? 'PLACEMENT AVAILABLE' : 'EMPTY ZONE'));
    return zone;
  }

  zone.setAttribute('aria-label', `${label}: ${card.name}, ${instance.battlefield?.currentHp ?? card.statistics?.hp ?? 0} of ${instance.battlefield?.maxHp ?? card.statistics?.hp ?? 0} HP, ${card.statistics?.atk ?? 0} attack. Inspect card.`);
  zone.dataset.instanceId = instanceId;
  zone.title = 'Inspect card';
  const artwork = getArtwork(card);
  if (artwork.src) {
    const image = el('img', 'battlefield-zone__art');
    image.src = artwork.src; image.alt = artwork.label; image.loading = 'lazy'; image.decoding = 'async';
    image.addEventListener('error', () => image.remove(), { once: true });
    zone.append(image);
  } else {
    const mark = el('span', 'battlefield-zone__mark', '◇'); mark.setAttribute('aria-hidden', 'true'); zone.append(mark);
  }

  const shade = el('span', 'battlefield-zone__shade'); shade.setAttribute('aria-hidden', 'true');
  const info = el('span', 'battlefield-zone__info');
  info.append(el('span', 'battlefield-zone__label', label), el('strong', '', card.name));
  const subtypeText = (card.subtypes ?? []).slice(0, 2).join(' · ');
  if (subtypeText) info.append(el('span', 'battlefield-zone__subtypes', subtypeText));
  const stats = el('span', 'battlefield-zone__stats', `${format(instance.battlefield?.currentHp)} / ${format(instance.battlefield?.maxHp)} HP  ·  ${format(card.statistics?.atk)} ATK`);
  info.append(stats);
  zone.append(shade, info);
  zone.addEventListener('click', () => onSelectCard(instanceId, card));
  return zone;
}

function renderEquipment(player, instanceById, cardById, onInspect) {
  const hostIds = new Set([player.center, ...(player.party ?? [])].filter(Boolean));
  const attached = Object.values(instanceById).filter((instance) =>
    instance.zone === 'attached' && hostIds.has(instance.attachedTo));
  const section = el('section', 'battlefield-equipment');
  const heading = el('div', 'battlefield-equipment__heading');
  heading.append(el('h4', '', 'EQUIPMENT'), el('span', '', `${attached.length} attached`));
  section.append(heading);
  const list = el('div', 'battlefield-equipment__list');
  for (const gear of attached) {
    const card = cardById.get(gear.cardId);
    if (!card) continue;
    const chip = el('button', 'battlefield-equipment__item'); chip.type = 'button';
    chip.setAttribute('aria-label', `Inspect ${card.name}, equipped to ${getInstanceName(gear.attachedTo, instanceById, cardById)}`);
    const artwork = getArtwork(card);
    if (artwork.src) {
      const image = el('img', 'battlefield-equipment__art');
      image.src = artwork.src; image.alt = ''; image.loading = 'lazy'; image.decoding = 'async';
      image.addEventListener('error', () => image.remove(), { once: true }); chip.append(image);
    }
    const text = el('span', 'battlefield-equipment__copy');
    text.append(el('strong', '', card.name), el('small', '', `EQUIPPED · ${getInstanceName(gear.attachedTo, instanceById, cardById)}`));
    chip.append(text);
    if ((gear.abilitiesSuppressedUntilTurn ?? 0) > 0) chip.classList.add('is-suppressed');
    chip.addEventListener('click', () => onInspect(card));
    list.append(chip);
  }
  if (!attached.length) list.append(el('p', 'battlefield-equipment__empty', 'No Equipment attached yet.'));
  section.append(list);
  return section;
}

function renderZoneSummary(player, cardById) {
  const summary = el('div', 'battlefield-zone-summary');
  const registrationIds = player.registration?.equipmentIds ?? [];
  const registeredSlots = registrationIds.reduce((total, id) => {
    const card = cardById.get(id);
    return total + Number(card?.slots ?? (card?.transformation ? 2 : 1));
  }, 0);
  const zones = player.zones ?? {};
  summary.append(
    summaryMetric('MAIN DECK', zones.mainDeck?.length ?? 0),
    summaryMetric('CONTINUE?', zones.continue?.length ?? 0),
    summaryMetric('ARSENAL', `${zones.arsenal?.length ?? 0} cards · ${registeredSlots} slots`),
  );
  return summary;
}

function summaryMetric(label, value) {
  const item = el('span', 'battlefield-zone-summary__item');
  item.append(el('small', 'battlefield-zone-summary__label', label),
    el('strong', 'battlefield-zone-summary__value', value));
  return item;
}

function renderHand(player, reveal, instanceById, cardById, highlighted, onInspect, onSelectCard, selectedInstanceId) {
  const section = el('section', `battlefield-hand${reveal ? ' is-revealed' : ' is-concealed'}`);
  const heading = el('div', 'battlefield-hand__heading');
  heading.append(el('span', 'battlefield-hand__title', reveal ? 'YOUR HAND' : 'OPPONENT HAND'),
    el('span', 'battlefield-hand__count', `${player.zones.hand.length} CARDS`));
  const list = el('div', 'battlefield-hand__cards');
  if (reveal) {
    for (const id of player.zones.hand) {
      const instance = instanceById[id]; const card = instance && cardById.get(instance.cardId);
      if (!card) continue;
      const item = el('article', `battlefield-hand__card${highlighted.hand.has(id) ? ' has-available-action' : ''}${id === selectedInstanceId ? ' is-selected' : ''}`);
      const select = el('button', 'battlefield-hand__select'); select.type = 'button';
      select.setAttribute('aria-label', `Select ${card.name} in hand`);
      select.setAttribute('aria-pressed', String(id === selectedInstanceId));
      const artwork = getArtwork(card);
      if (artwork.src) {
        const image = el('img', 'battlefield-hand__art'); image.src = artwork.src; image.alt = artwork.label;
        image.loading = 'lazy'; image.decoding = 'async'; image.addEventListener('error', () => image.remove(), { once: true });
        select.append(image);
      } else select.append(el('span', 'battlefield-hand__mark', mark(card.type)));
      select.append(el('strong', 'battlefield-hand__name', card.name),
        el('small', 'battlefield-hand__meta', `${card.type} · ${format(card.cost?.momentum)} M`));
      select.addEventListener('click', () => onSelectCard(id, card));
      const inspect = el('button', 'battlefield-hand__inspect', 'i'); inspect.type = 'button';
      inspect.setAttribute('aria-label', `Inspect ${card.name}`); inspect.title = 'Inspect card';
      inspect.addEventListener('click', () => onInspect(card));
      item.append(select, inspect);
      list.append(item);
    }
    if (!player.zones.hand.length) list.append(el('p', 'battlefield-hand__empty', 'Your hand is empty.'));
  } else {
    const visibleBacks = Math.min(8, player.zones.hand.length);
    const stack = el('div', 'battlefield-hand__backs');
    for (let index = 0; index < visibleBacks; index += 1) {
      const back = el('span', 'battlefield-hand__back'); back.setAttribute('aria-hidden', 'true'); stack.append(back);
    }
    if (player.zones.hand.length > visibleBacks) stack.append(el('span', 'battlefield-hand__overflow', `+${player.zones.hand.length - visibleBacks}`));
    stack.setAttribute('role', 'img'); stack.setAttribute('aria-label', `Opponent has ${player.zones.hand.length} cards in hand`);
    list.append(stack);
  }
  section.append(heading, list);
  return section;
}

function renderCenterStatus({ state, players, statusText, statusDetail }) {
  const center = el('section', 'battlefield-center-status');
  center.setAttribute('aria-live', 'polite');
  const phase = state.phase ? state.phase.replaceAll('-', ' ').toUpperCase() : 'SETUP';
  const actor = state.menu?.priorityPlayerId ?? state.priorityPlayerId ?? state.activePlayerId;
  const current = statusText || `${phase} · TURN ${state.turnNumber ?? 1}`;
  const detail = statusDetail || (state.menu
    ? `Response window · ${players[state.menu.priorityPlayerId]?.name ?? 'Player'} has priority`
    : state.resolutionChoice
      ? state.resolutionChoice.prompt
      : actor ? `${players[actor]?.name ?? actor} has priority` : 'Waiting for the next action');
  center.append(el('span', 'battlefield-center-status__eyebrow', 'MATCH STATUS'),
    el('strong', 'battlefield-center-status__phase', current),
    el('span', 'battlefield-center-status__detail', detail));
  return center;
}

function getLegalHighlights(actions, actorId, players) {
  const highlights = { attackers: new Set(), targets: new Set(), hosts: new Set(), guards: new Set(), sources: new Set(), hand: new Set(), deployments: new Map() };
  const actor = players[actorId];
  const deploy = (index) => {
    if (!Number.isInteger(index) || index < 0 || !actor) return;
    if (!highlights.deployments.has(actorId)) highlights.deployments.set(actorId, new Set());
    highlights.deployments.get(actorId).add(index);
  };
  for (const action of actions ?? []) {
    if (action.type === 'DECLARE_ATTACK') {
      if (action.attackerInstanceId) highlights.attackers.add(action.attackerInstanceId);
      if (action.targetInstanceId) highlights.targets.add(action.targetInstanceId);
    }
    if (action.type === 'ATTACH_EQUIPMENT' && action.hostInstanceId) highlights.hosts.add(action.hostInstanceId);
    if (action.type === 'ASSIGN_GUARDS') for (const id of action.eligibleInstanceIds ?? []) highlights.guards.add(id);
    if (action.type === 'TRANSFORM' && action.baseInstanceId) highlights.sources.add(action.baseInstanceId);
    if (action.type === 'SWITCH_CENTER' && action.partyInstanceId) highlights.sources.add(action.partyInstanceId);
    if (action.type === 'ADD_TO_PARTY' && actor) deploy(actor.party?.findIndex((id) => id == null));
    if (action.type === 'RESOLVE_CHOICE' && action.stage === 'ADD_PARTY' && Number.isInteger(action.partyIndex)) deploy(action.partyIndex);
    if (action.instanceId) {
      highlights.hand.add(action.instanceId);
      highlights.sources.add(action.instanceId);
    }
    if (action.equipmentInstanceId) highlights.hand.add(action.equipmentInstanceId);
    for (const id of action.targetOptions ?? []) highlights.targets.add(id);
    for (const id of action.targets ?? []) highlights.targets.add(id);
  }
  return highlights;
}

function resource(kind, icon, label, amount, playerId, sandboxMode = false, onResourceAdjust = () => {}) {
  const item = el('span', `battlefield-resource battlefield-resource--${kind}`);
  item.dataset.playerId = playerId;
  item.dataset.resource = kind;
  item.setAttribute('aria-label', `${label}: ${format(amount)}`);
  item.append(el('span', 'battlefield-resource__icon', icon), el('span', 'battlefield-resource__label', label));
  if (sandboxMode && kind !== 'life') {
    const minus = el('button', 'battlefield-resource__adjust', '−'); minus.type = 'button';
    minus.disabled = Number(amount) <= 0;
    minus.setAttribute('aria-label', `Spend one ${label.toLocaleLowerCase()}`);
    minus.title = `Spend one ${label.toLocaleLowerCase()}`;
    minus.addEventListener('click', () => onResourceAdjust(playerId, kind, -1));
    item.append(minus);
  }
  item.append(el('strong', 'battlefield-resource__value', format(amount)));
  if (sandboxMode && kind !== 'life') {
    const plus = el('button', 'battlefield-resource__adjust', '+'); plus.type = 'button';
    plus.setAttribute('aria-label', `Gain one ${label.toLocaleLowerCase()}`);
    plus.title = `Gain one ${label.toLocaleLowerCase()}`;
    plus.addEventListener('click', () => onResourceAdjust(playerId, kind, 1));
    item.append(plus);
  }
  return item;
}

function getInstanceName(instanceId, instances, cardById) {
  return cardById.get(instances[instanceId]?.cardId)?.name ?? 'Character';
}
function mark(type) { return ({ Character: '◇', Equipment: '⚔', Ability: '✧', 'Speed Ability': '↯', Finisher: '✦' })[type] ?? '◇'; }
function format(value) { return Number.isFinite(Number(value)) ? new Intl.NumberFormat().format(Number(value)) : '—'; }
function el(tag, className = '', text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = String(text);
  return node;
}

