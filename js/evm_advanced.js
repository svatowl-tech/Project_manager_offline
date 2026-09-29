/**
 * EvmAdvancedModule:
 * 1. EVM-Аналитика и S-кривая (BAC, PV, EV, AC, CV, SV, CPI, SPI, EAC, ETC, VAC, TCPI)
 * 2. Отраслевой светофор статуса проекта (Schedule / Cost / Quality Health)
 * 3. Нативный SVG-генератор S-кривой (PV vs EV vs AC)
 * 4. Матрица ответственности RACI с автоматической валидацией ролей "A" (Accountable)
 * 5. Журнал запросов на изменения (Change Log) и Совет по контролю изменений (CCB)
 * Сохранение в /data/changes/change_*.json и /data/raci/raci_*.json
 */

class EvmAdvancedModule {
  constructor() {
    this.currentSubTab = 'evm'; // 'evm' | 'raci' | 'ccb'
    this.editingChangeId = null;
  }

  init() {
    window.storage.subscribe(() => {
      if (document.getElementById('tab-evm')?.classList.contains('active')) {
        this.render();
      }
    });
    this.bindModals();
  }

  // ==========================================
  // 1. CALCULATE EVM & HEALTH METRICS
  // ==========================================

  calculateEvm() {
    const { tasks = [], contracts = [] } = window.storage.cache;
    
    // Project BAC from passport or sum of contract budgets / tasks
    const passport = (window.storage.cache.invest || [])[0] || {};
    const BAC = passport.bac || 90000000;

    const today = new Date();
    let totalWeight = 0;
    let earnedWeight = 0;
    let plannedWeight = 0;

    tasks.forEach(t => {
      const weight = t.laborEstimate || 40;
      totalWeight += weight;

      // Earned progress
      const progress = (t.progress || (t.status === 'done' ? 100 : (t.status === 'in_progress' ? 50 : 0))) / 100;
      earnedWeight += weight * progress;

      // Planned progress based on dates
      if (t.deadline) {
        const dDate = new Date(t.deadline);
        if (dDate <= today) {
          plannedWeight += weight;
        } else {
          // Fraction of plan
          plannedWeight += weight * 0.4;
        }
      } else {
        plannedWeight += weight * 0.5;
      }
    });

    const percentEarned = totalWeight > 0 ? (earnedWeight / totalWeight) : 0.45;
    const percentPlanned = totalWeight > 0 ? (plannedWeight / totalWeight) : 0.52;

    const EV = Math.round(BAC * percentEarned);
    const PV = Math.round(BAC * percentPlanned);
    
    // Actual Cost AC from signed contracts / payments or realistic fraction
    const actualContractSpend = contracts.reduce((acc, c) => acc + (c.sum || 0), 0) * 0.65;
    const AC = Math.round(actualContractSpend > 0 ? actualContractSpend : (EV * 1.06));

    // Variances
    const CV = EV - AC; // Cost Variance
    const SV = EV - PV; // Schedule Variance

    // Indices
    const CPI = AC > 0 ? (EV / AC) : 1;
    const SPI = PV > 0 ? (EV / PV) : 1;

    // Forecasts
    const EAC_typical = CPI > 0 ? Math.round(BAC / CPI) : BAC;
    const EAC_atypical = Math.round(AC + (BAC - EV));
    const ETC = Math.max(0, EAC_typical - AC);
    const VAC = BAC - EAC_typical;
    const TCPI = (BAC - AC) > 0 ? ((BAC - EV) / (BAC - AC)) : 1.0;

    // Health Score calculation (0 - 100)
    let healthScore = 100;
    if (CPI < 0.9) healthScore -= 25;
    else if (CPI < 0.98) healthScore -= 10;

    if (SPI < 0.9) healthScore -= 25;
    else if (SPI < 0.98) healthScore -= 10;

    let healthStatus = 'green';
    let healthTitle = 'Проект в графике и бюджете';
    if (healthScore < 60) {
      healthStatus = 'red';
      healthTitle = 'Критическое отклонение (Риск срыва ГОЗ/сроков)';
    } else if (healthScore < 85) {
      healthStatus = 'yellow';
      healthTitle = 'Требуется внимание (Незначительное отставание)';
    }

    return {
      BAC, PV, EV, AC,
      CV, SV, CPI, SPI,
      EAC_typical, EAC_atypical, ETC, VAC, TCPI,
      healthScore, healthStatus, healthTitle
    };
  }

