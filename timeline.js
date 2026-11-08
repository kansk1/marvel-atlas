'use strict';

const timelineCatalog = new Map(window.MARVEL_CATALOG.map(project => [project.id, project]));
const { periods, routes, stories } = window.MARVEL_TIMELINE;
const storiesById = new Map(stories.map(story => [story.id, story]));
const periodByStory = new Map(periods.flatMap(period => period.ids.map(id => [id, period])));
const cardButtons = new Map();
const viewButtons = new Map();
const find = selector => document.querySelector(selector);
const track = find('#timeline-track');
const search = find('#timeline-search');
const viewTitle = find('#timeline-view-title');
const viewCount = find('#timeline-view-count');
const detail = find('#timeline-detail');
const storyTitle = find('#story-title');
const storyPoster = find('#story-poster');
const storyWatch = find('#story-watch');
const storySource = find('#story-source');
const spoilerButton = find('#spoiler-toggle');
const spoilerLabel = spoilerButton.querySelector('span');
const spoilerPanel = find('#story-spoiler');
const spoilerHeading = find('#spoiler-heading');
const spoilerStatus = find('#spoiler-status');
const spoilerBody = find('#spoiler-fields');
const relatedList = find('#story-related');
const relatedSection = find('#related-section');
const arrows = find('#timeline-arrows');
const previous = find('#timeline-prev');
const next = find('#timeline-next');
const spoilerFields = {
  summary: find('#spoiler-summary'),
  ending: find('#spoiler-ending'),
  impact: find('#spoiler-impact'),
};
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let activeView = periods[0];
let selected;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function nameOf(story) {
  return [timelineCatalog.get(story.id).title, story.season].filter(Boolean).join(' · ');
}

