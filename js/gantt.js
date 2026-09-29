/**
 * Professional Gantt Chart & Schedule Network Engine (MS Project Level)
 * Complete Offline Air-Gapped Edition
 * 
 * Capabilities:
 * 1. Multi-Schedule Tabs (Вкладки для разных графиков и комплексов работ: Сводный, СМР, Инженерия, ИТ, Поставки, Пользовательские)
 * 2. Multi-tier Timescale Engine: Days, Weeks, Months, Quarters, Years with persistent state
 * 3. Microsoft Project XML (.xml) Import with Schema validation, WBS hierarchy reconstruction & preview modal
 * 4. Microsoft Project XML (.xml) Export (MSPDI schema compatible with MS Project 2013-2021, ProjectLibre, Primavera)
 * 5. WBS Structural Hierarchy (Phases/Summary tasks, Subtasks, Milestones) with [+] / [-] folding
 * 6. Predecessors & Dependencies (FS, SS, FF, SF) with orthogonal vector routing
 * 7. Cascade Schedule Recalculation Engine
 * 8. Critical Path Method (CPM) calculation & visual highlight
 * 9. Milestones as Golden/Red Diamonds (◆) with dates
 * 10. Direct Manipulation on SVG (Drag Move, Resize duration, Progress slider, Day Snap)
 * 11. Multi-column Splitter Table (WBS, Name, Duration, Start, End, Assignee)
 * 12. High-resolution SVG Export
 */

class GanttModule {
  constructor() {
    this.container = null;
    this.scaleMode = localStorage.getItem('gantt_scale_mode') || 'days'; // 'days' | 'weeks' | 'months' | 'quarters' | 'years'
    this.showCriticalPath = false;
    this.showSplitTable = true;
    this.collapsedPhases = new Set(JSON.parse(localStorage.getItem('gantt_collapsed_phases') || '[]'));

    // Multi-Schedule Tabs State
    this.defaultSchedules = [
      { id: 'all', name: 'Сводный график (Все работы)', icon: '🏢', isSystem: true },
      { id: 'smr', name: 'СМР и Общестрой', icon: '🏗', isSystem: true, keywords: ['смр', 'строй', 'фундамент', 'монтаж', 'каркас', 'фасад'] },
      { id: 'eng', name: 'Инженерия и ЭОМ/СС', icon: '⚡', isSystem: true, keywords: ['эом', 'сс', 'инженер', 'электр', 'кабел', 'щит', 'освещ'] },
      { id: 'it', name: 'ИТ и Цифровизация', icon: '💻', isSystem: true, keywords: ['ит', 'it', 'сервер', 'по', 'софт', 'сеть', 'astralinux', 'разработк'] },
      { id: 'supply', name: 'Поставки и Контракты', icon: '📜', isSystem: true, keywords: ['поставк', 'закупк', 'договор', 'контракт', 'оборудован', 'тз'] }
    ];
    this.customSchedules = JSON.parse(localStorage.getItem('gantt_custom_schedules') || '[]');
    this.activeScheduleId = localStorage.getItem('gantt_active_schedule') || 'all';

    // SVG Drag Manipulation State
    this.dragState = null; // { mode: 'move'|'resize', taskId, startX, initialStartDate, initialEndDate, dayWidth }
    
    // Calculated WBS tree cache
    this.wbsTree = [];
    this.flatVisibleRows = [];
    this.criticalTaskIds = new Set();
    this.importedTasksCache = null;
  }

  init() {
    this.container = document.getElementById('gantt-chart-area');
    this.bindEvents();
    this.render();
  }

  bindEvents() {
    window.addEventListener('mousemove', (e) => this.handleSvgMouseMove(e));
    window.addEventListener('mouseup', (e) => this.handleSvgMouseUp(e));
  }

  // ============================================================
  // 1. MULTI-SCHEDULE TABS MANAGEMENT
  // ============================================================

  getSchedulesList() {
    return [...this.defaultSchedules, ...this.customSchedules];
  }

  getActiveSchedule() {
    const list = this.getSchedulesList();
    return list.find(s => s.id === this.activeScheduleId) || this.defaultSchedules[0];
  }

  setActiveSchedule(id) {
    this.activeScheduleId = id;
    localStorage.setItem('gantt_active_schedule', id);
    this.render();
  }

  addCustomSchedule(name, icon = '📋') {
    if (!name || !name.trim()) return;
    const cleanName = name.trim();
    const id = 'sch_' + Date.now();
    const newSch = { id, name: cleanName, icon: icon || '📋', isSystem: false };
    this.customSchedules.push(newSch);
    localStorage.setItem('gantt_custom_schedules', JSON.stringify(this.customSchedules));
    this.activeScheduleId = id;
    localStorage.setItem('gantt_active_schedule', id);
    window.app.showToast(`Создан новый график работ: «${cleanName}»`, 'success');
    this.render();
  }

  removeCustomSchedule(id) {
    const target = this.customSchedules.find(s => s.id === id);
    if (!target) return;
    if (!confirm(`Удалить график работ «${target.name}»? Задачи останутся в общем архиве.`)) return;

    this.customSchedules = this.customSchedules.filter(s => s.id !== id);
    localStorage.setItem('gantt_custom_schedules', JSON.stringify(this.customSchedules));
    if (this.activeScheduleId === id) {
      this.activeScheduleId = 'all';
      localStorage.setItem('gantt_active_schedule', 'all');
    }
    window.app.showToast(`График «${target.name}» удален`, 'info');
    this.render();
  }

  promptNewSchedule() {
    const name = prompt('Введите наименование нового графика работ (например: «Реконструкция Цеха №3», «Пусконаладка», «Аудит ИБ»):');
    if (name && name.trim()) {
      const icons = ['🏗','⚡','💻','📜','🏭','🛠','🔬','🚀','📦','🛡','🔧','📊'];
      const randomIcon = icons[Math.floor(Math.random() * icons.length)];
      this.addCustomSchedule(name, randomIcon);
    }
  }

  filterTasksBySchedule(tasks, scheduleId) {
    if (scheduleId === 'all') return tasks;

    const currentSchedule = this.getSchedulesList().find(s => s.id === scheduleId);
    if (!currentSchedule) return tasks;

    return tasks.filter(task => {
      // 1. Direct match by scheduleId
      if (task.scheduleId === scheduleId) return true;

      // 2. Match by tag or keywords for default preset schedules
      if (currentSchedule.keywords && currentSchedule.keywords.length > 0) {
        const text = `${task.title || ''} ${task.description || ''} ${(task.tags || []).join(' ')}`.toLowerCase();
        if (currentSchedule.keywords.some(kw => text.includes(kw))) {
          return true;
        }
      }

      // 3. Match tag with schedule name or id
      if (Array.isArray(task.tags)) {
        if (task.tags.some(t => t.toLowerCase() === scheduleId.toLowerCase() || t.toLowerCase() === currentSchedule.name.toLowerCase())) {
          return true;
        }
      }

      return false;
    });
  }

  // ============================================================
  // 2. WBS HIERARCHY & CASCADE ENGINE
  // ============================================================

  buildWbsTree(tasks) {
    const taskMap = new Map();
    tasks.forEach(t => {
      taskMap.set(t.id, {
        ...t,
        children: [],
        wbs: '',
        level: 0,
        isPhase: false,
        duration: this.calcWorkingDays(t.startDate, t.endDate)
      });
    });

    const roots = [];
    taskMap.forEach(item => {
      if (item.parentId && taskMap.has(item.parentId)) {
        taskMap.get(item.parentId).children.push(item);
        taskMap.get(item.parentId).isPhase = true;
      } else {
        roots.push(item);
      }
    });

    const computePhaseMetrics = (node, level, prefix) => {
      node.level = level;
      node.wbs = prefix;

      if (node.children.length > 0) {
        node.isPhase = true;
        let minStart = null;
        let maxEnd = null;
        let totalEst = 0;
        let weightedProg = 0;

        node.children.forEach((child, idx) => {
          computePhaseMetrics(child, level + 1, `${prefix}.${idx + 1}`);

          if (child.startDate) {
            const cStart = new Date(child.startDate);
            if (!isNaN(cStart.getTime()) && (!minStart || cStart < minStart)) minStart = cStart;
          }
          if (child.endDate) {
            const cEnd = new Date(child.endDate);
            if (!isNaN(cEnd.getTime()) && (!maxEnd || cEnd > maxEnd)) maxEnd = cEnd;
          }

          const weight = child.estimatedHours || 8;
          totalEst += weight;
          weightedProg += (child.progress || 0) * weight;
        });

        if (minStart) node.startDate = minStart.toISOString().split('T')[0];
        if (maxEnd) node.endDate = maxEnd.toISOString().split('T')[0];
        node.progress = totalEst > 0 ? Math.round(weightedProg / totalEst) : 0;
        node.duration = this.calcWorkingDays(node.startDate, node.endDate);
      }
    };

    roots.forEach((root, idx) => {
      computePhaseMetrics(root, 0, `${idx + 1}`);
    });

    this.wbsTree = roots;

    const flat = [];
    const flattenVisible = (nodes) => {
      nodes.forEach(node => {
        flat.push(node);
        if (node.isPhase && !this.collapsedPhases.has(node.id)) {
          flattenVisible(node.children);
        }
      });
    };
    flattenVisible(roots);
    this.flatVisibleRows = flat;
  }

