// Shared API helper for admin panel
async function api(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include'
  };
  if (body && method !== 'GET') opts.body = JSON.stringify(body);
  const res = await fetch('/api/admin' + path, opts);
  if (res.status === 401) {
    document.getElementById('app').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
    throw new Error('Session expired');
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast toast-' + type;
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), 3000);
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

function hide(id) {
  document.getElementById(id).classList.add('hidden');
}

function show(id) {
  document.getElementById(id).classList.remove('hidden');
}

function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTime(d) {
  if (!d) return '-';
  return new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function truncate(s, n = 60) {
  if (!s) return '';
  return s.length > n ? s.substring(0, n) + '...' : s;
}

let debounceTimer;
function debounceSearch(fn, delay) {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(fn, delay);
}
