'use strict';

const projects = window.MARVEL_CATALOG;
const $ = (selector, root = document) => root.querySelector(selector);
const icons = {
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3.8a.8.8 0 0 1 1.2-.7l14 8.2a.8.8 0 0 1 0 1.4l-14 8.2a.8.8 0 0 1-1.2-.7Z"/></svg>',
  external: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7m-8 0h8v8"/></svg>',
  prev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 6-6 6 6 6"/></svg>',
  next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 6 6 6-6 6"/></svg>',
};

const sagas = {
  infinity: {
    name: 'Сага Бесконечности',
    index: '01',
    phases: [1, 2, 3],
    feature: 'endgame',
    headline: ['Мстители:', 'Финал'],
    description: 'После щелчка Таноса оставшиеся Мстители ищут способ вернуть тех, кого потеряли.',
  },
  multiverse: {
    name: 'Сага мультивселенной',
    index: '02',
    phases: [4, 5, 6],
    feature: 'wandavision',
    headline: ['Ванда/', 'Вижн'],
    description: 'Ванда и Вижн живут как герои старого ситкома. Но в их идеальном пригороде что-то идёт не по сценарию.',
  },
};

const phaseNames = {
  1: 'Сбор команды',
  2: 'Мир становится больше',
  3: 'Камни Бесконечности',
  4: 'После Финала',
  5: 'Новые герои',
  6: 'Новые вселенные',
};
const order = {
  release: (a, b) => a.number - b.number,
  latest: (a, b) => b.number - a.number,
  rating: (a, b) => (b.rating ?? -1) - (a.rating ?? -1) || a.number - b.number,
};

const state = { saga: 'infinity', phase: null, sort: 'release' };
const sagaButtons = [...document.querySelectorAll('[data-saga]')];
const filters = $('#phase-filters');
const shelves = $('#shelves');
const dialog = $('.search-dialog');
const searchInput = $('input', dialog);
const results = $('.search-results', dialog);
const visibleRails = new Map();
const railObserver = new ResizeObserver(entries => {
  for (const { target } of entries) visibleRails.get(target)?.();
});

function element(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value != null) node.textContent = value;
  return node;
}

function projectCount(count) {
  const last = count % 10;
  const teens = count % 100 >= 11 && count % 100 <= 14;
  const noun = !teens && last === 1 ? 'проект' : !teens && last >= 2 && last <= 4 ? 'проекта' : 'проектов';
  return count + ' ' + noun;
}

function yearRange(projects) {
  const years = projects.map(project => project.year);
  const first = Math.min(...years);
  const last = Math.max(...years);
  return first === last ? String(first) : first + '–' + last;
}

function rating(project) {
  return project.rating == null ? '—' : project.rating.toFixed(2);
}

function twoDigits(number) {
  return String(number).padStart(2, '0');
}

function setProjectLink(anchor, project) {
  anchor.href = project.href;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  anchor.title = project.searchLink ? 'Найти на Rezka' : 'Открыть на Rezka';
}

function makePoster(project, number = false) {
  const poster = element('span', 'poster');
  if (project.poster) {
    const image = element('img');
    image.alt = '';
    image.loading = 'lazy';
    image.decoding = 'async';
    image.src = project.poster;
    image.addEventListener('error', () => image.remove(), { once: true });
    poster.append(image);
  }
  const placeholder = element('span', 'poster-placeholder', project.english);
  placeholder.setAttribute('aria-hidden', 'true');
  poster.prepend(placeholder);
  if (number) {
    const badge = element('span', 'poster-number', twoDigits(project.number));
    badge.setAttribute('aria-hidden', 'true');
    const external = element('span', 'external-mark');
    external.innerHTML = icons.external;
    poster.append(badge, external);
  }
  return poster;
}

function makeCard(project) {
  const anchor = element('a', 'card');
  setProjectLink(anchor, project);
  const info = element('span', 'card-info');
  const details = project.searchLink ? project.year + ' · Поиск на Rezka' : project.year + ' · ' + project.type;
  info.append(element('span', '', details), element('span', 'card-rating', '★ ' + rating(project)));
  anchor.append(makePoster(project, true), element('span', 'card-title', project.title), info);
  return anchor;
}

function arrow(label, icon) {
  const button = element('button', 'round');
  button.type = 'button';
  button.setAttribute('aria-label', label);
  button.innerHTML = icon;
  return button;
}

function makeShelf(phase) {
  const entries = projects.filter(project => project.phase === phase).sort(order[state.sort]);
  const shelf = element('section', 'shelf');
  const title = element('h3', '', 'Фаза ' + phase);
  title.id = 'phase-title-' + phase;
  title.append(element('span', '', phaseNames[phase] + ' · ' + projectCount(entries.length)));
  shelf.setAttribute('aria-labelledby', title.id);
  const heading = element('div', 'shelf-heading');
  const rail = element('div', 'rail');
  rail.append(...entries.map(makeCard));
  const arrows = element('div', 'shelf-arrows');
  const previous = arrow('Прокрутить фазу ' + phase + ' назад', icons.prev);
  const next = arrow('Прокрутить фазу ' + phase + ' вперёд', icons.next);
  previous.disabled = true;
  arrows.append(previous, next);

  function updateArrows() {
    const overflow = rail.scrollWidth - rail.clientWidth;
    arrows.hidden = overflow < 3;
    previous.disabled = rail.scrollLeft < 3;
    next.disabled = rail.scrollLeft > overflow - 3;
  }

  previous.addEventListener('click', () => rail.scrollBy({ left: -rail.clientWidth * .8, behavior: 'auto' }));
  next.addEventListener('click', () => rail.scrollBy({ left: rail.clientWidth * .8, behavior: 'auto' }));
  rail.addEventListener('scroll', updateArrows, { passive: true });
  visibleRails.set(rail, updateArrows);
  railObserver.observe(rail);
  heading.append(title, arrows);
  shelf.append(heading, rail);
  return shelf;
}

