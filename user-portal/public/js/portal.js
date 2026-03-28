// ============================================================
// Navigation
// ============================================================
let currentUser = null;

document.querySelectorAll('[data-tab]').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    const tab = link.dataset.tab;
    document.querySelectorAll('.tab-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-tabs a').forEach(a => a.classList.remove('active'));
    document.getElementById('tab-' + tab).classList.add('active');
    link.classList.add('active');
    onTabLoad(tab);
  });
});

function onTabLoad(tab) {
  switch (tab) {
    case 'dashboard': loadDashboard(); break;
    case 'results': loadResults(); break;
    case 'assessments': loadAssessments(); break;
    case 'badges': loadBadges(); break;
    case 'leaderboard': loadLeaderboard(); break;
    case 'settings': loadPrefs(); break;
    case 'subscription': loadSubscription(); break;
  }
}

// ============================================================
// Auth
// ============================================================
let loginPhone = '';

async function sendOTP() {
  const phone = document.getElementById('login-phone').value.trim();
  if (!phone) return;
  loginPhone = phone;
  try {
    await api('POST', '/login', { phone });
    document.getElementById('phone-step').classList.add('hidden');
    document.getElementById('otp-step').classList.remove('hidden');
    document.getElementById('login-msg').textContent = 'OTP sent to your WhatsApp!';
    document.getElementById('login-msg').style.color = '#00b894';
  } catch (e) {
    document.getElementById('login-msg').textContent = e.message;
    document.getElementById('login-msg').style.color = '#e17055';
  }
}

async function verifyOTP() {
  const otp = document.getElementById('login-otp').value.trim();
  try {
    await api('POST', '/login', { phone: loginPhone, otp });
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    loadDashboard();
  } catch (e) {
    document.getElementById('login-msg').textContent = 'Invalid OTP. Try again.';
    document.getElementById('login-msg').style.color = '#e17055';
  }
}

async function logout() {
  await api('POST', '/logout');
  location.reload();
}

// ============================================================
// Dashboard
// ============================================================
async function loadDashboard() {
  try {
    const d = await api('GET', '/dashboard');
    currentUser = d.user;
    const s = d.stats || {};

    document.getElementById('welcome-msg').textContent = `Welcome back, ${d.user?.name || 'Brain Trainer'}!`;
    document.getElementById('dash-streak').textContent = s.streak || 0;
    document.getElementById('dash-points').textContent = s.totalPoints || 0;
    document.getElementById('dash-accuracy').textContent = (s.accuracy || 0) + '%';

    // Brain health
    if (d.user?.is_premium && d.user?.brain_health_score != null) {
      document.getElementById('health-gauge').style.width = d.user.brain_health_score + '%';
      document.getElementById('health-value').textContent = d.user.brain_health_score + '/100';
      document.getElementById('health-score-container').classList.remove('hidden');
      document.getElementById('health-upgrade').classList.add('hidden');
    } else {
      document.getElementById('health-score-container').classList.add('hidden');
      document.getElementById('health-upgrade').classList.remove('hidden');
    }

    // Recent activity
    const actDiv = document.getElementById('recent-activity');
    actDiv.innerHTML = (d.recentSessions || []).slice(0, 5).map(s =>
      `<div class="activity-item"><span>${s.type || 'Challenge'} - ${formatDate(s.sent_at)}</span><span>${s.is_correct ? '✅' : s.is_correct === false ? '❌' : '⏳'} ${s.points_earned || 0} pts</span></div>`
    ).join('') || '<p style="color:#636e72">No activity yet. Start your first challenge on WhatsApp!</p>';
  } catch (e) { console.error(e); }
}

// ============================================================
// Results Calendar
// ============================================================
let calMonth = new Date().getMonth() + 1;
let calYear = new Date().getFullYear();

function prevMonth() { calMonth--; if (calMonth < 1) { calMonth = 12; calYear--; } loadResults(); }
function nextMonth() { calMonth++; if (calMonth > 12) { calMonth = 1; calYear++; } loadResults(); }

