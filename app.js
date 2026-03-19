/* =============================================
   WE GOT NEXT — app.js
   RSS feed fetcher · Audio player · Mobile nav
   ============================================= */

const FEED_URL = 'https://feeds.transistor.fm/we-got-next';
const CORS_PROXY = 'https://api.allorigins.win/get?url=';

// ---- State ----
let currentAudio = null;
let currentEpisode = null;

// =============================================
// MOBILE NAV
// =============================================
function toggleMenu() {
  const mobile = document.getElementById('nav-mobile');
  if (mobile) mobile.classList.toggle('open');
}

// =============================================
// RSS FEED — fetch & parse episodes
// =============================================
async function loadEpisodes(limit = null) {
  const grid = document.getElementById('episodes-grid');
  if (!grid) return;

  try {
    const res = await fetch(CORS_PROXY + encodeURIComponent(FEED_URL));
    const data = await res.json();
    const parser = new DOMParser();
    const xml = parser.parseFromString(data.contents, 'text/xml');
    let items = Array.from(xml.querySelectorAll('item'));

    if (limit) items = items.slice(0, limit);

    if (items.length === 0) {
      grid.innerHTML = '';
      const noEp = document.getElementById('no-episodes');
      if (noEp) noEp.style.display = 'block';
      return;
    }

    grid.innerHTML = items.map(item => {
      const title = item.querySelector('title')?.textContent || 'Untitled';
      const desc = item.querySelector('description')?.textContent || '';
      const pubDate = item.querySelector('pubDate')?.textContent || '';
      const enclosure = item.querySelector('enclosure');
      const audioUrl = enclosure?.getAttribute('url') || '';
      const duration = item.querySelector('duration')?.textContent || '';

      // Try to get episode image, fall back to show art
      const itunesImage = item.querySelector('image')?.getAttribute('href')
        || 'https://img.transistorcdn.com/oWC0RIOPFLqCGuV4BRQmdQIhmvgP7Man-flXem962BA/rs:fill:0:0:1/w:800/h:800/q:60/mb:500000/aHR0cHM6Ly9pbWct/dXBsb2FkLXByb2R1/Y3Rpb24udHJhbnNp/c3Rvci5mbS82ZmJj/OGI1NWNkZjE4MTEw/NzczOTUzYzE3YjE1/yA5MS5wbmc.jpg';

      const date = pubDate ? new Date(pubDate).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric'
      }) : '';

      const cleanDesc = desc.replace(/<[^>]+>/g, '').trim();

      return `
        <div class="episode-card" onclick="playEpisode('${escHtml(audioUrl)}', '${escHtml(title)}', '${escHtml(itunesImage)}')">
          <img class="episode-thumb" src="${itunesImage}" alt="${escHtml(title)}" loading="lazy" />
          <div class="episode-body">
            <div class="episode-date">${date}${duration ? ' · ' + formatDuration(duration) : ''}</div>
            <div class="episode-title">${escHtml(title)}</div>
            <div class="episode-desc">${escHtml(cleanDesc)}</div>
            <div class="episode-play">▶ Play Episode</div>
          </div>
        </div>
      `;
    }).join('');

  } catch (err) {
    console.error('Feed error:', err);
    grid.innerHTML = `
      <div class="no-episodes" style="grid-column:1/-1;">
        <p>Couldn't load episodes right now. <a href="${FEED_URL}" target="_blank">View RSS feed directly</a>.</p>
      </div>
    `;
  }
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&#39;');
}

function formatDuration(dur) {
  const parts = dur.split(':').map(Number);
  if (parts.length === 3) {
    const [h, m, s] = parts;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  } else if (parts.length === 2) {
    return `${parts[0]}m`;
  }
  const secs = parseInt(dur);
  if (!isNaN(secs)) {
    const m = Math.floor(secs / 60);
    return `${m}m`;
  }
  return dur;
}

// =============================================
// AUDIO PLAYER
// =============================================
function playEpisode(audioUrl, title, artwork) {
  if (!audioUrl) return;

  const player = document.getElementById('sticky-player');
  const audio = document.getElementById('audio-el');
  const playBtn = document.getElementById('player-play');
  const titleEl = document.getElementById('player-title');
  const artworkEl = document.getElementById('player-artwork');

  if (!player || !audio) return;

  // If same episode, toggle play/pause
  if (currentEpisode === audioUrl) {
    togglePlay();
    return;
  }

  currentEpisode = audioUrl;
  audio.src = audioUrl;
  if (titleEl) titleEl.textContent = title;
  if (artworkEl) { artworkEl.src = artwork; artworkEl.alt = title; }

  player.style.display = 'block';
  audio.play();
  if (playBtn) playBtn.textContent = '⏸';

  // Progress tracking
  audio.addEventListener('timeupdate', updateProgress);
  audio.addEventListener('ended', () => {
    if (playBtn) playBtn.textContent = '▶';
  });
}

function togglePlay() {
  const audio = document.getElementById('audio-el');
  const playBtn = document.getElementById('player-play');
  if (!audio) return;

  if (audio.paused) {
    audio.play();
    if (playBtn) playBtn.textContent = '⏸';
  } else {
    audio.pause();
    if (playBtn) playBtn.textContent = '▶';
  }
}

function audioSeek(seconds) {
  const audio = document.getElementById('audio-el');
  if (!audio) return;
  audio.currentTime = Math.max(0, audio.currentTime + seconds);
}

function audioScrub(value) {
  const audio = document.getElementById('audio-el');
  if (!audio || !audio.duration) return;
  audio.currentTime = (value / 100) * audio.duration;
}

function updateProgress() {
  const audio = document.getElementById('audio-el');
  const scrubber = document.getElementById('player-scrubber');
  const current = document.getElementById('player-current');
  const duration = document.getElementById('player-duration');

  if (!audio) return;

  if (scrubber && audio.duration) {
    scrubber.value = (audio.currentTime / audio.duration) * 100;
  }

  if (current) current.textContent = formatTime(audio.currentTime);
  if (duration && audio.duration) duration.textContent = formatTime(audio.duration);
}

function formatTime(secs) {
  if (isNaN(secs)) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function closePlayer() {
  const audio = document.getElementById('audio-el');
  const player = document.getElementById('sticky-player');
  if (audio) { audio.pause(); audio.src = ''; }
  if (player) player.style.display = 'none';
  currentEpisode = null;
}

// =============================================
// CONTACT FORM
// =============================================
function handleContact(e) {
  e.preventDefault();
  const success = document.getElementById('form-success');
  if (success) {
    success.style.display = 'block';
    e.target.reset();
    setTimeout(() => { success.style.display = 'none'; }, 5000);
  }
}

// =============================================
// NAV SCROLL EFFECT
// =============================================
window.addEventListener('scroll', () => {
  const nav = document.getElementById('nav');
  if (nav) {
    if (window.scrollY > 20) {
      nav.style.boxShadow = '0 2px 40px rgba(107,76,154,0.4)';
    } else {
      nav.style.boxShadow = '0 2px 30px rgba(107,76,154,0.25)';
    }
  }
});

// =============================================
// INIT
// =============================================
document.addEventListener('DOMContentLoaded', () => {
  const page = document.body.className;

  if (page === 'page-home') {
    loadEpisodes(3);
  }

  if (page === 'page-episodes') {
    loadEpisodes(null);
  }
});