function renderShelves() {
  railObserver.disconnect();
  visibleRails.clear();
  const phases = state.phase ? [state.phase] : sagas[state.saga].phases;
  shelves.replaceChildren(...phases.map(makeShelf));
}

function renderFilters(phases) {
  filters.replaceChildren(...[null, ...phases].map(phase => {
    const button = element('button', '', phase ? 'Фаза ' + phase : 'Все фазы');
    button.type = 'button';
    button.setAttribute('aria-pressed', String(phase === state.phase));
    button.addEventListener('click', () => {
      state.phase = phase;
      for (const sibling of filters.children) sibling.setAttribute('aria-pressed', String(sibling === button));
      renderShelves();
    });
    return button;
  }));
}

function renderSaga() {
  const saga = sagas[state.saga];
  const entries = projects.filter(project => saga.phases.includes(project.phase));
  const feature = entries.find(project => project.id === saga.feature);
  const years = yearRange(entries);
  document.body.dataset.saga = state.saga;
  for (const button of sagaButtons) button.setAttribute('aria-pressed', String(button.dataset.saga === state.saga));
  for (const image of document.querySelectorAll('[data-art]')) image.classList.toggle('is-active', image.dataset.art === state.saga);

  $('#hero-label').textContent = saga.name + ' · ' + years;
  $('#hero-title').replaceChildren(saga.headline[0], element('br'), saga.headline[1]);
  $('#hero-description').textContent = saga.description;
  $('#hero-meta').replaceChildren(
    element('span', '', feature.year),
    element('span', '', feature.type),
    element('span', '', 'Фаза ' + feature.phase),
    element('span', 'hero-rating', '★ ' + rating(feature))
  );
  const heroLink = $('#hero-link');
  setProjectLink(heroLink, feature);
  heroLink.innerHTML = icons.play + 'Открыть на Rezka';
  $('#hero-index').textContent = saga.index;
  $('#catalog-kicker').textContent = 'Каталог MCU / ' + saga.index;
  $('#catalog-title').textContent = saga.name;
  $('#catalog-meta').textContent = years + ' · ' + projectCount(entries.length) + ' · Фазы ' + saga.phases[0] + '–' + saga.phases.at(-1);
  $('#collection-link').hidden = state.saga !== 'multiverse';
  renderFilters(saga.phases);
  renderShelves();
}

function selectSaga(saga) {
  if (saga === state.saga) return;
  state.saga = saga;
  state.phase = null;
  renderSaga();
}

function normalize(query) {
  return query.toLowerCase().replaceAll('ё', 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

const searchIndex = projects.map(project => ({
  project,
  terms: normalize([project.title, project.english, project.year + ' год', project.type, 'фаза ' + project.phase].join(' ')),
}));

function renderSearch() {
  const query = normalize(searchInput.value);
  const phasePhrase = query.match(/(?:^| )фаза ([1-6])(?: |$)|(?:^| )([1-6]) фаза(?: |$)/);
  const phase = phasePhrase ? Number(phasePhrase[1] || phasePhrase[2]) : null;
  const words = (phasePhrase ? query.replace(phasePhrase[0], ' ') : query).split(' ').filter(Boolean);
  const matches = query
    ? searchIndex.filter(({ terms, project }) =>
      (!phase || project.phase === phase) && words.every(word => terms.includes(word))
    ).map(({ project }) => project)
    : [];
  $('.search-status', dialog).textContent = query
    ? matches.length ? 'Найдено: ' + projectCount(matches.length) : 'Ничего не найдено. Попробуй другое название.'
    : 'Поиск по обеим сагам';
  results.replaceChildren(...matches.map(project => {
    const anchor = element('a');
    setProjectLink(anchor, project);
    const label = element('span');
    label.append(element('strong', '', project.title), element('small', '', project.year + ' · ' + project.type + ' · Фаза ' + project.phase));
    const external = element('span');
    external.innerHTML = icons.external;
    anchor.append(makePoster(project), label, external);
    return anchor;
  }));
}

for (const button of sagaButtons) button.addEventListener('click', () => selectSaga(button.dataset.saga));
$('[data-next-saga]').addEventListener('click', () => selectSaga(state.saga === 'infinity' ? 'multiverse' : 'infinity'));
$('#sort').addEventListener('change', event => {
  state.sort = event.target.value;
  renderShelves();
});
$('.search-open').addEventListener('click', () => {
  renderSearch();
  dialog.showModal();
  searchInput.focus();
});
searchInput.addEventListener('input', renderSearch);
searchInput.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  event.preventDefault();
  dialog.close();
});
dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const bounds = dialog.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
});
renderSaga();
