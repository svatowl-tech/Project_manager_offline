/**
 * Global Corporate Directory Module
 * Capabilities:
 * 1. External Enterprises Directory (Внешние предприятия, контрагенты, заказчики, ведомства)
 * 2. External Employees Directory (Сотрудники и представители других предприятий со склонением падежей)
 * 3. Internal Company Staff (Внутренний штат сотрудников)
 * 4. Contracts & Requisites Registry
 * 5. Interactive Letter & Protocol Automation Engine (Официальные письма, протоколы совещаний, акты)
 * 6. Excel (.xlsx / .csv) Import & Export for all directory sections
 */

class DirectoryModule {
  constructor() {
    this.currentSubTab = 'organizations'; // 'organizations' | 'external_contacts' | 'employees' | 'contracts' | 'generator'
    this.searchQuery = '';
    this.typeFilter = 'all';
    this.editingOrgId = null;
    this.editingExtContactId = null;

    // Generator state
    this.generatorState = {
      docType: 'letter_out', // 'letter_out' | 'protocol' | 'act' | 'memo'
      orgId: '',
      extContactId: '',
      internalSignerId: 'emp_1',
      docNum: 'Исх-104/26',
      docDate: new Date().toISOString().split('T')[0],
      subject: 'О согласовании рабочей документации и графиков поставки оборудования',
      bodyText: 'Направляем на рассмотрение и согласование комплект рабочей документации и скорректированный календарно-сетевой график поставки оборудования.\n\nПросим в срок до 15 дней утвердить представленные материалы либо направить мотивированные замечания.',
      protocolLocation: 'г. Москва, Спартаковская пл., 14 / ВКС',
      protocolAgenda: '1. Рассмотрение хода строительно-монтажных работ и пусконаладки.\n2. Устранение замечаний по серверному оборудованию.',
      protocolDecisions: '1. Утвердить скорректированный график СМР со сроком завершения до 15.11.2026.\n2. Произвести поставку 2-й партии оборудования до 25.10.2026.'
    };
  }

  init() {
    this.bindEvents();
    this.bindModals();
    this.render();
  }

