'use strict';

const timelineCatalog = Atlas.projects;
const { periods, routes, stories, confirmedOrder, branchLinks } = window.MARVEL_TIMELINE;
const storiesById = new Map(stories.map(story => [story.id, story]));
const periodByStory = new Map(periods.flatMap(period => period.ids.map(id => [id, period])));
const confirmed = new Set(confirmedOrder.map(pair => pair.join(':')));
const branches = new Set(branchLinks.map(pair => pair.join(':')));
const find = selector => document.querySelector(selector);
const viewport = find('#map-viewport');
const world = find('#map-world');
const lanesElement = find('#map-lanes');
const wires = find('#map-wires');
const viewSelect = find('#timeline-view');
const search = find('#timeline-search');
const guide = find('.map-guide');
const display = find('#map-display');
const list = find('#map-list');
const detail = find('#timeline-detail');
const storyTitle = find('#story-title');
const storyPoster = find('#story-poster');
const storyWatch = find('#story-watch');
const storySource = find('#story-source');
const storyWatched = find('#story-watched');
const storyPrep = find('#story-prep');
const storyPrepList = find('#story-prep-list');
const spoilerButton = find('#spoiler-toggle');
const spoilerLabel = spoilerButton.querySelector('span');
const spoilerPanel = find('#story-spoiler');
const spoilerHeading = find('#spoiler-heading');
const spoilerStatus = find('#spoiler-status');
const spoilerBody = find('#spoiler-fields');
const relatedList = find('#story-related');
const relatedSection = find('#related-section');
const spoilerFields = {
  summary: find('#spoiler-summary'),
  ending: find('#spoiler-ending'),
  impact: find('#spoiler-impact'),
};
const controls = {
  out: find('#zoom-out'),
  in: find('#zoom-in'),
  fit: find('#zoom-fit'),
  value: find('#zoom-value'),
  minimap: find('#map-minimap'),
  miniSvg: find('#map-mini-svg'),
};
const camera = createTimelineCamera(viewport, world, controls);
const cardWidth = 178;
const posterHeight = Math.round(cardWidth * 1.5);
const cardHeight = posterHeight + 65;
const horizontalStep = 223;
const laneStep = cardHeight + 102;
const prerequisites = {
  'multiverse-of-madness': [
    ['doctor-strange', 'Знакомит со Стрэнджем и правилами магии.'],
    ['wandavision', 'Объясняет, почему личная история Ванды так важна.'],
  ],
  'visionquest': [
    ['wandavision', 'Показывает, где началась история Вижна, которую продолжает этот сериал.'],
    ['agatha-all-along', 'Продолжает ту же сюжетную линию с другой стороны.'],
  ],
  'brand-new-day': [['no-way-home', 'Объясняет, с чего начинается новый этап жизни Питера.']],
  'daredevil-born-again-2': [['daredevil-born-again', 'Показывает, как Фиск стал мэром и начался конфликт.']],
  'doomsday': [
    ['thunderbolts', 'Знакомит с командой и её местом среди героев Marvel.'],
    ['fantastic-four', 'Знакомит с Фантастической четвёркой и её вселенной.'],
  ],
};
const laneLabels = {
  timeline: 'Основная линия MCU',
  branch: 'Ответвления и другие вселенные',
  undated: 'Точный год действия неизвестен',
  route: 'Маршрут по связанным историям',
};
const cardNodes = new Map();
const mobileSheet = matchMedia('(max-width: 660px)');
let selected;
let storyTrigger;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function nameOf(story) {
  return [timelineCatalog.get(story.id).title, story.season].filter(Boolean).join(' · ');
}

function createCard(story, position = null) {
  const button = element('button', story.branch ? 'map-node is-branch' : 'map-node');
  button.type = 'button';
  button.title = nameOf(story);
  button.dataset.story = story.id;
  button.setAttribute('aria-pressed', 'false');
  const poster = element('img');
  poster.src = timelineCatalog.get(story.id).poster;
  poster.alt = '';
  poster.loading = 'lazy';
  poster.decoding = 'async';
  poster.draggable = false;
  const meta = element('span', 'map-node-meta');
  meta.append(element('span', 'map-node-title', nameOf(story)), element('span', 'map-node-time', story.time));
  button.append(poster, meta);
  updateCardProgress(button, story.id);
  button.addEventListener('click', () => openStory(story, button));
  if (position) {
    button.addEventListener('focus', () => {
      if (button.matches(':focus-visible')) camera.reveal(position);
    });
    cardNodes.set(story.id, { button, position });
  }
  return button;
}

