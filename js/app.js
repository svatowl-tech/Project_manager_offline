/**
 * Main Application Orchestrator
 */

class App {
  constructor() {
    this.currentTab = 'kanban';
    this.theme = localStorage.getItem('smb_theme') || 'light';
  }

  async init() {
    this.applyTheme(this.theme);
    this.bindGlobalEvents();
    
    // Connect storage directories (Data Dir & Library Dir)
    try {
      const dataConn = await window.storage.connectDataDirectory(false);
      const libConn = await window.storage.connectLibraryDirectory(false);
      this.updateConnectionStatus(dataConn, libConn);
    } catch (e) {
      console.warn('Автоподключение каталогов:', e);
    }

    // Subscribe modules to storage changes
    window.storage.subscribe(() => {
      this.renderCurrentView();
      this.updateSyncIndicator();
    });

    // Initialize date defaults for calculators & OCR
    this.initCalculatorDefaults();

    // Initialize submodules
    window.tasksModule.init();
    window.calendarModule.init();
    window.ganttModule.init();
    window.contractsModule.init();
    window.employeesModule.init();
    if (window.directoryModule) window.directoryModule.init();
    if (window.investModule) window.investModule.init();
    if (window.risksModule) window.risksModule.init();
    if (window.evmAdvancedModule) window.evmAdvancedModule.init();
    if (window.documentsModule) window.documentsModule.init();
    if (window.ocrModule) window.ocrModule.init();
    if (window.pdfStudioModule) window.pdfStudioModule.init();
    if (window.cadViewerModule) window.cadViewerModule.init();
    window.calculatorsModule.init();

    this.updateUserSelector();
    this.updateNavBadges();
    this.switchTab('kanban');

    // Handle unload lock release
    window.addEventListener('beforeunload', () => {
      for (const [key] of window.storage.currentLocks) {
        const [type, id] = key.split('_');
        window.storage.releaseLock(type, id);
      }
    });
  }

  initCalculatorDefaults() {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 14);
    const nextWeekStr = nextWeek.toISOString().split('T')[0];

    const d1 = document.getElementById('wd-start-date');
    const d2 = document.getElementById('wd-end-date');
    const dAdd = document.getElementById('wd-add-start');
    const dDoc = document.getElementById('doc-field-date');
    const dOcr = document.getElementById('ocr-field-date');

