/**
 * Calendar & Weekly Planning Module
 * Modes: "Текущая неделя" (Monday to Sunday) and "Месяц"
 * Features: Visual distribution by deadline, overdue indicators
 */

class CalendarModule {
  constructor() {
    this.currentDate = new Date();
    this.viewMode = 'week'; // 'week' (default) or 'month'
  }

  init() {
    this.bindEvents();
    this.render();
  }

  bindEvents() {
    const btnPrev = document.getElementById('cal-btn-prev');
    const btnNext = document.getElementById('cal-btn-next');
    const btnToday = document.getElementById('cal-btn-today');
    const btnModeWeek = document.getElementById('cal-mode-week');
    const btnModeMonth = document.getElementById('cal-mode-month');

    if (btnPrev) btnPrev.addEventListener('click', () => this.navigate(-1));
    if (btnNext) btnNext.addEventListener('click', () => this.navigate(1));
    if (btnToday) btnToday.addEventListener('click', () => {
      this.currentDate = new Date();
      this.render();
    });

    if (btnModeWeek) {
      btnModeWeek.addEventListener('click', () => {
        this.viewMode = 'week';
        btnModeWeek.classList.add('active');
        btnModeMonth?.classList.remove('active');
        this.render();
      });
    }

    if (btnModeMonth) {
      btnModeMonth.addEventListener('click', () => {
        this.viewMode = 'month';
        btnModeMonth.classList.add('active');
        btnModeWeek?.classList.remove('active');
        this.render();
      });
    }
  }

  navigate(dir) {
    if (this.viewMode === 'month') {
      this.currentDate.setMonth(this.currentDate.getMonth() + dir);
    } else {
      this.currentDate.setDate(this.currentDate.getDate() + (dir * 7));
    }
    this.render();
  }

  render() {
    const titleEl = document.getElementById('cal-month-title');
    const containerEl = document.getElementById('cal-grid-area');
    if (!containerEl) return;

    const { tasks = [], contracts = [], employees = [] } = window.storage.cache;
    const todayStr = new Date().toISOString().split('T')[0];

    if (this.viewMode === 'week') {
      this.renderWeekView(containerEl, titleEl, tasks, contracts, employees, todayStr);
    } else {
      this.renderMonthView(containerEl, titleEl, tasks, contracts, employees, todayStr);
    }
  }

  /* ---------------- Недельный план (Пн-Вс) ---------------- */
  renderWeekView(containerEl, titleEl, tasks, contracts, employees, todayStr) {
    const current = new Date(this.currentDate);
    // Find Monday of the current week (0 = Sun, 1 = Mon, ..., 6 = Sat)
    const dayOfWeek = current.getDay();
    const distanceToMonday = (dayOfWeek + 6) % 7;
    
    const monday = new Date(current);
    monday.setDate(current.getDate() - distanceToMonday);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const monthNames = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
    if (titleEl) {
      titleEl.textContent = `Неделя: ${monday.getDate()} ${monthNames[monday.getMonth()]} — ${sunday.getDate()} ${monthNames[sunday.getMonth()]} ${sunday.getFullYear()}`;
    }

    const dayNames = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
    let weekHtml = '<div class="calendar-week-grid">';

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const isToday = dateStr === todayStr;
      const isWeekend = i >= 5;

      // Tasks matching this deadline
      const dayTasks = tasks.filter(t => t.endDate === dateStr);
      const dayContracts = contracts.filter(c => c.endDate === dateStr);

      weekHtml += `
        <div class="calendar-week-column ${isToday ? 'today' : ''}">
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-color); padding-bottom:4px;">
            <div>
              <span style="font-weight:700; font-size:0.85rem; color:${isToday ? 'var(--accent-primary)' : 'var(--text-primary)'};">${d.getDate()}</span>
              <span style="font-size:0.75rem; color:var(--text-muted); margin-left:4px;">${dayNames[i].substring(0, 2)}</span>
            </div>
            ${isToday ? '<span class="badge badge-status-in_progress" style="font-size:0.65rem; padding:1px 4px;">Сегодня</span>' : ''}
          </div>

          <div style="display:flex; flex-direction:column; gap:6px; flex:1; overflow-y:auto;">
            ${dayTasks.map(t => {
              const isOverdue = t.endDate && t.endDate < todayStr && t.status !== 'done';
              const assignee = employees.find(e => e.id === t.assigneeId) || { name: 'Не назначен' };
              const progress = t.progress || (t.status === 'done' ? 100 : 0);

              return `
                <div style="background:var(--bg-secondary); border:1px solid ${isOverdue ? 'var(--danger)' : 'var(--border-color)'}; border-left:3px solid ${isOverdue ? 'var(--danger)' : (t.status === 'done' ? 'var(--success)' : 'var(--accent-primary)')}; padding:6px 8px; border-radius:4px; font-size:0.78rem; cursor:pointer; box-shadow:var(--shadow-sm);"
                     onclick="window.tasksModule.openTaskModal('${t.id}')">
                  <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:4px;">
                    <span style="font-weight:600; line-height:1.2;">${this.escapeHtml(t.title)}</span>
                    ${isOverdue ? '<span class="badge badge-overdue" style="font-size:0.62rem; padding:1px 3px;">Просрочено</span>' : ''}
                  </div>
                  <div style="font-size:0.7rem; color:var(--text-muted); margin-top:4px; display:flex; justify-content:space-between;">
                    <span>👤 ${this.escapeHtml(assignee.name.split(' ')[0])}</span>
                    <span style="font-weight:600; color:var(--accent-primary);">${progress}%</span>
                  </div>
                </div>
              `;
            }).join('')}

            ${dayContracts.map(c => `
              <div style="background:#fef3c7; color:#92400e; border:1px solid #fde68a; border-left:3px solid #d97706; padding:6px 8px; border-radius:4px; font-size:0.75rem; cursor:pointer;"
                   onclick="window.contractsModule.openContractModal('${c.id}')">
                <div style="font-weight:600;">📑 Дедлайн: ${this.escapeHtml(c.number)}</div>
                <div style="font-size:0.7rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${this.escapeHtml(c.title)}</div>
              </div>
            `).join('')}

            ${(dayTasks.length === 0 && dayContracts.length === 0) ? `
              <div style="color:var(--text-muted); font-size:0.72rem; text-align:center; padding:1.5rem 0; opacity:0.6;">
                Нет дедлайнов
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }

