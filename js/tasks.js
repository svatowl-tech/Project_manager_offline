/**
 * Tasks & Kanban Module
 * Supports: Drag-and-Drop auto-save to JSON, filtering, progress tracking, date validation
 */

class TasksModule {
  constructor() {
    this.currentFilter = {
      search: '',
      assignee: 'all',
      priority: 'all'
    };
    this.editingTaskId = null;
  }

  init() {
    this.bindEvents();
    this.render();
  }

  bindEvents() {
    const searchInput = document.getElementById('task-search-input');
    const assigneeFilter = document.getElementById('task-assignee-filter');
    const priorityFilter = document.getElementById('task-priority-filter');
    const btnNewTask = document.getElementById('btn-new-task');

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.currentFilter.search = e.target.value.toLowerCase().trim();
        this.render();
      });
    }

    if (assigneeFilter) {
      assigneeFilter.addEventListener('change', (e) => {
        this.currentFilter.assignee = e.target.value;
        this.render();
      });
    }

    if (priorityFilter) {
      priorityFilter.addEventListener('change', (e) => {
        this.currentFilter.priority = e.target.value;
        this.render();
      });
    }

    if (btnNewTask) {
      btnNewTask.addEventListener('click', () => this.openTaskModal(null));
    }

    // Modal Progress Range Sync
    const progRange = document.getElementById('task-form-progress');
    const progVal = document.getElementById('task-form-progress-val');
    if (progRange && progVal) {
      progRange.addEventListener('input', (e) => {
        progVal.textContent = `${e.target.value}%`;
      });
    }
  }

  render() {
    const { tasks = [], employees = [], locks = [] } = window.storage.cache;

    // Populate employee filter dropdown
    const assigneeFilter = document.getElementById('task-assignee-filter');
    if (assigneeFilter) {
      const currentVal = assigneeFilter.value;
      assigneeFilter.innerHTML = '<option value="all">Все исполнители</option>' +
        employees.map(e => `<option value="${e.id}">${this.escapeHtml(e.name)}</option>`).join('');
      assigneeFilter.value = currentVal || 'all';
    }

    // Filter tasks
    const filtered = tasks.filter(task => {
      if (this.currentFilter.search) {
        const titleMatch = (task.title || '').toLowerCase().includes(this.currentFilter.search);
        const descMatch = (task.description || '').toLowerCase().includes(this.currentFilter.search);
        const tagMatch = (task.tags || []).some(t => t.toLowerCase().includes(this.currentFilter.search));
        if (!titleMatch && !descMatch && !tagMatch) return false;
      }
      if (this.currentFilter.assignee !== 'all' && task.assigneeId !== this.currentFilter.assignee) {
        return false;
      }
      if (this.currentFilter.priority !== 'all' && task.priority !== this.currentFilter.priority) {
        return false;
      }
      return true;
    });

    const columns = {
      backlog: document.getElementById('kanban-col-backlog'),
      in_progress: document.getElementById('kanban-col-in_progress'),
      review: document.getElementById('kanban-col-review'),
      done: document.getElementById('kanban-col-done')
    };

    const counts = { backlog: 0, in_progress: 0, review: 0, done: 0 };

    // Clear columns
    Object.values(columns).forEach(col => {
      if (col) col.innerHTML = '';
    });

    const todayStr = new Date().toISOString().split('T')[0];

    filtered.forEach(task => {
      const colKey = task.status || 'backlog';
      const colEl = columns[colKey];
      if (colEl) {
        counts[colKey]++;
        const card = this.createCardElement(task, employees, locks, todayStr);
        colEl.appendChild(card);
      }
    });

    // Update column counters
    Object.keys(counts).forEach(k => {
      const counterEl = document.getElementById(`counter-${k}`);
      if (counterEl) counterEl.textContent = counts[k];
    });

    // Update nav badge
    const navBadge = document.getElementById('nav-badge-tasks');
    if (navBadge) navBadge.textContent = tasks.length;
  }

  createCardElement(task, employees, locks, todayStr) {
    const card = document.createElement('div');
    card.className = 'task-card';
    card.draggable = true;
    card.dataset.id = task.id;

    // Overdue check
    const isOverdue = task.endDate && task.endDate < todayStr && task.status !== 'done';
    if (isOverdue) {
      card.classList.add('is-overdue');
    }

    // Lock check
    const isLocked = locks.some(l => l.entityType === 'tasks' && l.entityId === task.id && l.lockedBy !== window.storage.activeUser);
    if (isLocked) {
      card.classList.add('is-locked');
    }

    const assignee = employees.find(e => e.id === task.assigneeId) || { name: 'Не назначен' };

    const priorityLabels = {
      critical: 'Критический',
      high: 'Высокий',
      medium: 'Средний',
      low: 'Низкий'
    };

    const progress = Math.min(100, Math.max(0, parseInt(task.progress, 10) || (task.status === 'done' ? 100 : 0)));
    const subtasksDone = (task.subtasks || []).filter(s => s.done).length;
    const subtasksTotal = (task.subtasks || []).length;

    card.innerHTML = `
      <div class="card-top">
        <span class="badge badge-${task.priority || 'medium'}">${priorityLabels[task.priority] || 'Средний'}</span>
        <div style="display: flex; gap: 4px; align-items: center;">
          ${isOverdue ? '<span class="badge badge-overdue" style="font-size:0.68rem; padding:1px 5px;">Просрочено</span>' : ''}
          ${isLocked ? '<span title="Карточка редактируется другим пользователем" style="color:var(--danger);font-size:0.85rem;">🔒</span>' : ''}
        </div>
      </div>
      <div class="card-title">${this.escapeHtml(task.title || 'Без названия')}</div>
      ${(task.tags && task.tags.length) ? `
        <div class="card-tags">
          ${task.tags.map(t => `<span class="tag-chip">#${this.escapeHtml(t)}</span>`).join('')}
        </div>
      ` : ''}
      <div class="card-progress-bar" title="Готовность: ${progress}%">
        <div class="card-progress-fill" style="width: ${progress}%;"></div>
      </div>
      <div class="card-meta">
        <span>👤 ${this.escapeHtml(assignee.name)}</span>
        <span>⏱️ ${task.actualHours || 0}/${task.estimatedHours || 0}ч</span>
      </div>
      <div class="card-footer">
        <span style="${isOverdue ? 'color:var(--danger); font-weight:700;' : ''}">📅 ${task.endDate || 'Без срока'}</span>
        <span style="font-weight:600; color:var(--accent-primary);">${progress}%</span>
        ${subtasksTotal > 0 ? `<span>☑️ ${subtasksDone}/${subtasksTotal}</span>` : ''}
      </div>
    `;

    // Click to open editor
    card.addEventListener('click', (e) => {
      // Prevent opening modal when dragging
      if (card.dataset.dragging === 'true') return;
      this.openTaskModal(task.id);
    });

    // Native Drag and Drop
    card.addEventListener('dragstart', (e) => {
      card.dataset.dragging = 'true';
      e.dataTransfer.setData('text/plain', task.id);
      e.dataTransfer.effectAllowed = 'move';
      card.style.opacity = '0.4';
    });

    card.addEventListener('dragend', () => {
      card.style.opacity = '1';
      setTimeout(() => { card.dataset.dragging = 'false'; }, 50);
    });

    return card;
  }

  async openTaskModal(taskId) {
    this.editingTaskId = taskId;
    const modal = document.getElementById('task-modal');
    const lockWarning = document.getElementById('task-lock-warning');
    const deleteBtn = document.getElementById('btn-delete-task');
    const titleInput = document.getElementById('task-form-title');
    const descInput = document.getElementById('task-form-desc');
    const statusSelect = document.getElementById('task-form-status');
    const prioritySelect = document.getElementById('task-form-priority');
    const assigneeSelect = document.getElementById('task-form-assignee');
    const startInput = document.getElementById('task-form-start');
    const endInput = document.getElementById('task-form-end');
    const progRange = document.getElementById('task-form-progress');
    const progVal = document.getElementById('task-form-progress-val');
    const estInput = document.getElementById('task-form-est');
    const actInput = document.getElementById('task-form-act');
    const tagsInput = document.getElementById('task-form-tags');

    // Populate employees list
    const { tasks = [], employees = [] } = window.storage.cache;
    assigneeSelect.innerHTML = '<option value="">-- Выберите исполнителя --</option>' +
      employees.map(e => `<option value="${e.id}">${this.escapeHtml(e.name)} (${this.escapeHtml(e.role || 'Сотрудник')})</option>`).join('');

    // Populate schedules list
    const scheduleSelect = document.getElementById('task-form-schedule');
    if (scheduleSelect) {
      const schedules = window.ganttModule ? window.ganttModule.getSchedulesList() : [
        { id: 'all', name: 'Сводный график (Все работы)', icon: '🏢' },
        { id: 'smr', name: 'СМР и Общестрой', icon: '🏗' },
        { id: 'eng', name: 'Инженерия и ЭОМ/СС', icon: '⚡' },
        { id: 'it', name: 'ИТ и Цифровизация', icon: '💻' },
        { id: 'supply', name: 'Поставки и Контракты', icon: '📜' }
      ];
      scheduleSelect.innerHTML = schedules.map(s => 
        `<option value="${s.id}">${s.icon} ${this.escapeHtml(s.name)}</option>`
      ).join('');
    }

    // Populate parent WBS options
    const parentSelect = document.getElementById('task-form-parent');
    if (parentSelect) {
      const otherTasks = tasks.filter(t => !taskId || t.id !== taskId);
      parentSelect.innerHTML = '<option value="">(Корневой уровень / Без родителя)</option>' +
        otherTasks.map(t => `<option value="${t.id}">📁 ${this.escapeHtml(t.title)}</option>`).join('');
    }

    // Populate predecessor options
    const predSelect = document.getElementById('task-form-predecessor');
    if (predSelect) {
      const otherTasks = tasks.filter(t => !taskId || t.id !== taskId);
      predSelect.innerHTML = '<option value="">(Нет предшественника)</option>' +
        otherTasks.map(t => `<option value="${t.id}">${t.isMilestone ? '◆' : '•'} ${this.escapeHtml(t.title)} (${t.endDate || t.startDate})</option>`).join('');
    }

    const defaultSchedule = window.ganttModule ? (window.ganttModule.activeScheduleId || 'all') : 'all';

    let taskData = {
      title: '',
      description: '',
      status: 'backlog',
      priority: 'medium',
      assigneeId: '',
      scheduleId: defaultSchedule,
      parentId: null,
      predecessorId: null,
      predecessorType: 'FS',
      isMilestone: false,
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      progress: 0,
      estimatedHours: 8,
      actualHours: 0,
      tags: defaultSchedule !== 'all' ? [defaultSchedule] : [],
      subtasks: []
    };

    if (taskId) {
      const existing = (window.storage.cache.tasks || []).find(t => t.id === taskId);
      if (existing) {
        taskData = { ...taskData, ...existing };
      }

      // Try acquiring lock
      const lockResult = await window.storage.acquireLock('tasks', taskId);
      if (!lockResult.granted) {
        lockWarning.style.display = 'flex';
        lockWarning.innerHTML = `⚠️ Внимание: Данная задача заблокирована пользователем <b>${this.escapeHtml(lockResult.lockedBy)}</b> (${lockResult.minutesAgo} мин. назад).`;
      } else {
        lockWarning.style.display = 'none';
      }
      deleteBtn.style.display = 'inline-flex';
    } else {
      lockWarning.style.display = 'none';
      deleteBtn.style.display = 'none';
    }

    // Fill form fields
    titleInput.value = taskData.title || '';
    descInput.value = taskData.description || '';
    statusSelect.value = taskData.status || 'backlog';
    prioritySelect.value = taskData.priority || 'medium';
    assigneeSelect.value = taskData.assigneeId || '';
    
    if (scheduleSelect) scheduleSelect.value = taskData.scheduleId || 'all';
    if (parentSelect) parentSelect.value = taskData.parentId || '';
    if (predSelect) predSelect.value = taskData.predecessorId || '';
    
    const predTypeSelect = document.getElementById('task-form-pred-type');
    if (predTypeSelect) predTypeSelect.value = taskData.predecessorType || 'FS';

    const milestoneCheck = document.getElementById('task-form-is-milestone');
    if (milestoneCheck) milestoneCheck.checked = !!taskData.isMilestone;

    startInput.value = taskData.startDate || '';
    endInput.value = taskData.endDate || '';
    
    const curProg = parseInt(taskData.progress, 10) || (taskData.status === 'done' ? 100 : 0);
    if (progRange) progRange.value = curProg;
    if (progVal) progVal.textContent = `${curProg}%`;

    estInput.value = taskData.estimatedHours || 0;
    actInput.value = taskData.actualHours || 0;
    tagsInput.value = (taskData.tags || []).join(', ');

    // Render subtasks
    this.renderSubtasks(taskData.subtasks || []);

    modal.classList.add('open');
  }

  renderSubtasks(subtasks) {
    const list = document.getElementById('task-subtasks-list');
    list.innerHTML = '';
    subtasks.forEach((st, idx) => {
      const item = document.createElement('div');
      item.style.display = 'flex';
      item.style.alignItems = 'center';
      item.style.gap = '0.5rem';
      item.innerHTML = `
        <input type="checkbox" class="subtask-checkbox" data-index="${idx}" ${st.done ? 'checked' : ''}>
        <input type="text" class="form-control form-control-sm subtask-text" data-index="${idx}" value="${this.escapeHtml(st.text)}" style="flex:1;">
        <button type="button" class="btn btn-sm btn-danger btn-remove-subtask" data-index="${idx}">✕</button>
      `;
      list.appendChild(item);
      item.querySelector('.btn-remove-subtask').addEventListener('click', () => item.remove());
    });
  }

  async closeTaskModal() {
    const modal = document.getElementById('task-modal');
    modal.classList.remove('open');
    if (this.editingTaskId) {
      await window.storage.releaseLock('tasks', this.editingTaskId);
      this.editingTaskId = null;
    }
  }

  async saveCurrentTask() {
    const title = document.getElementById('task-form-title').value.trim();
    if (!title) {
      window.app.showToast('Укажите наименование задачи', 'error');
      return;
    }

    const startDate = document.getElementById('task-form-start').value;
    const endDate = document.getElementById('task-form-end').value;

    // Edge case check: End date cannot be earlier than start date
    if (startDate && endDate && endDate < startDate) {
      window.app.showToast('Ошибка: Дата завершения не может быть раньше даты начала', 'error');
      return;
    }

    const subtasks = [];
    document.querySelectorAll('#task-subtasks-list > div').forEach(row => {
      const cb = row.querySelector('.subtask-checkbox');
      const txt = row.querySelector('.subtask-text');
      if (txt && txt.value.trim()) {
        subtasks.push({ done: cb.checked, text: txt.value.trim() });
      }
    });

    const tags = document.getElementById('task-form-tags').value
      .split(',')
      .map(t => t.trim().replace(/^#/, ''))
      .filter(Boolean);

    const rawProgress = parseInt(document.getElementById('task-form-progress')?.value, 10) || 0;
    let status = document.getElementById('task-form-status').value;
    let progress = Math.min(100, Math.max(0, rawProgress));

    // Auto-adjust status if progress is 100% or 0%
    if (progress === 100 && status !== 'done') {
      status = 'done';
    } else if (status === 'done' && progress < 100) {
      progress = 100;
    }

    const scheduleId = document.getElementById('task-form-schedule')?.value || 'all';
    const parentId = document.getElementById('task-form-parent')?.value || null;
    const predecessorId = document.getElementById('task-form-predecessor')?.value || null;
    const predecessorType = document.getElementById('task-form-pred-type')?.value || 'FS';
    const isMilestone = document.getElementById('task-form-is-milestone')?.checked || false;

    const taskPayload = {
      id: this.editingTaskId || ('task_' + Date.now()),
      title,
      description: document.getElementById('task-form-desc').value,
      status,
      priority: document.getElementById('task-form-priority').value,
      assigneeId: document.getElementById('task-form-assignee').value,
      scheduleId,
      parentId,
      predecessorId,
      predecessorType,
      isMilestone,
      startDate,
      endDate,
      progress,
      estimatedHours: parseFloat(document.getElementById('task-form-est').value) || 0,
      actualHours: parseFloat(document.getElementById('task-form-act').value) || 0,
      tags,
      subtasks
    };

    try {
      await window.storage.saveEntity('tasks', taskPayload.id, taskPayload);
      window.app.showToast('Задача сохранена в JSON-файл сетевой папки', 'success');
      await this.closeTaskModal();
      if (window.ganttModule) window.ganttModule.render();
    } catch (e) {
      window.app.showToast(`Ошибка сохранения: ${e.message}`, 'error');
    }
  }

  async deleteCurrentTask() {
    if (!this.editingTaskId) return;
    if (confirm('Вы уверены, что хотите удалить эту задачу из сетевой папки (/data/tasks/)?')) {
      try {
        await window.storage.deleteEntity('tasks', this.editingTaskId);
        window.app.showToast('Задача удалена', 'info');
        await this.closeTaskModal();
      } catch (e) {
        window.app.showToast(`Ошибка удаления: ${e.message}`, 'error');
      }
    }
  }

  escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}

window.tasksModule = new TasksModule();
