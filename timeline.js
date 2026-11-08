'use strict';

const timelineCatalog = new Map(window.MARVEL_CATALOG.map(project => [project.id, project]));
const { eras, stories } = window.MARVEL_TIMELINE;
const storiesById = new Map(stories.map(story => [story.id, story]));
const cardButtons = new Map();
const eraButtons = new Map();
const find = selector => document.querySelector(selector);
const track = find('#timeline-track');
const branches = find('#timeline-branches');
const detail = find('#timeline-detail');
const storyTitle = find('#story-title');
const storyPoster = find('#story-poster');
const storyWatch = find('#story-watch');
const spoilerButton = find('#spoiler-toggle');
const spoilerLabel = spoilerButton.querySelector('span');
const spoilerPanel = find('#story-spoiler');
const relatedList = find('#story-related');
const arrows = find('#timeline-arrows');
const previous = find('#timeline-prev');
const next = find('#timeline-next');
const spoilerFields = {
  summary: find('#spoiler-summary'),
  ending: find('#spoiler-ending'),
  impact: find('#spoiler-impact'),
};
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
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
  if (!track.contains(card)) return;
  const offset = card.parentElement.getBoundingClientRect().left - track.getBoundingClientRect().left;
  track.scrollTo({ left: track.scrollLeft + offset, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
}

function bringDetailIntoView() {
  detail.scrollIntoView({ block: 'nearest', behavior: reducedMotion.matches ? 'auto' : 'smooth' });
}

function makeNode(story) {
  const item = element('li');
  const button = element('button', story.branch ? 'timeline-branch' : 'timeline-node');
  button.type = 'button';
  button.setAttribute('aria-pressed', 'false');

  const dot = element('span', story.branch ? 'timeline-branch-dot' : 'timeline-dot');
  dot.setAttribute('aria-hidden', 'true');
  if (story.branch) {
    button.append(dot, element('span', '', nameOf(story)));
  } else {
    const poster = element('img', 'timeline-thumb');
    poster.src = timelineCatalog.get(story.id).poster;
    poster.alt = '';
    poster.loading = 'lazy';
    poster.draggable = false;
    button.append(element('span', 'timeline-year', story.time), dot, poster, element('span', 'timeline-node-title', nameOf(story)));
  }

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
  spoilerLabel.textContent = open ? 'Скрыть спойлер' : 'Открыть спойлер';
  for (const [field, node] of Object.entries(spoilerFields)) {
    node.textContent = open ? selected[field] : '';
  }

  relatedList.replaceChildren();
  if (!open) return;
  for (const id of selected.related) {
    const story = storiesById.get(id);
    const button = element('button', '', nameOf(story) + ' →');
    button.type = 'button';
    button.addEventListener('click', () => {
      storyTitle.focus({ preventScroll: true });
      showStory(story);
      positionOnTrack(story);
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
  storyTitle.textContent = nameOf(story);
  find('#story-meta').textContent = story.time + ' · ' + project.type;
  find('#story-premise').textContent = story.premise;
  find('#story-fact').textContent = story.fact;
  storyPoster.src = project.poster;
  storyWatch.href = project.href;
  storyWatch.querySelector('span').textContent = project.searchLink ? 'Найти на Rezka' : 'Открыть на Rezka';
  showSpoiler(false);
  updateEras();
}

function updateEras() {
  let activeEra = null;
  for (const story of stories) {
    if (eraButtons.has(story.id)) activeEra = story.id;
    if (story === selected) break;
  }
  for (const [id, button] of eraButtons) {
    button.setAttribute('aria-pressed', String(!selected.branch && id === activeEra));
  }
}

function updateArrows() {
  const available = track.scrollWidth - track.clientWidth;
  arrows.hidden = available < 2;
  previous.disabled = track.scrollLeft < 2;
  next.disabled = track.scrollLeft > available - 2;
}

for (const story of stories) {
  const lane = story.branch ? branches : track;
  lane.append(makeNode(story));
}

for (const era of eras) {
  const button = element('button', '', era.title);
  button.type = 'button';
  button.addEventListener('click', () => {
    const story = storiesById.get(era.start);
    showStory(story);
    positionOnTrack(story);
  });
  eraButtons.set(era.start, button);
  find('#timeline-eras').append(button);
}

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

showStory(stories[0]);
updateArrows();