function updateCardProgress(button, id) {
  button.classList.toggle('is-watched', Atlas.isWatched(id));
  button.setAttribute('aria-label', nameOf(storiesById.get(id)) + ' · ' + storiesById.get(id).time +
    (Atlas.isWatched(id) ? ' · Просмотрено' : ''));
}

function focusStory(id) {
  if (!cardNodes.has(id)) {
    search.value = '';
    viewSelect.value = periodByStory.get(id).id;
    renderMap();
  }
  const card = cardNodes.get(id);
  if (list.hidden) camera.focus(card.position, true);
  const trigger = list.hidden ? card.button : [...list.querySelectorAll('.map-node')].find(button => button.dataset.story === id);
  if (!list.hidden) trigger?.scrollIntoView({ block: 'center' });
  openStory(storiesById.get(id), trigger);
}

function showSpoiler(open) {
  spoilerPanel.hidden = !open;
  spoilerButton.setAttribute('aria-expanded', String(open));
  const hasSummary = Boolean(selected.summary);
  spoilerLabel.textContent = hasSummary
    ? (open ? 'Скрыть спойлер' : 'Открыть спойлер')
    : (open ? 'Скрыть сведения' : 'Что известно');
  spoilerHeading.textContent = hasSummary ? 'Спойлеры' : 'Что известно';
  spoilerStatus.hidden = !open || !selected.spoilerStatus;
  spoilerStatus.textContent = open ? selected.spoilerStatus || '' : '';
  spoilerBody.hidden = !open || !hasSummary;
  for (const [field, node] of Object.entries(spoilerFields)) {
    node.parentElement.hidden = !selected[field];
    node.textContent = open ? selected[field] || '' : '';
  }
  relatedSection.hidden = !open || selected.related.length === 0;
  relatedList.replaceChildren();
  if (!open) return;
  for (const id of selected.related) {
    const story = storiesById.get(id);
    const button = element('button', '', nameOf(story) + ' →');
    button.type = 'button';
    button.addEventListener('click', () => focusStory(id));
    relatedList.append(button);
  }
}

function openStory(story, trigger) {
  storyTrigger?.setAttribute('aria-pressed', 'false');
  storyTrigger = trigger;
  selected = story;
  trigger?.setAttribute('aria-pressed', 'true');
  const project = timelineCatalog.get(story.id);
  detail.hidden = false;
  storyTitle.textContent = nameOf(story);
  find('#story-meta').textContent = story.time + ' · ' + project.type;
  find('#story-premise').textContent = story.premise;
  find('#story-fact').textContent = story.fact;
  storySource.hidden = !Atlas.safeLink(storySource, story.source);
  storyPoster.src = project.poster;
  storyWatch.querySelector('span').textContent = Atlas.projectLink(storyWatch, project);
  Atlas.setWatchedButton(storyWatched, project);
  const suggestions = prerequisites[story.id] || [];
  storyPrep.hidden = !suggestions.length;
  storyPrepList.replaceChildren(...suggestions.map(([id, reason]) => {
    const item = element('li', '', reason);
    const button = element('button', '', timelineCatalog.get(id).title);
    button.type = 'button';
    button.addEventListener('click', () => focusStory(id));
    item.prepend(button);
    return item;
  }));
  showSpoiler(false);
  detail.scrollTop = 0;
  storyTitle.focus({ preventScroll: true });
  keepCardInSight();
}

function keepCardInSight() {
  if (!mobileSheet.matches || !list.hidden) return;
  const { position } = cardNodes.get(selected.id);
  const sheetTop = detail.getBoundingClientRect().top - viewport.getBoundingClientRect().top;
  camera.keepAbove(position, sheetTop);
}

function closeStory(restoreFocus = true) {
  if (detail.hidden) return;
  const previous = storyTrigger;
  showSpoiler(false);
  detail.hidden = true;
  previous?.setAttribute('aria-pressed', 'false');
  storyTrigger = undefined;
  selected = undefined;
  if (restoreFocus) previous?.focus({ preventScroll: true });
}

