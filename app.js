const JSONBIN_API = '/api/bins';
const BIN_ID_KEY = 'juggle-bin-id';

const state = {
  activeCategory: 'volley',
  records: [],
  binId: null,
};

// --- Remote storage (JSONBin) ---

async function initBin() {
  // Check URL hash first (shared link), then localStorage
  const hashId = window.location.hash.slice(1);
  const storedId = localStorage.getItem(BIN_ID_KEY);
  const binId = hashId || storedId;

  if (binId) {
    state.binId = binId;
    localStorage.setItem(BIN_ID_KEY, binId);
    window.location.hash = binId;
    await fetchRecords();
  } else {
    await createBin();
  }

  renderLeaderboard();
}

async function createBin() {
  try {
    const res = await fetch(JSONBIN_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records: [] }),
    });
    const data = await res.json();
    state.binId = data.id;
    localStorage.setItem(BIN_ID_KEY, data.id);
    window.location.hash = data.id;
  } catch {
    // Fallback to local-only if network fails
  }
}

async function fetchRecords() {
  if (!state.binId) return;
  try {
    const res = await fetch(JSONBIN_API + '/' + state.binId);
    const data = await res.json();
    state.records = data.records || [];
  } catch {
    // Use whatever is in state
  }
}

async function saveRecords() {
  if (!state.binId) return;
  try {
    await fetch(JSONBIN_API + '/' + state.binId, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records: state.records }),
    });
  } catch {
    // Silent fail -- data is still in state for this session
  }
}

// --- Helpers ---

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function getRecordsByCategory(category) {
  return state.records
    .filter((r) => r.category === category)
    .sort((a, b) => b.count - a.count);
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

  const records = getRecordsByCategory(state.activeCategory);

  if (records.length === 0) {
    container.appendChild(
      el('div', { className: 'empty-state' },
        el('div', { className: 'icon' }, '\u26BD'),
        el('p', null, 'No records yet. Tap + New Record to add one!')
      )
    );
    return;
  }

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const rank = i + 1;
    const rankClass = rank <= 3 ? `record-card rank-${rank}` : 'record-card';

    const card = el('div', { className: rankClass, 'data-id': record.id },
      el('div', { className: 'rank' }, rank <= 3 ? RANK_MEDALS[rank - 1] : String(rank)),
      el('div', { className: 'record-info' },
        el('div', { className: 'player-name' }, String(record.count) + ' touches'),
        el('div', { className: 'record-date' }, formatDate(record.date))
      ),
      el('button', { className: 'btn-delete', 'data-id': record.id, title: 'Delete' }, '\u00D7')
    );

    container.appendChild(card);
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
  modalOverlay.classList.add('open');
  document.getElementById('count').focus();
});

document.getElementById('modalClose').addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) closeModal();
});

function closeModal() {
  modalOverlay.classList.remove('open');
  document.getElementById('recordForm').reset();
}

document.getElementById('recordForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const category = categorySelect.value;
  const count = parseInt(document.getElementById('count').value, 10);

  if (!count) return;

  state.records.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    category,
    count,
    date: new Date().toISOString(),
  });

  document.querySelector('.tab.active').classList.remove('active');
  document.querySelector(`[data-category="${category}"]`).classList.add('active');
  state.activeCategory = category;

  renderLeaderboard();
  closeModal();
  await saveRecords();
});

// --- Delete ---

document.getElementById('leaderboard').addEventListener('click', async (e) => {
  const btn = e.target.closest('.btn-delete');
  if (!btn) return;

  const id = btn.dataset.id;
  state.records = state.records.filter((r) => r.id !== id);
  renderLeaderboard();
  await saveRecords();
});

// --- Share button ---

document.getElementById('btnShare').addEventListener('click', () => {
  const url = window.location.href;
  if (navigator.share) {
    navigator.share({ title: 'Juggle Records', url });
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(() => {
      const btn = document.getElementById('btnShare');
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = 'Share'; }, 1500);
    });
  }
});

// --- Init ---

initBin();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js');
}
