// ============================================================
// Navigation
// ============================================================
document.querySelectorAll('[data-section]').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    const section = link.dataset.section;
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
    document.getElementById('sec-' + section).classList.add('active');
    link.classList.add('active');
    onSectionLoad(section);
  });
});

function onSectionLoad(section) {
  switch (section) {
    case 'dashboard': loadDashboard(); break;
    case 'testmode': loadTestMode(); break;
    case 'content': loadQuestions(); break;
    case 'users': loadUsers(); break;
    case 'plans': loadPlans(); break;
    case 'modules': loadModules(); break;
    case 'kids': loadKids(); break;
    case 'leaderboard': loadLeaderboard(); break;
    case 'ai-settings': loadAISettings(); break;
    case 'settings': loadSettings(); break;
  }
}

// ============================================================
// Auth
// ============================================================
async function doLogin() {
  try {
    const pw = document.getElementById('login-password').value;
    await api('POST', '/login', { password: pw });
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    loadDashboard();
  } catch (e) {
    document.getElementById('login-error').textContent = 'Invalid password';
  }
}

async function doLogout() {
  await api('POST', '/logout');
  document.getElementById('app').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
}

// ============================================================
// Dashboard
// ============================================================
async function loadDashboard() {
  try {
    const d = await api('GET', '/dashboard');
    document.getElementById('stat-total-users').textContent = d.totalUsers || 0;
    document.getElementById('stat-active-today').textContent = d.activeToday || 0;
    document.getElementById('stat-messages-sent').textContent = d.messagesSent || 0;
    document.getElementById('stat-window-open').textContent = d.windowOpenCount || 0;
    document.getElementById('stat-premium').textContent = d.premiumUsers || 0;
    document.getElementById('stat-revenue').textContent = '₹' + (d.monthlyRevenue || 0);

    // Status indicators
    setStatus('status-db', true);
    setStatus('status-chatwoot', d.chatwootConnected);
    setStatus('status-claude', d.claudeConnected);
    setStatus('status-openai', d.openaiConnected);

    // Activity feed
    const feed = document.getElementById('activity-feed');
    feed.innerHTML = (d.recentSessions || []).map(s =>
      `<tr><td>${formatTime(s.sent_at)}</td><td>${s.phone || s.user_id}</td><td>${s.type || '-'}</td><td>${s.is_correct ? '✅' : s.is_correct === false ? '❌' : '⏳'}</td><td>${s.points_earned || 0}</td></tr>`
    ).join('');
  } catch (e) {
    console.error('Dashboard load error:', e);
  }
}

function setStatus(id, ok) {
  const el = document.getElementById(id);
  el.classList.remove('green', 'red');
  el.classList.add(ok ? 'green' : 'red');
}

// ============================================================
// Test Mode
// ============================================================
async function loadTestMode() {
  try {
    const d = await api('GET', '/test-mode');
    document.getElementById('test-mode-toggle').checked = d.testMode === 'true' || d.testMode === true;
    const settings = await api('GET', '/settings');
    document.getElementById('trigger-keyword').value = settings.TRIGGER_KEYWORD || 'brain';
    renderWhitelist(d.whitelist || []);
  } catch (e) { console.error(e); }
}

async function toggleTestMode() {
  const enabled = document.getElementById('test-mode-toggle').checked;
  await api('PUT', '/test-mode', { enabled });
  showToast('Test mode ' + (enabled ? 'enabled' : 'disabled'));
}

async function saveTriggerKeyword() {
  const kw = document.getElementById('trigger-keyword').value;
  await api('PUT', '/trigger-keyword', { keyword: kw });
  showToast('Trigger keyword updated');
}

function showWhitelistForm() {
  document.getElementById('whitelist-form').classList.toggle('hidden');
}

async function addWhitelist() {
  try {
    await api('POST', '/whitelist', {
      phone: document.getElementById('wl-phone').value,
      label: document.getElementById('wl-label').value,
      difficulty: document.getElementById('wl-difficulty').value,
      time_slot: document.getElementById('wl-timeslot').value,
      plan: document.getElementById('wl-plan').value
    });
    showToast('Number added');
    loadTestMode();
  } catch (e) { showToast(e.message, 'error'); }
}

async function removeWhitelist(id) {
  await api('DELETE', '/whitelist/' + id);
  showToast('Number removed');
  loadTestMode();
}