  bindEvents() {
    // Subtab switching
    const subtabs = [
      { id: 'dir-subtab-organizations', tab: 'organizations' },
      { id: 'dir-subtab-external-contacts', tab: 'external_contacts' },
      { id: 'dir-subtab-employees', tab: 'employees' },
      { id: 'dir-subtab-contracts', tab: 'contracts' },
      { id: 'dir-subtab-quick-generator', tab: 'generator' }
    ];

    subtabs.forEach(st => {
      const btn = document.getElementById(st.id);
      if (btn) {
        btn.addEventListener('click', () => {
          this.currentSubTab = st.tab;
          subtabs.forEach(item => {
            const b = document.getElementById(item.id);
            if (b) {
              if (item.tab === st.tab) {
                b.classList.add('active');
              } else {
                b.classList.remove('active');
              }
            }
          });
          this.updateControlsForTab();
          this.render();
        });
      }
    });

    // Search filter
    const searchInput = document.getElementById('dir-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        this.render();
      });
    }

    // Type filter
    const typeFilter = document.getElementById('dir-type-filter');
    if (typeFilter) {
      typeFilter.addEventListener('change', (e) => {
        this.typeFilter = e.target.value;
        this.render();
      });
    }

    // Export to Excel
    const btnExport = document.getElementById('btn-export-excel');
    if (btnExport) {
      btnExport.addEventListener('click', () => this.exportToExcel());
    }

    // Import from Excel / CSV
    const btnImport = document.getElementById('btn-import-excel');
    const importFileInput = document.getElementById('dir-import-file-input');

    if (btnImport && importFileInput) {
      btnImport.addEventListener('click', () => {
        importFileInput.click();
      });
      importFileInput.addEventListener('change', (e) => this.handleExcelImport(e));
    }

    // Add new item button
    const btnAddNew = document.getElementById('btn-dir-add-item');
    if (btnAddNew) {
      btnAddNew.addEventListener('click', () => {
        if (this.currentSubTab === 'organizations') {
          this.openOrganizationModal(null);
        } else if (this.currentSubTab === 'external_contacts') {
          this.openExternalContactModal(null);
        } else if (this.currentSubTab === 'employees') {
          window.employeesModule.openEmployeeModal(null);
        } else if (this.currentSubTab === 'contracts') {
          window.contractsModule.openContractModal(null);
        } else if (this.currentSubTab === 'generator') {
          this.generateWordDocument();
        }
      });
    }
  }

  updateControlsForTab() {
    const searchInput = document.getElementById('dir-search-input');
    const typeFilter = document.getElementById('dir-type-filter');
    const btnAddNew = document.getElementById('btn-dir-add-item');

    if (this.currentSubTab === 'organizations') {
      if (searchInput) {
        searchInput.style.display = 'inline-block';
        searchInput.placeholder = '🔍 Поиск по названию, ИНН, руководителю...';
      }
      if (typeFilter) {
        typeFilter.style.display = 'inline-block';
        typeFilter.innerHTML = `
          <option value="all">Все типы предприятий</option>
          <option value="customer">Заказчики</option>
          <option value="general_contractor">Генподрядчики</option>
          <option value="subcontractor">Субподрядчики</option>
          <option value="supplier">Поставщики</option>
          <option value="designer">Проектировщики</option>
          <option value="authority">Госорганы / Ведомства</option>
          <option value="partner">Партнеры</option>
        `;
        typeFilter.value = 'all';
      }
      if (btnAddNew) {
        btnAddNew.style.display = 'inline-flex';
        btnAddNew.textContent = '➕ Добавить предприятие';
      }
    } else if (this.currentSubTab === 'external_contacts') {
      if (searchInput) {
        searchInput.style.display = 'inline-block';
        searchInput.placeholder = '🔍 Поиск по ФИО, организации, должности...';
      }
      if (typeFilter) {
        typeFilter.style.display = 'inline-block';
        typeFilter.innerHTML = `
          <option value="all">Все роли / категории</option>
          <option value="head">Руководители</option>
          <option value="gip">ГИПы и гл. инженеры</option>
          <option value="curator">Кураторы проектов</option>
          <option value="engineer">Инженеры / Специалисты</option>
          <option value="lawyer">Юристы / Подписанты</option>
        `;
        typeFilter.value = 'all';
      }
      if (btnAddNew) {
        btnAddNew.style.display = 'inline-flex';
        btnAddNew.textContent = '➕ Добавить представителя';
      }
    } else if (this.currentSubTab === 'employees') {
      if (searchInput) {
        searchInput.style.display = 'inline-block';
        searchInput.placeholder = '🔍 Поиск по ФИО или отделу...';
      }
      if (typeFilter) typeFilter.style.display = 'none';
      if (btnAddNew) {
        btnAddNew.style.display = 'inline-flex';
        btnAddNew.textContent = '➕ Добавить сотрудника';
      }
    } else if (this.currentSubTab === 'contracts') {
      if (searchInput) {
        searchInput.style.display = 'inline-block';
        searchInput.placeholder = '🔍 Поиск по контрагенту, номеру, ИНН...';
      }
      if (typeFilter) typeFilter.style.display = 'none';
      if (btnAddNew) {
        btnAddNew.style.display = 'inline-flex';
        btnAddNew.textContent = '➕ Новый договор';
      }
    } else if (this.currentSubTab === 'generator') {
      if (searchInput) searchInput.style.display = 'none';
      if (typeFilter) typeFilter.style.display = 'none';
      if (btnAddNew) {
        btnAddNew.style.display = 'inline-flex';
        btnAddNew.textContent = '📥 Скачать .docx (Word)';
      }
    }
  }

  render() {
    const container = document.getElementById('dir-table-container');
    if (!container) return;

    const { organizations = [], external_contacts = [], employees = [], contracts = [] } = window.storage.cache;

    // Update nav badge
    const badge = document.getElementById('nav-badge-employees');
    if (badge) badge.textContent = organizations.length + external_contacts.length + employees.length;

    if (this.currentSubTab === 'organizations') {
      this.renderOrganizationsTable(container, organizations, external_contacts);
    } else if (this.currentSubTab === 'external_contacts') {
      this.renderExternalContactsTable(container, external_contacts, organizations);
    } else if (this.currentSubTab === 'employees') {
      this.renderEmployeesTable(container, employees);
    } else if (this.currentSubTab === 'contracts') {
      this.renderContractsTable(container, contracts, employees);
    } else if (this.currentSubTab === 'generator') {
      this.renderLetterGenerator(container, organizations, external_contacts, employees);
    }
  }

  // ============================================================
  // 1. ORGANIZATIONS TABLE & CRUD
  // ============================================================

  renderOrganizationsTable(container, organizations, external_contacts) {
    const typeNames = {
      customer: 'Заказчик',
      general_contractor: 'Генподрядчик',
      subcontractor: 'Субподрядчик',
      supplier: 'Поставщик',
      designer: 'Проектировщик',
      authority: 'Госорган',
      partner: 'Партнер'
    };

    const typeBadges = {
      customer: 'badge-status-in_progress',
      general_contractor: 'badge-high',
      subcontractor: 'badge-medium',
      supplier: 'badge-low',
      designer: 'badge-status-review',
      authority: 'badge-overdue',
      partner: 'badge-status-done'
    };

    const filtered = organizations.filter(org => {
      if (this.typeFilter !== 'all' && org.type !== this.typeFilter) return false;
      if (this.searchQuery) {
        const text = `${org.shortName || ''} ${org.fullName || ''} ${org.inn || ''} ${org.headName || ''} ${org.email || ''} ${org.folderCode || ''}`.toLowerCase();
        if (!text.includes(this.searchQuery)) return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 3.5rem 1rem; color: var(--text-muted);">
          <div style="font-size: 2.2rem; margin-bottom: 0.5rem;">🏢</div>
          <div style="font-weight: 600; font-size: 1rem; color: var(--text-primary); margin-bottom: 0.35rem;">Предприятия не найдены</div>
          <p style="font-size: 0.85rem; margin-bottom: 1rem;">Добавьте организации для ведения единого реестра и автозаполнения писем.</p>
          <button class="btn btn-primary btn-sm" onclick="window.directoryModule.openOrganizationModal(null)">
            ➕ Добавить предприятие
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th style="width: 25%;">Организация / Предприятие</th>
            <th style="width: 14%;">Тип контрагента</th>
            <th style="width: 15%;">ИНН / КПП / ОГРН</th>
            <th style="width: 20%;">Руководитель / Подписант</th>
            <th style="width: 16%;">Контакты / Канцелярия</th>
            <th style="width: 10%; text-align: right;">Действия</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map(org => {
            const extCount = external_contacts.filter(c => c.organizationId === org.id).length;
            const typeLabel = typeNames[org.type] || org.type || 'Контрагент';
            const badgeClass = typeBadges[org.type] || 'badge-low';

            return `
              <tr>
                <td>
                  <div style="font-weight: 700; color: var(--text-primary); font-size: 0.88rem;">${this.escapeHtml(org.shortName)}</div>
                  <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">
                    ${this.truncateText(org.fullName || org.legalAddress || '', 42)}
                  </div>
                  ${org.folderCode ? `
                    <span class="tag-chip" style="font-size: 0.68rem; margin-top: 4px; display: inline-block;">
                      📁 /${this.escapeHtml(org.folderCode)}/
                    </span>
                  ` : ''}
                </td>
                <td>
                  <span class="badge ${badgeClass}">${typeLabel}</span>
                  <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">
                    👥 Контактов: <b>${extCount}</b>
                  </div>
                </td>
                <td>
                  <div style="font-size: 0.82rem; font-family: monospace;"><b>ИНН:</b> ${this.escapeHtml(org.inn || '—')}</div>
                  <div style="font-size: 0.75rem; color: var(--text-muted); font-family: monospace;">КПП: ${this.escapeHtml(org.kpp || '—')}</div>
                  <div style="font-size: 0.72rem; color: var(--text-muted); font-family: monospace;">БИК: ${this.escapeHtml(org.bik || '—')}</div>
                </td>
                <td>
                  <div style="font-weight: 600; font-size: 0.85rem; color: var(--text-primary);">${this.escapeHtml(org.headName || '—')}</div>
                  <div style="font-size: 0.76rem; color: var(--text-muted);">${this.escapeHtml(org.headRole || 'Руководитель')}</div>
                  <div style="font-size: 0.72rem; color: var(--text-secondary);">Основание: на основании ${this.escapeHtml(org.charterBasis || 'Устава')}</div>
                </td>
                <td>
                  <div style="font-size: 0.8rem;">✉️ <a href="mailto:${this.escapeHtml(org.email)}" style="color: var(--accent-primary);">${this.escapeHtml(org.email || '—')}</a></div>
                  <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 2px;">📞 ${this.escapeHtml(org.phone || '—')}</div>
                </td>
                <td style="text-align: right;">
                  <div style="display: flex; gap: 4px; justify-content: flex-end;">
                    <button class="btn btn-sm btn-primary" title="Составить письмо в эту организацию" onclick="window.directoryModule.startLetterToOrg('${org.id}')">
                      ✉️
                    </button>
                    <button class="btn btn-sm" title="Редактировать реквизиты" onclick="window.directoryModule.openOrganizationModal('${org.id}')">
                      ✏️
                    </button>
                  </div>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  }

  // ============================================================
  // 2. EXTERNAL CONTACTS TABLE & CRUD
  // ============================================================

  renderExternalContactsTable(container, contacts, organizations) {
    const categoryNames = {
      head: 'Руководитель / Подписант',
      gip: 'ГИП / Гл. инженер',
      curator: 'Куратор проекта',
      engineer: 'Инженер / Специалист',
      lawyer: 'Юрист / Договорной отдел',
      secretary: 'Секретарь / Канцелярия'
    };

    const filtered = contacts.filter(c => {
      if (this.typeFilter !== 'all' && c.category !== this.typeFilter) return false;
      if (this.searchQuery) {
        const text = `${c.name || ''} ${c.organizationName || ''} ${c.role || ''} ${c.email || ''} ${c.phone || ''} ${c.nameDative || ''}`.toLowerCase();
        if (!text.includes(this.searchQuery)) return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 3.5rem 1rem; color: var(--text-muted);">
          <div style="font-size: 2.2rem; margin-bottom: 0.5rem;">👥</div>
          <div style="font-weight: 600; font-size: 1rem; color: var(--text-primary); margin-bottom: 0.35rem;">Представители сторонних организаций не найдены</div>
          <p style="font-size: 0.85rem; margin-bottom: 1rem;">Добавьте контактных лиц и представителей для автоматизации писем и протоколов.</p>
          <button class="btn btn-primary btn-sm" onclick="window.directoryModule.openExternalContactModal(null)">
            ➕ Добавить представителя
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th style="width: 25%;">ФИО представителя</th>
            <th style="width: 22%;">Предприятие / Организация</th>
            <th style="width: 18%;">Должность и роль</th>
            <th style="width: 16%;">Склонение (Кому)</th>
            <th style="width: 11%;">Контакты</th>
            <th style="width: 8%; text-align: right;">Действия</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map(c => {
            const org = organizations.find(o => o.id === c.organizationId) || { shortName: c.organizationName || '—' };
            const catLabel = categoryNames[c.category] || 'Специалист';

            return `
              <tr>
                <td>
                  <div style="font-weight: 700; color: var(--text-primary); font-size: 0.88rem;">${this.escapeHtml(c.name)}</div>
                  <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">
                    ${c.salutation ? `<i>«${this.escapeHtml(c.salutation)}»</i>` : ''}
                  </div>
                  ${c.isSignatory ? `
                    <span class="badge badge-status-done" style="font-size: 0.68rem; margin-top: 3px; display: inline-block;">
                      ✍️ Право подписи
                    </span>
                  ` : ''}
                </td>
                <td>
                  <div style="font-weight: 600; font-size: 0.85rem; color: var(--accent-primary);">
                    🏢 ${this.escapeHtml(org.shortName)}
                  </div>
                  <div style="font-size: 0.74rem; color: var(--text-muted); margin-top: 2px;">
                    ${this.escapeHtml(c.cabinet || 'Офис')}
                  </div>
                </td>
                <td>
                  <div style="font-weight: 600; font-size: 0.82rem; color: var(--text-primary);">${this.escapeHtml(c.role || '—')}</div>
                  <span class="tag-chip" style="font-size: 0.7rem; margin-top: 3px; display: inline-block;">${catLabel}</span>
                  ${c.powerOfAttorney ? `
                    <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 2px;">${this.escapeHtml(c.powerOfAttorney)}</div>
                  ` : ''}
                </td>
                <td>
                  <div style="font-size: 0.8rem; color: var(--text-secondary);">
                    <b>Кому:</b> ${this.escapeHtml(c.nameDative || c.name)}
                  </div>
                  <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">
                    ${this.escapeHtml(c.roleDative || c.role || '')}
                  </div>
                </td>
                <td>
                  <div style="font-size: 0.8rem;">✉️ <a href="mailto:${this.escapeHtml(c.email)}" style="color: var(--accent-primary);">${this.escapeHtml(c.email || '—')}</a></div>
                  <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 2px;">📱 ${this.escapeHtml(c.mobile || c.phone || '—')}</div>
                </td>
                <td style="text-align: right;">
                  <div style="display: flex; gap: 4px; justify-content: flex-end;">
                    <button class="btn btn-sm btn-primary" title="Создать письмо адресату" onclick="window.directoryModule.startLetterToContact('${c.id}')">
                      ✉️
                    </button>
                    <button class="btn btn-sm" title="Редактировать карточку" onclick="window.directoryModule.openExternalContactModal('${c.id}')">
                      ✏️
                    </button>
                  </div>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  }

  // ============================================================
  // 3. INTERNAL EMPLOYEES & CONTRACTS (BACKWARD COMPATIBLE)
  // ============================================================

  renderEmployeesTable(container, employees) {
    const filtered = employees.filter(e => {
      if (!this.searchQuery) return true;
      return (e.name || '').toLowerCase().includes(this.searchQuery) ||
             (e.role || '').toLowerCase().includes(this.searchQuery) ||
             (e.department || '').toLowerCase().includes(this.searchQuery) ||
             (e.email || '').toLowerCase().includes(this.searchQuery);
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 3rem; color: var(--text-muted);">
          <div>Штатные сотрудники не найдены.</div>
          <button class="btn btn-primary btn-sm" style="margin-top: 0.75rem;" onclick="window.employeesModule.openEmployeeModal(null)">➕ Добавить сотрудника</button>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>ФИО сотрудника</th>
            <th>Должность</th>
            <th>Подразделение</th>
            <th>Контакты</th>
            <th>Ставка ФОТ</th>
            <th>Статус</th>
            <th style="text-align: right;">Действия</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map(e => `
            <tr>
              <td><b>${this.escapeHtml(e.name)}</b></td>
              <td>${this.escapeHtml(e.role || '—')}</td>
              <td>${this.escapeHtml(e.department || '—')}</td>
              <td>
                <div style="font-size: 0.8rem;">${this.escapeHtml(e.phone || '—')}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">${this.escapeHtml(e.email || '')}</div>
              </td>
              <td>${e.rate ? e.rate + ' ₽/ч' : '—'}</td>
              <td>
                <span class="badge ${e.status === 'active' ? 'badge-status-done' : 'badge-status-review'}">
                  ${e.status === 'active' ? 'В строю' : (e.status === 'vacation' ? 'Отпуск' : 'Больничный')}
                </span>
              </td>
              <td style="text-align: right;">
                <button class="btn btn-sm" onclick="window.employeesModule.openEmployeeModal('${e.id}')">✏️ Редактировать</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  renderContractsTable(container, contracts, employees) {
    const filtered = contracts.filter(c => {
      if (!this.searchQuery) return true;
      return (c.number || '').toLowerCase().includes(this.searchQuery) ||
             (c.counterparty || '').toLowerCase().includes(this.searchQuery) ||
             (c.title || '').toLowerCase().includes(this.searchQuery) ||
             (c.inn || '').toLowerCase().includes(this.searchQuery);
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 3rem; color: var(--text-muted);">
          <div>Договоры не найдены.</div>
          <button class="btn btn-primary btn-sm" style="margin-top: 0.75rem;" onclick="window.contractsModule.openContractModal(null)">➕ Добавить договор</button>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Номер и тип</th>
            <th>Контрагент и ИНН</th>
            <th>Предмет договора</th>
            <th>Сумма (с НДС)</th>
            <th>Сроки действия</th>
            <th>Куратор</th>
            <th style="text-align: right;">Действия</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map(c => {
            const curator = employees.find(e => e.id === c.responsibleId) || { name: '—' };
            const formattedSum = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(c.sum || 0);

            return `
              <tr>
                <td>
                  <b>${this.escapeHtml(c.number || 'Б/Н')}</b>
                  <div style="font-size: 0.75rem; color: var(--text-muted);">${this.escapeHtml(c.type || 'Поставка')}</div>
                </td>
                <td>
                  <div><b>${this.escapeHtml(c.counterparty || '—')}</b></div>
                  <div style="font-size: 0.75rem; color: var(--text-muted); font-family: monospace;">ИНН: ${this.escapeHtml(c.inn || '—')}</div>
                </td>
                <td>${this.truncateText(c.title || '—', 35)}</td>
                <td><b style="color: var(--accent-primary);">${formattedSum}</b></td>
                <td>
                  <div style="font-size: 0.8rem;">${c.startDate || '—'} — ${c.endDate || '—'}</div>
                </td>
                <td>${this.escapeHtml(curator.name)}</td>
                <td style="text-align: right;">
                  <button class="btn btn-sm" onclick="window.contractsModule.openContractModal('${c.id}')">✏️ Открыть</button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  }

  // ============================================================
  // 4. INTERACTIVE LETTER & PROTOCOL AUTOMATION GENERATOR
  // ============================================================

  renderLetterGenerator(container, organizations, external_contacts, employees) {
    if (!this.generatorState.orgId && organizations.length > 0) {
      this.generatorState.orgId = organizations[0].id;
    }

    const currentOrg = organizations.find(o => o.id === this.generatorState.orgId) || organizations[0] || {};
    const orgContacts = external_contacts.filter(c => c.organizationId === currentOrg.id);

    if (!this.generatorState.extContactId && orgContacts.length > 0) {
      this.generatorState.extContactId = orgContacts[0].id;
    }

    const currentContact = orgContacts.find(c => c.id === this.generatorState.extContactId) || orgContacts[0] || {};
    const currentSigner = employees.find(e => e.id === this.generatorState.internalSignerId) || employees[0] || { name: 'Соколов В.П.', role: 'Руководитель направления' };

    container.innerHTML = `
      <div style="display: grid; grid-template-columns: 420px 1fr; gap: 1.25rem; height: 100%; min-height: 520px; overflow: hidden;">
        
        <!-- Left: Form Controls -->
        <div class="calc-card" style="overflow-y: auto; padding: 1.25rem; display: flex; flex-direction: column; gap: 0.85rem;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <h3 style="font-size: 1.05rem; font-weight: 700; color: var(--text-primary);">⚡ Генератор документов</h3>
            <span class="badge badge-status-done">Автошаблоны</span>
          </div>

          <div class="form-group">
            <label class="form-label">1. Тип документа:</label>
            <select id="gen-field-doctype" class="form-control">
              <option value="letter_out" ${this.generatorState.docType === 'letter_out' ? 'selected' : ''}>✉️ Официальное исходящее письмо</option>
              <option value="protocol" ${this.generatorState.docType === 'protocol' ? 'selected' : ''}>📋 Протокол совместного совещания</option>
              <option value="act" ${this.generatorState.docType === 'act' ? 'selected' : ''}>📑 Акт сдачи-приемки работ</option>
              <option value="memo" ${this.generatorState.docType === 'memo' ? 'selected' : ''}>📄 Внутренняя служебная записка</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">2. Адресат: Стороннее предприятие</label>
            <select id="gen-field-org" class="form-control">
              ${organizations.map(o => `
                <option value="${o.id}" ${o.id === this.generatorState.orgId ? 'selected' : ''}>
                  ${this.escapeHtml(o.shortName)} (ИНН: ${o.inn})
                </option>
              `).join('')}
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">3. Должностное лицо / Представитель:</label>
            <select id="gen-field-contact" class="form-control">
              ${orgContacts.map(c => `
                <option value="${c.id}" ${c.id === this.generatorState.extContactId ? 'selected' : ''}>
                  ${this.escapeHtml(c.name)} — ${this.escapeHtml(c.role || '')}
                </option>
              `).join('')}
              ${orgContacts.length === 0 ? `<option value="">(У предприятия нет зарегистрированных контактов)</option>` : ''}
            </select>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Исх. № документа:</label>
              <input type="text" id="gen-field-docnum" class="form-control" value="${this.escapeHtml(this.generatorState.docNum)}">
            </div>
            <div class="form-group">
              <label class="form-label">Дата документа:</label>
              <input type="date" id="gen-field-date" class="form-control" value="${this.escapeHtml(this.generatorState.docDate)}">
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Подписант с нашей стороны:</label>
            <select id="gen-field-signer" class="form-control">
              ${employees.map(e => `
                <option value="${e.id}" ${e.id === this.generatorState.internalSignerId ? 'selected' : ''}>
                  ${this.escapeHtml(e.name)} (${this.escapeHtml(e.role || 'Сотрудник')})
                </option>
              `).join('')}
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Тема / Предмет:</label>
            <input type="text" id="gen-field-subject" class="form-control" value="${this.escapeHtml(this.generatorState.subject)}">
          </div>

          ${this.generatorState.docType === 'protocol' ? `
            <div class="form-group">
              <label class="form-label">Место проведения совещания:</label>
              <input type="text" id="gen-field-location" class="form-control" value="${this.escapeHtml(this.generatorState.protocolLocation)}">
            </div>
            <div class="form-group">
              <label class="form-label">Повестка дня совещания:</label>
              <textarea id="gen-field-agenda" class="form-control" rows="3">${this.escapeHtml(this.generatorState.protocolAgenda)}</textarea>
            </div>
            <div class="form-group">
              <label class="form-label">Принятые решения и поручения:</label>
              <textarea id="gen-field-decisions" class="form-control" rows="3">${this.escapeHtml(this.generatorState.protocolDecisions)}</textarea>
            </div>
          ` : `
            <div class="form-group">
              <label class="form-label">Текст документа:</label>
              <textarea id="gen-field-body" class="form-control" rows="5">${this.escapeHtml(this.generatorState.bodyText)}</textarea>
            </div>
          `}

          <div style="display: flex; gap: 0.5rem; margin-top: auto; padding-top: 0.75rem;">
            <button class="btn btn-primary" id="btn-gen-download-docx" style="flex: 1;">
              📥 Скачать .docx (Word)
            </button>
            <button class="btn btn-secondary" id="btn-gen-print" style="flex: 1;">
              🖨 Печать / PDF
            </button>
          </div>
        </div>

        <!-- Right: Live Interactive Letterhead Preview -->
        <div class="calc-card" style="overflow-y: auto; padding: 2rem; background: #ffffff; color: #1e293b; font-family: 'Times New Roman', serif; line-height: 1.4; box-shadow: var(--shadow-md); border: 1px solid var(--border-color);">
          <div id="document-preview-render-area">
            ${this.buildPreviewHtml(this.generatorState, currentOrg, currentContact, currentSigner)}
          </div>
        </div>

      </div>
    `;

    this.bindGeneratorEvents();
  }

  buildPreviewHtml(state, org, contact, signer) {
    const formattedDate = this.formatRussianDate(state.docDate);

    if (state.docType === 'protocol') {
      return `
        <div style="text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 0.75rem; margin-bottom: 1.5rem;">
          <div style="font-size: 13pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">
            АКЦИОНЕРНОЕ ОБЩЕСТВО «СИСТЕМЫ И ПРИБОРЫ»
          </div>
          <div style="font-size: 10pt; color: #475569; margin-top: 3px;">
            г. Москва, ул. Производственная, 18 | Тел: +7 (495) 700-10-00 | info@corp.ru
          </div>
        </div>

        <div style="text-align: center; margin-bottom: 1.5rem;">
          <div style="font-size: 15pt; font-weight: bold; text-transform: uppercase;">ПРОТОКОЛ</div>
          <div style="font-size: 12pt; font-weight: bold;">СОВМЕСТНОГО РАБОЧЕГО СОВЕЩАНИЯ № ${this.escapeHtml(state.docNum)}</div>
          <div style="font-size: 11pt; color: #334155; margin-top: 4px;">${this.escapeHtml(state.subject)}</div>
        </div>

        <div style="display: flex; justify-content: space-between; font-size: 11pt; margin-bottom: 1rem; border-bottom: 1px solid #cbd5e1; padding-bottom: 0.5rem;">
          <div><b>Дата:</b> ${formattedDate}</div>
          <div><b>Место проведения:</b> ${this.escapeHtml(state.protocolLocation)}</div>
        </div>

        <div style="margin-bottom: 1.25rem; font-size: 11pt;">
          <div style="font-weight: bold; margin-bottom: 0.35rem;">ПРИСУТСТВОВАЛИ:</div>
          <table style="width: 100%; border-collapse: collapse; font-size: 10.5pt; margin-bottom: 0.75rem;">
            <tr style="background: #f1f5f9;">
              <td style="padding: 4px 8px; border: 1px solid #cbd5e1; font-weight: bold;">От Исполнителя (АО «Системы и приборы»):</td>
              <td style="padding: 4px 8px; border: 1px solid #cbd5e1;">${this.escapeHtml(signer.name)} — ${this.escapeHtml(signer.role || 'Руководитель')}</td>
            </tr>
            <tr>
              <td style="padding: 4px 8px; border: 1px solid #cbd5e1; font-weight: bold;">От ${this.escapeHtml(org.shortName || 'Заказчика')}:</td>
              <td style="padding: 4px 8px; border: 1px solid #cbd5e1;">
                ${this.escapeHtml(contact.name || org.headName || '—')} — ${this.escapeHtml(contact.role || org.headRole || 'Представитель')}
                ${contact.powerOfAttorney ? ` (${this.escapeHtml(contact.powerOfAttorney)})` : ''}
              </td>
            </tr>
          </table>
        </div>

        <div style="margin-bottom: 1.25rem; font-size: 11pt;">
          <div style="font-weight: bold; margin-bottom: 0.35rem;">ПОВЕСТКА ДНЯ:</div>
          <div style="white-space: pre-line; background: #f8fafc; padding: 0.6rem 0.85rem; border: 1px solid #e2e8f0; border-radius: 4px;">
            ${this.escapeHtml(state.protocolAgenda)}
          </div>
        </div>

        <div style="margin-bottom: 1.5rem; font-size: 11pt;">
          <div style="font-weight: bold; margin-bottom: 0.35rem;">ПОСТАНОВИЛИ (РЕШЕНИЯ И ПОРУЧЕНИЯ):</div>
          <div style="white-space: pre-line; background: #f8fafc; padding: 0.6rem 0.85rem; border: 1px solid #e2e8f0; border-radius: 4px;">
            ${this.escapeHtml(state.protocolDecisions)}
          </div>
        </div>

        <div style="margin-top: 2.5rem; display: flex; justify-content: space-between; font-size: 11pt;">
          <div style="width: 45%;">
            <div><b>От АО «Системы и приборы»:</b></div>
            <div style="margin-top: 2rem; border-top: 1px solid #000; padding-top: 4px;">
              ${this.escapeHtml(signer.role || 'Руководитель')} / ${this.escapeHtml(signer.name)}
            </div>
          </div>
          <div style="width: 45%;">
            <div><b>От ${this.escapeHtml(org.shortName || 'Организации')}:</b></div>
            <div style="margin-top: 2rem; border-top: 1px solid #000; padding-top: 4px;">
              ${this.escapeHtml(contact.role || org.headRole || 'Представитель')} / ${this.escapeHtml(contact.name || org.headName || '')}
            </div>
          </div>
        </div>
      `;
    }

    // Default: Official Letter (Исходящее письмо)
    const dativeAddressee = contact.nameDative || (contact.name ? contact.name : (org.headNameDative || org.headName || 'Руководителю'));
    const dativeRole = contact.roleDative || (contact.role ? contact.role : (org.headRoleDative || org.headRole || ''));
    const salutation = contact.salutation || `Уважаемый ${contact.name ? contact.name.split(' ')[1] || '' : 'руководитель'}!`;

    return `
      <!-- Corporate Letterhead Header -->
      <div style="border-bottom: 2px solid #0f172a; padding-bottom: 0.75rem; margin-bottom: 1.25rem;">
        <div style="font-size: 13pt; font-weight: bold; text-transform: uppercase; color: #0f172a;">
          АКЦИОНЕРНОЕ ОБЩЕСТВО «СИСТЕМЫ И ПРИБОРЫ»
        </div>
        <div style="font-size: 9.5pt; color: #475569; margin-top: 2px;">
          105082, г. Москва, Спартаковская пл., д. 14 | ИНН 7701998877 | КПП 770101001
        </div>
        <div style="font-size: 9.5pt; color: #475569;">
          Тел.: +7 (495) 700-10-00 | E-mail: info@corp.ru | Сайт: www.corp.ru
        </div>
      </div>

      <!-- Outgoing Registration and Addressee Block -->
      <div style="display: flex; justify-content: space-between; margin-bottom: 1.5rem; font-size: 11pt;">
        <div style="width: 45%;">
          <div><b>Исх. №:</b> ${this.escapeHtml(state.docNum)}</div>
          <div><b>Дата:</b> ${formattedDate}</div>
        </div>
        <div style="width: 50%; text-align: right; line-height: 1.35;">
          <div style="font-weight: bold; font-size: 11.5pt; color: #0f172a;">${this.escapeHtml(dativeRole)}</div>
          <div style="font-weight: bold; color: #0f172a;">${this.escapeHtml(org.fullName || org.shortName || 'Организация')}</div>
          <div style="font-size: 11pt; color: #1e293b; margin-top: 2px;">${this.escapeHtml(dativeAddressee)}</div>
          ${org.legalAddress ? `<div style="font-size: 9pt; color: #64748b; margin-top: 3px;">${this.escapeHtml(org.legalAddress)}</div>` : ''}
        </div>
      </div>

      <!-- Subject / Re -->
      <div style="font-size: 11pt; margin-bottom: 1.5rem;">
        <b>Тема:</b> ${this.escapeHtml(state.subject)}
      </div>

      <!-- Salutation -->
      <div style="font-size: 12pt; text-align: center; font-weight: bold; margin-bottom: 1.25rem;">
        ${this.escapeHtml(salutation)}
      </div>

      <!-- Main Body Text -->
      <div style="font-size: 11pt; text-indent: 1.5rem; text-align: justify; white-space: pre-line; line-height: 1.5; margin-bottom: 2.5rem;">
        ${this.escapeHtml(state.bodyText)}
      </div>

      <!-- Signatures -->
      <div style="display: flex; justify-content: space-between; align-items: flex-end; font-size: 11pt; margin-top: 3rem;">
        <div>
          <div style="font-weight: bold;">${this.escapeHtml(signer.role || 'Руководитель направления')}</div>
          <div style="font-size: 9pt; color: #64748b;">АО «Системы и приборы»</div>
        </div>
        <div style="text-align: right;">
          <div style="font-weight: bold;">${this.escapeHtml(signer.name)}</div>
          <div style="font-size: 8.5pt; color: #64748b; font-style: italic;">(подпись / ЭЦП)</div>
        </div>
      </div>

      <!-- Footer Contact Note -->
      <div style="margin-top: 2rem; font-size: 8.5pt; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 4px;">
        Исполнитель: ${this.escapeHtml(signer.name)}, тел.: +7 (495) 700-10-01, e-mail: ${this.escapeHtml(signer.email || 'sokolov@corp.ru')}
      </div>
    `;
  }

  bindGeneratorEvents() {
    const docTypeSelect = document.getElementById('gen-field-doctype');
    const orgSelect = document.getElementById('gen-field-org');
    const contactSelect = document.getElementById('gen-field-contact');
    const signerSelect = document.getElementById('gen-field-signer');
    const docNumInput = document.getElementById('gen-field-docnum');
    const dateInput = document.getElementById('gen-field-date');
    const subjectInput = document.getElementById('gen-field-subject');
    const bodyInput = document.getElementById('gen-field-body');
    const agendaInput = document.getElementById('gen-field-agenda');
    const decisionsInput = document.getElementById('gen-field-decisions');
    const locationInput = document.getElementById('gen-field-location');

    const updatePreview = () => {
      this.generatorState.docType = docTypeSelect?.value || 'letter_out';
      this.generatorState.orgId = orgSelect?.value || '';
      this.generatorState.extContactId = contactSelect?.value || '';
      this.generatorState.internalSignerId = signerSelect?.value || '';
      this.generatorState.docNum = docNumInput?.value || '';
      this.generatorState.docDate = dateInput?.value || '';
      this.generatorState.subject = subjectInput?.value || '';
      if (bodyInput) this.generatorState.bodyText = bodyInput.value;
      if (agendaInput) this.generatorState.protocolAgenda = agendaInput.value;
      if (decisionsInput) this.generatorState.protocolDecisions = decisionsInput.value;
      if (locationInput) this.generatorState.protocolLocation = locationInput.value;

      const { organizations = [], external_contacts = [], employees = [] } = window.storage.cache;
      const org = organizations.find(o => o.id === this.generatorState.orgId) || {};
      const contact = external_contacts.find(c => c.id === this.generatorState.extContactId) || {};
      const signer = employees.find(e => e.id === this.generatorState.internalSignerId) || {};

      const previewArea = document.getElementById('document-preview-render-area');
      if (previewArea) {
        previewArea.innerHTML = this.buildPreviewHtml(this.generatorState, org, contact, signer);
      }
    };

    [docTypeSelect, orgSelect, signerSelect].forEach(el => {
      el?.addEventListener('change', () => {
        if (el === orgSelect || el === docTypeSelect) {
          this.render();
        } else {
          updatePreview();
        }
      });
    });

    [contactSelect, docNumInput, dateInput, subjectInput, bodyInput, agendaInput, decisionsInput, locationInput].forEach(el => {
      el?.addEventListener('input', updatePreview);
    });

    // Download .docx button
    document.getElementById('btn-gen-download-docx')?.addEventListener('click', () => {
      this.generateWordDocument();
    });

    // Print button
    document.getElementById('btn-gen-print')?.addEventListener('click', () => {
      this.printDocument();
    });
  }

  generateWordDocument() {
    const { organizations = [], external_contacts = [], employees = [] } = window.storage.cache;
    const org = organizations.find(o => o.id === this.generatorState.orgId) || {};
    const contact = external_contacts.find(c => c.id === this.generatorState.extContactId) || {};
    const signer = employees.find(e => e.id === this.generatorState.internalSignerId) || { name: 'Соколов В.П.', role: 'Руководитель' };

    const docType = this.generatorState.docType;
    const isProtocol = docType === 'protocol';

    const docTitle = isProtocol ? `Протокол_№_${this.generatorState.docNum.replace(/[^a-zA-Zа-яА-Я0-9]/g, '_')}` : `Письмо_${org.shortName?.replace(/[^a-zA-Zа-яА-Я0-9]/g, '_')}_${this.generatorState.docNum.replace(/[^a-zA-Zа-яА-Я0-9]/g, '_')}`;

    // Generate compliant Word XML document (.docx compatible)
    const xmlContent = isProtocol ? `
      <w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="28"/></w:rPr><w:t>ПРОТОКОЛ РАБОЧЕГО СОВЕЩАНИЯ № ${this.escapeHtml(this.generatorState.docNum)}</w:t></w:r></w:p>
      <w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="24"/></w:rPr><w:t>${this.escapeHtml(this.generatorState.subject)}</w:t></w:r></w:p>
      <w:p><w:r><w:t>Дата: ${this.escapeHtml(this.generatorState.docDate)} | Место: ${this.escapeHtml(this.generatorState.protocolLocation)}</w:t></w:r></w:p>
      <w:p><w:r><w:rPr><w:b/></w:rPr><w:t>ПРИСУТСТВОВАЛИ:</w:t></w:r></w:p>
      <w:p><w:r><w:t>От Исполнителя: ${this.escapeHtml(signer.name)} (${this.escapeHtml(signer.role)})</w:t></w:r></w:p>
      <w:p><w:r><w:t>От ${this.escapeHtml(org.shortName)}: ${this.escapeHtml(contact.name || org.headName || '—')} (${this.escapeHtml(contact.role || org.headRole || '—')})</w:t></w:r></w:p>
      <w:p><w:r><w:rPr><w:b/></w:rPr><w:t>ПОВЕСТКА ДНЯ:</w:t></w:r></w:p>
      <w:p><w:r><w:t>${this.escapeHtml(this.generatorState.protocolAgenda)}</w:t></w:r></w:p>
      <w:p><w:r><w:rPr><w:b/></w:rPr><w:t>ПОСТАНОВИЛИ:</w:t></w:r></w:p>
      <w:p><w:r><w:t>${this.escapeHtml(this.generatorState.protocolDecisions)}</w:t></w:r></w:p>
    ` : `
      <w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="28"/></w:rPr><w:t>АКЦИОНЕРНОЕ ОБЩЕСТВО «СИСТЕМЫ И ПРИБОРЫ»</w:t></w:r></w:p>
      <w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>${this.escapeHtml(contact.roleDative || org.headRoleDative || 'Руководителю')}</w:t></w:r></w:p>
      <w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>${this.escapeHtml(org.fullName || org.shortName)}</w:t></w:r></w:p>
      <w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:t>${this.escapeHtml(contact.nameDative || org.headNameDative || '')}</w:t></w:r></w:p>
      <w:p><w:r><w:t>Исх. № ${this.escapeHtml(this.generatorState.docNum)} от ${this.escapeHtml(this.generatorState.docDate)}</w:t></w:r></w:p>
      <w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Тема: ${this.escapeHtml(this.generatorState.subject)}</w:t></w:r></w:p>
      <w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>${this.escapeHtml(contact.salutation || 'Уважаемый партнер!')}</w:t></w:r></w:p>
      <w:p><w:r><w:t>${this.escapeHtml(this.generatorState.bodyText)}</w:t></w:r></w:p>
      <w:p><w:r><w:rPr><w:b/></w:rPr><w:t>${this.escapeHtml(signer.role)}: ${this.escapeHtml(signer.name)}</w:t></w:r></w:p>
    `;

    // Download as HTML-formatted Word doc (.doc / .docx compatible)
    const previewEl = document.getElementById('document-preview-render-area');
    const docHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${this.escapeHtml(docTitle)}</title>
        <style>
          body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.4; color: #000; padding: 2cm; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #000; padding: 6px; }
        </style>
      </head>
      <body>
        ${previewEl ? previewEl.innerHTML : xmlContent}
      </body>
      </html>
    `;

    const blob = new Blob([docHtml], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${docTitle}_${new Date().toISOString().split('T')[0]}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    window.app.showToast(`Документ «${docTitle}» успешно сформирован и сохранен`, 'success');
  }

  printDocument() {
    const previewEl = document.getElementById('document-preview-render-area');
    if (!previewEl) return;

    const printWin = window.open('', '_blank');
    if (!printWin) {
      window.print();
      return;
    }

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Печать документа</title>
        <style>
          body { font-family: 'Times New Roman', serif; font-size: 11.5pt; line-height: 1.4; color: #000; margin: 1.5cm; }
          @media print {
            body { margin: 1cm; }
          }
        </style>
      </head>
      <body>
        ${previewEl.innerHTML}
        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `);
    printWin.document.close();
  }

  startLetterToOrg(orgId) {
    this.currentSubTab = 'generator';
    this.generatorState.orgId = orgId;
    this.generatorState.extContactId = '';
    const subtabs = document.querySelectorAll('#dir-subtabs-group button');
    subtabs.forEach(b => b.classList.remove('active'));
    document.getElementById('dir-subtab-quick-generator')?.classList.add('active');
    this.updateControlsForTab();
    this.render();
    window.app.showToast('Открыт генератор официального письма для выбранной организации', 'info');
  }

  startLetterToContact(contactId) {
    const { external_contacts = [] } = window.storage.cache;
    const contact = external_contacts.find(c => c.id === contactId);
    if (!contact) return;

    this.currentSubTab = 'generator';
    this.generatorState.orgId = contact.organizationId;
    this.generatorState.extContactId = contact.id;

    const subtabs = document.querySelectorAll('#dir-subtabs-group button');
    subtabs.forEach(b => b.classList.remove('active'));
    document.getElementById('dir-subtab-quick-generator')?.classList.add('active');
    this.updateControlsForTab();
    this.render();
    window.app.showToast(`Подготовлен бланк письма адресату: ${contact.name}`, 'info');
  }

  // ============================================================
  // 5. MODAL WINDOWS FOR ORGANIZATIONS & EXTERNAL CONTACTS
  // ============================================================

  bindModals() {
    // 1. Organization Modal
    const orgModal = document.getElementById('organization-modal');
    const closeOrgBtn = document.getElementById('btn-close-org-modal');
    const cancelOrgBtn = document.getElementById('btn-cancel-organization');
    const saveOrgBtn = document.getElementById('btn-save-organization');
    const deleteOrgBtn = document.getElementById('btn-delete-organization');

    const closeOrg = () => {
      orgModal?.classList.remove('open');
      this.editingOrgId = null;
    };

    closeOrgBtn?.addEventListener('click', closeOrg);
    cancelOrgBtn?.addEventListener('click', closeOrg);

    saveOrgBtn?.addEventListener('click', async () => {
      const shortName = document.getElementById('org-form-short-name')?.value.trim();
      const inn = document.getElementById('org-form-inn')?.value.trim();

      if (!shortName || !inn) {
        window.app.showToast('Заполните краткое наименование и ИНН организации', 'error');
        return;
      }

      const orgPayload = {
        id: this.editingOrgId || ('org_' + Date.now()),
        shortName,
        fullName: document.getElementById('org-form-full-name')?.value.trim() || shortName,
        type: document.getElementById('org-form-type')?.value || 'customer',
        inn,
        kpp: document.getElementById('org-form-kpp')?.value.trim() || '',
        ogrn: document.getElementById('org-form-ogrn')?.value.trim() || '',
        okpo: document.getElementById('org-form-okpo')?.value.trim() || '',
        bankName: document.getElementById('org-form-bank-name')?.value.trim() || '',
        bik: document.getElementById('org-form-bik')?.value.trim() || '',
        rs: document.getElementById('org-form-rs')?.value.trim() || '',
        ks: document.getElementById('org-form-ks')?.value.trim() || '',
        legalAddress: document.getElementById('org-form-legal-address')?.value.trim() || '',
        actualAddress: document.getElementById('org-form-actual-address')?.value.trim() || '',
        email: document.getElementById('org-form-email')?.value.trim() || '',
        phone: document.getElementById('org-form-phone')?.value.trim() || '',
        website: document.getElementById('org-form-website')?.value.trim() || '',
        headName: document.getElementById('org-form-head-name')?.value.trim() || '',
        headNameGenitive: document.getElementById('org-form-head-name-gen')?.value.trim() || '',
        headNameDative: document.getElementById('org-form-head-name-dat')?.value.trim() || '',
        headRole: document.getElementById('org-form-head-role')?.value.trim() || '',
        headRoleGenitive: document.getElementById('org-form-head-role-gen')?.value.trim() || '',
        charterBasis: document.getElementById('org-form-charter')?.value.trim() || 'Устава',
        folderCode: document.getElementById('org-form-folder-code')?.value.trim() || shortName.replace(/[^a-zA-Zа-яА-Я0-9]/g, '_'),
        notes: document.getElementById('org-form-notes')?.value.trim() || ''
      };

      try {
        await window.storage.saveEntity('organizations', orgPayload.id, orgPayload);
        window.app.showToast(`Организация «${shortName}» сохранена в справочник`, 'success');
        closeOrg();
        this.render();
      } catch (err) {
        window.app.showToast(`Ошибка сохранения: ${err.message}`, 'error');
      }
    });

    deleteOrgBtn?.addEventListener('click', async () => {
      if (!this.editingOrgId) return;
      if (confirm('Удалить организацию из справочника?')) {
        try {
          await window.storage.deleteEntity('organizations', this.editingOrgId);
          window.app.showToast('Организация удалена', 'info');
          closeOrg();
          this.render();
        } catch (err) {
          window.app.showToast(`Ошибка удаления: ${err.message}`, 'error');
        }
      }
    });

    // 2. External Contact Modal
    const extModal = document.getElementById('external-contact-modal');
    const closeExtBtn = document.getElementById('btn-close-ext-modal');
    const cancelExtBtn = document.getElementById('btn-cancel-external-contact');
    const saveExtBtn = document.getElementById('btn-save-external-contact');
    const deleteExtBtn = document.getElementById('btn-delete-external-contact');

    const closeExt = () => {
      extModal?.classList.remove('open');
      this.editingExtContactId = null;
    };

    closeExtBtn?.addEventListener('click', closeExt);
    cancelExtBtn?.addEventListener('click', closeExt);

    saveExtBtn?.addEventListener('click', async () => {
      const name = document.getElementById('ext-form-name')?.value.trim();
      const orgId = document.getElementById('ext-form-org-id')?.value;

      if (!name || !orgId) {
        window.app.showToast('Заполните ФИО сотрудника и выберите организацию', 'error');
        return;
      }

      const { organizations = [] } = window.storage.cache;
      const org = organizations.find(o => o.id === orgId) || {};

      const extPayload = {
        id: this.editingExtContactId || ('ext_' + Date.now()),
        organizationId: orgId,
        organizationName: org.shortName || '',
        name,
        nameDative: document.getElementById('ext-form-name-dat')?.value.trim() || name,
        nameGenitive: document.getElementById('ext-form-name-gen')?.value.trim() || name,
        salutation: document.getElementById('ext-form-salutation')?.value.trim() || `Уважаемый ${name.split(' ')[1] || ''}!`,
        role: document.getElementById('ext-form-role')?.value.trim() || '',
        roleDative: document.getElementById('ext-form-role-dat')?.value.trim() || '',
        category: document.getElementById('ext-form-category')?.value || 'gip',
        phone: document.getElementById('ext-form-phone')?.value.trim() || '',
        mobile: document.getElementById('ext-form-mobile')?.value.trim() || '',
        email: document.getElementById('ext-form-email')?.value.trim() || '',
        cabinet: document.getElementById('ext-form-cabinet')?.value.trim() || '',
        powerOfAttorney: document.getElementById('ext-form-power')?.value.trim() || '',
        isSignatory: document.getElementById('ext-form-signatory')?.checked || false,
        notes: document.getElementById('ext-form-notes')?.value.trim() || ''
      };

      try {
        await window.storage.saveEntity('external_contacts', extPayload.id, extPayload);
        window.app.showToast(`Представитель «${name}» сохранен в справочник`, 'success');
        closeExt();
        this.render();
      } catch (err) {
        window.app.showToast(`Ошибка сохранения: ${err.message}`, 'error');
      }
    });

    deleteExtBtn?.addEventListener('click', async () => {
      if (!this.editingExtContactId) return;
      if (confirm('Удалить представителя из справочника?')) {
        try {
          await window.storage.deleteEntity('external_contacts', this.editingExtContactId);
          window.app.showToast('Представитель удален', 'info');
          closeExt();
          this.render();
        } catch (err) {
          window.app.showToast(`Ошибка удаления: ${err.message}`, 'error');
        }
      }
    });
  }

  openOrganizationModal(orgId) {
    this.editingOrgId = orgId;
    const modal = document.getElementById('organization-modal');
    const deleteBtn = document.getElementById('btn-delete-organization');
    if (!modal) return;

    let orgData = {
      shortName: '',
      fullName: '',
      type: 'customer',
      inn: '',
      kpp: '',
      ogrn: '',
      okpo: '',
      bankName: '',
      bik: '',
      rs: '',
      ks: '',
      legalAddress: '',
      actualAddress: '',
      email: '',
      phone: '',
      website: '',
      headName: '',
      headNameGenitive: '',
      headNameDative: '',
      headRole: 'Генеральный директор',
      headRoleGenitive: 'Генерального директора',
      charterBasis: 'Устава',
      folderCode: '',
      notes: ''
    };

    if (orgId) {
      const existing = (window.storage.cache.organizations || []).find(o => o.id === orgId);
      if (existing) orgData = { ...orgData, ...existing };
      if (deleteBtn) deleteBtn.style.display = 'inline-flex';
    } else {
      if (deleteBtn) deleteBtn.style.display = 'none';
    }

    document.getElementById('org-form-short-name').value = orgData.shortName || '';
    document.getElementById('org-form-full-name').value = orgData.fullName || '';
    document.getElementById('org-form-type').value = orgData.type || 'customer';
    document.getElementById('org-form-inn').value = orgData.inn || '';
    document.getElementById('org-form-kpp').value = orgData.kpp || '';
    document.getElementById('org-form-ogrn').value = orgData.ogrn || '';
    document.getElementById('org-form-okpo').value = orgData.okpo || '';
    document.getElementById('org-form-bank-name').value = orgData.bankName || '';
    document.getElementById('org-form-bik').value = orgData.bik || '';
    document.getElementById('org-form-rs').value = orgData.rs || '';
    document.getElementById('org-form-ks').value = orgData.ks || '';
    document.getElementById('org-form-legal-address').value = orgData.legalAddress || '';
    document.getElementById('org-form-actual-address').value = orgData.actualAddress || '';
    document.getElementById('org-form-email').value = orgData.email || '';
    document.getElementById('org-form-phone').value = orgData.phone || '';
    document.getElementById('org-form-website').value = orgData.website || '';
    document.getElementById('org-form-head-name').value = orgData.headName || '';
    document.getElementById('org-form-head-name-gen').value = orgData.headNameGenitive || '';
    document.getElementById('org-form-head-name-dat').value = orgData.headNameDative || '';
    document.getElementById('org-form-head-role').value = orgData.headRole || '';
    document.getElementById('org-form-head-role-gen').value = orgData.headRoleGenitive || '';
    document.getElementById('org-form-charter').value = orgData.charterBasis || 'Устава';
    document.getElementById('org-form-folder-code').value = orgData.folderCode || '';
    document.getElementById('org-form-notes').value = orgData.notes || '';

    modal.classList.add('open');
  }

  openExternalContactModal(contactId) {
    this.editingExtContactId = contactId;
    const modal = document.getElementById('external-contact-modal');
    const deleteBtn = document.getElementById('btn-delete-external-contact');
    const orgSelect = document.getElementById('ext-form-org-id');
    if (!modal) return;

    const { organizations = [] } = window.storage.cache;
    if (orgSelect) {
      orgSelect.innerHTML = organizations.map(o => `
        <option value="${o.id}">${this.escapeHtml(o.shortName)} (ИНН: ${o.inn})</option>
      `).join('');
    }

    let cData = {
      organizationId: organizations[0]?.id || '',
      name: '',
      nameDative: '',
      nameGenitive: '',
      salutation: '',
      role: '',
      roleDative: '',
      category: 'gip',
      phone: '',
      mobile: '',
      email: '',
      cabinet: '',
      powerOfAttorney: '',
      isSignatory: true,
      notes: ''
    };

    if (contactId) {
      const existing = (window.storage.cache.external_contacts || []).find(c => c.id === contactId);
      if (existing) cData = { ...cData, ...existing };
      if (deleteBtn) deleteBtn.style.display = 'inline-flex';
    } else {
      if (deleteBtn) deleteBtn.style.display = 'none';
    }

    if (orgSelect) orgSelect.value = cData.organizationId || organizations[0]?.id || '';
    document.getElementById('ext-form-name').value = cData.name || '';
    document.getElementById('ext-form-name-dat').value = cData.nameDative || '';
    document.getElementById('ext-form-name-gen').value = cData.nameGenitive || '';
    document.getElementById('ext-form-salutation').value = cData.salutation || '';
    document.getElementById('ext-form-role').value = cData.role || '';
    document.getElementById('ext-form-role-dat').value = cData.roleDative || '';
    document.getElementById('ext-form-category').value = cData.category || 'gip';
    document.getElementById('ext-form-phone').value = cData.phone || '';
    document.getElementById('ext-form-mobile').value = cData.mobile || '';
    document.getElementById('ext-form-email').value = cData.email || '';
    document.getElementById('ext-form-cabinet').value = cData.cabinet || '';
    document.getElementById('ext-form-power').value = cData.powerOfAttorney || '';
    
    const sigCheck = document.getElementById('ext-form-signatory');
    if (sigCheck) sigCheck.checked = !!cData.isSignatory;

    document.getElementById('ext-form-notes').value = cData.notes || '';

    modal.classList.add('open');
  }

  // ============================================================
  // 6. EXCEL IMPORT & EXPORT
  // ============================================================

  exportToExcel() {
    if (!window.XLSX) {
      window.app.showToast('Библиотека XLSX не загружена', 'error');
      return;
    }

    const { organizations = [], external_contacts = [], employees = [], contracts = [] } = window.storage.cache;
    let dataToExport = [];
    let fileName = `Справочник_${this.currentSubTab}_${new Date().toISOString().split('T')[0]}.xlsx`;

    if (this.currentSubTab === 'organizations') {
      dataToExport = organizations.map(o => ({
        'Краткое наименование': o.shortName,
        'Полное наименование': o.fullName,
        'Тип контрагента': o.type,
        'ИНН': o.inn,
        'КПП': o.kpp,
        'ОГРН': o.ogrn,
        'БИК': o.bik,
        'Банк': o.bankName,
        'Расчетный счет': o.rs,
        'Юридический адрес': o.legalAddress,
        'Фактический адрес': o.actualAddress,
        'Email канцелярии': o.email,
        'Телефон': o.phone,
        'ФИО руководителя': o.headName,
        'Должность руководителя': o.headRole,
        'Основание полномочий': o.charterBasis,
        'Код папки': o.folderCode
      }));
    } else if (this.currentSubTab === 'external_contacts') {
      dataToExport = external_contacts.map(c => ({
        'ФИО': c.name,
        'ФИО (Кому - Дат. падеж)': c.nameDative,
        'ФИО (Род. падеж)': c.nameGenitive,
        'Организация': c.organizationName,
        'Должность': c.role,
        'Должность (Дат. падеж)': c.roleDative,
        'Категория': c.category,
        'Email': c.email,
        'Мобильный': c.mobile,
        'Телефон': c.phone,
        'Обращение': c.salutation,
        'Документ полномочий': c.powerOfAttorney,
        'Право подписи': c.isSignatory ? 'Да' : 'Нет'
      }));
    } else if (this.currentSubTab === 'employees') {
      dataToExport = employees.map(e => ({
        'ФИО': e.name,
        'Должность': e.role,
        'Отдел': e.department,
        'Телефон': e.phone,
        'Email': e.email,
        'Ставка (руб/ч)': e.rate,
        'Статус': e.status
      }));
    } else if (this.currentSubTab === 'contracts') {
      dataToExport = contracts.map(c => ({
        'Номер': c.number,
        'Контрагент': c.counterparty,
        'ИНН': c.inn,
        'КПП': c.kpp,
        'Предмет': c.title,
        'Сумма': c.sum,
        'Дата начала': c.startDate,
        'Срок по': c.endDate,
        'Тип': c.type,
        'Статус': c.status
      }));
    }

    if (dataToExport.length === 0) {
      window.app.showToast('Нет данных для выгрузки', 'warning');
      return;
    }

    const ws = window.XLSX.utils.json_to_sheet(dataToExport);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, 'Реестр');
    window.XLSX.writeFile(wb, fileName);
    window.app.showToast('Таблица успешно экспортирована в Excel', 'success');
  }

  async handleExcelImport(e) {
    const file = e.target.files[0];
    if (!file || !window.XLSX) return;

    try {
      const data = await file.arrayBuffer();
      const wb = window.XLSX.read(data, { type: 'array' });
      const firstSheet = wb.Sheets[wb.SheetNames[0]];
      const rows = window.XLSX.utils.sheet_to_json(firstSheet);

      if (rows.length === 0) {
        window.app.showToast('Файл не содержит строк данных', 'warning');
        return;
      }

      let importedCount = 0;
      for (const [idx, row] of rows.entries()) {
        if (this.currentSubTab === 'organizations') {
          const shortName = row['Краткое наименование'] || row['Название'] || row['Организация'] || row['Наименование'];
          if (shortName) {
            const org = {
              id: 'org_imp_' + Date.now() + '_' + idx,
              shortName,
              fullName: row['Полное наименование'] || shortName,
              type: row['Тип контрагента'] || 'customer',
              inn: String(row['ИНН'] || ''),
              kpp: String(row['КПП'] || ''),
              ogrn: String(row['ОГРН'] || ''),
              bankName: row['Банк'] || '',
              bik: String(row['БИК'] || ''),
              rs: String(row['Расчетный счет'] || ''),
              legalAddress: row['Юридический адрес'] || '',
              email: row['Email'] || row['Email канцелярии'] || '',
              phone: row['Телефон'] || '',
              headName: row['ФИО руководителя'] || '',
              headRole: row['Должность руководителя'] || 'Генеральный директор',
              charterBasis: row['Основание полномочий'] || 'Устава',
              folderCode: row['Код папки'] || shortName.replace(/[^a-zA-Zа-яА-Я0-9]/g, '_')
            };
            await window.storage.saveEntity('organizations', org.id, org);
            importedCount++;
          }
        } else if (this.currentSubTab === 'external_contacts') {
          const name = row['ФИО'] || row['Имя'];
          if (name) {
            const ext = {
              id: 'ext_imp_' + Date.now() + '_' + idx,
              name,
              nameDative: row['ФИО (Кому - Дат. падеж)'] || row['Кому'] || name,
              nameGenitive: row['ФИО (Род. падеж)'] || name,
              organizationName: row['Организация'] || row['Предприятие'] || '',
              role: row['Должность'] || '',
              roleDative: row['Должность (Дат. падеж)'] || '',
              category: row['Категория'] || 'gip',
              email: row['Email'] || '',
              mobile: row['Мобильный'] || row['Телефон'] || '',
              salutation: row['Обращение'] || `Уважаемый ${name.split(' ')[1] || ''}!`,
              isSignatory: row['Право подписи'] === 'Да' || true
            };
            await window.storage.saveEntity('external_contacts', ext.id, ext);
            importedCount++;
          }
        }
      }

      window.app.showToast(`Успешно импортировано ${importedCount} записей из Excel`, 'success');
      this.render();
      e.target.value = '';
    } catch (err) {
      window.app.showToast(`Ошибка импорта Excel: ${err.message}`, 'error');
      e.target.value = '';
    }
  }

  // ============================================================
  // 7. UTILITIES
  // ============================================================

  formatRussianDate(isoDate) {
    if (!isoDate) return '«___» ________ 2026 г.';
    const parts = isoDate.split('-');
    if (parts.length !== 3) return isoDate;
    const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
    const day = parseInt(parts[2], 10);
    const month = months[parseInt(parts[1], 10) - 1] || '';
    const year = parts[0];
    return `«${day < 10 ? '0' + day : day}» ${month} ${year} г.`;
  }

  truncateText(str, maxLen) {
    if (!str) return '';
    return str.length > maxLen ? str.substring(0, maxLen) + '...' : str;
  }

  escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}

window.directoryModule = new DirectoryModule();
