/**
 * InvestModule (РП-3: Гейты Stage-Gate и Инвестиционный паспорт проекта)
 * Соответствует стандартам управления проектами РП-3 (Росатом), PMBOK и ГОСТ Р 54869-2011.
 * 
 * - Визуальная шкала прохождения контрольных точек Г1, Г2, Г3, Г4 с обязательными чек-листами
 * - Инвестиционный калькулятор Cash Flow: автоматический расчет NPV, IRR, DPP при WACC
 * - Сохранение в сетевую папку /data/invest/project_passport.json
 */

class InvestModule {
  constructor() {
    this.defaultWacc = 9.3;
    this.passportData = null;
    this.activeGate = 'G3';
  }

  init() {
    this.loadData();
    window.storage.subscribe(() => {
      this.loadData();
      if (document.getElementById('tab-invest')?.classList.contains('active')) {
        this.render();
      }
    });
  }

  loadData() {
    const investCache = window.storage.cache.invest || [];
    const existing = investCache.find(p => p.id === 'project_passport') || investCache[0];
    
    if (existing) {
      this.passportData = JSON.parse(JSON.stringify(existing));
    } else {
      this.passportData = {
        id: 'project_passport',
        projectName: 'Новый инвестиционный проект',
        projectCode: 'ПР-2026/01',
        sponsor: '',
        curator: window.storage.activeUser || '',
        targetCompletionDate: '',
        wacc: this.defaultWacc,
        bac: 0,
        stageGates: {
          G1: {
            code: 'Г1',
            name: 'Инициация и концепция',
            status: 'planned',
            date: '',
            decision: '',
            checklist: [
              { id: 'c1', title: 'Паспорт инвестиционного проекта (ПИП)', required: true, passed: false },
              { id: 'c2', title: 'Финансово-экономическое обоснование (ФЭО)', required: true, passed: false },
              { id: 'c3', title: 'Декларация о намерениях сторон', required: true, passed: false }
            ]
          },
          G2: {
            code: 'Г2',
            name: 'Обоснование инвестиций и ТЗ',
            status: 'planned',
            date: '',
            decision: '',
            checklist: [
              { id: 'c4', title: 'Техническое задание по ГОСТ 34.602-2020', required: true, passed: false },
              { id: 'c5', title: 'Анализ технологической независимости (ТОРП/Минпромторг)', required: true, passed: false },
              { id: 'c6', title: 'Предварительный сводный сметный расчет (ССР)', required: true, passed: false }
            ]
          },
          G3: {
            code: 'Г3',
            name: 'Проектирование и экспертиза',
            status: 'planned',
            date: '',
            decision: '',
            checklist: [
              { id: 'c7', title: 'Положительное заключение ФАУ «Главгосэкспертиза России»', required: true, passed: false },
              { id: 'c8', title: 'Утвержденная проектная документация (стадия «П»)', required: true, passed: false },
              { id: 'c9', title: 'Разрешение на строительство / реконструкцию объекта', required: true, passed: false }
            ]
          },
          G4: {
            code: 'Г4',
            name: 'Ввод в промышленную эксплуатацию',
            status: 'planned',
            date: '',
            decision: '',
            checklist: [
              { id: 'c10', title: 'Акт Государственной приемочной комиссии (форма КС-14)', required: true, passed: false },
              { id: 'c11', title: 'Заключение органа государственного строительного надзора (ЗОС)', required: true, passed: false },
              { id: 'c12', title: 'Аттестат соответствия требованиям безопасности информации ФСТЭК', required: true, passed: false }
            ]
          }
        },
        cashFlows: []
      };
    }
  }

  // ==========================================
  // FINANCIAL CALCULATIONS (NPV, IRR, DPP)
  // ==========================================