function renderWhitelist(list) {
  const tb = document.getElementById('whitelist-table');
  tb.innerHTML = list.map(w =>
    `<tr><td>${w.phone}</td><td>${w.label || '-'}</td><td>${w.difficulty}</td><td>${w.time_slot}</td><td>${w.plan_type || 'free'}</td><td>${w.is_active ? '✅' : '❌'}</td><td><button class="btn btn-danger btn-sm" onclick="removeWhitelist(${w.id})">Delete</button></td></tr>`
  ).join('');
}

// ============================================================
// Content / Questions
// ============================================================
let questionsPage = 1;
async function loadQuestions(page) {
  if (page) questionsPage = page;
  try {
    const params = new URLSearchParams({ page: questionsPage, limit: 20 });
    ['type', 'difficulty', 'audience', 'week'].forEach(f => {
      const v = document.getElementById('filter-' + f)?.value;
      if (v) params.set(f === 'week' ? 'week_number' : f, v);
    });
    const d = await api('GET', '/questions?' + params);
    const tb = document.getElementById('questions-table');
    tb.innerHTML = (d.questions || []).map(q =>
      `<tr><td>${q.id}</td><td>${q.type}</td><td>${q.difficulty}</td><td>${q.audience}</td><td>${truncate(q.question_text)}</td><td>${truncate(q.answer, 30)}</td><td>${q.points}</td><td>
        <button class="btn btn-sm btn-primary" onclick="editQuestion(${q.id})">Edit</button>
        <button class="btn btn-sm btn-danger" onclick="deleteQuestion(${q.id})">Del</button>
      </td></tr>`
    ).join('');
    renderPagination('questions-pagination', d.total || 0, 20, questionsPage, loadQuestions);
  } catch (e) { console.error(e); }
}

function showQuestionModal(q) {
  document.getElementById('question-modal-title').textContent = q ? 'Edit Question' : 'Add Question';
  const fields = ['id', 'week', 'day', 'type', 'difficulty', 'audience', 'answertype', 'text', 'answer', 'hint', 'points', 'explanation', 'tip', 'recall', 'theme'];
  const mapping = { id: 'id', week: 'week_number', day: 'day_of_week', type: 'type', difficulty: 'difficulty', audience: 'audience', answertype: 'answer_type', text: 'question_text', answer: 'answer', hint: 'hint_text', points: 'points', explanation: 'explanation', tip: 'tip_text', recall: 'memory_recall_text', theme: 'theme' };
  fields.forEach(f => {
    const el = document.getElementById('q-' + f);
    if (el) el.value = q ? (q[mapping[f]] || '') : (f === 'points' ? '10' : '');
  });
  show('question-modal');
}

async function editQuestion(id) {
  const d = await api('GET', '/questions/' + id);
  showQuestionModal(d.question || d);
}

async function saveQuestion(e) {
  e.preventDefault();
  const data = {
    week_number: document.getElementById('q-week').value || null,
    day_of_week: document.getElementById('q-day').value || null,
    type: document.getElementById('q-type').value,
    difficulty: document.getElementById('q-difficulty').value,
    audience: document.getElementById('q-audience').value,
    answer_type: document.getElementById('q-answertype').value,
    question_text: document.getElementById('q-text').value,
    answer: document.getElementById('q-answer').value,
    hint_text: document.getElementById('q-hint').value || null,
    points: parseInt(document.getElementById('q-points').value) || 10,
    explanation: document.getElementById('q-explanation').value || null,
    tip_text: document.getElementById('q-tip').value || null,
    memory_recall_text: document.getElementById('q-recall').value || null,
    theme: document.getElementById('q-theme').value || null
  };
  const id = document.getElementById('q-id').value;
  if (id) {
    await api('PUT', '/questions/' + id, data);
    showToast('Question updated');
  } else {
    await api('POST', '/questions', data);
    showToast('Question created');
  }
  closeModal('question-modal');
  loadQuestions();
}

async function deleteQuestion(id) {
  if (!confirm('Delete this question?')) return;
  await api('DELETE', '/questions/' + id);
  showToast('Question deleted');
  loadQuestions();
}

async function importCSV(input) {
  const file = input.files[0];
  if (!file) return;
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch('/api/admin/questions/import-csv', { method: 'POST', body: formData, credentials: 'include' });
  const data = await res.json();
  showToast(`Imported ${data.count || 0} questions`);
  loadQuestions();
  input.value = '';
}

async function exportQuestions() {
  window.open('/api/admin/questions/export', '_blank');
}

// ============================================================
// AI Generator
// ============================================================
let generatedQuestions = [];