function positionOnTrack(story) {
  const card = cardButtons.get(story.id);
  const offset = card.parentElement.getBoundingClientRect().left - track.getBoundingClientRect().left;
  track.scrollTo({ left: track.scrollLeft + offset, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
}

function bringDetailIntoView() {
  detail.scrollIntoView({ block: 'nearest', behavior: reducedMotion.matches ? 'auto' : 'smooth' });
}

function makeNode(story) {
  const item = element('li', story.branch ? 'timeline-alt-node' : '');
  const button = element('button', 'timeline-node');
  button.type = 'button';
  button.setAttribute('aria-pressed', 'false');

  const dot = element('span', 'timeline-dot');
  dot.setAttribute('aria-hidden', 'true');
  const poster = element('img', 'timeline-thumb');
  poster.src = timelineCatalog.get(story.id).poster;
  poster.alt = '';
  poster.loading = 'lazy';
  poster.draggable = false;
  button.append(element('span', 'timeline-year', story.time), dot, poster, element('span', 'timeline-node-title', nameOf(story)));

  button.addEventListener('click', () => {
    showStory(story);
    bringDetailIntoView();
  });
  cardButtons.set(story.id, button);
  item.append(button);
  return item;
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

  relatedList.replaceChildren();
  relatedSection.hidden = !open || selected.related.length === 0;
  if (!open) return;
  for (const id of selected.related) {
    const story = storiesById.get(id);
    const button = element('button', '', nameOf(story) + ' →');
    button.type = 'button';
    button.addEventListener('click', () => {
      if (cardButtons.has(story.id)) {
        showStory(story);
        positionOnTrack(story);
      } else {
        setView(periodByStory.get(story.id), story.id);
      }
      storyTitle.focus({ preventScroll: true });
      bringDetailIntoView();
    });
    relatedList.append(button);
  }
}

function showStory(story) {
  cardButtons.get(selected?.id)?.setAttribute('aria-pressed', 'false');
  selected = story;
  cardButtons.get(story.id).setAttribute('aria-pressed', 'true');
  const project = timelineCatalog.get(story.id);
  detail.hidden = false;
  storyTitle.textContent = nameOf(story);
  find('#story-meta').textContent = story.time + ' · ' + project.type;
  find('#story-premise').textContent = story.premise;
  find('#story-fact').textContent = story.fact;
  storySource.hidden = !story.source;
  if (story.source) storySource.href = story.source;
  else storySource.removeAttribute('href');
  storyPoster.src = project.poster;
  storyWatch.href = project.href;
  storyWatch.querySelector('span').textContent = project.searchLink ? 'Найти на Rezka' : 'Открыть на Rezka';
  showSpoiler(false);
}

function normalize(text) {
  return text.toLowerCase().replaceAll('ё', 'е').replaceAll('э', 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

const searchable = periods.flatMap(period => period.ids.map(id => {
  const project = timelineCatalog.get(id);
  return { id, text: normalize(project.title + ' ' + project.english) };
}));

function projectCount(count) {
  const last = count % 10;
  const teens = count % 100 >= 11 && count % 100 <= 14;
  const noun = !teens && last === 1 ? 'проект' : !teens && last >= 2 && last <= 4 ? 'проекта' : 'проектов';
  return count + ' ' + noun;
}

function renderBoard(storyId) {
  const query = normalize(search.value);
  const words = query.split(' ');
  const ids = query
    ? searchable.filter(entry => words.every(word => entry.text.includes(word))).map(entry => entry.id)
    : activeView.ids;
  const isRoute = !query && routes.includes(activeView);
  viewTitle.textContent = query ? 'Результаты поиска' : activeView.title;
  viewCount.textContent = ids.length ? projectCount(ids.length) : 'Ничего не найдено';
  for (const [id, button] of viewButtons) {
    button.setAttribute('aria-pressed', String(!query && id === activeView.id));
  }
  cardButtons.clear();
  track.classList.toggle('timeline-flow', isRoute);
  track.replaceChildren(...ids.map(id => makeNode(storiesById.get(id))));
  track.scrollLeft = 0;
  track.hidden = ids.length === 0;
  detail.hidden = ids.length === 0;
  if (ids.length) {
    const story = storiesById.get(ids.includes(storyId) ? storyId : ids[0]);
    showStory(story);
    if (storyId) positionOnTrack(story);
  }
  updateArrows();
}

function setView(view, storyId) {
  search.value = '';
  activeView = view;
  renderBoard(storyId);
}

function updateArrows() {
  const available = track.scrollWidth - track.clientWidth;
  arrows.hidden = available < 2;
  previous.disabled = track.scrollLeft < 2;
  next.disabled = track.scrollLeft > available - 2;
}

function addViewButtons(views, group) {
  for (const view of views) {
    const button = element('button', '', view.title);
    button.type = 'button';
    button.addEventListener('click', () => setView(view));
    viewButtons.set(view.id, button);
    group.append(button);
  }
}

addViewButtons(periods, find('#timeline-periods'));
addViewButtons(routes, find('#timeline-routes'));
search.addEventListener('input', () => renderBoard());

function scrollTrack(direction) {
  track.scrollBy({ left: direction * track.clientWidth * .78, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
}

previous.addEventListener('click', () => scrollTrack(-1));
next.addEventListener('click', () => scrollTrack(1));
track.addEventListener('scroll', updateArrows, { passive: true });
new ResizeObserver(updateArrows).observe(track);
spoilerButton.addEventListener('click', () => showSpoiler(spoilerPanel.hidden));

// Touch devices use the browser's native horizontal scrolling.
let drag;
let dragged = false;
track.addEventListener('pointerdown', event => {
  if (event.pointerType !== 'mouse' || event.button !== 0) return;
  drag = { pointer: event.pointerId, x: event.clientX, left: track.scrollLeft };
  dragged = false;
});
track.addEventListener('pointermove', event => {
  if (drag?.pointer !== event.pointerId) return;
  const delta = event.clientX - drag.x;
  if (!dragged && Math.abs(delta) < 7) return;
  if (!dragged) {
    dragged = true;
    track.setPointerCapture(event.pointerId);
    track.classList.add('is-dragging');
  }
  track.scrollLeft = drag.left - delta;
});
function stopDrag(event) {
  if (drag?.pointer !== event.pointerId) return;
  drag = null;
  track.classList.remove('is-dragging');
}
track.addEventListener('pointerup', stopDrag);
track.addEventListener('pointercancel', stopDrag);
track.addEventListener('lostpointercapture', stopDrag);
track.addEventListener('pointerleave', event => {
  if (!dragged) stopDrag(event);
});
track.addEventListener('click', event => {
  if (!dragged || !event.detail) return;
  dragged = false;
  event.preventDefault();
  event.stopPropagation();
}, { capture: true });

renderBoard();