    weekHtml += '</div>';
    containerEl.innerHTML = weekHtml;
  }

  /* ---------------- Месячный вид ---------------- */
  renderMonthView(containerEl, titleEl, tasks, contracts, employees, todayStr) {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
    
    if (titleEl) {
      titleEl.textContent = `${monthNames[month]} ${year}`;
    }

    const daysOfWeek = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    let gridHtml = '<div class="calendar-grid">';
    gridHtml += daysOfWeek.map(d => `<div class="calendar-day-header">${d}</div>`).join('');

    const firstDay = new Date(year, month, 1);
    let startDayOfWeek = firstDay.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    // Prev month days
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const dayNum = prevMonthDays - i;
      gridHtml += `<div class="calendar-day-cell other-month"><div class="day-number">${dayNum}</div></div>`;
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      const dateStr = d.toISOString().split('T')[0];
      const isToday = dateStr === todayStr;

      const dayTasks = tasks.filter(t => t.endDate === dateStr);
      const dayContracts = contracts.filter(c => c.endDate === dateStr);

      gridHtml += `
        <div class="calendar-day-cell ${isToday ? 'today' : ''}" data-date="${dateStr}">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span class="day-number" style="${isToday ? 'color:var(--accent-primary); font-weight:800;' : ''}">${day}</span>
            ${dayTasks.length ? `<span class="badge badge-low" style="padding:1px 4px;font-size:0.65rem;">${dayTasks.length}</span>` : ''}
          </div>
          <div style="display:flex; flex-direction:column; gap:3px; margin-top:4px;">
            ${dayTasks.map(t => {
              const isOverdue = t.endDate && t.endDate < todayStr && t.status !== 'done';
              return `
                <div style="background:var(--bg-tertiary); padding:2px 4px; border-radius:3px; font-size:0.7rem; cursor:pointer; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; border-left:2px solid ${isOverdue ? 'var(--danger)' : 'var(--accent-primary)'}; color:${isOverdue ? 'var(--danger)' : 'var(--text-primary)'};"
                     onclick="window.tasksModule.openTaskModal('${t.id}')" title="${this.escapeHtml(t.title)} (Дедлайн: ${t.endDate})">
                  ${isOverdue ? '⚠️ ' : '📌 '}${this.escapeHtml(t.title)}
                </div>
              `;
            }).join('')}
            ${dayContracts.map(c => `
              <div style="background:#fef3c7; color:#92400e; padding:2px 4px; border-radius:3px; font-size:0.7rem; cursor:pointer; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; border-left:2px solid #d97706;"
                   onclick="window.contractsModule.openContractModal('${c.id}')" title="Окончание договора: ${this.escapeHtml(c.title)}">
                📑 ${this.escapeHtml(c.number)}
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    // Remaining filler cells
    const totalRendered = startDayOfWeek + daysInMonth;
    const nextDays = (7 - (totalRendered % 7)) % 7;
    for (let i = 1; i <= nextDays; i++) {
      gridHtml += `<div class="calendar-day-cell other-month"><div class="day-number">${i}</div></div>`;
    }

    gridHtml += '</div>';
    containerEl.innerHTML = gridHtml;
  }

  escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}

window.calendarModule = new CalendarModule();