async function generateQuestions() {
  const btn = document.getElementById('gen-btn');
  const loading = document.getElementById('gen-loading');
  btn.disabled = true;
  loading.classList.remove('hidden');
  try {
    const data = await api('POST', '/questions/generate', {
      type: document.getElementById('gen-type').value,
      difficulty: document.getElementById('gen-difficulty').value,
      audience: document.getElementById('gen-audience').value,
      count: parseInt(document.getElementById('gen-count').value) || 5,
      provider: document.getElementById('gen-provider').value
    });
    generatedQuestions = data.questions || [];
    renderGenerated();
    show('gen-results');
    showToast(`Generated ${generatedQuestions.length} questions`);
  } catch (e) {
    showToast(e.message, 'error');
  } finally {
    btn.disabled = false;
    loading.classList.add('hidden');
  }
}

function renderGenerated() {
  document.getElementById('gen-count-label').textContent = generatedQuestions.length;
  const tb = document.getElementById('gen-table');
  tb.innerHTML = generatedQuestions.map((q, i) =>
    `<tr><td>${i + 1}</td><td>${truncate(q.question_text, 80)}</td><td>${truncate(q.answer, 30)}</td><td>${truncate(q.hint_text, 30)}</td><td>${q.points || 10}</td><td>
      <button class="btn btn-sm btn-success" onclick="saveGenerated(${i})">Save</button>
      <button class="btn btn-sm btn-danger" onclick="discardGenerated(${i})">Discard</button>
    </td></tr>`
  ).join('');
}

async function saveGenerated(i) {
  try {
    await api('POST', '/questions', generatedQuestions[i]);
    generatedQuestions.splice(i, 1);
    renderGenerated();
    showToast('Saved');
  } catch (e) { showToast(e.message, 'error'); }
}

function discardGenerated(i) {
  generatedQuestions.splice(i, 1);
  renderGenerated();
}

async function saveAllGenerated() {
  try {
    await api('POST', '/questions/bulk-save', { questions: generatedQuestions });
    showToast(`Saved ${generatedQuestions.length} questions`);
    generatedQuestions = [];
    renderGenerated();
    hide('gen-results');
  } catch (e) { showToast(e.message, 'error'); }
}

function discardAllGenerated() {
  generatedQuestions = [];
  renderGenerated();
  hide('gen-results');
}

// ============================================================
// Users
// ============================================================
let usersPage = 1;
async function loadUsers(page) {
  if (page) usersPage = page;
  try {
    const params = new URLSearchParams({ page: usersPage, limit: 20 });
    const search = document.getElementById('user-search')?.value;
    const status = document.getElementById('user-status')?.value;
    if (search) params.set('search', search);
    if (status) params.set('status', status);
    const d = await api('GET', '/users?' + params);
    const tb = document.getElementById('users-table');
    tb.innerHTML = (d.users || []).map(u =>
      `<tr onclick="viewUser(${u.id})" style="cursor:pointer"><td>${u.phone}</td><td>${u.name || '-'}</td><td>${u.mode}</td><td>${u.difficulty}</td><td>🔥${u.streak}</td><td>${u.total_points}</td><td>${u.is_premium ? '⭐Premium' : 'Free'}</td><td>${u.is_active ? '✅' : '⏸️'}</td><td>${formatDate(u.last_active)}</td><td><button class="btn btn-sm btn-primary" onclick="event.stopPropagation();editUserModal(${u.id})">Edit</button></td></tr>`
    ).join('');
    renderPagination('users-pagination', d.total || 0, 20, usersPage, loadUsers);
  } catch (e) { console.error(e); }
}