  // ============================================================
  // 3. CRITICAL PATH METHOD (CPM) ENGINE
  // ============================================================

  computeCriticalPath(tasks) {
    this.criticalTaskIds.clear();
    if (!tasks || tasks.length === 0) return;

    const taskDict = new Map();
    tasks.forEach(t => {
      const dur = Math.max(1, this.calcWorkingDays(t.startDate, t.endDate));
      taskDict.set(t.id, {
        id: t.id,
        duration: t.isMilestone ? 0 : dur,
        predecessors: this.parsePredecessors(t),
        successors: [],
        ES: 0,
        EF: 0,
        LS: Infinity,
        LF: Infinity,
        slack: 0
      });
    });

    taskDict.forEach(node => {
      node.predecessors.forEach(pred => {
        if (taskDict.has(pred.id)) {
          taskDict.get(pred.id).successors.push({ id: node.id, type: pred.type });
        }
      });
    });

    // Forward Pass
    taskDict.forEach(node => {
      let maxEarlyStart = 0;
      node.predecessors.forEach(pred => {
        if (taskDict.has(pred.id)) {
          const p = taskDict.get(pred.id);
          const earliest = pred.type === 'SS' ? p.ES : p.EF;
          if (earliest > maxEarlyStart) maxEarlyStart = earliest;
        }
      });
      node.ES = maxEarlyStart;
      node.EF = node.ES + node.duration;
    });

    let maxProjectFinish = 0;
    taskDict.forEach(node => {
      if (node.EF > maxProjectFinish) maxProjectFinish = node.EF;
    });

    // Backward Pass
    const reverseNodes = Array.from(taskDict.values()).reverse();
    reverseNodes.forEach(node => {
      if (node.successors.length === 0) {
        node.LF = maxProjectFinish;
      } else {
        let minLateFinish = Infinity;
        node.successors.forEach(succ => {
          if (taskDict.has(succ.id)) {
            const s = taskDict.get(succ.id);
            const latest = succ.type === 'SS' ? s.LS : s.LS;
            if (latest < minLateFinish) minLateFinish = latest;
          }
        });
        node.LF = minLateFinish;
      }
      node.LS = node.LF - node.duration;
      node.slack = node.LS - node.ES;

      if (node.slack <= 0.001) {
        this.criticalTaskIds.add(node.id);
      }
    });
  }

  parsePredecessors(task) {
    const list = [];
    if (task.predecessorId) {
      list.push({ id: task.predecessorId, type: task.predecessorType || 'FS' });
    }
    if (Array.isArray(task.dependencies)) {
      task.dependencies.forEach(d => {
        if (typeof d === 'string') list.push({ id: d, type: 'FS' });
        else if (d && d.id) list.push({ id: d.id, type: d.type || 'FS' });
      });
    }
    return list;
  }

  // ============================================================
  // 4. MAIN RENDER PIPELINE & TIMESCALES
  // ============================================================

  setScaleMode(mode) {
    this.scaleMode = mode;
    localStorage.setItem('gantt_scale_mode', mode);
    this.render();
  }

  getDayWidth() {
    switch (this.scaleMode) {
      case 'years': return 0.85;     // ~310px / year
      case 'quarters': return 2.4;   // ~216px / quarter
      case 'months': return 6.0;     // ~180px / month
      case 'weeks': return 20.0;     // ~140px / week
      case 'days':
      default: return 42.0;          // 42px / day
    }
  }