async function loadResults() {
  try {
    const d = await api('GET', `/results?month=${calMonth}&year=${calYear}`);
    const months = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    document.getElementById('cal-month-label').textContent = `${months[calMonth]} ${calYear}`;

    const grid = document.getElementById('calendar-grid');
    // Keep headers
    grid.innerHTML = '<div class="cal-header">Sun</div><div class="cal-header">Mon</div><div class="cal-header">Tue</div><div class="cal-header">Wed</div><div class="cal-header">Thu</div><div class="cal-header">Fri</div><div class="cal-header">Sat</div>';

    const firstDay = new Date(calYear, calMonth - 1, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth, 0).getDate();

    // Session lookup
    const sessionMap = {};
    (d.sessions || []).forEach(s => {
      const day = new Date(s.session_date).getDate();
      sessionMap[day] = s;
    });

    // Blank days
    for (let i = 0; i < firstDay; i++) grid.innerHTML += '<div class="cal-day empty"></div>';

    // Calendar days
    let answered = 0, correct = 0, totalPts = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      const s = sessionMap[day];
      let cls = '';
      if (s) {
        answered++;
        if (s.is_correct) { cls = 'green'; correct++; }
        else if (s.is_correct === false) cls = 'red';
        totalPts += s.points_earned || 0;
      } else {
        const dt = new Date(calYear, calMonth - 1, day);
        if (dt < new Date()) cls = 'gray';
      }
      grid.innerHTML += `<div class="cal-day ${cls}">${day}</div>`;
    }

    document.getElementById('res-answered').textContent = answered;
    document.getElementById('res-correct').textContent = correct;
    document.getElementById('res-points').textContent = totalPts;
  } catch (e) { console.error(e); }
}

// ============================================================
// Assessments
// ============================================================
async function loadAssessments() {
  try {
    const d = await api('GET', '/assessments');
    const assessments = d.assessments || [];

    const brainAge = assessments.find(a => a.assessment_type === 'brain_age');
    const iq = assessments.find(a => a.assessment_type === 'iq');

    if (brainAge) {
      document.getElementById('assess-brain-age').textContent = brainAge.score;
      document.getElementById('assess-brain-age-label').textContent = brainAge.result_label || 'Completed';
    }
    if (iq) {
      document.getElementById('assess-iq').textContent = iq.score;
      document.getElementById('assess-iq-label').textContent = iq.result_label || 'Completed';
    }
    if (currentUser?.cognitive_style) {
      document.getElementById('assess-style').textContent = currentUser.cognitive_style;
      document.getElementById('assess-style-label').textContent = 'Your cognitive profile';
    }

    const tb = document.getElementById('assessment-history');
    tb.innerHTML = assessments.map(a =>
      `<tr><td>${formatDate(a.completed_at || a.created_at)}</td><td>${a.assessment_type}</td><td>${a.score}</td><td>${a.result_label || '-'}</td></tr>`
    ).join('') || '<tr><td colspan="4" style="text-align:center;color:#636e72">No assessments yet</td></tr>';
  } catch (e) { console.error(e); }
}

// ============================================================
// Badges
// ============================================================
const ALL_BADGES = [
  { type: 'streak_7', icon: '🔥', name: '7-Day Streak', desc: 'Maintain a 7-day streak' },
  { type: 'streak_30', icon: '🔥🔥', name: '30-Day Streak', desc: '30 consecutive days' },
  { type: 'streak_100', icon: '🔥🔥🔥', name: '100-Day Streak', desc: '100 consecutive days' },
  { type: 'perfect_week', icon: '⭐', name: 'Perfect Week', desc: '7/7 correct in a week' },
  { type: 'speed_demon', icon: '⚡', name: 'Speed Demon', desc: '3 answers under 5 seconds' },
  { type: 'brain_age_test', icon: '🧠', name: 'Brain Explorer', desc: 'Complete brain age test' },
  { type: 'top_3', icon: '🏆', name: 'Top 3 Finish', desc: 'Rank top 3 on leaderboard' },
  { type: 'recall_master', icon: '🧩', name: 'Recall Master', desc: 'Recall 10/10 words' }
];

