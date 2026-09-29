/**
 * RisksModule: Реестр рисков (RMS - Risk Management System)
 * Стандарты: РП-3, PMBOK Guide, ГОСТ Р ИСО 31000-2019
 * 
 * - Интерактивная матрица 5x5 «Вероятность / Влияние» с цветовыми зонами (Зеленая, Желтая, Красная)
 * - Карточка риска: Владелец (Risk Owner), оценка P(1-5) и I(руб), авторасчет EMV = P * I
 * - Стратегии реагирования: Избегание, Передача, Снижение, Принятие
 * - Экспорт реестра рисков в Excel через SheetJS
 * - Сохранение в сетевую папку /data/risks/risk_*.json
 */

class RisksModule {
  constructor() {
    this.selectedMatrixCell = null; // { p, i }
    this.searchQuery = '';
    this.selectedCategory = 'all';
    this.selectedStatus = 'all';
    this.editingRiskId = null;
  }

  init() {
    window.storage.subscribe(() => {
      if (document.getElementById('tab-risks')?.classList.contains('active')) {
        this.render();
      }
    });
    this.bindModals();
  }

  // ==========================================
  // RENDER MAIN VIEW
  // ==========================================

  render() {
    const container = document.getElementById('tab-risks');
    if (!container) return;

    const { risks = [], employees = [] } = window.storage.cache;
    const nf = (v) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(v || 0);

    // Calculate aggregated stats
    const totalRisks = risks.length;
    const activeRisks = risks.filter(r => r.status === 'active').length;
    const totalEmv = risks.reduce((acc, r) => acc + (r.emv || (r.probability * (r.impactCost || 0) / 5)), 0);
    const criticalRisks = risks.filter(r => (r.probability * (r.impactScore || r.probability || 1)) >= 15).length;

    // Filter risks
    const filteredRisks = risks.filter(r => {
      if (this.selectedCategory !== 'all' && r.category !== this.selectedCategory) return false;
      if (this.selectedStatus !== 'all' && r.status !== this.selectedStatus) return false;
      if (this.selectedMatrixCell) {
        const impactScore = r.impactScore || Math.min(5, Math.max(1, Math.round((r.impactCost || 0) / 3000000)));
        if (r.probability !== this.selectedMatrixCell.p || impactScore !== this.selectedMatrixCell.i) return false;
      }
      if (this.searchQuery) {
        const q = this.searchQuery.toLowerCase();
        return (r.title || '').toLowerCase().includes(q) ||
               (r.ownerName || '').toLowerCase().includes(q) ||
               (r.actions || '').toLowerCase().includes(q);
      }
      return true;
    });

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 1.25rem;">
        
        <!-- Summary Stats Cards -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem;">
          <div class="calc-card" style="padding: 1rem 1.25rem; border-left: 4px solid var(--accent-primary);">
            <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">Всего рисков в реестре</div>
            <div style="font-size: 1.5rem; font-weight: 800; color: var(--text-primary); margin-top: 4px;">${totalRisks}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">Активных в работе: <b>${activeRisks}</b></div>
          </div>

          <div class="calc-card" style="padding: 1rem 1.25rem; border-left: 4px solid var(--accent-danger);">
            <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">Критическая зона (Красные)</div>
            <div style="font-size: 1.5rem; font-weight: 800; color: var(--accent-danger); margin-top: 4px;">${criticalRisks}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">Требуют первоочередных мер</div>
          </div>

          <div class="calc-card" style="padding: 1rem 1.25rem; border-left: 4px solid var(--accent-warning);">
            <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">Совокупный EMV (Ожидаемый ущерб)</div>
            <div style="font-size: 1.5rem; font-weight: 800; color: var(--accent-warning); margin-top: 4px;">${nf(totalEmv)} ₽</div>
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">Резерв на непредвиденные расходы</div>
          </div>

          <div class="calc-card" style="padding: 1rem 1.25rem; border-left: 4px solid var(--accent-success); display: flex; flex-direction: column; justify-content: center; gap: 0.5rem;">
            <button class="btn btn-primary" id="btn-create-risk-card" style="width: 100%;">➕ Идентифицировать риск</button>
            <button class="btn btn-secondary btn-sm" id="btn-export-risks-excel" style="width: 100%;">📥 Экспорт в Excel (XLSX)</button>
          </div>
        </div>

        <!-- 5x5 RISK MATRIX AND FILTERS SECTION -->
        <div style="display: grid; grid-template-columns: 460px 1fr; gap: 1.25rem;">
          
          <!-- Left: 5x5 Heatmap Matrix -->
          <div class="calc-card" style="padding: 1.25rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
              <h3 style="font-size: 0.95rem; font-weight: 700; color: var(--text-primary); margin: 0;">🎯 Матрица 5×5 «Вероятность / Влияние»</h3>
              ${this.selectedMatrixCell ? `
                <button class="btn btn-sm" id="btn-reset-matrix-filter" style="font-size: 0.75rem; padding: 2px 8px;">Сбросить фильтр</button>
              ` : ''}
            </div>

            <div class="risk-matrix-container">
              <div class="matrix-y-label">ВЕРОЯТНОСТЬ (1 - 5) →</div>
              <div class="matrix-grid">
                <!-- Matrix Rows: P=5 down to P=1 -->
                ${[5, 4, 3, 2, 1].map(p => `
                  <div class="matrix-row">
                    <div class="matrix-p-num">${p}</div>
                    ${[1, 2, 3, 4, 5].map(i => {
                      const score = p * i;
                      let zoneClass = 'zone-green';
                      if (score >= 15) zoneClass = 'zone-red';
                      else if (score >= 5) zoneClass = 'zone-yellow';

                      const isSelected = this.selectedMatrixCell && this.selectedMatrixCell.p === p && this.selectedMatrixCell.i === i;
                      const cellRisks = risks.filter(r => {
                        const imp = r.impactScore || Math.min(5, Math.max(1, Math.round((r.impactCost || 0) / 3000000)));
                        return r.probability === p && imp === i;
                      });

                      return `
                        <div class="matrix-cell ${zoneClass} ${isSelected ? 'selected-cell' : ''}" onclick="window.risksModule.filterByCell(${p}, ${i})">
                          <span class="cell-score">${score}</span>
                          ${cellRisks.length > 0 ? `<span class="cell-count-badge">${cellRisks.length}</span>` : ''}
                        </div>
                      `;
                    }).join('')}
                  </div>
                `).join('')}
                
                <!-- X-Axis Labels (Impact 1 - 5) -->
                <div class="matrix-x-labels">
                  <div style="width: 24px;"></div>
                  <div class="matrix-i-num">1<br><span style="font-size: 9px; color: var(--text-muted);">&lt;1М</span></div>
                  <div class="matrix-i-num">2<br><span style="font-size: 9px; color: var(--text-muted);">1-3М</span></div>
                  <div class="matrix-i-num">3<br><span style="font-size: 9px; color: var(--text-muted);">3-6М</span></div>
                  <div class="matrix-i-num">4<br><span style="font-size: 9px; color: var(--text-muted);">6-10М</span></div>
                  <div class="matrix-i-num">5<br><span style="font-size: 9px; color: var(--text-muted);">&gt;10М</span></div>
                </div>
              </div>
            </div>

            <div style="display: flex; justify-content: space-around; margin-top: 0.85rem; font-size: 0.75rem; color: var(--text-muted);">
              <span style="display: flex; align-items: center; gap: 4px;"><span style="display: inline-block; width: 10px; height: 10px; background: #22c55e; border-radius: 2px;"></span> Низкий (1-4)</span>
              <span style="display: flex; align-items: center; gap: 4px;"><span style="display: inline-block; width: 10px; height: 10px; background: #eab308; border-radius: 2px;"></span> Средний (5-12)</span>
              <span style="display: flex; align-items: center; gap: 4px;"><span style="display: inline-block; width: 10px; height: 10px; background: #ef4444; border-radius: 2px;"></span> Критический (15-25)</span>
            </div>
          </div>

          <!-- Right: Search, Filter, Strategy Summary -->
          <div class="calc-card" style="padding: 1.25rem; display: flex; flex-direction: column; gap: 0.85rem;">
            <div style="font-size: 0.95rem; font-weight: 700; color: var(--text-primary);">Фильтрация и классификация рисков</div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
              <div class="form-group">
                <label class="form-label">Категория риска:</label>
                <select id="select-risk-category" class="form-control">
                  <option value="all" ${this.selectedCategory === 'all' ? 'selected' : ''}>Все категории</option>
                  <option value="supply" ${this.selectedCategory === 'supply' ? 'selected' : ''}>Поставки и логистика</option>
                  <option value="regulatory" ${this.selectedCategory === 'regulatory' ? 'selected' : ''}>Нормативно-правовые / Экспертиза</option>
                  <option value="technical" ${this.selectedCategory === 'technical' ? 'selected' : ''}>Технические и интеграционные</option>
                  <option value="financial" ${this.selectedCategory === 'financial' ? 'selected' : ''}>Финансовые и сметные</option>
                  <option value="personnel" ${this.selectedCategory === 'personnel' ? 'selected' : ''}>Кадровые ресурсы</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">Статус риска:</label>
                <select id="select-risk-status" class="form-control">
                  <option value="all" ${this.selectedStatus === 'all' ? 'selected' : ''}>Все статусы</option>
                  <option value="active" ${this.selectedStatus === 'active' ? 'selected' : ''}>Активен (В работе)</option>
                  <option value="monitoring" ${this.selectedStatus === 'monitoring' ? 'selected' : ''}>На мониторинге</option>
                  <option value="closed" ${this.selectedStatus === 'closed' ? 'selected' : ''}>Закрыт / Нивелирован</option>
                  <option value="realized" ${this.selectedStatus === 'realized' ? 'selected' : ''}>Реализовался (Инцидент)</option>
                </select>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Поиск по формулировке, владельцу или мероприятию:</label>
              <input type="text" id="input-risk-search" class="form-control" value="${this.escapeHtml(this.searchQuery)}" placeholder="Начните вводить текст...">
            </div>

            <!-- Response Strategies Breakdown -->
            <div style="background: var(--bg-hover); padding: 0.75rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color); margin-top: auto;">
              <div style="font-size: 0.8rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.35rem;">Распределение по стратегиям реагирования:</div>
              <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-secondary);">
                <span>🛡 Снижение: <b>${risks.filter(r => r.strategy === 'mitigation' || r.strategy === 'reduction').length}</b></span>
                <span>🚫 Избегание: <b>${risks.filter(r => r.strategy === 'avoidance').length}</b></span>
                <span>🤝 Передача: <b>${risks.filter(r => r.strategy === 'transfer').length}</b></span>
                <span>📦 Принятие: <b>${risks.filter(r => r.strategy === 'acceptance').length}</b></span>
              </div>
            </div>
          </div>