    if (d1 && !d1.value) d1.value = todayStr;
    if (d2 && !d2.value) d2.value = nextWeekStr;
    if (dAdd && !dAdd.value) dAdd.value = todayStr;
    if (dDoc && !dDoc.value) dDoc.value = todayStr;
    if (dOcr && !dOcr.value) dOcr.value = todayStr;
  }

  bindGlobalEvents() {
    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = item.dataset.tab;
        if (tab) this.switchTab(tab);
      });
    });

    // Theme toggle
    const themeBtn = document.getElementById('btn-theme-toggle');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        this.theme = this.theme === 'light' ? 'dark' : 'light';
        localStorage.setItem('smb_theme', this.theme);
        this.applyTheme(this.theme);
      });
    }

    // Connect Data Directory button
    const btnDataDir = document.getElementById('btn-connect-data-dir');
    if (btnDataDir) {
      btnDataDir.addEventListener('click', async () => {
        try {
          const res = await window.storage.connectDataDirectory(true);
          this.updateConnectionStatus(res, null);
          this.showToast(`Папка БД успешно подключена: ${res.name}`, 'success');
        } catch (e) {
          this.showToast(e.message, 'warning');
        }
      });
    }

    // Connect Library Directory button
    const btnLibDir = document.getElementById('btn-connect-lib-dir');
    if (btnLibDir) {
      btnLibDir.addEventListener('click', async () => {
        try {
          const res = await window.storage.connectLibraryDirectory(true);
          this.updateConnectionStatus(null, res);
          this.showToast(`Библиотека документов подключена: ${res.name}`, 'success');
        } catch (e) {
          this.showToast(e.message, 'warning');
        }
      });
    }

    // Diagnostics button
    const btnDiag = document.getElementById('btn-open-diagnostics');
    if (btnDiag) {
      btnDiag.addEventListener('click', () => this.openDiagnosticsModal());
    }

    // Clear All Data button
    const btnClear = document.getElementById('btn-clear-all-data');
    if (btnClear) {
      btnClear.addEventListener('click', async () => {
        if (confirm('Вы уверены, что хотите полностью очистить базу данных? Все задачи, договоры, контрагенты и документы будут удалены.')) {
          await window.storage.clearAllData();
          this.updateUserSelector();
          this.showToast('База данных полностью очищена', 'warning');
        }
      });
    }

    // Seed Demo Data button
    const btnSeed = document.getElementById('btn-seed-data');
    if (btnSeed) {
      btnSeed.addEventListener('click', async () => {
        if (confirm('Сгенерировать демонстрационный набор данных (задачи, договоры, сотрудники, документы)?')) {
          await window.storage.seedDemoData();
          this.showToast('Демо-данные успешно загружены', 'success');
        }
      });
    }

    // User Selector change
    const userSelect = document.getElementById('header-user-select');
    if (userSelect) {
      userSelect.addEventListener('change', (e) => {
        window.storage.activeUser = e.target.value;
        localStorage.setItem('smb_active_user', e.target.value);
        this.showToast(`Текущий пользователь: ${e.target.value}`, 'info');
      });
    }

    // User Registration Modal Event Handlers
    const regModal = document.getElementById('user-registration-modal');
    const btnRegister = document.getElementById('btn-register-user');
    const btnCloseReg = document.getElementById('btn-close-register-modal');
    const btnCancelReg = document.getElementById('btn-cancel-register');
    const btnSaveReg = document.getElementById('btn-save-register');

    if (btnRegister) {
      btnRegister.addEventListener('click', () => {
        regModal?.classList.add('open');
      });
    }

    const closeRegModal = () => {
      regModal?.classList.remove('open');
      if (document.getElementById('register-form-name')) document.getElementById('register-form-name').value = '';
      if (document.getElementById('register-form-role')) document.getElementById('register-form-role').value = '';
      if (document.getElementById('register-form-department')) document.getElementById('register-form-department').value = '';
      if (document.getElementById('register-form-email')) document.getElementById('register-form-email').value = '';
      if (document.getElementById('register-form-phone')) document.getElementById('register-form-phone').value = '';
      if (document.getElementById('register-form-rate')) document.getElementById('register-form-rate').value = '1200';
    };

    btnCloseReg?.addEventListener('click', closeRegModal);
    btnCancelReg?.addEventListener('click', closeRegModal);

    if (btnSaveReg) {
      btnSaveReg.addEventListener('click', async () => {
        const name = document.getElementById('register-form-name')?.value.trim();
        const role = document.getElementById('register-form-role')?.value.trim();
        const department = document.getElementById('register-form-department')?.value.trim();
        const email = document.getElementById('register-form-email')?.value.trim();
        const phone = document.getElementById('register-form-phone')?.value.trim();
        const rate = parseFloat(document.getElementById('register-form-rate')?.value) || 1200;

        if (!name || !role || !department) {
          this.showToast('Пожалуйста, заполните ФИО, должность и подразделение', 'error');
          return;
        }

        const newUserId = 'emp_reg_' + Date.now();
        const payload = {
          id: newUserId,
          name,
          role,
          department,
          phone: phone || '+7 (495) 000-00-00',
          email: email || '',
          rate,
          load: 0,
          status: 'active'
        };

        try {
          await window.storage.saveEntity('employees', payload.id, payload);
          const activeUserStr = `${name} (${role})`;
          window.storage.activeUser = activeUserStr;
          localStorage.setItem('smb_active_user', activeUserStr);
          this.updateUserSelector();
          this.showToast(`Вы успешно зарегистрированы: ${activeUserStr}`, 'success');
          closeRegModal();
        } catch (err) {
          this.showToast(`Ошибка при регистрации: ${err.message}`, 'error');
        }
      });
    }

    // Drag and Drop for kanban columns with Auto-Save into JSON
    document.querySelectorAll('.kanban-column').forEach(col => {
      col.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        col.classList.add('drag-over');
      });

      col.addEventListener('dragleave', () => {
        col.classList.remove('drag-over');
      });

      col.addEventListener('drop', async (e) => {
        e.preventDefault();
        col.classList.remove('drag-over');
        const taskId = e.dataTransfer.getData('text/plain');
        const targetStatus = col.dataset.status;
        
        if (taskId && targetStatus) {
          const task = (window.storage.cache.tasks || []).find(t => t.id === taskId);
          if (task && task.status !== targetStatus) {
            task.status = targetStatus;
            if (targetStatus === 'done') {
              task.progress = 100;
            } else if (targetStatus === 'backlog' && task.progress === 100) {
              task.progress = 0;
            }
            try {
              await window.storage.saveEntity('tasks', taskId, task);
              const colName = col.querySelector('.column-header span')?.textContent || targetStatus;
              this.showToast(`Статус задачи сохранен: «${colName}»`, 'success');
            } catch (err) {
              this.showToast(`Ошибка сохранения: ${err.message}`, 'error');
            }
          }
        }
      });
    });

    // Task Modal Save & Cancel
    document.getElementById('btn-save-task')?.addEventListener('click', () => window.tasksModule.saveCurrentTask());
    document.getElementById('btn-cancel-task')?.addEventListener('click', () => window.tasksModule.closeTaskModal());
    document.getElementById('btn-close-task-modal')?.addEventListener('click', () => window.tasksModule.closeTaskModal());
    document.getElementById('btn-delete-task')?.addEventListener('click', () => window.tasksModule.deleteCurrentTask());

    // Add subtask button
    document.getElementById('btn-add-subtask')?.addEventListener('click', () => {
      const list = document.getElementById('task-subtasks-list');
      const idx = list.children.length;
      const item = document.createElement('div');
      item.style.display = 'flex';
      item.style.alignItems = 'center';
      item.style.gap = '0.5rem';
      item.innerHTML = `
        <input type="checkbox" class="subtask-checkbox" data-index="${idx}">
        <input type="text" class="form-control form-control-sm subtask-text" placeholder="Описание подзадачи..." data-index="${idx}" style="flex:1;">
        <button type="button" class="btn btn-sm btn-danger btn-remove-subtask" data-index="${idx}">✕</button>
      `;
      list.appendChild(item);
      item.querySelector('.btn-remove-subtask').addEventListener('click', () => item.remove());
    });

    // Contract Modal Save & Cancel
    document.getElementById('btn-save-contract')?.addEventListener('click', () => window.contractsModule.saveContract());
    document.getElementById('btn-cancel-contract')?.addEventListener('click', () => window.contractsModule.closeContractModal());
    document.getElementById('btn-close-contract-modal')?.addEventListener('click', () => window.contractsModule.closeContractModal());
    document.getElementById('btn-delete-contract')?.addEventListener('click', () => window.contractsModule.deleteContract());

    // Employee Modal Save & Cancel
    document.getElementById('btn-save-employee')?.addEventListener('click', () => window.employeesModule.saveEmployee());
    document.getElementById('btn-cancel-employee')?.addEventListener('click', () => window.employeesModule.closeEmployeeModal());
    document.getElementById('btn-close-employee-modal')?.addEventListener('click', () => window.employeesModule.closeEmployeeModal());
    document.getElementById('btn-delete-employee')?.addEventListener('click', () => window.employeesModule.deleteEmployee());

    // Diagnostics Modal close
    document.getElementById('btn-close-diag')?.addEventListener('click', () => {
      document.getElementById('diagnostics-modal').classList.remove('open');
    });

    // Clear locks button in diagnostics
    document.getElementById('btn-clear-stale-locks')?.addEventListener('click', async () => {
      const count = window.storage.cache.locks.length;
      for (const l of window.storage.cache.locks) {
        await window.storage.releaseLock(l.entityType, l.entityId);
      }
      this.showToast(`Снято ${count} блокировок`, 'success');
      this.openDiagnosticsModal();
    });
  }

  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const themeIcon = document.getElementById('theme-icon');
    if (themeIcon) {
      themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
  }

  switchTab(tabId) {
    this.currentTab = tabId;
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.tab === tabId);
    });

    document.querySelectorAll('.tab-content').forEach(el => {
      el.classList.toggle('active', el.id === `tab-${tabId}`);
    });

    const pageTitles = {
      kanban: 'Канбан и оперативные задачи',
      calendar: 'Календарь и недельный план',
      gantt: 'Диаграмма Ганта (Сроки и этапы)',
      documents: 'Реестр договоров и генератор Word (.docx)',
      ocr: 'Оптическое распознавание (OCR) и каталог документов',
      pdfstudio: 'PDF Студия: Инструменты работы с документами (PDF24)',
      cad: 'Инженерная графика и просмотрщик CAD / DXF / Visio',
      directory: 'Глобальный справочник сотрудников и контрагентов',
      invest: 'Гейты и Инвестиционный паспорт проекта (РП-3 / PMBOK)',
      risks: 'Реестр рисков и матрица реагирования (RMS / ISO 31000)',
      evm: 'EVM-Аналитика освоенного объема и S-Кривая (ГОСТ Р ИСО 21508)',
      calculators: 'Специализированные калькуляторы'
    };

    const titleEl = document.getElementById('current-page-title');
    if (titleEl) titleEl.textContent = pageTitles[tabId] || 'Панель руководителя';

    this.renderCurrentView();
  }

  renderCurrentView() {
    this.updateNavBadges();
    switch (this.currentTab) {
      case 'kanban': window.tasksModule.render(); break;
      case 'calendar': window.calendarModule.render(); break;
      case 'gantt': window.ganttModule.render(); break;
      case 'documents':
        window.contractsModule.render();
        if (window.documentsModule) window.documentsModule.render();
        break;
      case 'ocr':
        if (window.ocrModule) window.ocrModule.render();
        break;
      case 'cad':
        if (window.cadViewerModule) {
          window.cadViewerModule.resizeCanvas();
          window.cadViewerModule.render();
        }
        break;
      case 'directory':
        if (window.directoryModule) window.directoryModule.render();
        break;
      case 'invest':
        if (window.investModule) window.investModule.render();
        break;
      case 'risks':
        if (window.risksModule) window.risksModule.render();
        break;
      case 'evm':
        if (window.evmAdvancedModule) window.evmAdvancedModule.render();
        break;
      case 'calculators':
        if (window.calculatorsModule) window.calculatorsModule.render();
        break;
    }
  }

  updateNavBadges() {
    const { tasks = [], contracts = [], docs = [], employees = [], risks = [] } = window.storage.cache;
    const badgeTasks = document.getElementById('nav-badge-tasks');
    const badgeContracts = document.getElementById('nav-badge-contracts');
    const badgeDocs = document.getElementById('nav-badge-docs');
    const badgeEmp = document.getElementById('nav-badge-employees');
    const badgeRisks = document.getElementById('nav-badge-risks');
    
    if (badgeTasks) badgeTasks.textContent = tasks.length;
    if (badgeContracts) badgeContracts.textContent = contracts.length;
    if (badgeDocs) badgeDocs.textContent = docs.length;
    if (badgeEmp) badgeEmp.textContent = employees.length;
    if (badgeRisks) badgeRisks.textContent = risks.filter(r => r.status === 'active').length;
  }

  updateConnectionStatus(dataRes, libRes) {
    // 1. Data Directory Status
    const dataInd = document.getElementById('header-data-indicator');
    const dataText = document.getElementById('header-data-text');
    if (dataText) {
      if (window.storage.dataDirHandle) {
        if (dataInd) dataInd.className = 'status-indicator connected';
        dataText.textContent = `БД: ${window.storage.dataDirHandle.name}`;
      } else if (dataRes && dataRes.success) {
        if (dataInd) dataInd.className = 'status-indicator connected';
        dataText.textContent = dataRes.mode === 'fsa' ? `БД: ${dataRes.name}` : `БД: IndexedDB (SMB)`;
      } else if (window.storage.isVirtualMode) {
        if (dataInd) dataInd.className = 'status-indicator connected';
        dataText.textContent = 'БД: IndexedDB (Вирт)';
      } else {
        if (dataInd) dataInd.className = 'status-indicator';
        dataText.textContent = 'БД: Не подключена';
      }
    }

    // 2. Library Directory Status
    const libInd = document.getElementById('header-lib-indicator');
    const libText = document.getElementById('header-lib-text');
    if (libText) {
      if (window.storage.libraryDirHandle) {
        if (libInd) libInd.className = 'status-indicator connected';
        libText.textContent = `Библиотека: ${window.storage.libraryDirHandle.name}`;
      } else if (libRes && libRes.success) {
        if (libInd) libInd.className = 'status-indicator connected';
        libText.textContent = libRes.mode === 'fsa' ? `Библиотека: ${libRes.name}` : `Библиотека: Внутренняя`;
      } else {
        if (libInd) libInd.className = 'status-indicator';
        libText.textContent = 'Библиотека: Не подключена';
      }
    }
  }

  updateSyncIndicator() {
    const dataInd = document.getElementById('header-data-indicator');
    if (dataInd) {
      dataInd.classList.add('polling');
      setTimeout(() => dataInd.classList.remove('polling'), 800);
    }
    const syncTimeEl = document.getElementById('footer-sync-time');
    if (syncTimeEl) {
      const now = new Date();
      syncTimeEl.textContent = `Синхр: ${now.toLocaleTimeString('ru-RU')}`;
    }
  }

  updateUserSelector() {
    const userSelect = document.getElementById('header-user-select');
    if (!userSelect) return;

    const { employees = [] } = window.storage.cache;
    const allUsers = new Set();
    
    if (window.storage.activeUser) {
      allUsers.add(window.storage.activeUser);
    }

    employees.forEach(e => allUsers.add(`${e.name} (${e.role || 'Сотрудник'})`));

    if (allUsers.size === 0) {
      allUsers.add('Пользователь не выбран');
    }

    userSelect.innerHTML = Array.from(allUsers).map(u => {
      const isSelected = u === window.storage.activeUser || (window.storage.activeUser && u.startsWith(window.storage.activeUser.split(' ')[0]));
      return `<option value="${this.escapeHtml(u)}" ${isSelected ? 'selected' : ''}>${this.escapeHtml(u)}</option>`;
    }).join('');
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };

    toast.innerHTML = `
      <span>${icons[type] || 'ℹ️'}</span>
      <span style="flex:1;">${this.escapeHtml(message)}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  openDiagnosticsModal() {
    const modal = document.getElementById('diagnostics-modal');
    const content = document.getElementById('diag-modal-content');
    const { tasks = [], employees = [], contracts = [], docs = [], locks = [] } = window.storage.cache;

    content.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:0.75rem; font-size:0.88rem;">
        <div style="padding:0.75rem; background:var(--bg-tertiary); border-radius:var(--radius-sm);">
          <div><b>Режим хранилища:</b> ${window.storage.isVirtualMode ? 'IndexedDB SMB Emulation' : 'File System Access API (Реальная файловая система)'}</div>
          <div style="margin-top: 4px;"><b>Папка БД:</b> ${window.storage.dataDirHandle ? window.storage.dataDirHandle.name : 'Не выбрана'}</div>
          <div style="margin-top: 2px;"><b>Библиотека документов:</b> ${window.storage.libraryDirHandle ? window.storage.libraryDirHandle.name : 'Не выбрана'}</div>
        </div>
        <div>📁 Задач в базе: <b>${tasks.length} шт.</b> (/data/tasks/*.json)</div>
        <div>📁 Документов в каталоге: <b>${docs.length} шт.</b> (/data/docs/*.json)</div>
        <div>📁 Договоров: <b>${contracts.length} шт.</b> (/data/contracts/*.json)</div>
        <div>📁 Сотрудников: <b>${employees.length} чел.</b> (/data/employees/*.json)</div>
        <div style="border-top:1px solid var(--border-color); padding-top:0.75rem;">
          <b>Активные блокировки файлов (/data/locks/):</b> ${locks.length} шт.
          ${locks.length > 0 ? `
            <ul style="margin-top:0.5rem; padding-left:1.25rem; font-size:0.8rem;">
              ${locks.map(l => `<li>${l.entityType}/${l.entityId} — 👤 ${l.lockedBy} (${new Date(l.lockedAt).toLocaleTimeString()})</li>`).join('')}
            </ul>
          ` : '<div style="color:var(--text-muted); margin-top:4px;">Нет активных блокировок</div>'}
        </div>
      </div>
    `;

    modal.classList.add('open');
  }

  escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}

window.app = new App();
document.addEventListener('DOMContentLoaded', () => {
  window.app.init();
});