async function loadBadges() {
  try {
    const d = await api('GET', '/badges');
    const earned = new Set((d.badges || []).map(b => b.badge_type));
    const grid = document.getElementById('badges-grid');
    grid.innerHTML = ALL_BADGES.map(b => {
      const isEarned = earned.has(b.type);
      return `<div class="badge-card ${isEarned ? '' : 'locked'}">
        <div class="badge-icon">${b.icon}</div>
        <div class="badge-name">${b.name}</div>
        <div class="badge-desc">${isEarned ? 'Earned!' : b.desc}</div>
      </div>`;
    }).join('');
  } catch (e) { console.error(e); }
}

// ============================================================
// Leaderboard
// ============================================================
async function loadLeaderboard() {
  try {
    const d = await api('GET', '/leaderboard');
    const tb = document.getElementById('portal-leaderboard');
    tb.innerHTML = (d.leaderboard || []).map((l, i) => {
      const isMe = currentUser && l.user_id === currentUser.id;
      return `<tr class="${isMe ? 'highlight' : ''}"><td>${l.rank || i + 1}</td><td>${l.name || 'Anonymous'}</td><td>${l.points}</td><td>${l.accuracy_pct || '-'}%</td></tr>`;
    }).join('') || '<tr><td colspan="4" style="text-align:center;color:#636e72">No leaderboard data yet</td></tr>';

    const rankDiv = document.getElementById('my-rank');
    if (d.myRank) {
      rankDiv.textContent = `Your rank: #${d.myRank.rank} with ${d.myRank.points} points`;
      rankDiv.classList.remove('hidden');
    } else {
      rankDiv.classList.add('hidden');
    }
  } catch (e) { console.error(e); }
}

// ============================================================
// Settings
// ============================================================
async function loadPrefs() {
  if (currentUser) {
    document.getElementById('pref-timeslot').value = currentUser.time_slot || '08:00';
    document.getElementById('pref-difficulty').value = currentUser.difficulty || 'medium';
  }
}

async function savePrefs() {
  try {
    await api('PUT', '/settings', {
      time_slot: document.getElementById('pref-timeslot').value,
      difficulty: document.getElementById('pref-difficulty').value
    });
    showToast('Settings saved!');
  } catch (e) { showToast(e.message, 'error'); }
}

// ============================================================
// Subscription
// ============================================================
async function loadSubscription() {
  try {
    const d = await api('GET', '/subscription');
    const info = document.getElementById('current-plan-info');
    if (d.currentPlan) {
      info.innerHTML = `<strong>${d.currentPlan.name}</strong> - Rs.${d.currentPlan.price_inr}/month${d.isPremium ? ' ⭐' : ''}`;
    } else {
      info.innerHTML = '<strong>Free Plan</strong>';
    }

    const grid = document.getElementById('plans-grid');
    grid.innerHTML = (d.allPlans || []).map(p => {
      const isCurrent = d.currentPlan && d.currentPlan.id === p.id;
      const features = [];
      features.push(`${p.challenges_per_day} challenge${p.challenges_per_day > 1 ? 's' : ''}/day`);
      if (p.has_analytics) features.push('Advanced analytics');
      if (p.has_special_modules) features.push('All special modules');
      if (p.has_kids_mode) features.push('Kids mode');
      if (p.has_corporate_dashboard) features.push('Corporate dashboard');
      return `<div class="plan-card ${isCurrent ? 'current' : ''}">
        <h4>${p.name}</h4>
        <div class="plan-price">Rs.${p.price_inr}<small>/mo</small></div>
        <ul class="plan-features">${features.map(f => `<li>${f}</li>`).join('')}</ul>
        ${isCurrent ? '<p><strong>Current Plan</strong></p>' : '<button class="btn btn-primary">Contact to Upgrade</button>'}
      </div>`;
    }).join('');
  } catch (e) { console.error(e); }
}

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
    // Not logged in
  }
})();