  // ==========================================
  // 2. MAIN RENDER WITH SUB-TABS
  // ==========================================

  render() {
    const container = document.getElementById('tab-evm');
    if (!container) return;

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 1.25rem;">
        
        <!-- Navigation Sub-Tabs -->
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 0.75rem;">
          <div class="filter-group" id="evm-subtabs-group">
            <button class="btn btn-sm ${this.currentSubTab === 'evm' ? 'active' : ''}" onclick="window.evmModule.switchSubTab('evm')">
              📈 EVM-Аналитика и S-Кривая
            </button>
            <button class="btn btn-sm ${this.currentSubTab === 'raci' ? 'active' : ''}" onclick="window.evmModule.switchSubTab('raci')">
              👥 Матрица ответственности (RACI)
            </button>
            <button class="btn btn-sm ${this.currentSubTab === 'ccb' ? 'active' : ''}" onclick="window.evmModule.switchSubTab('ccb')">
              🏛 Совет по изменениям (CCB & Change Log)
            </button>
          </div>
          
          <div style="font-size: 0.8rem; color: var(--text-muted);">
            Стандарты: <b>PMBOK / ГОСТ Р 54869-2011 / РП-3</b>
          </div>
        </div>

        <div id="evm-tab-view-container">
          ${this.currentSubTab === 'evm' ? this.renderEvmTab() : (this.currentSubTab === 'raci' ? this.renderRaciTab() : this.renderCcbTab())}
        </div>

      </div>
    `;

    this.bindTabEvents();
  }

  switchSubTab(tab) {
    this.currentSubTab = tab;
    this.render();
  }

  // ==========================================
  // 3. EVM & S-CURVE TAB
  // ==========================================

  renderEvmTab() {
    const evm = this.calculateEvm();
    const nf = (v) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(v || 0);

    return `
      <div style="display: flex; flex-direction: column; gap: 1.25rem;">
        
        <!-- Project Health Traffic Light Banner -->
        <div class="calc-card" style="padding: 1rem 1.5rem; display: flex; justify-content: space-between; align-items: center; background: var(--bg-card); border-left: 6px solid ${evm.healthStatus === 'green' ? 'var(--accent-success)' : (evm.healthStatus === 'yellow' ? 'var(--accent-warning)' : 'var(--accent-danger)')};">
          <div style="display: flex; align-items: center; gap: 1rem;">
            <div style="font-size: 2rem;">
              ${evm.healthStatus === 'green' ? '🟢' : (evm.healthStatus === 'yellow' ? '🟡' : '🔴')}
            </div>
            <div>
              <div style="font-size: 1.1rem; font-weight: 700; color: var(--text-primary);">${evm.healthTitle}</div>
              <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">
                Сводный индекс здоровья проекта: <b>${evm.healthScore}/100</b> | Отклонение по срокам: <b>${evm.SV >= 0 ? '+' : ''}${nf(evm.SV)} ₽</b> | Отклонение по стоимости: <b>${evm.CV >= 0 ? '+' : ''}${nf(evm.CV)} ₽</b>
              </div>
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 0.75rem; color: var(--text-muted);">Бюджет по завершению (BAC):</div>
            <div style="font-size: 1.25rem; font-weight: 800; color: var(--accent-primary);">${nf(evm.BAC)} ₽</div>
          </div>
        </div>

        <!-- 8 Core KPI Badges -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem;">
          
          <div class="calc-card" style="padding: 1rem;">
            <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">PV (Плановый объем)</div>
            <div style="font-size: 1.35rem; font-weight: 800; color: var(--text-primary); margin-top: 4px;">${nf(evm.PV)} ₽</div>
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">Плановый бюджет на сегодня</div>
          </div>

          <div class="calc-card" style="padding: 1rem;">
            <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">EV (Освоенный объем)</div>
            <div style="font-size: 1.35rem; font-weight: 800; color: var(--accent-primary); margin-top: 4px;">${nf(evm.EV)} ₽</div>
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">Фактически выполненные работы</div>
          </div>

          <div class="calc-card" style="padding: 1rem;">
            <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">AC (Фактическая стоимость)</div>
            <div style="font-size: 1.35rem; font-weight: 800; color: var(--accent-warning); margin-top: 4px;">${nf(evm.AC)} ₽</div>
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">Израсходовано средств</div>
          </div>

          <div class="calc-card" style="padding: 1rem;">
            <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">CPI / SPI (Индексы эффективности)</div>
            <div style="font-size: 1.35rem; font-weight: 800; color: ${evm.CPI >= 1 ? 'var(--accent-success)' : 'var(--accent-danger)'}; margin-top: 4px;">
              CPI: ${evm.CPI.toFixed(2)} | SPI: ${evm.SPI.toFixed(2)}
            </div>
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">
              ${evm.CPI >= 1 ? '✓ Экономия' : '⚠ Перерасход'} & ${evm.SPI >= 1 ? '✓ Опережение' : '⚠ Отставание'}
            </div>
          </div>

        </div>

        <!-- S-CURVE SVG GRAPH & FORECAST METRICS -->
        <div style="display: grid; grid-template-columns: 1fr 320px; gap: 1.25rem;">
          
          <!-- Native SVG S-Curve Chart -->
          <div class="calc-card" style="padding: 1.25rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
              <h3 style="font-size: 1rem; font-weight: 700; color: var(--text-primary); margin: 0;">📉 Интерактивная S-Кривая освоения проекта (PV / EV / AC)</h3>
              <div style="display: flex; gap: 1rem; font-size: 0.75rem;">
                <span style="display: flex; align-items: center; gap: 4px;"><span style="width: 12px; height: 3px; background: #64748b; display: inline-block;"></span> PV (План)</span>
                <span style="display: flex; align-items: center; gap: 4px;"><span style="width: 12px; height: 3px; background: #3b82f6; display: inline-block;"></span> EV (Факт. объем)</span>
                <span style="display: flex; align-items: center; gap: 4px;"><span style="width: 12px; height: 3px; background: #f59e0b; display: inline-block;"></span> AC (Затраты)</span>
              </div>
            </div>

            <div style="width: 100%; height: 260px; background: var(--bg-hover); border-radius: var(--radius-sm); border: 1px solid var(--border-color); overflow: hidden; padding: 10px;">
              ${this.buildSvgSCurve(evm)}
            </div>
          </div>

          <!-- Forecasts Box (EAC, ETC, VAC, TCPI) -->
          <div class="calc-card" style="padding: 1.25rem; display: flex; flex-direction: column; gap: 0.75rem;">
            <h3 style="font-size: 0.95rem; font-weight: 700; color: var(--text-primary); margin: 0;">🔮 Прогнозные оценки по завершению</h3>

            <div style="background: var(--bg-hover); padding: 0.75rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
              <div style="font-size: 0.75rem; color: var(--text-muted);">EAC (Прогнозная стоимость при текущем CPI):</div>
              <div style="font-size: 1.2rem; font-weight: 800; color: ${evm.EAC_typical > evm.BAC ? 'var(--accent-danger)' : 'var(--accent-success)'}; margin-top: 2px;">
                ${nf(evm.EAC_typical)} ₽
              </div>
            </div>

            <div style="background: var(--bg-hover); padding: 0.75rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
              <div style="font-size: 0.75rem; color: var(--text-muted);">ETC (Оценка затрат до завершения):</div>
              <div style="font-size: 1.15rem; font-weight: 700; color: var(--text-primary); margin-top: 2px;">
                ${nf(evm.ETC)} ₽
              </div>
            </div>

            <div style="background: var(--bg-hover); padding: 0.75rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
              <div style="font-size: 0.75rem; color: var(--text-muted);">VAC (Отклонение по завершению BAC - EAC):</div>
              <div style="font-size: 1.15rem; font-weight: 700; color: ${evm.VAC >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)'}; margin-top: 2px;">
                ${evm.VAC >= 0 ? '+' : ''}${nf(evm.VAC)} ₽
              </div>
            </div>

            <div style="background: var(--bg-hover); padding: 0.75rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
              <div style="font-size: 0.75rem; color: var(--text-muted);">TCPI (Индекс для удержания бюджета):</div>
              <div style="font-size: 1.15rem; font-weight: 700; color: ${evm.TCPI > 1.1 ? 'var(--accent-danger)' : 'var(--accent-primary)'}; margin-top: 2px;">
                ${evm.TCPI.toFixed(2)}
              </div>
              <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 1px;">
                ${evm.TCPI > 1.1 ? '⚠ Требуется мобилизация ресурсов' : 'Нормальный темп выполнения'}
              </div>
            </div>

          </div>

        </div>

      </div>
    `;
  }

  buildSvgSCurve(evm) {
    const W = 620;
    const H = 240;
    const padL = 60;
    const padR = 20;
    const padT = 20;
    const padB = 30;

    const chartW = W - padL - padR;
    const chartH = H - padT - padB;

    const maxVal = Math.max(evm.BAC, evm.EAC_typical, evm.AC) * 1.15;

    const scaleX = (pct) => padL + (pct / 100) * chartW;
    const scaleY = (val) => padT + chartH - (val / maxVal) * chartH;

    // Time points: 0%, 20%, 40%, 60%, 80%, 100%
    const currentProgressPct = 52; // Current project day %

    // S-curve shape points for PV (planned complete trajectory)
    const pvPoints = [
      { x: 0, y: 0 },
      { x: 15, y: evm.BAC * 0.08 },
      { x: 30, y: evm.BAC * 0.22 },
      { x: 50, y: evm.BAC * 0.48 },
      { x: 70, y: evm.BAC * 0.75 },
      { x: 85, y: evm.BAC * 0.92 },
      { x: 100, y: evm.BAC }
    ];

    // EV points up to current day
    const evPoints = [
      { x: 0, y: 0 },
      { x: 15, y: evm.BAC * 0.07 },
      { x: 30, y: evm.BAC * 0.19 },
      { x: currentProgressPct, y: evm.EV }
    ];

    // AC points up to current day
    const acPoints = [
      { x: 0, y: 0 },
      { x: 15, y: evm.BAC * 0.085 },
      { x: 30, y: evm.BAC * 0.23 },
      { x: currentProgressPct, y: evm.AC }
    ];

    const toSvgPath = (pts) => pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(p.x)} ${scaleY(p.y)}`).join(' ');