        </div>

        <!-- RISK REGISTER DATA TABLE -->
        <div class="calc-card" style="padding: 1.25rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.85rem;">
            <div style="font-size: 1rem; font-weight: 700; color: var(--text-primary);">
              📑 Реестр рисков проекта (Найдено: ${filteredRisks.length})
            </div>
          </div>

          <div style="overflow-x: auto;">
            <table class="data-table" style="font-size: 0.85rem;">
              <thead>
                <tr>
                  <th style="width: 45px;">№</th>
                  <th>Формулировка риска и источник</th>
                  <th>Категория</th>
                  <th>P (1-5)</th>
                  <th>I (Ущерб)</th>
                  <th>Ранг</th>
                  <th>EMV (₽)</th>
                  <th>Владелец риска</th>
                  <th>Стратегия и меры реагирования</th>
                  <th>Статус</th>
                  <th style="text-align: right;">Действия</th>
                </tr>
              </thead>
              <tbody>
                ${filteredRisks.map((r, idx) => {
                  const score = (r.probability || 1) * (r.impactScore || Math.min(5, Math.max(1, Math.round((r.impactCost || 0) / 3000000))));
                  let badgeClass = 'badge-status-done';
                  if (score >= 15) badgeClass = 'badge-status-rejected';
                  else if (score >= 5) badgeClass = 'badge-status-review';

                  const stratMap = {
                    mitigation: '🛡 Снижение',
                    reduction: '🛡 Снижение',
                    avoidance: '🚫 Избегание',
                    transfer: '🤝 Передача',
                    acceptance: '📦 Принятие'
                  };

                  const catMap = {
                    supply: 'Поставки',
                    regulatory: 'Экспертиза/Право',
                    technical: 'Технический',
                    financial: 'Финансовый',
                    personnel: 'Кадры'
                  };

                  return `
                    <tr>
                      <td><b>R-${idx + 1}</b></td>
                      <td>
                        <div style="font-weight: 600; color: var(--text-primary);">${this.escapeHtml(r.title)}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">Причина: ${this.escapeHtml(r.source || '—')}</div>
                      </td>
                      <td><span class="badge badge-status-todo" style="font-size: 0.75rem;">${catMap[r.category] || r.category}</span></td>
                      <td style="text-align: center; font-weight: bold;">${r.probability || 1}</td>
                      <td>${nf(r.impactCost || 0)} ₽</td>
                      <td style="text-align: center;">
                        <span class="badge ${badgeClass}" style="font-weight: 800;">${score}</span>
                      </td>
                      <td><b style="color: var(--accent-warning);">${nf(r.emv || ((r.probability * (r.impactCost || 0)) / 5))} ₽</b></td>
                      <td>
                        <div style="font-weight: 600;">${this.escapeHtml(r.ownerName || '—')}</div>
                      </td>
                      <td>
                        <div style="font-size: 0.8rem; font-weight: 600;">${stratMap[r.strategy] || r.strategy}</div>
                        <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px;">${this.truncate(r.actions || '—', 55)}</div>
                      </td>
                      <td>
                        <span class="badge ${r.status === 'active' ? 'badge-status-progress' : (r.status === 'closed' ? 'badge-status-done' : 'badge-status-todo')}">
                          ${r.status === 'active' ? 'Активен' : (r.status === 'closed' ? 'Закрыт' : (r.status === 'realized' ? 'Инцидент' : 'Мониторинг'))}
                        </span>
                      </td>
                      <td style="text-align: right;">
                        <button class="btn btn-sm" onclick="window.risksModule.openRiskModal('${r.id}')">✏️ Карточка</button>
                      </td>
                    </tr>
                  `;
                }).join('')}
                ${filteredRisks.length === 0 ? `
                  <tr>
                    <td colspan="11" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                      Риски по указанным критериям не найдены
                    </td>
                  </tr>
                ` : ''}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    `;

    this.bindEvents();
  }

  filterByCell(p, i) {
    if (this.selectedMatrixCell && this.selectedMatrixCell.p === p && this.selectedMatrixCell.i === i) {
      this.selectedMatrixCell = null;
    } else {
      this.selectedMatrixCell = { p, i };
    }
    this.render();
  }

  bindEvents() {
    document.getElementById('btn-reset-matrix-filter')?.addEventListener('click', () => {
      this.selectedMatrixCell = null;
      this.render();
    });

    document.getElementById('select-risk-category')?.addEventListener('change', (e) => {
      this.selectedCategory = e.target.value;
      this.render();
    });

    document.getElementById('select-risk-status')?.addEventListener('change', (e) => {
      this.selectedStatus = e.target.value;
      this.render();
    });

    document.getElementById('input-risk-search')?.addEventListener('input', (e) => {
      this.searchQuery = e.target.value;
      this.render();
    });

    document.getElementById('btn-create-risk-card')?.addEventListener('click', () => {
      this.openRiskModal(null);
    });

    document.getElementById('btn-export-risks-excel')?.addEventListener('click', () => {
      this.exportToExcel();
    });
  }

  // ==========================================
  // MODAL & RISK CARD CRUD
  // ==========================================

  bindModals() {
    const modal = document.getElementById('risk-card-modal');
    const closeBtn = document.getElementById('btn-close-risk-modal');
    const cancelBtn = document.getElementById('btn-cancel-risk');
    const saveBtn = document.getElementById('btn-save-risk');
    const deleteBtn = document.getElementById('btn-delete-risk');

    const closeModal = () => {
      modal?.classList.remove('open');
      this.editingRiskId = null;
    };

    closeBtn?.addEventListener('click', closeModal);
    cancelBtn?.addEventListener('click', closeModal);

    // Auto-calculate EMV on probability or impact cost change
    const pInput = document.getElementById('risk-form-prob');
    const costInput = document.getElementById('risk-form-impact-cost');
    const emvDisplay = document.getElementById('risk-form-emv-display');

    const updateEmv = () => {
      const p = parseInt(pInput?.value || '1', 10);
      const cost = parseFloat(costInput?.value || '0');
      const emv = (p * cost) / 5;
      if (emvDisplay) {
        emvDisplay.textContent = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(emv) + ' ₽';
      }
    };

    pInput?.addEventListener('input', updateEmv);
    costInput?.addEventListener('input', updateEmv);

    saveBtn?.addEventListener('click', async () => {
      const title = document.getElementById('risk-form-title')?.value.trim();
      if (!title) {
        window.app.showToast('Укажите формулировку риска', 'error');
        return;
      }

      const { employees = [] } = window.storage.cache;
      const ownerId = document.getElementById('risk-form-owner')?.value || '';
      const ownerObj = employees.find(e => e.id === ownerId) || { name: 'Не назначен' };

      const prob = parseInt(document.getElementById('risk-form-prob')?.value || '1', 10);
      const impactCost = parseFloat(document.getElementById('risk-form-impact-cost')?.value || '0');
      const impactScore = Math.min(5, Math.max(1, Math.round(impactCost / 3000000))) || 1;
      const emv = (prob * impactCost) / 5;

      const riskPayload = {
        id: this.editingRiskId || ('risk_' + Date.now()),
        title,
        source: document.getElementById('risk-form-source')?.value.trim() || '',
        category: document.getElementById('risk-form-category')?.value || 'supply',
        probability: prob,
        impactCost,
        impactScore,
        emv,
        ownerId,
        ownerName: ownerObj.name,
        strategy: document.getElementById('risk-form-strategy')?.value || 'mitigation',
        status: document.getElementById('risk-form-status')?.value || 'active',
        actions: document.getElementById('risk-form-actions')?.value.trim() || '',
        triggerEvent: document.getElementById('risk-form-trigger')?.value.trim() || '',
        deadline: document.getElementById('risk-form-deadline')?.value || ''
      };

      try {
        await window.storage.saveEntity('risks', riskPayload.id, riskPayload);
        window.app.showToast(`Риск «${this.truncate(title, 30)}» сохранен в /data/risks/`, 'success');
        closeModal();
        this.render();
      } catch (err) {
        window.app.showToast(`Ошибка сохранения риска: ${err.message}`, 'error');
      }
    });

    deleteBtn?.addEventListener('click', async () => {
      if (!this.editingRiskId) return;
      if (confirm('Удалить данный риск из реестра?')) {
        try {
          await window.storage.deleteEntity('risks', this.editingRiskId);
          window.app.showToast('Риск удален из реестра', 'info');
          closeModal();
          this.render();
        } catch (err) {
          window.app.showToast(`Ошибка удаления: ${err.message}`, 'error');
        }
      }
    });
  }

  openRiskModal(riskId) {
    this.editingRiskId = riskId;
    const modal = document.getElementById('risk-card-modal');
    const deleteBtn = document.getElementById('btn-delete-risk');
    const ownerSelect = document.getElementById('risk-form-owner');
    if (!modal) return;

    const { employees = [], risks = [] } = window.storage.cache;

    // Populate employee options
    if (ownerSelect) {
      ownerSelect.innerHTML = employees.map(e => `
        <option value="${e.id}">${this.escapeHtml(e.name)} (${this.escapeHtml(e.role || 'Сотрудник')})</option>
      `).join('');
    }

    let rData = {
      title: '',
      source: '',
      category: 'supply',
      probability: 3,
      impactCost: 5000000,
      ownerId: employees[0]?.id || '',
      strategy: 'mitigation',
      status: 'active',
      actions: '',
      triggerEvent: '',
      deadline: ''
    };

    if (riskId) {
      const existing = risks.find(r => r.id === riskId);
      if (existing) rData = { ...rData, ...existing };
      if (deleteBtn) deleteBtn.style.display = 'inline-flex';
    } else {
      if (deleteBtn) deleteBtn.style.display = 'none';
    }

    document.getElementById('risk-form-title').value = rData.title || '';
    document.getElementById('risk-form-source').value = rData.source || '';
    document.getElementById('risk-form-category').value = rData.category || 'supply';
    document.getElementById('risk-form-prob').value = rData.probability || 3;
    document.getElementById('risk-form-impact-cost').value = rData.impactCost || 0;
    if (ownerSelect) ownerSelect.value = rData.ownerId || employees[0]?.id || '';
    document.getElementById('risk-form-strategy').value = rData.strategy || 'mitigation';
    document.getElementById('risk-form-status').value = rData.status || 'active';
    document.getElementById('risk-form-actions').value = rData.actions || '';
    document.getElementById('risk-form-trigger').value = rData.triggerEvent || '';
    document.getElementById('risk-form-deadline').value = rData.deadline || '';

    const emvDisplay = document.getElementById('risk-form-emv-display');
    if (emvDisplay) {
      const emv = (rData.probability * (rData.impactCost || 0)) / 5;
      emvDisplay.textContent = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(emv) + ' ₽';
    }

    modal.classList.add('open');
  }

  // ==========================================
  // EXCEL EXPORT VIA SHEETJS
  // ==========================================

  exportToExcel() {
    if (!window.XLSX) {
      window.app.showToast('Библиотека XLSX не загружена', 'error');
      return;
    }

    const { risks = [] } = window.storage.cache;
    if (risks.length === 0) {
      window.app.showToast('В реестре нет рисков для выгрузки', 'warning');
      return;
    }

    const dataToExport = risks.map((r, i) => ({
      'Код риска': `R-${i + 1}`,
      'Формулировка риска': r.title,
      'Источник / Причина': r.source,
      'Категория': r.category,
      'Вероятность P (1-5)': r.probability,
      'Влияние I (руб)': r.impactCost,
      'Оценка EMV (руб)': r.emv || ((r.probability * r.impactCost) / 5),
      'Владелец риска (Risk Owner)': r.ownerName,
      'Стратегия реагирования': r.strategy,
      'Мероприятия по снижению': r.actions,
      'Триггерное событие': r.triggerEvent,
      'Срок реализации мер': r.deadline,
      'Статус': r.status
    }));

    const ws = window.XLSX.utils.json_to_sheet(dataToExport);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, 'Реестр рисков РП-3');
    window.XLSX.writeFile(wb, `Реестр_рисков_РП3_${new Date().toISOString().split('T')[0]}.xlsx`);
    window.app.showToast('Реестр рисков успешно экспортирован в Excel', 'success');
  }

  truncate(str, len) {
    if (!str) return '';
    return str.length > len ? str.substring(0, len) + '...' : str;
  }

  escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}

window.risksModule = new RisksModule();
