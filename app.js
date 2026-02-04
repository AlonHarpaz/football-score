const STORAGE_KEY = 'juggle-records';

const state = {
  activeCategory: 'volley',
  records: loadRecords(),
};

function loadRecords() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.records));
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(seconds) {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function getPersonalBests(category) {
  const categoryRecords = state.records.filter((r) => r.category === category);
  const byPlayer = {};

  for (const record of categoryRecords) {
    const name = record.player.toLowerCase();
    if (!byPlayer[name] || record.count > byPlayer[name].count) {
      byPlayer[name] = record;
    }
  }

  return Object.values(byPlayer).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return b.duration - a.duration;
  });
}

function getPlayerHistory(player, category) {
  return state.records
    .filter((r) => r.player.toLowerCase() === player.toLowerCase() && r.category === category)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

function getUniquePlayers() {
  const names = new Set();
  for (const r of state.records) {
    names.add(r.player);
  }
  return [...names];
}

// --- DOM helpers ---

function el(tag, attrs, ...children) {
  const node = document.createElement(tag);
  if (attrs) {
    for (const [key, val] of Object.entries(attrs)) {
      if (key.startsWith('data-')) {
        node.setAttribute(key, val);
      } else if (key === 'className') {
        node.className = val;
      } else if (key === 'title') {
        node.title = val;
      } else {
        node[key] = val;
      }
    }
  }
  for (const child of children) {
    if (typeof child === 'string') {
      node.appendChild(document.createTextNode(child));
    } else if (child) {
      node.appendChild(child);
    }
  }
  return node;
}

const RANK_MEDALS = ['\u{1F947}', '\u{1F948}', '\u{1F949}'];

// --- Rendering ---

function renderLeaderboard() {
  const container = document.getElementById('leaderboard');
  container.replaceChildren();

  const bests = getPersonalBests(state.activeCategory);

  if (bests.length === 0) {
    container.appendChild(
      el('div', { className: 'empty-state' },
        el('div', { className: 'icon' }, '\u26BD'),
        el('p', null, 'No records yet. Tap + New Record to add one!')
      )
    );
    return;
  }

  for (let i = 0; i < bests.length; i++) {
    const record = bests[i];
    const rank = i + 1;
    const rankClass = rank <= 3 ? `record-card rank-${rank}` : 'record-card';

    const card = el('div', { className: rankClass, 'data-player': record.player, 'data-category': record.category },
      el('div', { className: 'rank' }, rank <= 3 ? RANK_MEDALS[rank - 1] : String(rank)),
      el('div', { className: 'record-info' },
        el('div', { className: 'player-name' }, record.player),
        el('div', { className: 'record-date' }, formatDate(record.date))
      ),
      el('div', { className: 'record-stats' },
        el('div', { className: 'stat' },
          el('span', { className: 'stat-value' }, String(record.count)),
          el('span', { className: 'stat-label' }, 'touches')
        ),
        el('div', { className: 'stat' },
          el('span', { className: 'stat-value' }, formatTime(record.duration)),
          el('span', { className: 'stat-label' }, 'time')
        )
      )
    );

    container.appendChild(card);
  }
}

function renderPlayerList() {
  const datalist = document.getElementById('playerList');
  datalist.replaceChildren();
  for (const name of getUniquePlayers()) {
    const option = document.createElement('option');
    option.value = name;
    datalist.appendChild(option);
  }
}

// --- Tabs ---

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelector('.tab.active').classList.remove('active');
    tab.classList.add('active');
    state.activeCategory = tab.dataset.category;
    renderLeaderboard();
  });
});

// --- Add Record Modal ---

const modalOverlay = document.getElementById('modalOverlay');
const categorySelect = document.getElementById('category');

document.getElementById('btnAddRecord').addEventListener('click', () => {
  categorySelect.value = state.activeCategory;
  renderPlayerList();
  modalOverlay.classList.add('open');
  document.getElementById('playerName').focus();
});

document.getElementById('modalClose').addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) closeModal();
});

function closeModal() {
  modalOverlay.classList.remove('open');
  document.getElementById('recordForm').reset();
}

document.getElementById('recordForm').addEventListener('submit', (e) => {
  e.preventDefault();

  const player = document.getElementById('playerName').value.trim();
  const category = categorySelect.value;
  const count = parseInt(document.getElementById('count').value, 10);
  const duration = parseInt(document.getElementById('duration').value, 10);

  if (!player || !count || !duration) return;

  state.records.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    player,
    category,
    count,
    duration,
    date: new Date().toISOString(),
  });

  saveRecords();
  state.activeCategory = category;

  document.querySelector('.tab.active').classList.remove('active');
  document.querySelector(`[data-category="${category}"]`).classList.add('active');

  renderLeaderboard();
  closeModal();
});

// --- Player History Modal ---

const historyOverlay = document.getElementById('historyOverlay');

document.getElementById('leaderboard').addEventListener('click', (e) => {
  const card = e.target.closest('.record-card');
  if (!card) return;

  const player = card.dataset.player;
  const category = card.dataset.category;
  showHistory(player, category);
});

document.getElementById('historyClose').addEventListener('click', closeHistory);
historyOverlay.addEventListener('click', (e) => {
  if (e.target === historyOverlay) closeHistory();
});

function closeHistory() {
  historyOverlay.classList.remove('open');
}

function showHistory(player, category) {
  const history = getPlayerHistory(player, category);
  const best = history.reduce((top, r) => (r.count > top.count ? r : top), history[0]);

  document.getElementById('historyTitle').textContent = `${player} - ${capitalize(category)}`;

  const content = document.getElementById('historyContent');
  content.replaceChildren();

  const list = el('div', { className: 'history-list' });

  for (const r of history) {
    const isBest = r.id === best.id;

    const infoDiv = el('div', null,
      el('div', { className: 'history-date' }, formatDate(r.date)),
      isBest ? el('div', { className: 'record-badge' }, 'Personal Best') : null
    );

    const statsDiv = el('div', { className: 'history-stats' },
      el('div', null,
        el('div', { className: 'history-value' }, String(r.count)),
        el('div', { className: 'history-label' }, 'touches')
      ),
      el('div', null,
        el('div', { className: 'history-value' }, formatTime(r.duration)),
        el('div', { className: 'history-label' }, 'time')
      )
    );

    const deleteBtn = el('button', { className: 'btn-delete', 'data-id': r.id, title: 'Delete' }, '\u00D7');

    const item = el('div', { className: isBest ? 'history-item is-record' : 'history-item' },
      infoDiv, statsDiv, deleteBtn
    );

    list.appendChild(item);
  }

  content.appendChild(list);
  historyOverlay.classList.add('open');
}

document.getElementById('historyContent').addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-delete');
  if (!btn) return;

  const id = btn.dataset.id;
  state.records = state.records.filter((r) => r.id !== id);
  saveRecords();
  renderLeaderboard();

  const remaining = state.records.filter(
    (r) => r.category === state.activeCategory
  );
  if (remaining.length === 0) {
    closeHistory();
  } else {
    const item = btn.closest('.history-item');
    if (item) {
      item.style.opacity = '0';
      item.style.transform = 'translateX(100%)';
      item.style.transition = 'all 0.25s';
      setTimeout(() => item.remove(), 250);
    }
  }
});

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// --- Init ---

renderLeaderboard();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js');
}