function normalize(text) {
  return text.toLowerCase().replaceAll('ё', 'е').replaceAll('э', 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

const searchable = new Map(stories.map(story => {
  const project = timelineCatalog.get(story.id);
  return [story.id, normalize(project.title + ' ' + project.english + ' ' + story.time)];
}));

function projectCount(count) {
  const last = count % 10;
  const teens = count % 100 >= 11 && count % 100 <= 14;
  const noun = !teens && last === 1 ? 'проект' : !teens && last >= 2 && last <= 4 ? 'проекта' : 'проектов';
  return count + ' ' + noun;
}

function exactYears(story) {
  if (/около/i.test(story.time)) return [];
  return (story.time.match(/(?:19|20)\d{2}/g) || []).map(Number);
}

function wireBetween(kind, from, to) {
  const pair = from + ':' + to;
  if (kind === 'route') return { className: 'route-wire', marker: 'violet' };
  if (kind === 'branch') return branches.has(pair) ? { className: 'branch-wire', marker: 'violet' } : null;
  if (kind !== 'timeline') return null;
  const earlier = exactYears(storiesById.get(from));
  const later = exactYears(storiesById.get(to));
  if (confirmed.has(pair) || (earlier.length && later.length && Math.max(...earlier) < Math.min(...later))) {
    return { className: 'chronology-wire', marker: 'gold' };
  }
  return { className: 'chronology-wire is-parallel' };
}

function svg(tag, attributes) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  return node;
}

function createMarkers() {
  const defs = svg('defs', {});
  for (const tone of ['gold', 'violet']) {
    const marker = svg('marker', { id: 'map-arrow-' + tone, viewBox: '0 0 8 8', refX: 7, refY: 4, markerWidth: 5, markerHeight: 5, orient: 'auto' });
    marker.append(svg('path', { d: 'M0 0 8 4 0 8z', class: 'map-wire-arrow-' + tone }));
    defs.append(marker);
  }
  return defs;
}

function addWire(d, edge) {
  const path = svg('path', { d, class: edge.className });
  if (edge.marker) path.setAttribute('marker-end', 'url(#map-arrow-' + edge.marker + ')');
  wires.append(path);
}

function drawLane(group, index, searching) {
  const kind = group.kind || 'timeline';
  const x = 49;
  const y = 18 + index * laneStep;
  const width = (group.ids.length - 1) * horizontalStep + cardWidth;
  const section = element('section', 'map-lane');
  section.dataset.kind = kind;
  section.style.left = x + 'px';
  section.style.top = y + 'px';
  section.style.width = width + 'px';
  section.style.height = (59 + cardHeight) + 'px';
  const title = element('h2', '', group.title);
  title.id = 'map-lane-' + group.id;
  section.setAttribute('aria-labelledby', title.id);
  section.append(title, element('p', 'map-lane-label', laneLabels[kind] + ' · ' + projectCount(group.ids.length)));
  for (const [cardIndex, id] of group.ids.entries()) {
    const position = { x: x + cardIndex * horizontalStep, y: y + 59, width: cardWidth, height: cardHeight };
    const card = createCard(storiesById.get(id), position);
    card.style.left = (position.x - x) + 'px';
    card.style.top = (position.y - y) + 'px';
    section.append(card);
    const next = group.ids[cardIndex + 1];
    if (!next || searching) continue;
    const edge = wireBetween(kind, id, next);
    if (!edge) continue;
    const midY = position.y + posterHeight / 2;
    addWire(`M ${position.x + cardWidth + 2} ${midY} H ${position.x + horizontalStep - 5}`, edge);
  }
  lanesElement.append(section);
  return { x, y, kind, width, cardHeight };
}

function drawList(groups) {
  list.replaceChildren(...groups.map(group => {
    const section = element('section', 'map-list-group');
    const cards = element('div', 'map-list-cards');
    cards.append(...group.ids.map(id => createCard(storiesById.get(id))));
    section.append(element('h2', '', group.title), cards);
    return section;
  }));
  list.scrollTop = 0;
}

function renderMap() {
  closeStory(false);
  const query = normalize(search.value);
  const words = query.split(' ');
  const route = routes.find(candidate => candidate.id === viewSelect.value);
  const period = periods.find(candidate => candidate.id === viewSelect.value);
  const groups = query
    ? periods.map(group => ({ ...group, ids: group.ids.filter(id => words.every(word => searchable.get(id).includes(word))) })).filter(group => group.ids.length)
    : route ? [{ ...route, kind: 'route' }] : period ? [period] : periods;
  const count = groups.reduce((sum, group) => sum + group.ids.length, 0);
  const status = query ? 'Результаты поиска' : route?.title || period?.title || 'Вся хронология';
  find('#map-status').textContent = status + ' · ' + projectCount(count);
  find('#map-empty').hidden = count !== 0;
  controls.minimap.hidden = count === 0 || !list.hidden;
  find('#map-controls').hidden = count === 0 || !list.hidden;
  cardNodes.clear();
  lanesElement.replaceChildren();
  wires.replaceChildren(createMarkers());
  const lanes = groups.map((group, index) => drawLane(group, index, Boolean(query)));
  if (!query && viewSelect.value === 'all') {
    for (const [index, lane] of lanes.entries()) {
      const nextLane = lanes[index + 1];
      if (lane.kind !== 'timeline' || nextLane?.kind !== 'timeline') continue;
      addWire(`M 24 ${lane.y + 60 + cardHeight} V ${nextLane.y + 9} H 41`, { className: 'chronology-wire', marker: 'gold' });
    }
  }
  const width = Math.max(320, ...lanes.map(lane => lane.x + lane.width + 42));
  const height = Math.max(200, (lanes.length - 1) * laneStep + 104 + cardHeight);
  wires.setAttribute('viewBox', `0 0 ${width} ${height}`);
  world.style.setProperty('--node-width', cardWidth + 'px');
  world.style.setProperty('--node-height', cardHeight + 'px');
  world.style.setProperty('--poster-height', posterHeight + 'px');
  if (list.hidden) {
    camera.setScene({ width, height, lanes });
  } else {
    drawList(groups);
  }
}

function appendOptions(label, views) {
  const group = document.createElement('optgroup');
  group.label = label;
  for (const view of views) {
    const option = element('option', '', view.title);
    option.value = view.id;
    group.append(option);
  }
  viewSelect.append(group);
}

appendOptions('Периоды и ветки', periods);
appendOptions('Сюжетные маршруты', routes);
viewSelect.addEventListener('change', () => {
  search.value = '';
  renderMap();
});
search.addEventListener('input', renderMap);
display.addEventListener('click', () => {
  list.hidden = !list.hidden;
  viewport.hidden = !list.hidden;
  display.textContent = list.hidden ? 'Список' : 'Карта';
  renderMap();
});
storyWatched.addEventListener('click', () => {
  if (selected) Atlas.toggleWatched(selected.id);
});
Atlas.onProgress(() => {
  for (const button of document.querySelectorAll('.map-node')) updateCardProgress(button, button.dataset.story);
  if (selected) Atlas.setWatchedButton(storyWatched, timelineCatalog.get(selected.id));
});
spoilerButton.addEventListener('click', () => {
  const opening = spoilerPanel.hidden;
  showSpoiler(opening);
  keepCardInSight();
  if (opening) {
    spoilerHeading.focus({ preventScroll: true });
    detail.scrollTop += Math.max(0, spoilerPanel.getBoundingClientRect().top - sheetHandle.getBoundingClientRect().bottom - 8);
  }
});
find('#story-close').addEventListener('click', () => closeStory());
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape' || event.defaultPrevented) return;
  if (!detail.hidden) closeStory();
  else if (guide.open) guide.open = false;
});
viewport.addEventListener('pointerdown', () => { guide.open = false; });

const sheetHandle = find('.story-sheet-top');
let sheetDrag;
sheetHandle.addEventListener('pointerdown', event => {
  if (!mobileSheet.matches || event.button !== 0 || event.target.closest('button')) return;
  sheetDrag = { pointerId: event.pointerId, y: event.clientY };
  sheetHandle.setPointerCapture(event.pointerId);
});
sheetHandle.addEventListener('pointermove', event => {
  if (sheetDrag?.pointerId !== event.pointerId) return;
  detail.style.transform = `translateY(${Math.max(0, event.clientY - sheetDrag.y)}px)`;
});
function finishSheetDrag(event) {
  if (sheetDrag?.pointerId !== event.pointerId) return;
  const distance = event.clientY - sheetDrag.y;
  sheetDrag = undefined;
  detail.style.transform = '';
  if (event.type === 'pointerup' && distance > 55) closeStory();
}
sheetHandle.addEventListener('pointerup', finishSheetDrag);
sheetHandle.addEventListener('pointercancel', finishSheetDrag);
sheetHandle.addEventListener('lostpointercapture', finishSheetDrag);

renderMap();