  render() {
    if (!this.container) return;
    const { tasks: allTasks = [], employees = [] } = window.storage.cache;

    // Build Schedules Bar HTML
    const schedules = this.getSchedulesList();
    const activeSch = this.getActiveSchedule();

    const scheduleTabsHtml = `
      <div class="gantt-schedule-tabs-bar">
        ${schedules.map(sch => {
          const schTasks = this.filterTasksBySchedule(allTasks, sch.id);
          const count = schTasks.length;
          const isActive = sch.id === this.activeScheduleId;

          return `
            <div class="gantt-schedule-tab ${isActive ? 'active' : ''}" data-schedule-id="${sch.id}">
              <span>${sch.icon}</span>
              <span>${this.escapeHtml(sch.name)}</span>
              <span class="gantt-schedule-tab-badge">${count}</span>
              ${!sch.isSystem ? `
                <span class="gantt-schedule-tab-close" data-del-id="${sch.id}" title="Удалить вкладку графика">✕</span>
              ` : ''}
            </div>
          `;
        }).join('')}

        <div class="gantt-schedule-tab-add" id="btn-add-schedule-tab" title="Создать новую вкладку графика работ">
          <span>➕</span>
          <span>Новый график</span>
        </div>
      </div>
    `;

    // Filter tasks for active schedule
    const tasks = this.filterTasksBySchedule(allTasks, this.activeScheduleId);

    if (tasks.length === 0) {
      this.container.innerHTML = `
        ${scheduleTabsHtml}
        <div style="text-align: center; padding: 3.5rem 2rem; color: var(--text-muted); background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-md); margin-top: 0.5rem;">
          <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">${activeSch.icon}</div>
          <h3 style="color: var(--text-primary); font-size: 1.15rem; margin-bottom: 0.35rem;">
            В графике «${this.escapeHtml(activeSch.name)}» нет задач
          </h3>
          <p style="font-size: 0.85rem; margin-bottom: 1.5rem; max-width: 480px; margin-left: auto; margin-right: auto;">
            Добавьте новую задачу в этот раздел, импортируйте проектный план из MS Project XML или выберите сводный график.
          </p>
          <div style="display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap;">
            <button class="btn btn-primary" onclick="window.tasksModule.openTaskModal(null)">
              ➕ Добавить задачу в «${this.escapeHtml(activeSch.name)}»
            </button>
            <button class="btn btn-secondary" onclick="window.ganttModule.openImportModal()">
              📥 Импорт MS Project в этот график
            </button>
            ${this.activeScheduleId !== 'all' ? `
              <button class="btn" onclick="window.ganttModule.setActiveSchedule('all')">
                🏢 Перейти в Сводный график
              </button>
            ` : `
              <button class="btn" onclick="window.storage.seedDemoData().then(() => window.ganttModule.render())">
                ⚡ Демо-данные
              </button>
            `}
          </div>
        </div>
      `;
      this.bindScheduleTabsEvents();
      return;
    }

    // Build hierarchy & Critical Path for filtered tasks
    this.buildWbsTree(tasks);
    this.computeCriticalPath(tasks);

    // Compute Timeline Boundaries
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let minDate = new Date(today);
    let maxDate = new Date(today);

    tasks.forEach(t => {
      if (t.startDate) {
        const d = new Date(t.startDate);
        if (!isNaN(d.getTime()) && d < minDate) minDate = d;
      }
      if (t.endDate) {
        const d = new Date(t.endDate);
        if (!isNaN(d.getTime()) && d > maxDate) maxDate = d;
      }
    });

    minDate = new Date(minDate);
    maxDate = new Date(maxDate);

    if (this.scaleMode === 'years') {
      minDate.setFullYear(minDate.getFullYear() - 1, 0, 1);
      maxDate.setFullYear(maxDate.getFullYear() + 2, 11, 31);
    } else if (this.scaleMode === 'quarters') {
      minDate.setMonth(Math.floor(minDate.getMonth() / 3) * 3 - 3, 1);
      maxDate.setMonth(Math.floor(maxDate.getMonth() / 3) * 3 + 6, 0);
    } else if (this.scaleMode === 'months') {
      minDate.setMonth(minDate.getMonth() - 1, 1);
      maxDate.setMonth(maxDate.getMonth() + 3, 0);
    } else if (this.scaleMode === 'weeks') {
      minDate.setDate(minDate.getDate() - 7);
      maxDate.setDate(maxDate.getDate() + 28);
    } else {
      // Days
      minDate.setDate(minDate.getDate() - 4);
      maxDate.setDate(maxDate.getDate() + 18);
    }

    minDate.setHours(0, 0, 0, 0);
    maxDate.setHours(0, 0, 0, 0);

    const totalDays = Math.max(14, Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24)));
    const dayWidth = this.getDayWidth();
    const rowHeight = 42;
    const headerHeight = 56;
    const timelineWidth = Math.max(800, totalDays * dayWidth);

    // Split Table Width
    const tableWidth = this.showSplitTable ? 520 : 0;
    const totalSvgWidth = tableWidth + timelineWidth;
    const totalSvgHeight = headerHeight + this.flatVisibleRows.length * rowHeight + 20;

    // Build Toolbar HTML
    const toolbarHtml = `
      <div class="gantt-pro-toolbar">
        <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
          <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-primary); margin-right: 0.25rem;">
            ${activeSch.icon} ${this.escapeHtml(activeSch.name)}
          </div>

          <!-- Timescale Switcher -->
          <div class="btn-group" id="gantt-scale-group">
            <button class="btn btn-sm ${this.scaleMode === 'days' ? 'active' : ''}" data-scale="days" title="Масштаб по дням">Дни</button>
            <button class="btn btn-sm ${this.scaleMode === 'weeks' ? 'active' : ''}" data-scale="weeks" title="Масштаб по неделям">Недели</button>
            <button class="btn btn-sm ${this.scaleMode === 'months' ? 'active' : ''}" data-scale="months" title="Масштаб по месяцам">Месяцы</button>
            <button class="btn btn-sm ${this.scaleMode === 'quarters' ? 'active' : ''}" data-scale="quarters" title="Масштаб по кварталам">Кварталы</button>
            <button class="btn btn-sm ${this.scaleMode === 'years' ? 'active' : ''}" data-scale="years" title="Масштаб по годам">Годы</button>
          </div>

          <button class="btn btn-sm ${this.showCriticalPath ? 'btn-danger' : ''}" id="gantt-btn-cpm" title="Показать задачи и связи на критическом пути">
            ${this.showCriticalPath ? '🔴 Критический путь: ВКЛ' : '⚪ Критический путь'}
          </button>

          <button class="btn btn-sm" id="gantt-btn-toggle-table" title="Скрыть/показать левую таблицу WBS">
            ${this.showSplitTable ? '◀ Скрыть таблицу' : '▶ Таблица WBS'}
          </button>
        </div>

        <div style="display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap;">
          <button class="btn btn-sm btn-secondary" id="gantt-btn-import-msp" title="Импорт проектного плана из MS Project XML">
            📥 Импорт MS Project
          </button>
          <button class="btn btn-sm" id="gantt-btn-export-msp" title="Экспорт диаграммы в совместимый с MS Project формат XML">
            💾 Экспорт MS Project
          </button>
          <button class="btn btn-sm" id="gantt-btn-export-svg" title="Экспорт диаграммы в векторный SVG файл">
            📊 Экспорт SVG
          </button>
          <button class="btn btn-sm btn-primary" onclick="window.tasksModule.openTaskModal(null)">
            ➕ Добавить задачу
          </button>
        </div>
      </div>
    `;

    // 1. SVG Grid & Date Headers Generation
    const dayHeaders = [];
    const gridLines = [];
    let todayX = null;

    const monthNames = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
    const monthFullNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
    const dayNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

    const todayDiff = (today - minDate) / (1000 * 60 * 60 * 24);
    if (todayDiff >= 0 && todayDiff <= totalDays) {
      todayX = tableWidth + todayDiff * dayWidth;
    }

    if (this.scaleMode === 'days') {
      let currentMonth = -1;
      let monthStartX = tableWidth;
      let monthStartYear = '';
      let monthName = '';

      for (let i = 0; i < totalDays; i++) {
        const curDate = new Date(minDate);
        curDate.setDate(curDate.getDate() + i);
        const isToday = curDate.getTime() === today.getTime();
        const isWeekend = curDate.getDay() === 0 || curDate.getDay() === 6;
        const x = tableWidth + i * dayWidth;

        gridLines.push(`
          <rect x="${x}" y="0" width="${dayWidth}" height="${totalSvgHeight}" 
                fill="${isToday ? 'rgba(59, 130, 246, 0.08)' : (isWeekend ? 'var(--bg-tertiary)' : 'none')}" 
                stroke="var(--border-color)" stroke-width="0.5" />
        `);

        if (curDate.getMonth() !== currentMonth) {
          if (currentMonth !== -1) {
            const mWidth = x - monthStartX;
            dayHeaders.push(`
              <rect x="${monthStartX}" y="0" width="${mWidth}" height="26" fill="var(--bg-tertiary)" stroke="var(--border-color)" stroke-width="0.5" />
              <text x="${monthStartX + 8}" y="18" font-size="11" font-weight="700" fill="var(--text-primary)">
                ${monthName} ${monthStartYear}
              </text>
            `);
          }
          currentMonth = curDate.getMonth();
          monthStartX = x;
          monthStartYear = curDate.getFullYear();
          monthName = monthFullNames[currentMonth];
        }

        dayHeaders.push(`
          <g transform="translate(${x}, 26)">
            <rect x="0" y="0" width="${dayWidth}" height="30" fill="${isToday ? 'var(--accent-light)' : 'none'}" />
            <text x="${dayWidth/2}" y="13" text-anchor="middle" font-size="9" fill="${isWeekend ? 'var(--danger)' : 'var(--text-muted)'}">${dayNames[curDate.getDay()]}</text>
            <text x="${dayWidth/2}" y="25" text-anchor="middle" font-size="11" font-weight="${isToday ? '700' : '500'}" fill="${isToday ? 'var(--accent-primary)' : 'var(--text-primary)'}">
              ${curDate.getDate()}
            </text>
          </g>
        `);
      }

      if (monthStartX < tableWidth + totalDays * dayWidth) {
        const mWidth = (tableWidth + totalDays * dayWidth) - monthStartX;
        dayHeaders.push(`
          <rect x="${monthStartX}" y="0" width="${mWidth}" height="26" fill="var(--bg-tertiary)" stroke="var(--border-color)" stroke-width="0.5" />
          <text x="${monthStartX + 8}" y="18" font-size="11" font-weight="700" fill="var(--text-primary)">
            ${monthName} ${monthStartYear}
          </text>
        `);
      }

    } else if (this.scaleMode === 'weeks') {
      let currentMonth = -1;
      let monthStartX = tableWidth;
      let monthStartYear = '';
      let monthName = '';

      for (let i = 0; i < totalDays; i++) {
        const curDate = new Date(minDate);
        curDate.setDate(curDate.getDate() + i);
        const x = tableWidth + i * dayWidth;

        if (curDate.getDay() === 1 || i === 0) {
          gridLines.push(`
            <line x1="${x}" y1="26" x2="${x}" y2="${totalSvgHeight}" stroke="var(--border-color)" stroke-width="1.2" />
          `);

          const weekEndDate = new Date(curDate);
          weekEndDate.setDate(weekEndDate.getDate() + 6);
          const weekNum = this.getWeekNumber(curDate);

          dayHeaders.push(`
            <g transform="translate(${x}, 26)">
              <rect x="0" y="0" width="${dayWidth * 7}" height="30" fill="none" />
              <text x="6" y="14" font-size="9.5" font-weight="700" fill="var(--accent-primary)">Нед ${weekNum}</text>
              <text x="6" y="25" font-size="9" fill="var(--text-muted)">${curDate.getDate()} ${monthNames[curDate.getMonth()]} - ${weekEndDate.getDate()} ${monthNames[weekEndDate.getMonth()]}</text>
            </g>
          `);
        } else {
          gridLines.push(`
            <line x1="${x}" y1="38" x2="${x}" y2="${totalSvgHeight}" stroke="var(--border-color)" stroke-width="0.3" stroke-dasharray="2,2" />
          `);
        }

        if (curDate.getMonth() !== currentMonth) {
          if (currentMonth !== -1) {
            const mWidth = x - monthStartX;
            dayHeaders.push(`
              <rect x="${monthStartX}" y="0" width="${mWidth}" height="26" fill="var(--bg-tertiary)" stroke="var(--border-color)" stroke-width="0.5" />
              <text x="${monthStartX + 8}" y="18" font-size="11" font-weight="700" fill="var(--text-primary)">
                ${monthName} ${monthStartYear}
              </text>
            `);
          }
          currentMonth = curDate.getMonth();
          monthStartX = x;
          monthStartYear = curDate.getFullYear();
          monthName = monthFullNames[currentMonth];
        }
      }

      if (monthStartX < tableWidth + totalDays * dayWidth) {
        const mWidth = (tableWidth + totalDays * dayWidth) - monthStartX;
        dayHeaders.push(`
          <rect x="${monthStartX}" y="0" width="${mWidth}" height="26" fill="var(--bg-tertiary)" stroke="var(--border-color)" stroke-width="0.5" />
          <text x="${monthStartX + 8}" y="18" font-size="11" font-weight="700" fill="var(--text-primary)">
            ${monthName} ${monthStartYear}
          </text>
        `);
      }

    } else if (this.scaleMode === 'months') {
      let currentYear = -1;
      let yearStartX = tableWidth;

      let iterDate = new Date(minDate);
      while (iterDate <= maxDate) {
        const mStart = new Date(iterDate.getFullYear(), iterDate.getMonth(), 1);
        const mEnd = new Date(iterDate.getFullYear(), iterDate.getMonth() + 1, 0);

        const startOffset = Math.max(0, (mStart - minDate) / (1000 * 60 * 60 * 24));
        const endOffset = (mEnd - minDate) / (1000 * 60 * 60 * 24) + 1;

        const x1 = tableWidth + startOffset * dayWidth;
        const x2 = tableWidth + endOffset * dayWidth;
        const mWidth = x2 - x1;

        gridLines.push(`
          <line x1="${x1}" y1="26" x2="${x1}" y2="${totalSvgHeight}" stroke="var(--border-color)" stroke-width="1.2" />
        `);

        dayHeaders.push(`
          <g transform="translate(${x1}, 26)">
            <text x="${mWidth / 2}" y="19" text-anchor="middle" font-size="11" font-weight="600" fill="var(--text-primary)">
              ${monthFullNames[iterDate.getMonth()]}
            </text>
          </g>
        `);

        if (iterDate.getFullYear() !== currentYear) {
          if (currentYear !== -1) {
            const yWidth = x1 - yearStartX;
            dayHeaders.push(`
              <rect x="${yearStartX}" y="0" width="${yWidth}" height="26" fill="var(--bg-tertiary)" stroke="var(--border-color)" stroke-width="0.5" />
              <text x="${yearStartX + 12}" y="18" font-size="12" font-weight="700" fill="var(--text-primary)">
                ${currentYear} год
              </text>
            `);
          }
          currentYear = iterDate.getFullYear();
          yearStartX = x1;
        }

        iterDate.setMonth(iterDate.getMonth() + 1, 1);
      }

      const yWidth = (tableWidth + totalDays * dayWidth) - yearStartX;
      dayHeaders.push(`
        <rect x="${yearStartX}" y="0" width="${yWidth}" height="26" fill="var(--bg-tertiary)" stroke="var(--border-color)" stroke-width="0.5" />
        <text x="${yearStartX + 12}" y="18" font-size="12" font-weight="700" fill="var(--text-primary)">
          ${currentYear} год
        </text>
      `);

    } else if (this.scaleMode === 'quarters') {
      let currentYear = -1;
      let yearStartX = tableWidth;

      let iterDate = new Date(minDate);
      iterDate.setMonth(Math.floor(iterDate.getMonth() / 3) * 3, 1);

      const quarterLabels = ['I кв.', 'II кв.', 'III кв.', 'IV кв.'];

      while (iterDate <= maxDate) {
        const qIndex = Math.floor(iterDate.getMonth() / 3);
        const qStart = new Date(iterDate.getFullYear(), qIndex * 3, 1);
        const qEnd = new Date(iterDate.getFullYear(), (qIndex + 1) * 3, 0);

        const startOffset = Math.max(0, (qStart - minDate) / (1000 * 60 * 60 * 24));
        const endOffset = (qEnd - minDate) / (1000 * 60 * 60 * 24) + 1;

        const x1 = tableWidth + startOffset * dayWidth;
        const x2 = tableWidth + endOffset * dayWidth;
        const qWidth = x2 - x1;

        gridLines.push(`
          <line x1="${x1}" y1="26" x2="${x1}" y2="${totalSvgHeight}" stroke="var(--border-color)" stroke-width="1.2" />
        `);

        dayHeaders.push(`
          <g transform="translate(${x1}, 26)">
            <text x="${qWidth / 2}" y="19" text-anchor="middle" font-size="11" font-weight="700" fill="var(--accent-primary)">
              ${quarterLabels[qIndex]}
            </text>
          </g>
        `);

        if (iterDate.getFullYear() !== currentYear) {
          if (currentYear !== -1) {
            const yWidth = x1 - yearStartX;
            dayHeaders.push(`
              <rect x="${yearStartX}" y="0" width="${yWidth}" height="26" fill="var(--bg-tertiary)" stroke="var(--border-color)" stroke-width="0.5" />
              <text x="${yearStartX + 12}" y="18" font-size="12" font-weight="700" fill="var(--text-primary)">
                ${currentYear} год
              </text>
            `);
          }
          currentYear = iterDate.getFullYear();
          yearStartX = x1;
        }

        iterDate.setMonth(iterDate.getMonth() + 3, 1);
      }

      const yWidth = (tableWidth + totalDays * dayWidth) - yearStartX;
      dayHeaders.push(`
        <rect x="${yearStartX}" y="0" width="${yWidth}" height="26" fill="var(--bg-tertiary)" stroke="var(--border-color)" stroke-width="0.5" />
        <text x="${yearStartX + 12}" y="18" font-size="12" font-weight="700" fill="var(--text-primary)">
          ${currentYear} год
        </text>
      `);

    } else if (this.scaleMode === 'years') {
      let iterDate = new Date(minDate);
      iterDate.setMonth(0, 1);

      while (iterDate <= maxDate) {
        const yStart = new Date(iterDate.getFullYear(), 0, 1);
        const yEnd = new Date(iterDate.getFullYear(), 11, 31);

        const startOffset = Math.max(0, (yStart - minDate) / (1000 * 60 * 60 * 24));
        const endOffset = (yEnd - minDate) / (1000 * 60 * 60 * 24) + 1;

        const x1 = tableWidth + startOffset * dayWidth;
        const x2 = tableWidth + endOffset * dayWidth;
        const yWidth = x2 - x1;

        gridLines.push(`
          <line x1="${x1}" y1="0" x2="${x1}" y2="${totalSvgHeight}" stroke="var(--border-color)" stroke-width="1.5" />
        `);

        dayHeaders.push(`
          <rect x="${x1}" y="0" width="${yWidth}" height="56" fill="var(--bg-tertiary)" stroke="var(--border-color)" stroke-width="0.5" />
          <text x="${x1 + yWidth / 2}" y="34" text-anchor="middle" font-size="13" font-weight="700" fill="var(--text-primary)">
            ${iterDate.getFullYear()} г.
          </text>
        `);

        iterDate.setFullYear(iterDate.getFullYear() + 1);
      }
    }

    // 2. Build Table Rows, Task Bars, Milestones & Dependencies
    const taskRows = [];
    const dependencyArrows = [];
    const taskRowPosMap = new Map();

    this.flatVisibleRows.forEach((task, idx) => {
      const y = headerHeight + idx * rowHeight;
      const assignee = employees.find(e => e.id === task.assigneeId) || { name: '—' };
      const isCritical = this.criticalTaskIds.has(task.id);

      let tStart = task.startDate ? new Date(task.startDate) : new Date(minDate);
      let tEnd = task.endDate ? new Date(task.endDate) : new Date(tStart);
      if (isNaN(tStart.getTime())) tStart = new Date(minDate);
      if (isNaN(tEnd.getTime()) || tEnd < tStart) tEnd = new Date(tStart);

      const offsetDays = Math.max(0, (tStart - minDate) / (1000 * 60 * 60 * 24));
      const durationDays = Math.max(1, Math.ceil((tEnd - tStart) / (1000 * 60 * 60 * 24)) + 1);

      const barX = tableWidth + offsetDays * dayWidth;
      const minBarWidth = this.scaleMode === 'years' ? 8 : this.scaleMode === 'quarters' ? 12 : this.scaleMode === 'months' ? 16 : 24;
      const barWidth = task.isMilestone ? 20 : Math.max(minBarWidth, durationDays * dayWidth);
      const barHeight = task.isPhase ? 14 : 22;
      const barY = y + (rowHeight - barHeight) / 2;

      taskRowPosMap.set(task.id, {
        rowY: y,
        barX: barX,
        barY: barY,
        barWidth: barWidth,
        barHeight: barHeight,
        endX: barX + barWidth,
        isMilestone: task.isMilestone,
        isPhase: task.isPhase,
        isCritical: isCritical
      });

      const progress = Math.min(100, Math.max(0, parseInt(task.progress, 10) || (task.status === 'done' ? 100 : 0)));
      const progressWidth = (barWidth * progress) / 100;

      // Color coding
      let barBg = isCritical && this.showCriticalPath ? '#ef4444' : task.isPhase ? '#1e293b' : '#3b82f6';
      let barFill = isCritical && this.showCriticalPath ? '#b91c1c' : task.isPhase ? '#0f172a' : '#1d4ed8';

      if (task.status === 'done' && !isCritical) {
        barBg = '#22c55e'; barFill = '#15803d';
      }

      // A. Split Table Left Columns
      let tableRowSvg = '';
      if (this.showSplitTable) {
        const indent = task.level * 16;
        tableRowSvg = `
          <!-- Table Row Background -->
          <rect x="0" y="${y}" width="${tableWidth}" height="${rowHeight}" fill="${idx % 2 === 0 ? 'var(--bg-secondary)' : 'var(--bg-primary)'}" />
          
          <!-- WBS Code -->
          <text x="10" y="${y + 25}" font-size="11" font-weight="700" fill="var(--text-muted)">${task.wbs}</text>
          
          <!-- Task Name with Fold Button -->
          <g transform="translate(${45 + indent}, ${y})" style="cursor: pointer;" onclick="${task.isPhase ? `window.ganttModule.togglePhaseCollapse('${task.id}')` : `window.tasksModule.openTaskModal('${task.id}')`}">
            ${task.isPhase ? `
              <text x="0" y="24" font-size="11" font-weight="700" fill="var(--accent-primary)">${this.collapsedPhases.has(task.id) ? '▶' : '▼'}</text>
              <text x="16" y="25" font-size="11.5" font-weight="700" fill="var(--text-primary)">${this.truncateText(task.title, 22 - task.level * 2)}</text>
            ` : `
              <text x="0" y="25" font-size="11" font-weight="${isCritical && this.showCriticalPath ? '700' : '500'}" fill="${isCritical && this.showCriticalPath ? 'var(--danger)' : 'var(--text-primary)'}">
                ${task.isMilestone ? '◆ ' : ''}${this.truncateText(task.title, 24 - task.level * 2)}
              </text>
            `}
          </g>

          <!-- Duration -->
          <text x="260" y="${y + 25}" font-size="11" fill="var(--text-secondary)">${task.duration} дн.</text>
          
          <!-- Start Date -->
          <text x="315" y="${y + 25}" font-size="10.5" fill="var(--text-muted)">${task.startDate || '—'}</text>
          
          <!-- End Date -->
          <text x="390" y="${y + 25}" font-size="10.5" fill="var(--text-muted)">${task.endDate || '—'}</text>
          
          <!-- Assignee -->
          <text x="465" y="${y + 25}" font-size="10" fill="var(--text-secondary)">${this.truncateText(assignee.name.split(' ')[0], 7)}</text>
        `;
      }

      // B. Timeline Graphic Element
      let timelineGraphic = '';

      if (task.isPhase) {
        timelineGraphic = `
          <g class="gantt-phase-bracket" style="cursor: pointer;" onclick="window.ganttModule.togglePhaseCollapse('${task.id}')">
            <path d="M ${barX} ${barY + 6} L ${barX} ${barY} L ${barX + barWidth} ${barY} L ${barX + barWidth} ${barY + 6} L ${barX + barWidth - 5} ${barY + 12} L ${barX + 5} ${barY + 12} Z" 
                  fill="${barBg}" />
            <text x="${barX + barWidth + 8}" y="${barY + 10}" font-size="10.5" font-weight="700" fill="var(--text-primary)">
              ${task.progress}%
            </text>
          </g>
        `;
      } else if (task.isMilestone) {
        const diaCenterX = barX;
        const diaCenterY = y + rowHeight / 2;
        const diaSize = 9;
        const diaColor = isCritical && this.showCriticalPath ? '#ef4444' : '#f59e0b';

        timelineGraphic = `
          <g class="gantt-milestone-diamond" style="cursor: pointer;" onclick="window.tasksModule.openTaskModal('${task.id}')">
            <polygon points="${diaCenterX},${diaCenterY - diaSize} ${diaCenterX + diaSize},${diaCenterY} ${diaCenterX},${diaCenterY + diaSize} ${diaCenterX - diaSize},${diaCenterY}" 
                     fill="${diaColor}" stroke="#ffffff" stroke-width="1.5" />
            <text x="${diaCenterX + 14}" y="${diaCenterY + 4}" font-size="11" font-weight="700" fill="${diaColor}">
              ◆ ${this.escapeHtml(task.title)} (${task.endDate || task.startDate})
            </text>
          </g>
        `;
      } else {
        timelineGraphic = `
          <g class="gantt-bar-group" data-task-id="${task.id}" style="cursor: move;">
            <title>${this.escapeHtml(task.title)}&#10;Сроки: ${task.startDate} — ${task.endDate}&#10;Длительность: ${task.duration} дн.&#10;Готовность: ${progress}%</title>
            
            <!-- Main Bar -->
            <rect x="${barX}" y="${barY}" width="${barWidth}" height="${barHeight}" rx="4" ry="4" fill="${barBg}" opacity="0.88" 
                  onmousedown="window.ganttModule.startDrag(event, '${task.id}', 'move')" />
            
            <!-- Progress Fill Bar -->
            ${progress > 0 ? `
              <rect x="${barX}" y="${barY}" width="${progressWidth}" height="${barHeight}" rx="4" ry="4" fill="${barFill}" 
                    style="pointer-events: none;" />
            ` : ''}

            <!-- Bar Label Text -->
            <text x="${barX + 8}" y="${barY + 15}" font-size="10" font-weight="700" fill="#ffffff" style="pointer-events: none; user-select: none;">
              ${progress}% ${barWidth > 75 ? '• ' + this.truncateText(task.title, 14) : ''}
            </text>

            <!-- Resize Right Handle -->
            <rect x="${barX + barWidth - 7}" y="${barY}" width="7" height="${barHeight}" rx="2" fill="rgba(255,255,255,0.4)" style="cursor: ew-resize;" 
                  onmousedown="window.ganttModule.startDrag(event, '${task.id}', 'resize')" />
          </g>
        `;
      }

      taskRows.push(`
        <!-- Row Line Divider -->
        <line x1="0" y1="${y + rowHeight}" x2="${totalSvgWidth}" y2="${y + rowHeight}" stroke="var(--border-color)" stroke-width="0.7" />
        
        <!-- Table Column Cell Data -->
        ${tableRowSvg}

        <!-- Timeline Bar/Milestone -->
        ${timelineGraphic}
      `);
    });

    // 3. Build Vector Orthogonal Dependency Arrows
    tasks.forEach(task => {
      const preds = this.parsePredecessors(task);
      const targetPos = taskRowPosMap.get(task.id);
      if (!targetPos) return;

      preds.forEach(pred => {
        const sourcePos = taskRowPosMap.get(pred.id);
        if (!sourcePos) return;

        const isCritConn = this.showCriticalPath && targetPos.isCritical && sourcePos.isCritical;
        const arrowColor = isCritConn ? '#ef4444' : '#64748b';
        const arrowWidth = isCritConn ? 2 : 1.2;

        const startX = sourcePos.endX;
        const startY = sourcePos.barY + sourcePos.barHeight / 2;
        const endX = targetPos.barX;
        const endY = targetPos.barY + targetPos.barHeight / 2;

        const midX = startX + 12;

        let pathD = '';
        if (endX >= startX + 16) {
          pathD = `M ${startX} ${startY} L ${midX} ${startY} L ${midX} ${endY} L ${endX - 4} ${endY}`;
        } else {
          const wrapY = sourcePos.rowY + rowHeight + 4;
          pathD = `M ${startX} ${startY} L ${startX + 8} ${startY} L ${startX + 8} ${wrapY} L ${endX - 12} ${wrapY} L ${endX - 12} ${endY} L ${endX - 4} ${endY}`;
        }

        dependencyArrows.push(`
          <path d="${pathD}" fill="none" stroke="${arrowColor}" stroke-width="${arrowWidth}" marker-end="url(#arrow-${isCritConn ? 'red' : 'gray'})" />
        `);
      });
    });

    // Render Full View
    this.container.innerHTML = `
      ${scheduleTabsHtml}
      ${toolbarHtml}
      <div class="gantt-svg-scroll-container">
        <svg id="gantt-master-svg" width="${totalSvgWidth}" height="${totalSvgHeight}" style="display: block; font-family: inherit;">
          <defs>
            <marker id="arrow-gray" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#64748b" />
            </marker>
            <marker id="arrow-red" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#ef4444" />
            </marker>
          </defs>

          <!-- Timeline Grid Lines -->
          ${gridLines.join('')}

          <!-- Header Bar (Table + Timeline) -->
          <rect x="0" y="0" width="${totalSvgWidth}" height="${headerHeight}" fill="var(--bg-tertiary)" stroke="var(--border-color)" stroke-width="1" />
          
          ${this.showSplitTable ? `
            <!-- Table Header Titles -->
            <text x="10" y="32" font-size="11" font-weight="700" fill="var(--text-primary)">WBS</text>
            <text x="45" y="32" font-size="11" font-weight="700" fill="var(--text-primary)">Наименование работы</text>
            <text x="260" y="32" font-size="11" font-weight="700" fill="var(--text-primary)">Длит.</text>
            <text x="315" y="32" font-size="11" font-weight="700" fill="var(--text-primary)">Начало</text>
            <text x="390" y="32" font-size="11" font-weight="700" fill="var(--text-primary)">Дедлайн</text>
            <text x="465" y="32" font-size="11" font-weight="700" fill="var(--text-primary)">Исполнитель</text>
            
            <!-- Table Vertical Border -->
            <line x1="${tableWidth}" y1="0" x2="${tableWidth}" y2="${totalSvgHeight}" stroke="var(--border-color)" stroke-width="2" />
          ` : ''}

          <!-- Timeline Date Headers -->
          ${dayHeaders.join('')}

          <!-- Task Rows & Bars -->
          ${taskRows.join('')}

          <!-- Dependency Vector Arrows -->
          ${dependencyArrows.join('')}

          <!-- Current Today Vertical Line -->
          ${todayX !== null ? `
            <line x1="${todayX}" y1="0" x2="${todayX}" y2="${totalSvgHeight}" stroke="var(--danger)" stroke-width="2" stroke-dasharray="4,4" />
            <rect x="${todayX - 25}" y="2" width="50" height="16" rx="3" fill="var(--danger)" />
            <text x="${todayX}" y="13" text-anchor="middle" font-size="9" font-weight="700" fill="#ffffff">СЕГОДНЯ</text>
          ` : ''}
        </svg>
      </div>
    `;

    this.bindScheduleTabsEvents();
    this.bindToolbarEvents();
  }

  bindScheduleTabsEvents() {
    // Schedule Tab Clicks
    this.container.querySelectorAll('.gantt-schedule-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        if (e.target.classList.contains('gantt-schedule-tab-close')) return;
        const id = tab.dataset.scheduleId;
        if (id) this.setActiveSchedule(id);
      });
    });

    // Delete Custom Tab Click
    this.container.querySelectorAll('.gantt-schedule-tab-close').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const delId = btn.dataset.delId;
        if (delId) this.removeCustomSchedule(delId);
      });
    });

    // Add New Schedule Button
    const btnAdd = this.container.querySelector('#btn-add-schedule-tab');
    if (btnAdd) {
      btnAdd.addEventListener('click', () => this.promptNewSchedule());
    }
  }

  bindToolbarEvents() {
    document.querySelectorAll('#gantt-scale-group button').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const scale = e.currentTarget.dataset.scale;
        if (scale) this.setScaleMode(scale);
      });
    });

    document.getElementById('gantt-btn-cpm')?.addEventListener('click', () => {
      this.showCriticalPath = !this.showCriticalPath;
      this.render();
    });

    document.getElementById('gantt-btn-toggle-table')?.addEventListener('click', () => {
      this.showSplitTable = !this.showSplitTable;
      this.render();
    });

    document.getElementById('gantt-btn-export-svg')?.addEventListener('click', () => {
      this.exportGanttSvg();
    });

    document.getElementById('gantt-btn-export-msp')?.addEventListener('click', () => {
      this.exportMsProjectXml();
    });

    document.getElementById('gantt-btn-import-msp')?.addEventListener('click', () => {
      this.openImportModal();
    });
  }

  togglePhaseCollapse(phaseId) {
    if (this.collapsedPhases.has(phaseId)) {
      this.collapsedPhases.delete(phaseId);
    } else {
      this.collapsedPhases.add(phaseId);
    }
    localStorage.setItem('gantt_collapsed_phases', JSON.stringify(Array.from(this.collapsedPhases)));
    this.render();
  }

  // ============================================================
  // 5. DIRECT MANIPULATION (MOVE, RESIZE DURATION, DAY SNAP)
  // ============================================================

  startDrag(e, taskId, mode) {
    e.stopPropagation();
    e.preventDefault();

    const task = (window.storage.cache.tasks || []).find(t => t.id === taskId);
    if (!task) return;

    this.dragState = {
      mode: mode,
      taskId: taskId,
      task: { ...task },
      startX: e.clientX,
      initialStartDate: task.startDate,
      initialEndDate: task.endDate,
      dayWidth: this.getDayWidth()
    };
  }

  handleSvgMouseMove(e) {
    if (!this.dragState) return;

    const dx = e.clientX - this.dragState.startX;
    const deltaDays = Math.round(dx / this.dragState.dayWidth);

    if (this.dragState.mode === 'move') {
      if (deltaDays !== 0) {
        const newStart = this.addDays(this.dragState.initialStartDate, deltaDays);
        const newEnd = this.addDays(this.dragState.initialEndDate, deltaDays);
        this.dragState.task.startDate = newStart;
        this.dragState.task.endDate = newEnd;
      }
    } else if (this.dragState.mode === 'resize') {
      if (deltaDays !== 0) {
        const newEnd = this.addDays(this.dragState.initialEndDate, deltaDays);
        if (newEnd >= this.dragState.task.startDate) {
          this.dragState.task.endDate = newEnd;
        }
      }
    }
  }

  async handleSvgMouseUp(e) {
    if (!this.dragState) return;

    const { task, initialStartDate, initialEndDate, taskId } = this.dragState;
    this.dragState = null;

    if (task.startDate !== initialStartDate || task.endDate !== initialEndDate) {
      try {
        await this.cascadeUpdateSuccessors(task);
        await window.storage.saveEntity('tasks', taskId, task);
        window.app.showToast(`Сроки задачи «${task.title}» обновлены`, 'success');
        this.render();
      } catch (err) {
        window.app.showToast(`Ошибка сохранения: ${err.message}`, 'error');
      }
    }
  }

  async cascadeUpdateSuccessors(shiftedTask) {
    const { tasks = [] } = window.storage.cache;
    const deltaEnd = new Date(shiftedTask.endDate);

    for (const t of tasks) {
      const preds = this.parsePredecessors(t);
      const isDependent = preds.some(p => p.id === shiftedTask.id);

      if (isDependent && t.startDate) {
        const tCurStart = new Date(t.startDate);
        const tCurEnd = new Date(t.endDate);
        const duration = Math.max(1, Math.round((tCurEnd - tCurStart) / 86400000));

        if (tCurStart <= deltaEnd) {
          const nextStart = new Date(deltaEnd);
          nextStart.setDate(nextStart.getDate() + 1);
          const nextEnd = new Date(nextStart);
          nextEnd.setDate(nextEnd.getDate() + duration);

          t.startDate = nextStart.toISOString().split('T')[0];
          t.endDate = nextEnd.toISOString().split('T')[0];
          await window.storage.saveEntity('tasks', t.id, t);
        }
      }
    }
  }

  // ============================================================
  // 6. MS PROJECT (.XML) EXPORT
  // ============================================================

  exportMsProjectXml() {
    const { tasks: allTasks = [], employees = [] } = window.storage.cache;
    const tasks = this.filterTasksBySchedule(allTasks, this.activeScheduleId);
    const activeSch = this.getActiveSchedule();

    if (tasks.length === 0) {
      window.app.showToast(`Нет задач в графике «${activeSch.name}» для экспорта`, 'warning');
      return;
    }

    this.buildWbsTree(tasks);

    const uidMap = new Map();
    this.flatVisibleRows.forEach((t, i) => {
      uidMap.set(t.id, i + 1);
    });

    const nowIso = new Date().toISOString().split('.')[0];
    
    let pStart = nowIso;
    let pFinish = nowIso;
    if (this.flatVisibleRows.length > 0) {
      const dates = this.flatVisibleRows.map(t => ({ s: t.startDate, e: t.endDate })).filter(d => d.s && d.e);
      if (dates.length > 0) {
        const sortedStart = [...dates].sort((a,b) => a.s.localeCompare(b.s));
        const sortedEnd = [...dates].sort((a,b) => b.e.localeCompare(a.e));
        pStart = `${sortedStart[0].s}T08:00:00`;
        pFinish = `${sortedEnd[0].e}T17:00:00`;
      }
    }

    const xmlTasks = this.flatVisibleRows.map((t, idx) => {
      const uid = uidMap.get(t.id) || (idx + 1);
      const id = idx + 1;
      const tStart = t.startDate ? `${t.startDate}T08:00:00` : pStart;
      const tFinish = t.endDate ? `${t.endDate}T17:00:00` : pFinish;
      const durDays = t.isMilestone ? 0 : (t.duration || 1);
      const durHours = durDays * 8;
      const durationIso = `PT${durHours}H0M0S`;
      const isSummary = t.isPhase ? 1 : 0;
      const isMilestone = t.isMilestone ? 1 : 0;
      const percent = Math.min(100, Math.max(0, parseInt(t.progress, 10) || (t.status === 'done' ? 100 : 0)));
      const outlineLevel = (t.level || 0) + 1;
      const outlineNumber = t.wbs || `${id}`;
      const priority = t.priority === 'critical' ? 900 : t.priority === 'high' ? 700 : t.priority === 'low' ? 300 : 500;

      const preds = this.parsePredecessors(t);
      const predXml = preds.map(p => {
        const pUid = uidMap.get(p.id);
        if (!pUid) return '';
        return `
          <PredecessorLink>
            <PredecessorUID>${pUid}</PredecessorUID>
            <Type>1</Type>
            <CrossProject>0</CrossProject>
            <LinkLag>0</LinkLag>
            <LagFormat>7</LagFormat>
          </PredecessorLink>
        `;
      }).join('');

      return `
        <Task>
          <UID>${uid}</UID>
          <ID>${id}</ID>
          <Name>${this.escapeXml(t.title)}</Name>
          <Type>0</Type>
          <CreateDate>${nowIso}</CreateDate>
          <WBS>${outlineNumber}</WBS>
          <OutlineNumber>${outlineNumber}</OutlineNumber>
          <OutlineLevel>${outlineLevel}</OutlineLevel>
          <Priority>${priority}</Priority>
          <Start>${tStart}</Start>
          <Finish>${tFinish}</Finish>
          <Duration>${durationIso}</Duration>
          <DurationFormat>7</DurationFormat>
          <Work>${durationIso}</Work>
          <PercentComplete>${percent}</PercentComplete>
          <PercentWorkComplete>${percent}</PercentWorkComplete>
          <Milestone>${isMilestone}</Milestone>
          <Summary>${isSummary}</Summary>
          <Critical>${this.criticalTaskIds.has(t.id) ? 1 : 0}</Critical>
          <Notes>${this.escapeXml(t.description || '')}</Notes>
          ${predXml}
        </Task>
      `;
    }).join('');

    const xmlResources = employees.map((emp, i) => `
      <Resource>
        <UID>${i + 1}</UID>
        <ID>${i + 1}</ID>
        <Name>${this.escapeXml(emp.name)}</Name>
        <Type>1</Type>
        <StandardRate>1000</StandardRate>
      </Resource>
    `).join('');

    const xmlDoc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Project xmlns="http://schemas.microsoft.com/project">
  <SaveVersion>14</SaveVersion>
  <Name>${this.escapeXml(activeSch.name)}_${new Date().toISOString().split('T')[0]}</Name>
  <Title>${this.escapeXml(activeSch.name)}</Title>
  <CreationDate>${nowIso}</CreationDate>
  <StartDate>${pStart}</StartDate>
  <FinishDate>${pFinish}</FinishDate>
  <ScheduleFromStart>1</ScheduleFromStart>
  <DefaultStartTime>08:00:00</DefaultStartTime>
  <DefaultFinishTime>17:00:00</DefaultFinishTime>
  <MinutesPerDay>480</MinutesPerDay>
  <MinutesPerWeek>2400</MinutesPerWeek>
  <DaysPerMonth>20</DaysPerMonth>
  <Tasks>
    ${xmlTasks}
  </Tasks>
  <Resources>
    ${xmlResources}
  </Resources>
</Project>`;

    const blob = new Blob([xmlDoc], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `План_${activeSch.name.replace(/[^a-zA-Zа-яА-Я0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.xml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    window.app.showToast(`План «${activeSch.name}» успешно экспортирован в MS Project XML`, 'success');
  }

  // ============================================================
  // 7. MS PROJECT (.XML) IMPORT
  // ============================================================

  openImportModal() {
    let modal = document.getElementById('msproject-import-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.className = 'modal-overlay';
      modal.id = 'msproject-import-modal';
      modal.innerHTML = `
        <div class="modal-card" style="max-width: 680px; width: 90%;">
          <div class="modal-header">
            <h3 class="modal-title">📥 Импорт проекта из MS Project (XML)</h3>
            <button class="btn btn-sm" id="btn-close-msp-modal">✕</button>
          </div>
          <div class="modal-body" style="display: flex; flex-direction: column; gap: 1rem;">
            
            <div class="ocr-dropzone" id="msp-file-dropzone">
              <span style="font-size: 2.2rem;">📁</span>
              <div style="font-weight: 700; font-size: 0.95rem;">Выберите или перетащите файл MS Project (.xml)</div>
              <div style="font-size: 0.78rem; color: var(--text-muted);">
                Поддерживаются форматы Microsoft Project 2010–2021 XML, ProjectLibre, Primavera XML
              </div>
              <input type="file" id="msp-file-input" accept=".xml,text/xml" style="display: none;">
            </div>

            <div id="msp-preview-area" style="display: none; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 1rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
                <div style="font-weight: 700; font-size: 0.9rem; color: var(--text-primary);" id="msp-preview-title">Анализ файла проекта</div>
                <span class="badge badge-low" id="msp-preview-badge">0 задач</span>
              </div>
              <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem; margin-bottom: 0.75rem; font-size: 0.8rem;">
                <div style="background: var(--bg-primary); padding: 0.5rem; border-radius: 4px; text-align: center;">
                  <div style="color: var(--text-muted);">Всего задач</div>
                  <b id="msp-stat-total" style="font-size: 1.1rem; color: var(--accent-primary);">0</b>
                </div>
                <div style="background: var(--bg-primary); padding: 0.5rem; border-radius: 4px; text-align: center;">
                  <div style="color: var(--text-muted);">Этапы (Phases)</div>
                  <b id="msp-stat-phases" style="font-size: 1.1rem; color: var(--text-primary);">0</b>
                </div>
                <div style="background: var(--bg-primary); padding: 0.5rem; border-radius: 4px; text-align: center;">
                  <div style="color: var(--text-muted);">Вехи (◆)</div>
                  <b id="msp-stat-milestones" style="font-size: 1.1rem; color: #f59e0b);">0</b>
                </div>
                <div style="background: var(--bg-primary); padding: 0.5rem; border-radius: 4px; text-align: center;">
                  <div style="color: var(--text-muted);">Связи</div>
                  <b id="msp-stat-deps" style="font-size: 1.1rem; color: #10b981);">0</b>
                </div>
              </div>

              <div class="form-group" style="margin-bottom: 0.5rem;">
                <label class="form-label">Куда импортировать:</label>
                <div style="display: flex; flex-direction: column; gap: 0.4rem; font-size: 0.85rem;">
                  <label style="display: flex; align-items: center; gap: 0.35rem; cursor: pointer;">
                    <input type="radio" name="msp-import-dest" value="new_tab" checked>
                    <b>Создать новую вкладку графика</b> (из названия проекта / файла)
                  </label>
                  <label style="display: flex; align-items: center; gap: 0.35rem; cursor: pointer;">
                    <input type="radio" name="msp-import-dest" value="active_tab">
                    Импортировать в текущий график («<span id="msp-active-tab-name"></span>»)
                  </label>
                  <label style="display: flex; align-items: center; gap: 0.35rem; cursor: pointer;">
                    <input type="radio" name="msp-import-dest" value="replace_all">
                    Заменить весь сводный план проекта
                  </label>
                </div>
              </div>

              <!-- Preview Table -->
              <div style="max-height: 160px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary);">
                <table class="data-table" style="font-size: 0.78rem;">
                  <thead>
                    <tr>
                      <th>WBS</th>
                      <th>Наименование</th>
                      <th>Начало</th>
                      <th>Окончание</th>
                      <th>Готовность</th>
                    </tr>
                  </thead>
                  <tbody id="msp-preview-table-body"></tbody>
                </table>
              </div>
            </div>

          </div>
          <div class="modal-footer">
            <button class="btn" id="btn-cancel-msp-modal">Отмена</button>
            <button class="btn btn-primary" id="btn-confirm-msp-import" disabled>
              🚀 Импортировать задачи в график
            </button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      const dropzone = modal.querySelector('#msp-file-dropzone');
      const fileInput = modal.querySelector('#msp-file-input');
      const closeBtn = modal.querySelector('#btn-close-msp-modal');
      const cancelBtn = modal.querySelector('#btn-cancel-msp-modal');
      const confirmBtn = modal.querySelector('#btn-confirm-msp-import');

      dropzone.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          this.parseMsProjectFile(e.target.files[0]);
        }
      });

      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('drag-over');
      });
      dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('drag-over');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          this.parseMsProjectFile(e.dataTransfer.files[0]);
        }
      });

      const closeModal = () => {
        modal.classList.remove('active');
        this.importedTasksCache = null;
      };

      closeBtn.addEventListener('click', closeModal);
      cancelBtn.addEventListener('click', closeModal);

      confirmBtn.addEventListener('click', async () => {
        if (!this.importedTasksCache || this.importedTasksCache.tasks.length === 0) return;
        const dest = modal.querySelector('input[name="msp-import-dest"]:checked')?.value || 'new_tab';
        await this.applyImportedTasks(this.importedTasksCache, dest);
        closeModal();
      });
    }

    const activeTabNameEl = modal.querySelector('#msp-active-tab-name');
    if (activeTabNameEl) activeTabNameEl.textContent = this.getActiveSchedule().name;

    modal.classList.add('active');
  }

  async parseMsProjectFile(file) {
    try {
      const text = await file.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(text, 'application/xml');

      const parseErrors = xmlDoc.getElementsByTagName('parsererror');
      if (parseErrors.length > 0) {
        throw new Error('Файл не является корректным XML-документом');
      }

      const projectName = xmlDoc.getElementsByTagName('Title')[0]?.textContent?.trim() || 
                          xmlDoc.getElementsByTagName('Name')[0]?.textContent?.trim() || 
                          file.name.replace(/\.[^/.]+$/, '');

      const taskNodes = Array.from(xmlDoc.getElementsByTagName('Task'));
      if (taskNodes.length === 0) {
        throw new Error('В файле не найдено секции <Tasks><Task>...');
      }

      const parsedTasks = [];
      const parentStack = [];
      const uidToIdMap = new Map();

      taskNodes.forEach((node, idx) => {
        const uid = node.getElementsByTagName('UID')[0]?.textContent?.trim() || String(idx + 1);
        const name = node.getElementsByTagName('Name')[0]?.textContent?.trim();
        
        if (!name && idx === 0) return;

        const outlineLevel = parseInt(node.getElementsByTagName('OutlineLevel')[0]?.textContent?.trim() || '1', 10);
        const outlineNumber = node.getElementsByTagName('OutlineNumber')[0]?.textContent?.trim() || `${idx + 1}`;
        const startRaw = node.getElementsByTagName('Start')[0]?.textContent?.trim();
        const finishRaw = node.getElementsByTagName('Finish')[0]?.textContent?.trim();
        const durationRaw = node.getElementsByTagName('Duration')[0]?.textContent?.trim();
        const percentRaw = node.getElementsByTagName('PercentComplete')[0]?.textContent?.trim() || '0';
        const milestoneRaw = node.getElementsByTagName('Milestone')[0]?.textContent?.trim() || '0';
        const summaryRaw = node.getElementsByTagName('Summary')[0]?.textContent?.trim() || '0';
        const notes = node.getElementsByTagName('Notes')[0]?.textContent?.trim() || '';
        const priorityRaw = node.getElementsByTagName('Priority')[0]?.textContent?.trim() || '500';

        const startDate = startRaw ? startRaw.split('T')[0] : new Date().toISOString().split('T')[0];
        const endDate = finishRaw ? finishRaw.split('T')[0] : startDate;
        const isMilestone = milestoneRaw === '1' || durationRaw === 'PT0H0M0S';
        const isPhase = summaryRaw === '1';
        const progress = parseInt(percentRaw, 10) || 0;

        const priorityNum = parseInt(priorityRaw, 10);
        const priority = priorityNum >= 800 ? 'critical' : priorityNum >= 600 ? 'high' : priorityNum <= 300 ? 'low' : 'medium';

        const taskId = `task_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`;
        uidToIdMap.set(uid, taskId);

        const predNodes = Array.from(node.getElementsByTagName('PredecessorLink'));
        const predecessors = predNodes.map(pn => {
          const predUid = pn.getElementsByTagName('PredecessorUID')[0]?.textContent?.trim();
          const typeCode = pn.getElementsByTagName('Type')[0]?.textContent?.trim() || '1';
          const type = typeCode === '4' ? 'SS' : typeCode === '3' ? 'FF' : 'FS';
          return { uid: predUid, type };
        });

        while (parentStack.length > 0 && parentStack[parentStack.length - 1].level >= outlineLevel) {
          parentStack.pop();
        }

        const parentId = parentStack.length > 0 ? parentStack[parentStack.length - 1].id : null;

        const taskObj = {
          id: taskId,
          title: name || `Задача ${idx + 1}`,
          startDate: startDate,
          endDate: endDate,
          progress: progress,
          isMilestone: isMilestone,
          isPhase: isPhase,
          status: progress >= 100 ? 'done' : progress > 0 ? 'in_progress' : 'backlog',
          priority: priority,
          parentId: parentId,
          outlineLevel: outlineLevel,
          outlineNumber: outlineNumber,
          description: notes,
          rawPredecessors: predecessors,
          dependencies: [],
          tags: ['MS-Project', `WBS-${outlineNumber}`],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        if (isPhase) {
          parentStack.push({ level: outlineLevel, id: taskId });
        }

        parsedTasks.push(taskObj);
      });

      let totalDeps = 0;
      parsedTasks.forEach(t => {
        if (t.rawPredecessors && t.rawPredecessors.length > 0) {
          t.rawPredecessors.forEach(p => {
            const mappedId = uidToIdMap.get(p.uid);
            if (mappedId) {
              t.dependencies.push({ id: mappedId, type: p.type });
              totalDeps++;
            }
          });
          if (t.dependencies.length > 0) {
            t.predecessorId = t.dependencies[0].id;
            t.predecessorType = t.dependencies[0].type;
          }
        }
        delete t.rawPredecessors;
      });

      this.importedTasksCache = { projectName, tasks: parsedTasks };

      const previewArea = document.getElementById('msp-preview-area');
      const confirmBtn = document.getElementById('btn-confirm-msp-import');
      const badge = document.getElementById('msp-preview-badge');
      const statTotal = document.getElementById('msp-stat-total');
      const statPhases = document.getElementById('msp-stat-phases');
      const statMilestones = document.getElementById('msp-stat-milestones');
      const statDeps = document.getElementById('msp-stat-deps');
      const tableBody = document.getElementById('msp-preview-table-body');

      const phasesCount = parsedTasks.filter(t => t.isPhase).length;
      const milestonesCount = parsedTasks.filter(t => t.isMilestone).length;

      statTotal.textContent = String(parsedTasks.length);
      statPhases.textContent = String(phasesCount);
      statMilestones.textContent = String(milestonesCount);
      statDeps.textContent = String(totalDeps);
      badge.textContent = `${parsedTasks.length} задач готово к импорту`;

      tableBody.innerHTML = parsedTasks.slice(0, 12).map(t => `
        <tr>
          <td><b>${t.outlineNumber || '—'}</b></td>
          <td>${t.isPhase ? '📁 <b>' + this.escapeHtml(t.title) + '</b>' : (t.isMilestone ? '◆ ' : '') + this.escapeHtml(t.title)}</td>
          <td>${t.startDate}</td>
          <td>${t.endDate}</td>
          <td>${t.progress}%</td>
        </tr>
      `).join('');

      previewArea.style.display = 'block';
      confirmBtn.disabled = false;
      window.app.showToast(`Распознано ${parsedTasks.length} задач из проекта «${projectName}»`, 'info');

    } catch (err) {
      window.app.showToast(`Ошибка парсинга MS Project: ${err.message}`, 'error');
    }
  }

  async applyImportedTasks(importData, mode) {
    try {
      const { projectName, tasks } = importData;
      let targetScheduleId = this.activeScheduleId;

      if (mode === 'new_tab') {
        const newSchId = 'sch_' + Date.now();
        const newSch = { id: newSchId, name: projectName || 'Импортированный проект', icon: '📁', isSystem: false };
        this.customSchedules.push(newSch);
        localStorage.setItem('gantt_custom_schedules', JSON.stringify(this.customSchedules));
        targetScheduleId = newSchId;
        this.activeScheduleId = newSchId;
        localStorage.setItem('gantt_active_schedule', newSchId);
      } else if (mode === 'replace_all') {
        const existing = window.storage.cache.tasks || [];
        for (const t of existing) {
          await window.storage.deleteEntity('tasks', t.id);
        }
        window.storage.cache.tasks = [];
      }

      for (const t of tasks) {
        t.scheduleId = targetScheduleId;
        await window.storage.saveEntity('tasks', t.id, t);
      }

      window.app.showToast(`Успешно импортировано ${tasks.length} задач в график «${projectName}»`, 'success');
      this.render();
      window.tasksModule.render();
      window.calendarModule.render();
    } catch (err) {
      window.app.showToast(`Ошибка сохранения импортированных задач: ${err.message}`, 'error');
    }
  }

  // ============================================================
  // 8. EXPORT GANTT SVG & UTILITIES
  // ============================================================

  exportGanttSvg() {
    const svgEl = document.getElementById('gantt-master-svg');
    if (!svgEl) return;

    const activeSch = this.getActiveSchedule();
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `График_${activeSch.name.replace(/[^a-zA-Zа-яА-Я0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    window.app.showToast(`График «${activeSch.name}» успешно экспортирован в SVG`, 'success');
  }

  calcWorkingDays(startStr, endStr) {
    if (!startStr || !endStr) return 1;
    const d1 = new Date(startStr);
    const d2 = new Date(endStr);
    if (isNaN(d1.getTime()) || isNaN(d2.getTime()) || d2 < d1) return 1;
    let count = 0;
    const cur = new Date(d1);
    while (cur <= d2) {
      const day = cur.getDay();
      if (day !== 0 && day !== 6) count++;
      cur.setDate(cur.getDate() + 1);
    }
    return Math.max(1, count);
  }

  getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }

  addDays(dateStr, days) {
    if (!dateStr) return new Date().toISOString().split('T')[0];
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  }

  truncateText(str, maxLen) {
    if (!str) return '';
    return str.length > maxLen ? str.substring(0, maxLen) + '...' : str;
  }

  escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  escapeXml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}

window.ganttModule = new GanttModule();