async function viewUser(id) {
  try {
    const d = await api('GET', '/users/' + id);
    const u = d.user || d;
    const sessions = d.sessions || [];
    document.getElementById('user-detail').innerHTML = `
      <div class="form-grid">
        <div><strong>Phone:</strong> ${u.phone}</div>
        <div><strong>Name:</strong> ${u.name || '-'}</div>
        <div><strong>Age:</strong> ${u.age || '-'}</div>
        <div><strong>Gender:</strong> ${u.gender || '-'}</div>
        <div><strong>Country:</strong> ${u.country || '-'}</div>
        <div><strong>Mode:</strong> ${u.mode}</div>
        <div><strong>Difficulty:</strong> ${u.difficulty}</div>
        <div><strong>Streak:</strong> 🔥${u.streak} (Best: ${u.longest_streak})</div>
        <div><strong>Points:</strong> ${u.total_points}</div>
        <div><strong>Brain Age:</strong> ${u.brain_age_score || '-'}</div>
        <div><strong>IQ:</strong> ${u.iq_estimate_score || '-'}</div>
        <div><strong>Style:</strong> ${u.cognitive_style || '-'}</div>
        <div><strong>Profession:</strong> ${u.profession || '-'}</div>
        <div><strong>Interests:</strong> ${u.interests || '-'}</div>
        <div><strong>Plan:</strong> ${u.plan_name || 'Free'} ${u.is_premium ? '⭐' : ''}</div>
        <div><strong>Joined:</strong> ${formatDate(u.joined_at)}</div>
        <div><strong>Last Active:</strong> ${formatDate(u.last_active)}</div>
        <div><strong>Onboarding:</strong> ${u.onboarding_step}</div>
      </div>
      <h4 class="mt-20">Assign Plan</h4>
      <div class="form-row">
        <select id="assign-plan-select" class="input">
          <option value="free">Free</option>
          <option value="premium" ${u.is_premium ? 'selected' : ''}>Premium</option>
          <option value="corporate">Corporate</option>
        </select>
        <button class="btn btn-primary" onclick="assignPlan(${u.id})">Assign Plan</button>
      </div>
      <h4 class="mt-20">Recent Sessions</h4>
      <table class="table"><thead><tr><th>Date</th><th>Type</th><th>Correct</th><th>Points</th><th>Time</th></tr></thead>
      <tbody>${sessions.map(s => `<tr><td>${formatDate(s.session_date)}</td><td>${s.session_type}</td><td>${s.is_correct ? '✅' : s.is_correct === false ? '❌' : '-'}</td><td>${s.points_earned || 0}</td><td>${s.response_time_seconds || '-'}s</td></tr>`).join('')}</tbody></table>`;
    show('user-modal');
  } catch (e) { showToast(e.message, 'error'); }
}

async function assignPlan(userId) {
  const planName = document.getElementById('assign-plan-select').value;
  try {
    await api('POST', '/users/' + userId + '/assign-plan', { plan_name: planName });
    showToast('Plan assigned: ' + planName);
    loadUsers();
  } catch (e) { showToast(e.message, 'error'); }
}

async function editUserModal(id) { viewUser(id); }

async function exportUsers() { window.open('/api/admin/users/export', '_blank'); }

// ============================================================
// Plans
// ============================================================
async function loadPlans() {
  try {
    const plans = await api('GET', '/plans');
    const tb = document.getElementById('plans-table');
    tb.innerHTML = (plans || []).map(p =>
      `<tr><td>${p.name}</td><td>₹${p.price_inr}</td><td>${p.challenges_per_day}</td><td>${p.has_analytics ? '✅' : '❌'}</td><td>${p.has_special_modules ? '✅' : '❌'}</td><td>${p.has_kids_mode ? '✅' : '❌'}</td><td>${p.is_active ? '✅' : '❌'}</td><td><button class="btn btn-sm btn-primary" onclick="editPlan(${p.id})">Edit</button></td></tr>`
    ).join('');

    const subs = await api('GET', '/subscriptions');
    const stb = document.getElementById('subscriptions-table');
    stb.innerHTML = (subs || []).map(s =>
      `<tr><td>${s.phone || s.user_id}</td><td>${s.plan_name || s.plan_id}</td><td>${formatDate(s.started_at)}</td><td>${formatDate(s.ends_at)}</td><td>${s.is_active ? '✅' : '❌'}</td></tr>`
    ).join('');
  } catch (e) { console.error(e); }
}

function showPlanForm() { show('plan-form'); }

async function savePlan() {
  const data = {
    name: document.getElementById('plan-name').value,
    price_inr: parseInt(document.getElementById('plan-price').value) || 0,
    challenges_per_day: parseInt(document.getElementById('plan-challenges').value) || 1,
    billing_cycle: document.getElementById('plan-cycle').value,
    has_analytics: document.getElementById('plan-analytics').checked,
    has_special_modules: document.getElementById('plan-modules').checked,
    has_kids_mode: document.getElementById('plan-kids').checked,
    has_corporate_dashboard: document.getElementById('plan-corporate').checked
  };
  const id = document.getElementById('plan-id').value;
  if (id) await api('PUT', '/plans/' + id, data);
  else await api('POST', '/plans', data);
  showToast('Plan saved');
  hide('plan-form');
  loadPlans();
}

async function editPlan(id) {
  const plans = await api('GET', '/plans');
  const p = plans.find(x => x.id === id);
  if (!p) return;
  document.getElementById('plan-id').value = p.id;
  document.getElementById('plan-name').value = p.name;
  document.getElementById('plan-price').value = p.price_inr;
  document.getElementById('plan-challenges').value = p.challenges_per_day;
  document.getElementById('plan-analytics').checked = p.has_analytics;
  document.getElementById('plan-modules').checked = p.has_special_modules;
  document.getElementById('plan-kids').checked = p.has_kids_mode;
  document.getElementById('plan-corporate').checked = p.has_corporate_dashboard;
  show('plan-form');
}