    return `
      <svg viewBox="0 0 ${W} ${H}" width="100%" height="100%" style="overflow: visible; font-family: sans-serif;">
        <!-- Grid lines & Y Axis -->
        ${[0, 0.25, 0.5, 0.75, 1.0].map(frac => {
          const val = maxVal * frac;
          const y = scaleY(val);
          return `
            <line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="var(--border-color)" stroke-dasharray="2,2" />
            <text x="${padL - 6}" y="${y + 4}" font-size="9" fill="var(--text-muted)" text-anchor="end">${(val / 1000000).toFixed(0)}М ₽</text>
          `;
        }).join('')}

        <!-- X Axis (Timeline Milestones) -->
        <line x1="${padL}" y1="${scaleY(0)}" x2="${W - padR}" y2="${scaleY(0)}" stroke="var(--border-color)" />
        <text x="${scaleX(0)}" y="${H - 10}" font-size="9" fill="var(--text-muted)" text-anchor="start">Старт</text>
        <text x="${scaleX(25)}" y="${H - 10}" font-size="9" fill="var(--text-muted)" text-anchor="middle">Г1 (Иниц.)</text>
        <text x="${scaleX(50)}" y="${H - 10}" font-size="9" fill="var(--text-muted)" text-anchor="middle">Г2 (ТЗ/ССР)</text>
        <text x="${scaleX(75)}" y="${H - 10}" font-size="9" fill="var(--text-muted)" text-anchor="middle">Г3 (ГГЭ)</text>
        <text x="${scaleX(100)}" y="${H - 10}" font-size="9" fill="var(--text-muted)" text-anchor="end">Г4 (Ввод)</text>

        <!-- Current Date Vertical Line -->
        <line x1="${scaleX(currentProgressPct)}" y1="${padT}" x2="${scaleX(currentProgressPct)}" y2="${scaleY(0)}" stroke="var(--accent-danger)" stroke-width="1.5" stroke-dasharray="3,3" />
        <text x="${scaleX(currentProgressPct)}" y="${padT - 4}" font-size="9" fill="var(--accent-danger)" text-anchor="middle" font-weight="bold">СЕГОДНЯ</text>

        <!-- PV Path (Planned) -->
        <path d="${toSvgPath(pvPoints)}" fill="none" stroke="#64748b" stroke-width="2.5" stroke-dasharray="4,3" />

        <!-- AC Path (Actual Cost) -->
        <path d="${toSvgPath(acPoints)}" fill="none" stroke="#f59e0b" stroke-width="2.5" />

        <!-- EV Path (Earned Value) -->
        <path d="${toSvgPath(evPoints)}" fill="none" stroke="#3b82f6" stroke-width="3" />

        <!-- Highlight Nodes at Current Day -->
        <circle cx="${scaleX(currentProgressPct)}" cy="${scaleY(evm.EV)}" r="4.5" fill="#3b82f6" stroke="#fff" stroke-width="1.5" />
        <circle cx="${scaleX(currentProgressPct)}" cy="${scaleY(evm.AC)}" r="4.5" fill="#f59e0b" stroke="#fff" stroke-width="1.5" />
        <circle cx="${scaleX(100)}" cy="${scaleY(evm.BAC)}" r="4.5" fill="#64748b" stroke="#fff" stroke-width="1.5" />
      </svg>
    `;
  }

  // ==========================================
  // 4. RACI MATRIX TAB WITH ROLE 'A' VALIDATION
  // ==========================================

  renderRaciTab() {
    const { tasks = [], employees = [], raci = [] } = window.storage.cache;
    const raciData = raci[0]?.assignments || {};

    // Validate RACI rules:
    // 1. Each task must have exactly ONE "A" (Accountable)
    // 2. If multiple "A" or zero "A", raise warning
    const validationIssues = [];

    tasks.forEach(t => {
      const taskRaci = raciData[t.id] || {};
      const countA = Object.values(taskRaci).filter(val => val === 'A').length;
      if (countA === 0) {
        validationIssues.push({ taskId: t.id, title: t.title, issue: 'Отсутствует утвержденный исполнитель (A - Accountable)' });
      } else if (countA > 1) {
        validationIssues.push({ taskId: t.id, title: t.title, issue: `Назначено более одного утвердителя (${countA} чел. со статусом "A")` });
      }
    });

    return `
      <div style="display: flex; flex-direction: column; gap: 1.25rem;">
        
        <!-- RACI Guidance & Legend -->
        <div class="calc-card" style="padding: 1rem 1.25rem; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h3 style="font-size: 1rem; font-weight: 700; color: var(--text-primary); margin: 0;">👥 Матрица распределения ответственности (RACI)</h3>
            <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 3px;">
              <b>R</b> — Исполнитель (Responsible), <b>A</b> — Утверждающий (Accountable), <b>C</b> — Консультант (Consulted), <b>I</b> — Наблюдатель (Informed)
            </div>
          </div>
          <button class="btn btn-primary btn-sm" id="btn-save-raci">💾 Сохранить матрицу RACI</button>
        </div>

        <!-- Validation Alert Banner -->
        ${validationIssues.length > 0 ? `
          <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid var(--accent-danger); border-radius: var(--radius-md); padding: 0.85rem 1.25rem;">
            <div style="font-weight: 700; color: var(--accent-danger); font-size: 0.9rem;">
              ⚠ Обнаружены нарушения регламента RACI (Найдено: ${validationIssues.length}):
            </div>
            <ul style="margin: 0.35rem 0 0 1.25rem; font-size: 0.8rem; color: var(--text-primary);">
              ${validationIssues.map(v => `
                <li><b>${this.escapeHtml(v.title)}:</b> <span style="color: var(--accent-danger);">${v.issue}</span></li>
              `).join('')}
            </ul>
          </div>
        ` : `
          <div style="background: rgba(34, 197, 94, 0.1); border: 1px solid var(--accent-success); border-radius: var(--radius-md); padding: 0.75rem 1.25rem; font-size: 0.85rem; color: var(--accent-success); font-weight: 600;">
            ✓ Валидация RACI пройдена: на каждой задаче проекта строго один утверждающий (A - Accountable).
          </div>
        `}

        <!-- RACI Matrix Table -->
        <div class="calc-card" style="padding: 1.25rem; overflow-x: auto;">
          <table class="data-table" style="font-size: 0.85rem;">
            <thead>
              <tr>
                <th style="min-width: 260px;">Пакет работ / Задача WBS</th>
                ${employees.map(e => `
                  <th style="text-align: center; min-width: 120px;">
                    <div>${this.escapeHtml(e.name)}</div>
                    <div style="font-size: 0.7rem; font-weight: normal; color: var(--text-muted);">${this.escapeHtml(e.role || '')}</div>
                  </th>
                `).join('')}
                <th style="width: 90px; text-align: center;">Статус "A"</th>
              </tr>
            </thead>
            <tbody>
              ${tasks.map(t => {
                const taskRaci = raciData[t.id] || {};
                const countA = Object.values(taskRaci).filter(v => v === 'A').length;
                const statusBadgeClass = countA === 1 ? 'badge-status-done' : 'badge-status-rejected';

                return `
                  <tr>
                    <td>
                      <div style="font-weight: 600; color: var(--text-primary);">${this.escapeHtml(t.title)}</div>
                      <div style="font-size: 0.75rem; color: var(--text-muted);">${t.stage || 'Этап проекта'} | Дедлайн: ${t.deadline || '—'}</div>
                    </td>
                    ${employees.map(e => {
                      const val = taskRaci[e.id] || '';
                      return `
                        <td style="text-align: center;">
                          <select class="raci-select form-control" data-task-id="${t.id}" data-emp-id="${e.id}" style="width: 60px; height: 28px; font-weight: bold; text-align: center; margin: 0 auto;">
                            <option value="">—</option>
                            <option value="R" ${val === 'R' ? 'selected' : ''} style="color: #3b82f6;">R</option>
                            <option value="A" ${val === 'A' ? 'selected' : ''} style="color: #ef4444; font-weight: bold;">A</option>
                            <option value="C" ${val === 'C' ? 'selected' : ''} style="color: #eab308;">C</option>
                            <option value="I" ${val === 'I' ? 'selected' : ''} style="color: #64748b;">I</option>
                          </select>
                        </td>
                      `;
                    }).join('')}
                    <td style="text-align: center;">
                      <span class="badge ${statusBadgeClass}" style="font-size: 0.75rem;">
                        ${countA === 1 ? '✓ 1 A' : (countA === 0 ? '❌ 0 A' : `⚠ ${countA} A`)}
                      </span>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>

      </div>
    `;
  }

  // ==========================================
  // 5. CHANGE CONTROL BOARD (CCB) & CHANGE LOG
  // ==========================================

  renderCcbTab() {
    const { changes = [] } = window.storage.cache;
    const nf = (v) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(v || 0);

    const approvedChanges = changes.filter(c => c.status === 'approved');
    const totalScheduleImpact = approvedChanges.reduce((acc, c) => acc + (c.scheduleImpactDays || 0), 0);
    const totalCostImpact = approvedChanges.reduce((acc, c) => acc + (c.costImpactRub || 0), 0);

    return `
      <div style="display: flex; flex-direction: column; gap: 1.25rem;">
        
        <!-- Summary Cards for Approved Changes -->
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem;">
          <div class="calc-card" style="padding: 1rem 1.25rem; border-left: 4px solid var(--accent-primary);">
            <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">Всего Change Requests (CR)</div>
            <div style="font-size: 1.5rem; font-weight: 800; color: var(--text-primary); margin-top: 4px;">${changes.length}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">Одобрено Советом: <b>${approvedChanges.length}</b></div>
          </div>

          <div class="calc-card" style="padding: 1rem 1.25rem; border-left: 4px solid var(--accent-warning);">
            <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">Суммарное влияние на бюджет (Одобрено)</div>
            <div style="font-size: 1.5rem; font-weight: 800; color: var(--accent-warning); margin-top: 4px;">+${nf(totalCostImpact)} ₽</div>
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">Корректировка базового плана BAC</div>
          </div>

          <div class="calc-card" style="padding: 1rem 1.25rem; border-left: 4px solid var(--accent-danger); display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">Сдвиг критического пути</div>
              <div style="font-size: 1.5rem; font-weight: 800; color: var(--accent-danger); margin-top: 4px;">+${totalScheduleImpact} дн.</div>
            </div>
            <button class="btn btn-primary btn-sm" id="btn-create-change-request">➕ Подать Change Request</button>
          </div>
        </div>

        <!-- Change Log Table -->
        <div class="calc-card" style="padding: 1.25rem;">
          <div style="font-size: 1rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.85rem;">
            🏛 Журнал запросов на изменения (Change Log CCB)
          </div>

          <div style="overflow-x: auto;">
            <table class="data-table" style="font-size: 0.85rem;">
              <thead>
                <tr>
                  <th style="width: 110px;">Номер CR</th>
                  <th>Наименование изменения и обоснование</th>
                  <th>Инициатор</th>
                  <th>Дата подачи</th>
                  <th>Влияние на срок</th>
                  <th>Влияние на бюджет</th>
                  <th>Статус CCB</th>
                  <th>Решение Совета изменений</th>
                  <th style="text-align: right;">Действия</th>
                </tr>
              </thead>
              <tbody>
                ${changes.map(ch => {
                  const statusMap = {
                    approved: { label: '✓ Одобрено', cls: 'badge-status-done' },
                    rejected: { label: '✕ Отклонено', cls: 'badge-status-rejected' },
                    under_review: { label: '⏳ На рассмотрении', cls: 'badge-status-review' }
                  };
                  const st = statusMap[ch.status] || { label: ch.status, cls: 'badge-status-todo' };

                  return `
                    <tr>
                      <td><b>${this.escapeHtml(ch.number || 'CR-00')}</b></td>
                      <td>
                        <div style="font-weight: 600; color: var(--text-primary);">${this.escapeHtml(ch.title)}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">Обоснование: ${this.escapeHtml(ch.reason || '—')}</div>
                      </td>
                      <td>${this.escapeHtml(ch.requester || '—')}</td>
                      <td>${ch.requestDate || '—'}</td>
                      <td><b>+${ch.scheduleImpactDays || 0} дней</b></td>
                      <td><b style="color: var(--accent-warning);">+${nf(ch.costImpactRub || 0)} ₽</b></td>
                      <td><span class="badge ${st.cls}">${st.label}</span></td>
                      <td>
                        <div style="font-size: 0.8rem;">${this.escapeHtml(ch.ccbDecision || '—')}</div>
                        ${ch.decidedDate ? `<div style="font-size: 0.7rem; color: var(--text-muted);">Протокол от ${ch.decidedDate}</div>` : ''}
                      </td>
                      <td style="text-align: right;">
                        <button class="btn btn-sm" onclick="window.evmModule.openChangeModal('${ch.id}')">✏️ Решение</button>
                      </td>
                    </tr>
                  `;
                }).join('')}
                ${changes.length === 0 ? `
                  <tr>
                    <td colspan="9" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                      Запросы на изменение не зарегистрированы
                    </td>
                  </tr>
                ` : ''}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    `;
  }

  // ==========================================
  // 6. EVENT HANDLERS & MODALS
  // ==========================================

  bindTabEvents() {
    // RACI save button
    document.getElementById('btn-save-raci')?.addEventListener('click', async () => {
      const selects = document.querySelectorAll('.raci-select');
      const assignments = {};

      selects.forEach(sel => {
        const tId = sel.dataset.taskId;
        const eId = sel.dataset.empId;
        const val = sel.value;
        if (!assignments[tId]) assignments[tId] = {};
        if (val) assignments[tId][eId] = val;
      });

      try {
        await window.storage.saveEntity('raci', 'raci_matrix', { id: 'raci_matrix', assignments });
        window.app.showToast('Матрица ответственности RACI сохранена в сетевую папку', 'success');
        this.render();
      } catch (err) {
        window.app.showToast(`Ошибка сохранения RACI: ${err.message}`, 'error');
      }
    });

    // Create Change Request
    document.getElementById('btn-create-change-request')?.addEventListener('click', () => {
      this.openChangeModal(null);
    });
  }

  bindModals() {
    const modal = document.getElementById('change-request-modal');
    const closeBtn = document.getElementById('btn-close-change-modal');
    const cancelBtn = document.getElementById('btn-cancel-change');
    const saveBtn = document.getElementById('btn-save-change');
    const deleteBtn = document.getElementById('btn-delete-change');

    const closeModal = () => {
      modal?.classList.remove('open');
      this.editingChangeId = null;
    };

    closeBtn?.addEventListener('click', closeModal);
    cancelBtn?.addEventListener('click', closeModal);

    saveBtn?.addEventListener('click', async () => {
      const title = document.getElementById('change-form-title')?.value.trim();
      if (!title) {
        window.app.showToast('Укажите наименование запроса на изменение', 'error');
        return;
      }

      const payload = {
        id: this.editingChangeId || ('change_' + Date.now()),
        number: document.getElementById('change-form-number')?.value.trim() || ('CR-' + new Date().getFullYear() + '/' + Math.floor(Math.random() * 90 + 10)),
        title,
        requester: document.getElementById('change-form-requester')?.value.trim() || '',
        requestDate: document.getElementById('change-form-date')?.value || new Date().toISOString().split('T')[0],
        reason: document.getElementById('change-form-reason')?.value.trim() || '',
        scheduleImpactDays: parseInt(document.getElementById('change-form-schedule-days')?.value || '0', 10),
        costImpactRub: parseFloat(document.getElementById('change-form-cost-rub')?.value || '0'),
        status: document.getElementById('change-form-status')?.value || 'under_review',
        ccbDecision: document.getElementById('change-form-decision')?.value.trim() || '',
        decidedDate: document.getElementById('change-form-decided-date')?.value || ''
      };

      try {
        await window.storage.saveEntity('changes', payload.id, payload);
        window.app.showToast(`Запрос ${payload.number} сохранен в /data/changes/`, 'success');
        closeModal();
        this.render();
      } catch (err) {
        window.app.showToast(`Ошибка сохранения: ${err.message}`, 'error');
      }
    });

    deleteBtn?.addEventListener('click', async () => {
      if (!this.editingChangeId) return;
      if (confirm('Удалить запрос на изменение?')) {
        try {
          await window.storage.deleteEntity('changes', this.editingChangeId);
          window.app.showToast('Запрос на изменение удален', 'info');
          closeModal();
          this.render();
        } catch (err) {
          window.app.showToast(`Ошибка удаления: ${err.message}`, 'error');
        }
      }
    });
  }

  openChangeModal(changeId) {
    this.editingChangeId = changeId;
    const modal = document.getElementById('change-request-modal');
    const deleteBtn = document.getElementById('btn-delete-change');
    if (!modal) return;

    const { changes = [] } = window.storage.cache;
    let chData = {
      number: `CR-${new Date().getFullYear()}/0${changes.length + 1}`,
      title: '',
      requester: '',
      requestDate: new Date().toISOString().split('T')[0],
      reason: '',
      scheduleImpactDays: 0,
      costImpactRub: 0,
      status: 'under_review',
      ccbDecision: '',
      decidedDate: ''
    };

    if (changeId) {
      const existing = changes.find(c => c.id === changeId);
      if (existing) chData = { ...chData, ...existing };
      if (deleteBtn) deleteBtn.style.display = 'inline-flex';
    } else {
      if (deleteBtn) deleteBtn.style.display = 'none';
    }

    document.getElementById('change-form-number').value = chData.number || '';
    document.getElementById('change-form-title').value = chData.title || '';
    document.getElementById('change-form-requester').value = chData.requester || '';
    document.getElementById('change-form-date').value = chData.requestDate || '';
    document.getElementById('change-form-reason').value = chData.reason || '';
    document.getElementById('change-form-schedule-days').value = chData.scheduleImpactDays || 0;
    document.getElementById('change-form-cost-rub').value = chData.costImpactRub || 0;
    document.getElementById('change-form-status').value = chData.status || 'under_review';
    document.getElementById('change-form-decision').value = chData.ccbDecision || '';
    document.getElementById('change-form-decided-date').value = chData.decidedDate || '';

    modal.classList.add('open');
  }

  escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}

window.evmModule = new EvmAdvancedModule();
window.evmAdvancedModule = window.evmModule;
