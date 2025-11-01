const STORAGE_KEY = 'ram_write_sessions_v1';

function loadSessions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (_e) {
    return [];
  }
}

function saveSessions(sessions) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch (_e) {
    // ignore quota errors
  }
}

function formatDate(iso) {
  try {
    const d = new Date(iso);
    const datePart = d.toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
    const timePart = d.toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', hour12: true
    });
    return `${datePart}, ${timePart}`;
  } catch (_e) {
    return iso;
  }
}

let currentSession = null;

export function startSession() {
  currentSession = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
    startTime: new Date().toISOString(),
    endTime: null,
    count: 0
  };
  persistCurrent();
}

export function incrementCount() {
  if (!currentSession) startSession();
  currentSession.count += 1;
  persistCurrent();
}

export function endSession() {
  if (!currentSession) return;
  if (currentSession.count <= 0) {
    currentSession = null;
    return;
  }
  currentSession.endTime = new Date().toISOString();
  const sessions = loadSessions();
  sessions.unshift(currentSession);
  saveSessions(sessions);
  currentSession = null;
}

function persistCurrent() {
  // Keep latest session preview in storage so refreshes don’t lose progress
  sessionStorage.setItem('ram_current_session', JSON.stringify(currentSession));
}

export function restoreOngoingSession() {
  try {
    const raw = sessionStorage.getItem('ram_current_session');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.count === 'number') {
        currentSession = parsed;
      }
    }
  } catch (_e) {}
}

export function getSessions() {
  return loadSessions();
}

export function clearHistory() {
  saveSessions([]);
}

export function bindHistoryUI() {
  const historyBtn = document.getElementById('historyButton');
  const modal = document.getElementById('historyModal');
  const modalClose = document.getElementById('historyClose');
  const modalList = document.getElementById('historyList');
  const clearBtn = document.getElementById('historyClear');
  const calGrid = document.getElementById('historyCalendar');
  const calPrev = document.getElementById('calPrev');
  const calNext = document.getElementById('calNext');
  const calMonthLabel = document.getElementById('calMonthLabel');
  const tabCal = document.getElementById('tabCalendar');
  const tabSes = document.getElementById('tabSessions');
  const panelCal = document.getElementById('tabPanelCalendar');
  const panelSes = document.getElementById('tabPanelSessions');

  let viewYearMonth = (() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() }; // 0-based month
  })();

  function ymd(d) {
    const y = d.getFullYear();
    const m = `${d.getMonth()+1}`.padStart(2,'0');
    const day = `${d.getDate()}`.padStart(2,'0');
    return `${y}-${m}-${day}`;
  }

  function aggregateByDate() {
    const sessions = getSessions();
    const totals = {};
    sessions.forEach((s) => {
      const whenIso = s.endTime || s.startTime;
      const d = new Date(whenIso);
      const key = ymd(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
      totals[key] = (totals[key] || 0) + (s.count || 0);
    });
    return totals;
  }

  function renderCalendar() {
    if (!calGrid || !calMonthLabel) return;
    calGrid.innerHTML = '';

    // Header row (DoW)
    const dows = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    dows.forEach(dw => {
      const el = document.createElement('div');
      el.className = 'cal-dow';
      el.textContent = dw;
      calGrid.appendChild(el);
    });

    const { y, m } = viewYearMonth;
    const firstOfMonth = new Date(y, m, 1);
    const startDow = firstOfMonth.getDay();
    const daysInMonth = new Date(y, m+1, 0).getDate();
    const totals = aggregateByDate();

    calMonthLabel.textContent = firstOfMonth.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

    // Leading previous month days to align grid (muted)
    const prevMonthDays = startDow;
    const prevMonth = new Date(y, m, 0).getDate();
    for (let i = prevMonthDays - 1; i >= 0; i--) {
      const el = document.createElement('div');
      el.className = 'cal-day muted';
      el.textContent = `${prevMonth - i}`;
      calGrid.appendChild(el);
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const el = document.createElement('div');
      el.className = 'cal-day';
      el.textContent = `${day}`;
      const key = ymd(new Date(y, m, day));
      if ((totals[key] || 0) >= 108) {
        el.classList.add('achieved');
      }
      calGrid.appendChild(el);
    }

    // Trailing next month fillers to complete weeks (optional)
    const cellsSoFar = 7 + prevMonthDays + daysInMonth; // 7 dow + days
    const remainder = cellsSoFar % 7;
    const trailing = remainder === 0 ? 0 : 7 - remainder;
    for (let i = 1; i <= trailing; i++) {
      const el = document.createElement('div');
      el.className = 'cal-day muted';
      el.textContent = `${i}`;
      calGrid.appendChild(el);
    }
  }

  function render() {
    const sessions = getSessions();
    if (!modalList) return;
    modalList.innerHTML = '';
    if (sessions.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'history-empty';
      empty.textContent = 'No history yet. Start writing “राम”.';
      modalList.appendChild(empty);
      return;
    }
    sessions.forEach((s) => {
      const item = document.createElement('div');
      item.className = 'history-item';
      const when = s.endTime ? s.endTime : s.startTime;
      item.innerHTML = `
        <div class="history-item-row">
          <span class="history-count">${s.count} राम</span>
          <span class="history-time">${formatDate(when)}</span>
        </div>
      `;
      modalList.appendChild(item);
    });
  }

  function openModal() {
    if (!modal) return;
    // default to Calendar tab on open
    activateTab('calendar');
    modal.classList.add('show');
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.remove('show');
  }

  if (historyBtn) historyBtn.addEventListener('click', openModal);
  if (modalClose) modalClose.addEventListener('click', closeModal);
  if (modal) modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
  if (clearBtn) clearBtn.addEventListener('click', () => {
    clearHistory();
    if (isCalendarActive()) {
      renderCalendar();
    } else {
      render();
    }
  });

  if (calPrev) calPrev.addEventListener('click', () => {
    viewYearMonth.m -= 1;
    if (viewYearMonth.m < 0) { viewYearMonth.m = 11; viewYearMonth.y -= 1; }
    renderCalendar();
  });
  if (calNext) calNext.addEventListener('click', () => {
    viewYearMonth.m += 1;
    if (viewYearMonth.m > 11) { viewYearMonth.m = 0; viewYearMonth.y += 1; }
    renderCalendar();
  });

  function isCalendarActive() {
    return tabCal && tabCal.classList.contains('active');
  }

  function activateTab(which) {
    if (!tabCal || !tabSes || !panelCal || !panelSes) return;
    if (which === 'calendar') {
      tabCal.classList.add('active');
      tabCal.setAttribute('aria-selected', 'true');
      tabSes.classList.remove('active');
      tabSes.setAttribute('aria-selected', 'false');
      panelCal.hidden = false;
      panelSes.hidden = true;
      renderCalendar();
    } else {
      tabSes.classList.add('active');
      tabSes.setAttribute('aria-selected', 'true');
      tabCal.classList.remove('active');
      tabCal.setAttribute('aria-selected', 'false');
      panelSes.hidden = false;
      panelCal.hidden = true;
      render();
    }
  }

  if (tabCal) tabCal.addEventListener('click', () => activateTab('calendar'));
  if (tabSes) tabSes.addEventListener('click', () => activateTab('sessions'));
}