// ============================================================
// Modules
// ============================================================
async function loadModules() {
  try {
    const d = await api('GET', '/modules');
    if (d && d.modules) {
      Object.entries(d.modules).forEach(([key, val]) => {
        const toggle = document.querySelector(`[data-module="${key}"]`);
        if (toggle) toggle.checked = val.enabled !== false;
        Object.entries(val).forEach(([ck, cv]) => {
          if (ck === 'enabled') return;
          const cfg = document.querySelector(`[data-config="${key}_${ck}"]`);
          if (cfg) cfg.value = cv;
        });
      });
    }
  } catch (e) { console.error(e); }
}

async function saveModules() {
  const modules = {};
  document.querySelectorAll('[data-module]').forEach(el => {
    modules[el.dataset.module] = { enabled: el.checked };
  });
  document.querySelectorAll('[data-config]').forEach(el => {
    const [mod, key] = el.dataset.config.split('_');
    if (!modules[mod]) modules[mod] = {};
    modules[mod][key] = el.type === 'checkbox' ? el.checked : el.value;
  });
  await api('PUT', '/modules', { modules });
  showToast('Module settings saved');
}

// ============================================================
// Kids
// ============================================================
async function loadKids() {
  try {
    const d = await api('GET', '/kids');
    document.getElementById('kids-total').textContent = d.total || 0;
    document.getElementById('kids-6-9').textContent = d.ageGroups?.['6-9'] || 0;
    document.getElementById('kids-10-13').textContent = d.ageGroups?.['10-13'] || 0;
    document.getElementById('kids-14-17').textContent = d.ageGroups?.['14-17'] || 0;
    const tb = document.getElementById('kids-coverage-table');
    tb.innerHTML = (d.coverage || []).map(c =>
      `<tr><td>${c.audience}</td><td>${c.total}</td><td>${c.logic || 0}</td><td>${c.words || 0}</td><td>${c.math || 0}</td><td>${c.pattern || 0}</td><td>${c.memory || 0}</td><td>${c.trivia || 0}</td><td>${c.riddle || 0}</td></tr>`
    ).join('');
  } catch (e) { console.error(e); }
}

// ============================================================
// Leaderboard
// ============================================================
async function loadLeaderboard() {
  try {
    const week = document.getElementById('lb-week')?.value || '';
    const d = await api('GET', '/leaderboard' + (week ? '?week=' + week : ''));
    const tb = document.getElementById('leaderboard-table');
    tb.innerHTML = (d || []).map((l, i) =>
      `<tr><td>${l.rank || i + 1}</td><td>${l.name || '-'}</td><td>${l.phone}</td><td>${l.points}</td><td>${l.accuracy_pct || '-'}%</td></tr>`
    ).join('');
  } catch (e) { console.error(e); }
}

// ============================================================
// AI Settings
// ============================================================
async function loadAISettings() {
  try {
    const s = await api('GET', '/settings');
    document.getElementById('ai-claude-key').value = s.ANTHROPIC_API_KEY || '';
    document.getElementById('ai-claude-model').value = s.CLAUDE_MODEL || 'claude-sonnet-4-6';
    document.getElementById('ai-openai-key').value = s.OPENAI_API_KEY || '';
    document.getElementById('ai-openai-model').value = s.OPENAI_MODEL || 'gpt-4o';
  } catch (e) { console.error(e); }
}

async function saveAISettings() {
  await api('PUT', '/settings', {
    settings: {
      ANTHROPIC_API_KEY: document.getElementById('ai-claude-key').value,
      CLAUDE_MODEL: document.getElementById('ai-claude-model').value,
      OPENAI_API_KEY: document.getElementById('ai-openai-key').value,
      OPENAI_MODEL: document.getElementById('ai-openai-model').value
    }
  });
  showToast('AI settings saved');
}

async function testAI(provider) {
  try {
    const d = await api('POST', '/test-ai', { provider });
    const el = document.getElementById('ai-' + provider + '-status');
    el.textContent = '✅ Connected';
    el.style.color = '#00b894';
  } catch (e) {
    const el = document.getElementById('ai-' + provider + '-status');
    el.textContent = '❌ ' + e.message;
    el.style.color = '#e17055';
  }
}