  calculateMetrics(cashFlows, waccPercent) {
    const r = (waccPercent || this.defaultWacc) / 100;
    if (!cashFlows || cashFlows.length === 0) {
      return { npv: 0, irr: 0, dpp: '—', totalCapex: 0, totalRevenue: 0, pi: 0 };
    }

    let npv = 0;
    let totalCapex = 0;
    let totalRevenue = 0;
    let cumDiscounted = 0;
    let dpp = '—';
    let prevCum = 0;
    let dppFound = false;

    const flows = cashFlows.map((cf, t) => {
      const net = (cf.revenue || 0) - (cf.capex || 0) - (cf.opex || 0);
      const discountFactor = Math.pow(1 + r, t);
      const discountedNet = net / discountFactor;
      
      totalCapex += (cf.capex || 0);
      totalRevenue += (cf.revenue || 0);
      npv += discountedNet;
      
      prevCum = cumDiscounted;
      cumDiscounted += discountedNet;

      if (!dppFound && cumDiscounted >= 0 && t > 0) {
        // Linear interpolation for fractional year
        const fraction = prevCum < 0 ? Math.abs(prevCum) / discountedNet : 0;
        dpp = (t - 1 + fraction).toFixed(2) + ' лет';
        dppFound = true;
      }

      return { t, net, discountFactor, discountedNet, cumDiscounted };
    });

    if (!dppFound) {
      dpp = npv > 0 ? '> ' + cashFlows.length + ' лет' : 'Не окупается';
    }

    // IRR calculation using numerical bisection
    const irr = this.calculateIRR(cashFlows.map(cf => (cf.revenue || 0) - (cf.capex || 0) - (cf.opex || 0)));
    const pi = totalCapex > 0 ? ((npv + totalCapex) / totalCapex) : 1;

    return {
      npv,
      irr,
      dpp,
      totalCapex,
      totalRevenue,
      pi,
      flows
    };
  }

  calculateIRR(cfs) {
    if (!cfs || cfs.length === 0) return 0;
    let min = -0.9999;
    let max = 5.0;
    const npvAt = (rate) => cfs.reduce((acc, val, t) => acc + val / Math.pow(1 + rate, t), 0);

    let npvMin = npvAt(min);
    let npvMax = npvAt(max);
    if (npvMin * npvMax > 0) {
      return 0; // No real sign change in range
    }

    for (let i = 0; i < 100; i++) {
      const mid = (min + max) / 2;
      const npvMid = npvAt(mid);
      if (Math.abs(npvMid) < 0.001) return mid * 100;
      if (npvMin * npvMid < 0) {
        max = mid;
        npvMax = npvMid;
      } else {
        min = mid;
        npvMin = npvMid;
      }
    }
    return ((min + max) / 2) * 100;
  }

  // ==========================================
  // UI RENDERING
  // ==========================================

