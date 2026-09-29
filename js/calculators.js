/**
 * Corporate Calculators Module
 * Features:
 * 1. VAT Calculator (20%, 10%, 0%) with Extract/Add modes and 1-click clipboard copy
 * 2. Working Days Calculator (Exclude Sat/Sun & Add N workdays to date)
 * 3. Labor Cost & FOT Calculator
 * 4. EVM Performance Index (SPI/CPI) with zero-division protection
 */

class CalculatorsModule {
  init() {
    this.bindEvents();
    this.calcVat();
    this.calcWorkDaysDiff();
    this.calcAddWorkDays();
    this.calcFot();
    this.calcEvm();
  }

  bindEvents() {
    // VAT Calculator
    ['vat-input-sum', 'vat-rate', 'vat-mode'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', () => this.calcVat());
      if (el) el.addEventListener('change', () => this.calcVat());
    });

    // Copy VAT result
    const copyVatBtn = document.getElementById('btn-copy-vat');
    if (copyVatBtn) {
      copyVatBtn.addEventListener('click', () => this.copyVatResult());
    }

    // Work Days Difference
    ['wd-start-date', 'wd-end-date', 'wd-include-start'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', () => this.calcWorkDaysDiff());
      if (el) el.addEventListener('change', () => this.calcWorkDaysDiff());
    });

    // Add Work Days to Date
    ['wd-add-start', 'wd-add-count'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', () => this.calcAddWorkDays());
      if (el) el.addEventListener('change', () => this.calcAddWorkDays());
    });

    // Copy deadline result
    const copyDlBtn = document.getElementById('btn-copy-deadline');
    if (copyDlBtn) {
      copyDlBtn.addEventListener('click', () => this.copyDeadlineResult());
    }

    // FOT Calculator
    ['fot-hours', 'fot-rate', 'fot-tax', 'fot-overhead'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', () => this.calcFot());
    });

    // EVM Calculator
    ['evm-pv', 'evm-ev', 'evm-ac'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', () => this.calcEvm());
    });
  }

  /* ---------------- 1. Калькулятор НДС ---------------- */
  calcVat() {
    const sumInput = document.getElementById('vat-input-sum');
    const rateInput = document.getElementById('vat-rate');
    const modeInput = document.getElementById('vat-mode');

    const totalValEl = document.getElementById('vat-result-total');
    const breakdownEl = document.getElementById('vat-result-breakdown');

    if (!sumInput || !totalValEl) return;

    const rawSum = parseFloat(sumInput.value);
    const rate = parseFloat(rateInput?.value) || 0; // 20, 10, 0
    const mode = modeInput?.value || 'extract'; // 'extract' (в т.ч.) or 'add' (начислить)

    if (isNaN(rawSum) || rawSum < 0) {
      totalValEl.textContent = '0.00 ₽';
      if (breakdownEl) breakdownEl.innerHTML = '<span style="color:var(--danger)">Введите корректную сумму</span>';
      return;
    }

    let sumWithoutVat = 0;
    let vatAmount = 0;
    let sumWithVat = 0;

    if (mode === 'extract') {
      // Выделение НДС из суммы (в т.ч.)
      if (rate === 0) {
        sumWithoutVat = rawSum;
        vatAmount = 0;
        sumWithVat = rawSum;
      } else {
        sumWithoutVat = rawSum / (1 + rate / 100);
        vatAmount = rawSum - sumWithoutVat;
        sumWithVat = rawSum;
      }
    } else {
      // Начисление НДС сверху (+)
      sumWithoutVat = rawSum;
      vatAmount = rawSum * (rate / 100);
      sumWithVat = rawSum + vatAmount;
    }

    const fmt = (n) => new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + ' ₽';

    totalValEl.textContent = fmt(mode === 'extract' ? vatAmount : sumWithVat);

    if (breakdownEl) {
      breakdownEl.innerHTML = `
        <div>Сумма без НДС: <b id="val-sum-no-vat">${fmt(sumWithoutVat)}</b></div>
        <div>Сумма налога (${rate}%): <b id="val-sum-tax">${fmt(vatAmount)}</b></div>
        <div>Итого с НДС: <b id="val-sum-with-vat">${fmt(sumWithVat)}</b></div>
      `;
    }

    this.lastVatCalc = {
      mode,
      rate,
      sumWithoutVat: fmt(sumWithoutVat),
      vatAmount: fmt(vatAmount),
      sumWithVat: fmt(sumWithVat)
    };
  }

  async copyVatResult() {
    if (!this.lastVatCalc) return;
    const text = `Сумма без НДС: ${this.lastVatCalc.sumWithoutVat}\nНДС (${this.lastVatCalc.rate}%): ${this.lastVatCalc.vatAmount}\nИтого с НДС: ${this.lastVatCalc.sumWithVat}`;
    try {
      await navigator.clipboard.writeText(text);
      window.app.showToast('Результат расчета НДС скопирован в буфер обмена', 'success');
    } catch (e) {
      window.app.showToast('Не удалось скопировать в буфер', 'warning');
    }
  }

  /* ---------------- 2. Калькулятор рабочих сроков ---------------- */
  calcWorkDaysDiff() {
    const startEl = document.getElementById('wd-start-date');
    const endEl = document.getElementById('wd-end-date');
    const resEl = document.getElementById('wd-diff-result');
    const descEl = document.getElementById('wd-diff-desc');

    if (!startEl || !endEl || !resEl) return;

    const d1Str = startEl.value;
    const d2Str = endEl.value;

    if (!d1Str || !d2Str) {
      resEl.textContent = '—';
      if (descEl) descEl.textContent = 'Укажите обе даты';
      return;
    }

    const d1 = new Date(d1Str);
    const d2 = new Date(d2Str);

    if (isNaN(d1) || isNaN(d2)) {
      resEl.textContent = 'Ошибка';
      if (descEl) descEl.textContent = 'Неверный формат даты';
      return;
    }

    if (d2 < d1) {
      resEl.textContent = '0 дн.';
      if (descEl) descEl.innerHTML = '<span style="color:var(--danger)">Дата окончания раньше даты начала!</span>';
      return;
    }

    // Iterate day by day counting Monday(1) to Friday(5)
    let cur = new Date(d1);
    let workDaysCount = 0;
    let calendarDays = 0;

    while (cur <= d2) {
      const day = cur.getDay();
      calendarDays++;
      if (day !== 0 && day !== 6) { // Not Sunday and Not Saturday
        workDaysCount++;
      }
      cur.setDate(cur.getDate() + 1);
    }

    const weekendsCount = calendarDays - workDaysCount;
    resEl.textContent = `${workDaysCount} раб. дн.`;
    if (descEl) {
      descEl.textContent = `Всего календарных дней: ${calendarDays} (выходных: ${weekendsCount})`;
    }
  }

  calcAddWorkDays() {
    const startEl = document.getElementById('wd-add-start');
    const countEl = document.getElementById('wd-add-count');
    const resEl = document.getElementById('wd-add-result');
    const descEl = document.getElementById('wd-add-desc');

    if (!startEl || !countEl || !resEl) return;

    const dStr = startEl.value;
    const count = parseInt(countEl.value, 10);

    if (!dStr || isNaN(count) || count < 0) {
      resEl.textContent = '—';
      if (descEl) descEl.textContent = 'Укажите дату и количество рабочих дней';
      return;
    }

    let cur = new Date(dStr);
    if (isNaN(cur)) {
      resEl.textContent = 'Ошибка';
      return;
    }

    let addedWorkDays = 0;
    let totalCalendarDays = 0;

    while (addedWorkDays < count) {
      cur.setDate(cur.getDate() + 1);
      totalCalendarDays++;
      const day = cur.getDay();
      if (day !== 0 && day !== 6) {
        addedWorkDays++;
      }
    }

    const dayNames = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
    const monthNames = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

    const formattedDate = `${cur.getDate()} ${monthNames[cur.getMonth()]} ${cur.getFullYear()} г. (${dayNames[cur.getDay()]})`;
    const isoDate = cur.toISOString().split('T')[0];

    resEl.textContent = isoDate;
    if (descEl) {
      descEl.textContent = formattedDate;
    }

    this.lastDeadlineCalc = {
      isoDate,
      formattedDate,
      count
    };
  }

  async copyDeadlineResult() {
    if (!this.lastDeadlineCalc) return;
    try {
      await navigator.clipboard.writeText(this.lastDeadlineCalc.isoDate);
      window.app.showToast(`Дата ${this.lastDeadlineCalc.isoDate} скопирована`, 'success');
    } catch (e) {
      window.app.showToast('Не удалось скопировать', 'warning');
    }
  }

  /* ---------------- 3. Расчёт ФОТ и себестоимости ---------------- */
  calcFot() {
    const hours = Math.max(0, parseFloat(document.getElementById('fot-hours')?.value) || 0);
    const rate = Math.max(0, parseFloat(document.getElementById('fot-rate')?.value) || 0);
    const taxPercent = Math.max(0, parseFloat(document.getElementById('fot-tax')?.value) || 0);
    const overheadPercent = Math.max(0, parseFloat(document.getElementById('fot-overhead')?.value) || 0);

    const baseSalary = hours * rate;
    const taxes = baseSalary * (taxPercent / 100);
    const totalFot = baseSalary + taxes;
    const overhead = totalFot * (overheadPercent / 100);
    const totalCost = totalFot + overhead;

    const resEl = document.getElementById('fot-result-total');
    const breakEl = document.getElementById('fot-result-breakdown');

    if (resEl) resEl.textContent = new Intl.NumberFormat('ru-RU').format(Math.round(totalCost)) + ' ₽';
    if (breakEl) {
      breakEl.innerHTML = `
        <div>Базовый ФОТ: <b>${new Intl.NumberFormat('ru-RU').format(Math.round(baseSalary))} ₽</b></div>
        <div>Взносы (${taxPercent}%): <b>${new Intl.NumberFormat('ru-RU').format(Math.round(taxes))} ₽</b></div>
        <div>Накладные (${overheadPercent}%): <b>${new Intl.NumberFormat('ru-RU').format(Math.round(overhead))} ₽</b></div>
      `;
    }
  }

  /* ---------------- 4. Анализ освоенного объема EVM ---------------- */
  calcEvm() {
    const pv = Math.max(0, parseFloat(document.getElementById('evm-pv')?.value) || 0);
    const ev = Math.max(0, parseFloat(document.getElementById('evm-ev')?.value) || 0);
    const ac = Math.max(0, parseFloat(document.getElementById('evm-ac')?.value) || 0);

    // Protection against division by zero
    const cpi = ac > 0 ? (ev / ac) : (ev > 0 ? 1 : 1);
    const spi = pv > 0 ? (ev / pv) : (ev > 0 ? 1 : 1);
    const cv = ev - ac;
    const sv = ev - pv;

    const spiEl = document.getElementById('evm-spi-val');
    const cpiEl = document.getElementById('evm-cpi-val');
    const descEl = document.getElementById('evm-summary-desc');

    if (spiEl) spiEl.textContent = isFinite(spi) ? spi.toFixed(2) : '1.00';
    if (cpiEl) cpiEl.textContent = isFinite(cpi) ? cpi.toFixed(2) : '1.00';

    if (descEl) {
      const spiStatus = spi >= 1 ? '🟢 С опережением графика' : '🔴 Отставание по срокам';
      const cpiStatus = cpi >= 1 ? '🟢 Экономия бюджета' : '🔴 Превышение бюджета';
      descEl.innerHTML = `
        <div>График (SPI = ${spi.toFixed(2)}): <b>${spiStatus}</b> (${new Intl.NumberFormat('ru-RU').format(Math.round(sv))} ₽)</div>
        <div>Бюджет (CPI = ${cpi.toFixed(2)}): <b>${cpiStatus}</b> (${new Intl.NumberFormat('ru-RU').format(Math.round(cv))} ₽)</div>
      `;
    }
  }
}

window.calculatorsModule = new CalculatorsModule();