// ============================================================
// Settings
// ============================================================
async function loadSettings() {
  try {
    const s = await api('GET', '/settings');
    document.getElementById('set-botname').value = s.BOT_NAME || '';
    document.getElementById('set-timezone').value = s.TIMEZONE || '';
    document.getElementById('set-trigger').value = s.TRIGGER_KEYWORD || '';
    document.getElementById('set-chatwoot-url').value = s.CHATWOOT_URL || '';
    document.getElementById('set-chatwoot-token').value = s.CHATWOOT_TOKEN || '';
    document.getElementById('set-chatwoot-inbox').value = s.CHATWOOT_INBOX_ID || '';
  } catch (e) { console.error(e); }
}

async function saveSettings() {
  await api('PUT', '/settings', {
    settings: {
      BOT_NAME: document.getElementById('set-botname').value,
      TIMEZONE: document.getElementById('set-timezone').value,
      TRIGGER_KEYWORD: document.getElementById('set-trigger').value,
      CHATWOOT_URL: document.getElementById('set-chatwoot-url').value,
      CHATWOOT_TOKEN: document.getElementById('set-chatwoot-token').value,
      CHATWOOT_INBOX_ID: document.getElementById('set-chatwoot-inbox').value
    }
  });
  showToast('Settings saved');
}

async function testChatwoot() {
  try {
    await api('POST', '/test-chatwoot');
    document.getElementById('chatwoot-status').textContent = '✅ Connected';
    document.getElementById('chatwoot-status').style.color = '#00b894';
  } catch (e) {
    document.getElementById('chatwoot-status').textContent = '❌ ' + e.message;
    document.getElementById('chatwoot-status').style.color = '#e17055';
  }
}

// ============================================================
// Pagination helper
// ============================================================
function renderPagination(containerId, total, perPage, currentPage, loadFn) {
  const pages = Math.ceil(total / perPage);
  if (pages <= 1) { document.getElementById(containerId).innerHTML = ''; return; }
  let html = '';
  for (let i = 1; i <= pages; i++) {
    html += `<button class="btn btn-sm ${i === currentPage ? 'btn-primary' : 'btn-secondary'}" onclick="${loadFn.name}(${i})">${i}</button> `;
  }
  document.getElementById(containerId).innerHTML = html;
}

// ============================================================
// Health Tips
// ============================================================
async function loadHealthTips() {
  try {
    const tips = await api('GET', '/health-tips');
    const tb = document.getElementById('tips-table');
    tb.innerHTML = (tips || []).map(t =>
      `<tr><td>${t.id}</td><td>${t.category}</td><td>${t.audience}</td><td>${truncate(t.tip_text, 60)}</td><td>${t.source || '-'}</td><td><button class="btn btn-sm btn-danger" onclick="deleteTip(${t.id})">Delete</button></td></tr>`
    ).join('');
  } catch (e) { console.error(e); }
}

function showTipForm() { show('tip-form'); }

async function saveTip() {
  try {
    await api('POST', '/health-tips', {
      category: document.getElementById('tip-category').value,
      audience: document.getElementById('tip-audience').value,
      tip_text: document.getElementById('tip-text').value,
      source: document.getElementById('tip-source').value || null
    });
    showToast('Tip added');
    hide('tip-form');
    loadHealthTips();
  } catch (e) { showToast(e.message, 'error'); }
}

async function deleteTip(id) {
  if (!confirm('Delete this tip?')) return;
  await api('DELETE', '/health-tips/' + id);
  showToast('Tip deleted');
  loadHealthTips();
}