  render() {
    const container = document.getElementById('tab-invest');
    if (!container) return;

    const data = this.passportData;
    const metrics = this.calculateMetrics(data.cashFlows, data.wacc);
    const nf = (v) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(v || 0);

    const gates = ['G1', 'G2', 'G3', 'G4'];
    const activeG = data.stageGates[this.activeGate] || data.stageGates.G1;

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 1.25rem;">
        
        <!-- Header Info Card -->
        <div class="calc-card" style="display: flex; justify-content: space-between; align-items: center; padding: 1.25rem 1.5rem; background: var(--bg-card); border-left: 4px solid var(--accent-primary);">
          <div>
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <h2 style="font-size: 1.25rem; font-weight: 700; color: var(--text-primary); margin: 0;">${this.escapeHtml(data.projectName)}</h2>
              <span class="badge badge-status-done" style="font-size: 0.75rem;">Стандарт РП-3</span>
            </div>
            <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.35rem; display: flex; gap: 1.5rem;">
              <span><b>Шифр проекта:</b> ${this.escapeHtml(data.projectCode)}</span>
              <span><b>Заказчик/Спонсор:</b> ${this.escapeHtml(data.sponsor)}</span>
              <span><b>Куратор РП:</b> ${this.escapeHtml(data.curator)}</span>
              <span><b>Срок ввода:</b> ${data.targetCompletionDate}</span>
            </div>
          </div>
          <div style="display: flex; gap: 0.5rem;">
            <button class="btn btn-secondary btn-sm" id="btn-invest-edit-header">✏️ Реквизиты проекта</button>
            <button class="btn btn-primary btn-sm" id="btn-invest-save-all">💾 Сохранить в сетевую папку</button>
          </div>
        </div>

        <!-- 1. STAGE-GATE PIPELINE VISUAL SCALE -->
        <div class="calc-card" style="padding: 1.25rem 1.5rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <div style="font-size: 1rem; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 0.5rem;">
              <span>🚥 Индикатор этапов Stage-Gate (ГОСТ Р / РП-3)</span>
            </div>
            <div style="font-size: 0.8rem; color: var(--text-muted);">
              Нажмите на контрольную точку для просмотра чек-листа документации
            </div>
          </div>

          <div class="stage-gate-track">
            ${gates.map((gKey, idx) => {
              const g = data.stageGates[gKey];
              const isSelected = this.activeGate === gKey;
              const statusClass = g.status === 'passed' ? 'gate-passed' : (g.status === 'active' ? 'gate-active' : 'gate-planned');
              const statusLabel = g.status === 'passed' ? 'Пройден' : (g.status === 'active' ? 'В работе' : 'Запланирован');
              const totalItems = g.checklist.length;
              const passedItems = g.checklist.filter(c => c.passed).length;

              return `
                <div class="stage-gate-step ${statusClass} ${isSelected ? 'selected' : ''}" onclick="window.investModule.selectGate('${gKey}')">
                  <div class="gate-node">
                    <span class="gate-code">${g.code}</span>
                    <span class="gate-status-icon">${g.status === 'passed' ? '✓' : (g.status === 'active' ? '⚙' : '○')}</span>
                  </div>
                  <div class="gate-title">${this.escapeHtml(g.name)}</div>
                  <div class="gate-meta">
                    <div><b>${statusLabel}</b></div>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">${passedItems}/${totalItems} док. (${g.date})</div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>

          <!-- Active Gate Detail Box -->
          <div style="margin-top: 1.25rem; background: var(--bg-hover); border-radius: var(--radius-md); padding: 1.25rem; border: 1px solid var(--border-color);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.85rem;">
              <div style="display: flex; align-items: center; gap: 0.75rem;">
                <span style="font-size: 1.1rem; font-weight: 700; color: var(--accent-primary);">${activeG.code}: ${this.escapeHtml(activeG.name)}</span>
                <span class="badge ${activeG.status === 'passed' ? 'badge-status-done' : (activeG.status === 'active' ? 'badge-status-progress' : 'badge-status-review')}">
                  ${activeG.status === 'passed' ? 'Контрольная точка пройдена' : (activeG.status === 'active' ? 'Текущий контрольный гейт' : 'Предстоящий гейт')}
                </span>
              </div>
              <div style="display: flex; gap: 0.5rem; align-items: center;">
                <label style="font-size: 0.8rem; color: var(--text-muted);">Статус гейта:</label>
                <select id="select-active-gate-status" class="form-control" style="width: 160px; height: 32px; font-size: 0.8rem;">
                  <option value="planned" ${activeG.status === 'planned' ? 'selected' : ''}>Запланирован</option>
                  <option value="active" ${activeG.status === 'active' ? 'selected' : ''}>В работе (Текущий)</option>
                  <option value="passed" ${activeG.status === 'passed' ? 'selected' : ''}>Успешно пройден</option>
                </select>
                <input type="date" id="input-active-gate-date" class="form-control" value="${activeG.date || ''}" style="width: 140px; height: 32px; font-size: 0.8rem;">
              </div>
            </div>

            <div style="margin-bottom: 0.75rem; font-size: 0.85rem; color: var(--text-secondary);">
              <b>Решение / Вердикт комиссии:</b>
              <input type="text" id="input-active-gate-decision" class="form-control" value="${this.escapeHtml(activeG.decision || '')}" style="margin-top: 0.35rem;" placeholder="Укажите номер протокола или статус рассмотрения...">
            </div>

            <div style="font-size: 0.9rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.5rem; margin-top: 1rem;">
              📋 Чек-лист обязательной документации и заключений:
            </div>

            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
              ${activeG.checklist.map((item, cIdx) => `
                <div style="display: flex; align-items: center; justify-content: space-between; background: var(--bg-card); padding: 0.65rem 0.85rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
                  <label style="display: flex; align-items: center; gap: 0.65rem; cursor: pointer; flex: 1;">
                    <input type="checkbox" ${item.passed ? 'checked' : ''} onchange="window.investModule.toggleChecklistItem('${this.activeGate}', ${cIdx}, this.checked)" style="width: 18px; height: 18px; accent-color: var(--accent-primary);">
                    <span style="font-size: 0.875rem; ${item.passed ? 'color: var(--text-primary); font-weight: 600;' : 'color: var(--text-secondary);'}">${this.escapeHtml(item.title)}</span>
                  </label>
                  <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <span class="badge ${item.passed ? 'badge-status-done' : 'badge-status-todo'}" style="font-size: 0.75rem;">
                      ${item.passed ? '✓ Утвержден / Получен' : '⏳ Требуется'}
                    </span>
                    <button class="btn btn-sm" onclick="window.investModule.removeChecklistItem('${this.activeGate}', ${cIdx})" style="padding: 2px 6px; color: var(--accent-danger);" title="Удалить пункт">✕</button>
                  </div>
                </div>
              `).join('')}
            </div>

            <div style="display: flex; gap: 0.5rem; margin-top: 0.75rem;">
              <input type="text" id="input-new-checklist-item" class="form-control" placeholder="Добавить обязательный документ в чек-лист гейта..." style="font-size: 0.85rem;">
              <button class="btn btn-secondary btn-sm" id="btn-add-checklist-item">➕ Добавить документ</button>
            </div>
          </div>
        </div>

        <!-- 2. FINANCIAL & INVESTMENT CALCULATOR (NPV, IRR, DPP, CASH FLOW) -->
        <div class="calc-card" style="padding: 1.25rem 1.5rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
            <div>
              <h3 style="font-size: 1.05rem; font-weight: 700; color: var(--text-primary); margin: 0;">💰 Инвестиционный анализ проекта (Cash Flow & DCF)</h3>
              <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">
                Расчет чистой приведенной стоимости (NPV), внутренней нормы доходности (IRR) и дисконтированного срока окупаемости (DPP)
              </div>
            </div>
            
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">Ставка WACC (%):</label>
              <input type="number" id="input-invest-wacc" class="form-control" value="${data.wacc || this.defaultWacc}" step="0.1" style="width: 90px; height: 32px; font-weight: 700; text-align: center;">
              <button class="btn btn-secondary btn-sm" id="btn-add-cashflow-year">➕ Добавить год</button>
            </div>
          </div>

          <!-- KPI Summary Cards -->
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.25rem;">
            
            <div style="background: var(--bg-hover); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
              <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">NPV (Чистый дисконтированный доход)</div>
              <div style="font-size: 1.35rem; font-weight: 800; color: ${metrics.npv >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)'}; margin-top: 4px;">
                ${nf(metrics.npv)} ₽
              </div>
              <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">
                ${metrics.npv >= 0 ? '✓ Проект эффективен (NPV > 0)' : '⚠ Проект убыточен при ставке WACC'}
              </div>
            </div>

            <div style="background: var(--bg-hover); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
              <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">IRR (Внутренняя норма доходности)</div>
              <div style="font-size: 1.35rem; font-weight: 800; color: ${metrics.irr >= (data.wacc || 9.3) ? 'var(--accent-success)' : 'var(--accent-warning)'}; margin-top: 4px;">
                ${metrics.irr.toFixed(1)}%
              </div>
              <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">
                ${metrics.irr >= (data.wacc || 9.3) ? 'Превышает WACC (' + (data.wacc || 9.3) + '%)' : 'Ниже WACC'}
              </div>
            </div>

            <div style="background: var(--bg-hover); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
              <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">DPP (Дисконтированный срок окупаемости)</div>
              <div style="font-size: 1.35rem; font-weight: 800; color: var(--accent-primary); margin-top: 4px;">
                ${metrics.dpp}
              </div>
              <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">
                С учетом дисконтирования потоков
              </div>
            </div>

            <div style="background: var(--bg-hover); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
              <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">PI (Индекс прибыльности / Capex)</div>
              <div style="font-size: 1.35rem; font-weight: 800; color: ${metrics.pi >= 1 ? 'var(--accent-success)' : 'var(--accent-danger)'}; margin-top: 4px;">
                ${metrics.pi.toFixed(2)}x
              </div>
              <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">
                Капекс: ${nf(metrics.totalCapex)} ₽
              </div>
            </div>

          </div>

          <!-- Cash Flow Table Editor -->
          <div style="overflow-x: auto;">
            <table class="data-table" style="font-size: 0.85rem;">
              <thead>
                <tr>
                  <th style="width: 90px;">Год</th>
                  <th>Инвестиции CAPEX (₽)</th>
                  <th>Операционные затраты OPEX (₽)</th>
                  <th>Выручка / Эффект (₽)</th>
                  <th>Чистый поток CF (₽)</th>
                  <th>Дисконт-й поток DCF (₽)</th>
                  <th>Накопленный DCF (₽)</th>
                  <th style="width: 50px; text-align: right;">Уд.</th>
                </tr>
              </thead>
              <tbody>
                ${data.cashFlows.map((cf, idx) => {
                  const mFlow = metrics.flows ? metrics.flows[idx] : { discountedNet: 0, cumDiscounted: 0 };
                  const net = (cf.revenue || 0) - (cf.capex || 0) - (cf.opex || 0);
                  return `
                    <tr>
                      <td>
                        <input type="number" class="form-control cf-year-input" data-idx="${idx}" value="${cf.year}" style="height: 28px; width: 75px; font-weight: bold; text-align: center;">
                      </td>
                      <td>
                        <input type="number" class="form-control cf-capex-input" data-idx="${idx}" value="${cf.capex || 0}" step="100000" style="height: 28px;">
                      </td>
                      <td>
                        <input type="number" class="form-control cf-opex-input" data-idx="${idx}" value="${cf.opex || 0}" step="100000" style="height: 28px;">
                      </td>
                      <td>
                        <input type="number" class="form-control cf-revenue-input" data-idx="${idx}" value="${cf.revenue || 0}" step="100000" style="height: 28px;">
                      </td>
                      <td>
                        <b style="color: ${net >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)'};">${nf(net)} ₽</b>
                      </td>
                      <td style="color: var(--text-primary); font-family: monospace;">
                        ${nf(mFlow.discountedNet)} ₽
                      </td>
                      <td>
                        <b style="color: ${mFlow.cumDiscounted >= 0 ? 'var(--accent-success)' : 'var(--text-muted)'}; font-family: monospace;">
                          ${nf(mFlow.cumDiscounted)} ₽
                        </b>
                      </td>
                      <td style="text-align: right;">
                        <button class="btn btn-sm" onclick="window.investModule.removeCashFlowRow(${idx})" style="color: var(--accent-danger); padding: 2px 6px;">✕</button>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>

        </div>

      </div>
    `;

    this.bindEvents();
  }

  selectGate(gateKey) {
    this.activeGate = gateKey;
    this.render();
  }

  toggleChecklistItem(gateKey, idx, isChecked) {
    if (this.passportData.stageGates[gateKey]?.checklist[idx]) {
      this.passportData.stageGates[gateKey].checklist[idx].passed = isChecked;
      this.autoSave();
      this.render();
    }
  }

  removeChecklistItem(gateKey, idx) {
    if (this.passportData.stageGates[gateKey]?.checklist) {
      this.passportData.stageGates[gateKey].checklist.splice(idx, 1);
      this.autoSave();
      this.render();
    }
  }

  removeCashFlowRow(idx) {
    if (this.passportData.cashFlows.length > 1) {
      this.passportData.cashFlows.splice(idx, 1);
      this.autoSave();
      this.render();
    } else {
      window.app.showToast('Таблица должна содержать минимум один период', 'warning');
    }
  }

  bindEvents() {
    // Gate status change
    document.getElementById('select-active-gate-status')?.addEventListener('change', (e) => {
      if (this.passportData.stageGates[this.activeGate]) {
        this.passportData.stageGates[this.activeGate].status = e.target.value;
        this.autoSave();
        this.render();
      }
    });

    document.getElementById('input-active-gate-date')?.addEventListener('change', (e) => {
      if (this.passportData.stageGates[this.activeGate]) {
        this.passportData.stageGates[this.activeGate].date = e.target.value;
        this.autoSave();
      }
    });

    document.getElementById('input-active-gate-decision')?.addEventListener('input', (e) => {
      if (this.passportData.stageGates[this.activeGate]) {
        this.passportData.stageGates[this.activeGate].decision = e.target.value;
        this.autoSave();
      }
    });

    // Add checklist item
    document.getElementById('btn-add-checklist-item')?.addEventListener('click', () => {
      const input = document.getElementById('input-new-checklist-item');
      const val = input?.value.trim();
      if (!val) return;
      if (!this.passportData.stageGates[this.activeGate].checklist) {
        this.passportData.stageGates[this.activeGate].checklist = [];
      }
      this.passportData.stageGates[this.activeGate].checklist.push({
        id: 'c_' + Date.now(),
        title: val,
        required: true,
        passed: false
      });
      input.value = '';
      this.autoSave();
      this.render();
    });

    // WACC input
    document.getElementById('input-invest-wacc')?.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (!isNaN(val)) {
        this.passportData.wacc = val;
        this.autoSave();
        this.render();
      }
    });

    // Cash flow row inputs
    document.querySelectorAll('.cf-year-input').forEach(el => {
      el.addEventListener('change', (e) => {
        const idx = parseInt(e.target.dataset.idx, 10);
        this.passportData.cashFlows[idx].year = parseInt(e.target.value, 10) || 2026;
        this.autoSave();
      });
    });

    document.querySelectorAll('.cf-capex-input').forEach(el => {
      el.addEventListener('input', (e) => {
        const idx = parseInt(e.target.dataset.idx, 10);
        this.passportData.cashFlows[idx].capex = parseFloat(e.target.value) || 0;
        this.autoSave();
        this.render();
      });
    });

    document.querySelectorAll('.cf-opex-input').forEach(el => {
      el.addEventListener('input', (e) => {
        const idx = parseInt(e.target.dataset.idx, 10);
        this.passportData.cashFlows[idx].opex = parseFloat(e.target.value) || 0;
        this.autoSave();
        this.render();
      });
    });

    document.querySelectorAll('.cf-revenue-input').forEach(el => {
      el.addEventListener('input', (e) => {
        const idx = parseInt(e.target.dataset.idx, 10);
        this.passportData.cashFlows[idx].revenue = parseFloat(e.target.value) || 0;
        this.autoSave();
        this.render();
      });
    });

    // Add Year button
    document.getElementById('btn-add-cashflow-year')?.addEventListener('click', () => {
      const lastYear = this.passportData.cashFlows.length > 0 
        ? (this.passportData.cashFlows[this.passportData.cashFlows.length - 1].year + 1)
        : 2026;
      this.passportData.cashFlows.push({
        year: lastYear,
        capex: 0,
        opex: 5000000,
        revenue: 25000000,
        netFlow: 20000000
      });
      this.autoSave();
      this.render();
    });

    // Save All button
    document.getElementById('btn-invest-save-all')?.addEventListener('click', async () => {
      try {
        await window.storage.saveEntity('invest', this.passportData.id, this.passportData);
        window.app.showToast('Инвест-паспорт и статус гейтов сохранены в /data/invest/project_passport.json', 'success');
      } catch (err) {
        window.app.showToast(`Ошибка сохранения: ${err.message}`, 'error');
      }
    });

    // Edit Header Modal
    document.getElementById('btn-invest-edit-header')?.addEventListener('click', () => {
      this.openHeaderModal();
    });
  }

  async autoSave() {
    try {
      await window.storage.saveEntity('invest', this.passportData.id, this.passportData);
    } catch (e) {
      console.warn('AutoSave invest error:', e);
    }
  }

  openHeaderModal() {
    const modal = document.getElementById('invest-header-modal');
    if (!modal) return;
    
    document.getElementById('invest-modal-proj-name').value = this.passportData.projectName || '';
    document.getElementById('invest-modal-proj-code').value = this.passportData.projectCode || '';
    document.getElementById('invest-modal-sponsor').value = this.passportData.sponsor || '';
    document.getElementById('invest-modal-curator').value = this.passportData.curator || '';
    document.getElementById('invest-modal-target-date').value = this.passportData.targetCompletionDate || '';

    modal.classList.add('open');
  }

  escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}

window.investModule = new InvestModule();
