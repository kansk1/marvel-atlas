'use strict';

const Atlas = (() => {
  const projects = new Map(window.MARVEL_CATALOG.map(project => [project.id, project]));
  const dateFormat = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'long', timeZone: 'UTC' });
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/New_York' }).format(new Date());
  const disneyMovies = 'https://movies.disney.com/avengers-doomsday';
  const releases = [
    { id: 'doomsday', title: 'Мстители: Доктор Дум', date: '2026-12-18', venue: 'Кинотеатры США', source: disneyMovies },
    {
      id: 'friendly-spider-man-2', title: 'Дружелюбный сосед Человек-паук · 2 сезон',
      date: '2027-01-13', venue: 'Disney+', posterId: 'friendly-spider-man',
      source: 'https://www.disneyplus.com/browse/entity-b1417e49-48ad-4827-bfd6-94580ecbecd7',
    },
    {
      id: 'secret-wars', title: 'Мстители: Секретные войны', date: '2027-12-17', venue: 'Кинотеатры США',
      source: 'https://www.gamesradar.com/entertainment/marvel-movies/after-rumors-of-a-delay-disney-confirms-avengers-secret-wars-release-date/',
    },
    {
      id: 'black-panther-3', title: 'Чёрная Пантера 3', date: '2028-12-15', venue: 'Кинотеатры США',
      source: 'https://www.disneyplus.com/explore/articles/san-diego-comic-con-2026-announcements',
    },
    {
      id: 'daredevil-born-again-3', title: 'Сорвиголова: Рождённый заново · 3 сезон',
      venue: 'Disney+', posterId: 'daredevil-born-again', source: 'https://www.marvel.com/tv-shows/',
    },
    {
      id: 'wonder-man-2', title: 'Чудо-человек · 2 сезон', venue: 'Disney+',
      posterId: 'wonder-man', source: 'https://www.marvel.com/tv-shows/',
    },
  ];
  const announcements = new Map(releases.map(release => [release.id, release]));
  const upcoming = releases.filter(release => !release.date || release.date >= today);
  const upcomingIds = new Set(upcoming.map(release => release.id));
  const allowedHosts = new Set(['rezka.fi', 'www.marvel.com', 'www.disneyplus.com', 'movies.disney.com',
    'www.sony.com', 'www.sonypictures.com', 'thewaltdisneycompany.com', 'www.gamesradar.com']);
  const storageKey = 'marvel-atlas:watched:v1';
  const events = new EventTarget();
  let watched = new Set();

  function readWatched(value) {
    try {
      const ids = JSON.parse(value);
      return new Set(Array.isArray(ids) ? ids.filter(id => projects.has(id)) : []);
    } catch {
      return new Set();
    }
  }

  try {
    watched = readWatched(localStorage.getItem(storageKey));
  } catch {
    // Progress remains usable for the current page when browser storage is blocked.
  }

  window.addEventListener('storage', event => {
    if (event.key !== storageKey && event.key !== null) return;
    watched = readWatched(event.newValue);
    events.dispatchEvent(new Event('change'));
  });

  function toggleWatched(id) {
    if (!projects.has(id) || announcements.has(id)) return;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored !== null) watched = readWatched(stored);
    } catch {
      // Use the current page's progress when browser storage is unavailable.
    }
    if (!watched.delete(id)) watched.add(id);
    try {
      localStorage.setItem(storageKey, JSON.stringify([...watched]));
    } catch {
      // A failed write keeps the in-memory change for this page.
    }
    events.dispatchEvent(new Event('change'));
  }

  function safeLink(anchor, value) {
    anchor.removeAttribute('href');
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:' || url.username || url.password || url.port || !allowedHosts.has(url.hostname)) return false;
      anchor.href = url.href;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      return true;
    } catch {
      return false;
    }
  }

  function projectLink(anchor, project) {
    const announcement = announcements.get(project.id);
    const url = announcement?.source || project.href;
    const label = announcement ? 'Подробнее о премьере' : url.startsWith('https://www.disneyplus.com/') ? 'Открыть на Disney+' :
      project.searchLink ? 'Найти на Rezka' : 'Открыть на Rezka';
    safeLink(anchor, url);
    anchor.title = label;
    return label;
  }

  function releaseText(release) {
    const date = release.date ? dateFormat.format(new Date(release.date + 'T00:00:00Z')) : 'Дата не объявлена';
    return release.venue + ' · ' + date;
  }

  function setWatchedButton(button, project, compact = false) {
    const checked = watched.has(project.id);
    button.hidden = announcements.has(project.id);
    button.setAttribute('aria-pressed', String(checked));
    const action = checked ? 'Снять отметку о просмотре' : 'Отметить как просмотренное';
    button.setAttribute('aria-label', action + ' · ' + project.title);
    button.title = action;
    button.textContent = compact ? (checked ? '✓' : '+') : (checked ? '✓ Просмотрено' : 'Отметить просмотренным');
  }

  return {
    projects, upcoming, upcomingIds, announcements, projectLink, releaseText, safeLink,
    isWatched: id => watched.has(id),
    onProgress: handler => events.addEventListener('change', handler),
    toggleWatched, setWatchedButton,
  };
})();
