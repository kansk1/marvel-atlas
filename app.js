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
  },
  multiverse: {
    name: 'Сага мультивселенной',
    index: '02',
    phases: [4, 5, 6],
  },
};
const recent = [
  { id: 'doomsday', title: 'Мстители: Доктор Дум', date: '2026-12-18', art: 'assets/hero-doomsday.jpg', description: 'Герои трёх вселенных сталкиваются с общей угрозой. Роберт Дауни — младший возвращается в Marvel в роли Доктора Дума.' },
  { id: 'visionquest', title: 'Квест Вижна', date: '2026-10-14', description: 'Вижн ищет своё место в мире. История продолжает линию «Ванды/Вижна» и «Это всё Агата».' },
  { id: 'brand-new-day', date: '2026-07-31', description: 'Питер Паркер снова защищает Нью-Йорк, а внезапные перемены в его способностях ставят его перед новым выбором.' },
  { id: 'punisher', date: '2026-05-12', description: 'Фрэнк Касл пытается оставить прошлое позади, но новая угроза вынуждает его вернуться к борьбе.' },
  { id: 'daredevil-born-again-2', date: '2026-03-24', art: 'assets/hero-daredevil-2.jpg', description: 'Сорвиголова и его союзники пытаются разоблачить Уилсона Фиска, пока власти Нью-Йорка охотятся за людьми в масках.' },
  { id: 'wonder-man', date: '2026-01-27', description: 'Актёр Саймон Уильямс скрывает сверхспособности и пытается получить роль в фильме о Чудо-человеке.' },
].sort((a, b) => b.date.localeCompare(a.date));
const recentDates = new Map(recent.map(({ id, date }) => [id, date]));

function byRelease(a, b) {
  const aDate = recentDates.get(a.id);
  const bDate = recentDates.get(b.id);
  return a.year - b.year || (aDate && bDate ? aDate.localeCompare(bDate) : a.number - b.number);
}

const phaseNames = {
  1: 'Сбор команды',
  2: 'Мир становится больше',
  3: 'Камни Бесконечности',
  4: 'После Финала',
  5: 'Новые герои',
  6: 'Новые вселенные',
};
const order = {
  release: byRelease,
  latest: (a, b) => byRelease(b, a),
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
  return Atlas.projectLink(anchor, project);
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
  const tile = element('div', 'card-tile');
  const anchor = element('a', 'card');
  setProjectLink(anchor, project);
  const info = element('span', 'card-info');
  const announcement = Atlas.announcements.get(project.id);
  const details = announcement ? Atlas.releaseText(announcement) : project.year + ' · ' + project.type;
  info.append(element('span', '', details), element('span', 'card-rating', '★ ' + rating(project)));
  anchor.append(makePoster(project, true), element('span', 'card-title', project.title), info);
  tile.append(anchor);
  if (!announcement) {
    const button = element('button', 'watch-mark');
    button.type = 'button';
    button.dataset.watch = project.id;
    Atlas.setWatchedButton(button, project, true);
    button.addEventListener('click', () => Atlas.toggleWatched(project.id));
    tile.append(button);
  }
  return tile;
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
  const years = yearRange(entries);
  document.body.dataset.saga = state.saga;
  for (const button of sagaButtons) button.setAttribute('aria-pressed', String(button.dataset.saga === state.saga));
  $('#catalog-kicker').textContent = 'Каталог MCU / ' + saga.index;
  $('#catalog-title').textContent = saga.name;
  $('#catalog-meta').textContent = years + ' · ' + projectCount(entries.length) + ' · Фазы ' + saga.phases[0] + '–' + saga.phases.at(-1);
  $('#collection-link').hidden = state.saga !== 'multiverse';
  renderFilters(saga.phases);
  renderShelves();
  renderProgress();
}

function selectSaga(saga) {
  if (saga === state.saga) return;
  state.saga = saga;
  state.phase = null;
  renderSaga();
  $('#catalog').scrollIntoView();
}

const hero = $('.hero');
const heroImage = $('#hero-image');
const pause = $('#hero-pause');
let heroIndex = 0;
let heroPaused = matchMedia('(prefers-reduced-motion: reduce)').matches;
let heroTimer;