// ============================================================
// WhatsApp Flow Visualizer
// ============================================================
function renderFlow(view) {
  const container = document.getElementById('flow-container');
  const flows = {
    onboarding: `
      <div class="flow-group"><div class="flow-group-title">Onboarding Flow</div>
        <div class="flow-node bot"><div class="node-label">Trigger</div><div class="node-text">User sends <strong>"brain"</strong> on WhatsApp</div></div>
        <div class="flow-arrow">↓</div>
        <div class="flow-node action"><div class="node-label">System</div><div class="node-text">Create user record, detect country from phone</div></div>
        <div class="flow-arrow">↓</div>
        <div class="flow-node bot"><div class="node-label">Bot Message</div><div class="node-text">Welcome to BrainPing! Are you joining for yourself or a child?<br>1 - For myself | 2 - For my child</div></div>
        <div class="flow-arrow">↓</div>
        <div class="flow-node user"><div class="node-label">User Reply</div><div class="node-text">1 or 2</div></div>
        <div class="flow-arrow">↓</div>
        <div class="flow-node bot"><div class="node-label">T&C Consent</div><div class="node-text">We collect basic info to personalise training. Reply ACCEPT or REJECT</div></div>
        <div class="flow-arrow">↓</div>
        <div class="flow-branch">
          <div><div class="flow-branch-label">Adult Path</div>
            <div class="flow-node bot"><div class="node-text">How old are you? (18-100)</div></div>
            <div class="flow-arrow">↓</div>
            <div class="flow-node bot"><div class="node-text">What should I call you?</div></div>
          </div>
          <div><div class="flow-branch-label">Kids Path</div>
            <div class="flow-node bot"><div class="node-text">How old is your child? (6-17)</div></div>
            <div class="flow-arrow">↓</div>
            <div class="flow-node action"><div class="node-text">Auto-set difficulty by age group</div></div>
          </div>
        </div>
        <div class="flow-arrow">↓</div>
        <div class="flow-node bot"><div class="node-text">Choose time: 1-Morning 8AM | 2-Afternoon 1PM | 3-Evening 7PM</div></div>
        <div class="flow-arrow">↓</div>
        <div class="flow-node bot"><div class="node-text">Choose difficulty: 1-Easy | 2-Medium | 3-Hard (adults only)</div></div>
        <div class="flow-arrow">↓</div>
        <div class="flow-node bot"><div class="node-label">Complete</div><div class="node-text">You're all set! Shows available modules (1-10)</div></div>
      </div>`,
    daily: `
      <div class="flow-group"><div class="flow-group-title">Daily Session Flow</div>
        <div class="flow-node action"><div class="node-label">Scheduler (Cron)</div><div class="node-text">7:55 AM / 12:55 PM / 6:55 PM based on user preference</div></div>
        <div class="flow-arrow">↓</div>
        <div class="flow-node action"><div class="node-text">Check: window open? test mode? user active?</div></div>
        <div class="flow-arrow">↓</div>
        <div class="flow-node bot"><div class="node-text">Daily Session — Today's challenge: [Type] — Questions: 10</div></div>
        <div class="flow-arrow">↓</div>
        <div class="flow-node bot"><div class="node-text">Question 1/10: [Question text]</div></div>
        <div class="flow-arrow">↓</div>
        <div class="flow-node user"><div class="node-text">User answers</div></div>
        <div class="flow-arrow">↓</div>
        <div class="flow-node bot"><div class="node-text">✅/❌ Result + points → Question 2/10...</div></div>
        <div class="flow-arrow">↓</div>
        <div class="flow-node action"><div class="node-text">Repeat for all 10 questions</div></div>
        <div class="flow-arrow">↓</div>
        <div class="flow-node bot"><div class="node-label">Session Complete</div><div class="node-text">Score: X/10 | Accuracy: X% | Points: X | Streak: X days</div></div>
        <div class="flow-arrow">↓</div>
        <div class="flow-node bot"><div class="node-text">📝 Full answers & explanations for each question</div></div>
        <div class="flow-arrow">↓</div>
        <div class="flow-node action"><div class="node-text">Check adaptive difficulty → may level up/down</div></div>
      </div>`,
    modules: `
      <div class="flow-group"><div class="flow-group-title">Modules Flow</div>
        <div class="flow-node user"><div class="node-text">User types MODULES</div></div>
        <div class="flow-arrow">↓</div>
        <div class="flow-node bot"><div class="node-text">Available Modules:<br>1 🧠 Brain Age | 2 🧩 IQ | 3 ⚡ Speed<br>4 ⚔️ Duel | 5 💡 Profile | 6 📊 Health<br>7 🏆 Leaderboard | 8 🏅 Badges<br>9 🔮 Horoscope | 10 ⏰ Reminder<br>11 🧠 N-Back Memory | 12 🔄 Life Memory | 13 🔍 Attention</div></div>
        <div class="flow-arrow">↓</div>
        <div class="flow-branch">
          <div><div class="flow-branch-label">Brain Age (1)</div><div class="flow-node bot"><div class="node-text">10 questions → scored → "Your brain is X years old"</div></div></div>
          <div><div class="flow-branch-label">N-Back (11)</div><div class="flow-node bot"><div class="node-text">Choose 1/2/3-back → letter sequence → YES/NO per letter</div></div></div>
          <div><div class="flow-branch-label">Attention (13)</div><div class="flow-node bot"><div class="node-text">Random: emoji count / letter count / reading detail / stroop</div></div></div>
        </div>
      </div>`,
    evening: `
      <div class="flow-group"><div class="flow-group-title">Evening Flow (Automated)</div>
        <div class="flow-node action"><div class="node-label">8:00 PM</div><div class="node-text">Evening Brain Teaser — fun fact question</div></div>
        <div class="flow-arrow">↓</div>
        <div class="flow-node bot"><div class="node-text">🎲 Evening Brain Teaser! [Question] — Reply YES to see answer</div></div>
        <div class="flow-arrow">↓</div>
        <div class="flow-node user"><div class="node-text">YES</div></div>
        <div class="flow-arrow">↓</div>
        <div class="flow-node bot"><div class="node-text">✨ Answer + fun fact</div></div>
        <div class="flow-arrow">↓ 1 hour later</div>
        <div class="flow-node action"><div class="node-label">9:00 PM</div><div class="node-text">Evening Closeout</div></div>
        <div class="flow-arrow">↓</div>
        <div class="flow-node bot"><div class="node-text">Today's performance + How was your day? (1-5 mood)</div></div>
        <div class="flow-arrow">↓</div>
        <div class="flow-node bot"><div class="node-text">Gratitude moment: Name one thing you're grateful for today</div></div>
        <div class="flow-arrow">↓</div>
        <div class="flow-node bot"><div class="node-label">Night</div><div class="node-text">Good night! Your brain consolidates memories during sleep 🌙</div></div>
      </div>`,
    commands: `
      <div class="flow-group"><div class="flow-group-title">All Commands</div>
        <table class="table">
          <thead><tr><th>Command</th><th>Action</th><th>Flow</th></tr></thead>
          <tbody>
            <tr><td><strong>brain</strong></td><td>Start onboarding (new users)</td><td>Onboarding flow</td></tr>
            <tr><td><strong>MENU</strong></td><td>Show all commands</td><td>Single message</td></tr>
            <tr><td><strong>MODULES</strong></td><td>Show module selection</td><td>10-item menu</td></tr>
            <tr><td><strong>STATS</strong></td><td>Show personal stats</td><td>Single message</td></tr>
            <tr><td><strong>HINT</strong></td><td>Get hint for pending Q</td><td>Single message (-1 pt)</td></tr>
            <tr><td><strong>BRAIN AGE</strong></td><td>10-question assessment</td><td>Multi-step (10 Q&A)</td></tr>
            <tr><td><strong>IQ</strong></td><td>IQ estimation (Premium)</td><td>Multi-step (15 Q&A)</td></tr>
            <tr><td><strong>DUEL +91XXX</strong></td><td>Challenge a friend</td><td>Paired session</td></tr>
            <tr><td><strong>REMIND</strong></td><td>Set a reminder</td><td>2-step (text → time)</td></tr>
            <tr><td><strong>HOROSCOPE</strong></td><td>Daily horoscope</td><td>AI-generated</td></tr>
            <tr><td><strong>PROFILE</strong></td><td>Build brain profile</td><td>Multi-step personal Q</td></tr>
            <tr><td><strong>LEADERBOARD</strong></td><td>Weekly top 10</td><td>Single message</td></tr>
            <tr><td><strong>BADGES</strong></td><td>View achievements</td><td>Single message</td></tr>
            <tr><td><strong>LEVEL</strong></td><td>Change difficulty</td><td>1-step selection</td></tr>
            <tr><td><strong>PREMIUM</strong></td><td>See plans</td><td>Single message</td></tr>
            <tr><td><strong>REPORT</strong></td><td>Weekly brain report</td><td>Single message</td></tr>
            <tr><td><strong>PAUSE / RESUME</strong></td><td>Toggle messages</td><td>Single message</td></tr>
            <tr><td><strong>STOP</strong></td><td>Unsubscribe</td><td>Single message</td></tr>
          </tbody>
        </table>
      </div>`
  };
  container.innerHTML = flows[view] || flows.onboarding;
}

// ============================================================
// Section load handler update
// ============================================================
const origOnSectionLoad = onSectionLoad;
function onSectionLoadExtended(section) {
  origOnSectionLoad(section);
  if (section === 'health-tips') loadHealthTips();
  if (section === 'flow') renderFlow('onboarding');
}
// Replace the original handler
document.querySelectorAll('[data-section]').forEach(link => {
  link.removeEventListener('click', link._handler);
  const handler = function(e) {
    e.preventDefault();
    const section = this.dataset.section;
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
    document.getElementById('sec-' + section).classList.add('active');
    this.classList.add('active');
    onSectionLoadExtended(section);
  };
  link._handler = handler;
  link.addEventListener('click', handler);
});

// ============================================================
// Init
// ============================================================
(async function init() {
  try {
    await api('GET', '/dashboard');
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    loadDashboard();
  } catch (e) {
    // Not logged in, show login screen
  }
})();