function renderHero(announce = false) {
  const item = recent[heroIndex];
  const project = Atlas.projects.get(item.id);
  const announcement = Atlas.announcements.get(item.id);
  const title = item.title || project.title;
  heroImage.src = item.art || project.poster;
  heroImage.dataset.art = item.art ? item.id : 'poster';
  $('#hero-label').textContent = Atlas.upcomingIds.has(item.id) ? 'Ожидается' : 'Новые проекты Marvel';
  $('#hero-title').textContent = title;
  $('#hero-description').textContent = item.description;
  $('#hero-meta').replaceChildren(element('span', '', announcement ? Atlas.releaseText(announcement) : project.year),
    element('span', '', project.type), element('span', '', 'Фаза ' + project.phase));
  const link = $('#hero-link');
  const label = setProjectLink(link, project);
  link.innerHTML = announcement ? icons.external : icons.play;
  link.classList.toggle('is-premiere', Boolean(announcement));
  link.append(label);
  $('#hero-index').textContent = twoDigits(heroIndex + 1) + ' / ' + twoDigits(recent.length);
  if (announce) $('#hero-announcement').textContent = title;
}

function scheduleHero() {
  clearTimeout(heroTimer);
  pause.textContent = heroPaused ? '▶' : 'Ⅱ';
  pause.setAttribute('aria-label', heroPaused ? 'Включить автопереключение' : 'Остановить автопереключение');
  if (heroPaused || document.hidden || hero.matches(':focus-within, :hover')) return;
  heroTimer = setTimeout(() => {
    heroIndex = (heroIndex + 1) % recent.length;
    renderHero();
    scheduleHero();
  }, 10000);
}

function stepHero(delta) {
  heroIndex = (heroIndex + delta + recent.length) % recent.length;
  heroPaused = true;
  renderHero(true);
  scheduleHero();
}

function renderProgress() {
  const phases = sagas[state.saga].phases;
  const available = projects.filter(project => phases.includes(project.phase) && !Atlas.announcements.has(project.id))
    .sort((a, b) => a.phase - b.phase || byRelease(a, b));
  const next = available.find(project => !Atlas.isWatched(project.id));
  const watched = available.filter(project => Atlas.isWatched(project.id)).length;
  const phase = next ? available.filter(project => project.phase === next.phase) : [];
  const phaseProgress = next ? ' · Фаза ' + next.phase + ' · ' + phase.filter(project => Atlas.isWatched(project.id)).length + ' из ' + phase.length : '';
  $('#progress-count').textContent = sagas[state.saga].name + ' · ' + watched + ' из ' + available.length + phaseProgress;
  const panel = $('#progress-next');
  if (!next) {
    panel.replaceChildren(element('p', '', 'Все доступные проекты саги отмечены как просмотренные.'));
    return;
  }
  const link = element('a', 'action action-primary');
  link.textContent = setProjectLink(link, next);
  const button = element('button', 'action action-secondary');
  button.type = 'button';
  Atlas.setWatchedButton(button, next);
  button.addEventListener('click', () => {
    Atlas.toggleWatched(next.id);
    (panel.querySelector('button') || $('#progress-title')).focus({ preventScroll: true });
  });
  panel.replaceChildren(element('strong', '', next.title), link, button);
}

function renderUpcoming() {
  $('#upcoming-releases').replaceChildren(...Atlas.upcoming.map(release => {
    const row = element('li', 'release');
    const posterProject = Atlas.projects.get(release.posterId || release.id);
    const art = posterProject ? makePoster(posterProject) : element('span', 'release-placeholder', 'M');
    const copy = element('div', 'release-copy');
    const source = element('a', 'source-link', 'Источник ↗');
    Atlas.safeLink(source, release.source);
    source.setAttribute('aria-label', 'Источник даты · ' + release.title);
    copy.append(element('h3', '', release.title), element('p', '', Atlas.releaseText(release)), source);
    row.append(art, copy);
    return row;
  }));
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
$('#hero-prev').addEventListener('click', () => stepHero(-1));
$('#hero-next').addEventListener('click', () => stepHero(1));
pause.addEventListener('click', () => {
  heroPaused = !heroPaused;
  scheduleHero();
});
for (const event of ['focusin', 'focusout', 'mouseenter', 'mouseleave']) {
  hero.addEventListener(event, () => queueMicrotask(scheduleHero));
}
document.addEventListener('visibilitychange', scheduleHero);
Atlas.onProgress(() => {
  for (const button of document.querySelectorAll('[data-watch]')) {
    Atlas.setWatchedButton(button, Atlas.projects.get(button.dataset.watch), true);
  }
  renderProgress();
});
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
renderUpcoming();
renderHero();
scheduleHero();
