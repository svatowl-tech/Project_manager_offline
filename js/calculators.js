/**
 * Corporate Calculators & Smart Utilities Suite
 * Features:
 * 1. Standard & Formula Calculator with interactive keypad, expression parsing, history log & financial macros
 * 2. Text Case Converter (UPPERCASE, lowercase, Sentence case, Title Case, Toggle Case, Trim Whitespace, live stats)
 * 3. Keyboard Layout Converter (English QWERTY <-> Russian ЙЦУКЕН, Smart Auto-switch, GOST Transliteration)
 * 4. VAT Calculator (20%, 10%, 0%) with Extract/Add modes and 1-click clipboard copy
 * 5. Working Days Calculator (Exclude Sat/Sun & Add N workdays to date)
 * 6. Labor Cost & FOT Calculator
 * 7. EVM Performance Index (SPI/CPI) with zero-division protection
 */

class CalculatorsModule {
  constructor() {
    this.currentSubTab = 'standard'; // 'standard' | 'case' | 'layout' | 'vat' | 'dates' | 'fot' | 'evm'
    
    // Formula Calculator State
    this.calcExpression = '';
    this.calcResult = '0';
    this.calcHistory = JSON.parse(localStorage.getItem('calc_history_tape') || '[]');

    // Case Converter State
    this.caseText = '';

    // Layout Converter State
    this.layoutText = '';

    // Key mappings
    this.enToRuMap = {
      'q': 'й', 'w': 'ц', 'e': 'у', 'r': 'к', 't': 'е', 'y': 'н', 'u': 'г', 'i': 'ш', 'o': 'щ', 'p': 'з', '[': 'х', ']': 'ъ',
      'a': 'ф', 's': 'ы', 'd': 'в', 'f': 'а', 'g': 'п', 'h': 'р', 'j': 'о', 'k': 'л', 'l': 'д', ';': 'ж', '\'': 'э',
      'z': 'я', 'x': 'ч', 'c': 'с', 'v': 'м', 'b': 'и', 'n': 'т', 'm': 'ь', ',': 'б', '.': 'ю', '/': '.',
      'Q': 'Й', 'W': 'Ц', 'E': 'У', 'R': 'К', 'T': 'Е', 'Y': 'Н', 'U': 'Г', 'I': 'Ш', 'O': 'Щ', 'P': 'З', '{': 'Х', '}': 'Ъ',
      'A': 'Ф', 'S': 'Ы', 'D': 'В', 'F': 'А', 'G': 'П', 'H': 'Р', 'J': 'О', 'K': 'Л', 'L': 'Д', ':': 'Ж', '"': 'Э',
      'Z': 'Я', 'X': 'Ч', 'C': 'С', 'V': 'М', 'B': 'И', 'N': 'Т', 'M': 'Ь', '<': 'Б', '>': 'Ю', '?': ',',
      '`': 'ё', '~': 'Ё', '@': '"', '#': '№', '$': ';', '^': ':', '&': '?'
    };

    this.ruToEnMap = {};
    for (const [en, ru] of Object.entries(this.enToRuMap)) {
      this.ruToEnMap[ru] = en;
    }
  }

  init() {
    this.render();
  }

  render() {
    const container = document.getElementById('tab-calculators');
    if (!container) return;

    container.innerHTML = `
      <div class="calc-suite-layout">
        <!-- Subtab Navigation Bar -->
        <div class="calc-tools-nav">
          <button type="button" class="calc-tool-btn ${this.currentSubTab === 'standard' ? 'active' : ''}" data-subtab="standard">
            <span>🧮</span>
            <span>Формульный калькулятор</span>
          </button>
          <button type="button" class="calc-tool-btn ${this.currentSubTab === 'case' ? 'active' : ''}" data-subtab="case">
            <span>🔤</span>
            <span>Конвертер регистров</span>
          </button>
          <button type="button" class="calc-tool-btn ${this.currentSubTab === 'layout' ? 'active' : ''}" data-subtab="layout">
            <span>🌐</span>
            <span>Конвертер раскладок</span>
          </button>
          <button type="button" class="calc-tool-btn ${this.currentSubTab === 'vat' ? 'active' : ''}" data-subtab="vat">
            <span>💰</span>
            <span>Калькулятор НДС</span>
          </button>
          <button type="button" class="calc-tool-btn ${this.currentSubTab === 'dates' ? 'active' : ''}" data-subtab="dates">
            <span>📅</span>
            <span>Рабочие дни и сроки</span>
          </button>
          <button type="button" class="calc-tool-btn ${this.currentSubTab === 'fot' ? 'active' : ''}" data-subtab="fot">
            <span>👥</span>
            <span>ФОТ и себестоимость</span>
          </button>
          <button type="button" class="calc-tool-btn ${this.currentSubTab === 'evm' ? 'active' : ''}" data-subtab="evm">
            <span>📈</span>
            <span>Экспресс EVM</span>
          </button>
        </div>

        <!-- 1. Standard & Formula Calculator Panel -->
        <div class="calc-panel ${this.currentSubTab === 'standard' ? 'active' : ''}" id="panel-calc-standard">
          ${this.renderStandardCalculatorHtml()}
        </div>

        <!-- 2. Text Case Converter Panel -->
        <div class="calc-panel ${this.currentSubTab === 'case' ? 'active' : ''}" id="panel-calc-case">
          ${this.renderCaseConverterHtml()}
        </div>

        <!-- 3. Keyboard Layout Converter Panel -->
        <div class="calc-panel ${this.currentSubTab === 'layout' ? 'active' : ''}" id="panel-calc-layout">
          ${this.renderLayoutConverterHtml()}
        </div>

        <!-- 4. VAT Calculator Panel -->
        <div class="calc-panel ${this.currentSubTab === 'vat' ? 'active' : ''}" id="panel-calc-vat">
          ${this.renderVatCalculatorHtml()}
        </div>

        <!-- 5. Working Days Calculator Panel -->
        <div class="calc-panel ${this.currentSubTab === 'dates' ? 'active' : ''}" id="panel-calc-dates">
          ${this.renderDatesCalculatorHtml()}
        </div>

        <!-- 6. FOT Calculator Panel -->
        <div class="calc-panel ${this.currentSubTab === 'fot' ? 'active' : ''}" id="panel-calc-fot">
          ${this.renderFotCalculatorHtml()}
        </div>

        <!-- 7. EVM Calculator Panel -->
        <div class="calc-panel ${this.currentSubTab === 'evm' ? 'active' : ''}" id="panel-calc-evm">
          ${this.renderEvmCalculatorHtml()}
        </div>
      </div>
    `;

    this.bindSubtabEvents();
    this.bindActiveSubtabEvents();
  }

  bindSubtabEvents() {
    document.querySelectorAll('.calc-tool-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.currentSubTab = btn.dataset.subtab;
        this.render();
      });
    });
  }

  bindActiveSubtabEvents() {
    if (this.currentSubTab === 'standard') {
      this.bindStandardCalculatorEvents();
    } else if (this.currentSubTab === 'case') {
      this.bindCaseConverterEvents();
    } else if (this.currentSubTab === 'layout') {
      this.bindLayoutConverterEvents();
    } else if (this.currentSubTab === 'vat') {
      this.bindVatEvents();
      this.calcVat();
    } else if (this.currentSubTab === 'dates') {
      this.bindDatesEvents();
      this.calcWorkDaysDiff();
      this.calcAddWorkDays();
    } else if (this.currentSubTab === 'fot') {
      this.bindFotEvents();
      this.calcFot();
    } else if (this.currentSubTab === 'evm') {
      this.bindEvmEvents();
      this.calcEvm();
    }
  }

  // ============================================================
  // 1. STANDARD & FORMULA CALCULATOR
  // ============================================================

  renderStandardCalculatorHtml() {
    return `
      <div>
        <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--text-primary);">🧮 Инженерно-финансовый калькулятор формул</h3>
        <p style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 2px;">
          Поддерживает составление длинных математических выражений, скобки, проценты, корни, степени и быстрые финансовые коэффициенты.
        </p>
      </div>

      <div class="calc-standard-grid">
        
        <!-- Left: Calculator Device -->
        <div class="calc-device">
          <!-- Screen Display -->
          <div class="calc-screen">
            <input type="text" class="calc-screen-expr" id="calc-input-expr" placeholder="Введите выражение или кликайте кнопки..." value="${this.escapeHtml(this.calcExpression)}" autocomplete="off" autocorrect="off" spellcheck="false">
            <div class="calc-screen-result" id="calc-display-result">${this.calcResult}</div>
          </div>

          <!-- Quick Business Presets Bar -->
          <div class="calc-quick-bar">
            <button type="button" class="calc-quick-btn" data-macro="vat_add" title="Умножить на 1.20">+20% НДС</button>
            <button type="button" class="calc-quick-btn" data-macro="vat_sub" title="Разделить на 1.20">-20% Без НДС</button>
            <button type="button" class="calc-quick-btn" data-macro="mul_1k" title="Умножить на 1 000">× 1 000</button>
            <button type="button" class="calc-quick-btn" data-macro="div_1k" title="Разделить на 1 000 (в тыс. руб.)">÷ 1 000</button>
          </div>

          <!-- Keypad Grid (5x5) -->
          <div class="calc-keypad">
            <!-- Row 1 -->
            <button type="button" class="calc-key action" data-key="clear_all">C</button>
            <button type="button" class="calc-key action" data-key="clear_entry">CE</button>
            <button type="button" class="calc-key op" data-key="backspace">⌫</button>
            <button type="button" class="calc-key op" data-key="(">(</button>
            <button type="button" class="calc-key op" data-key=")">)</button>

            <!-- Row 2 -->
            <button type="button" class="calc-key op" data-key="sqrt">√</button>
            <button type="button" class="calc-key num" data-key="7">7</button>
            <button type="button" class="calc-key num" data-key="8">8</button>
            <button type="button" class="calc-key num" data-key="9">9</button>
            <button type="button" class="calc-key op" data-key="/">÷</button>

            <!-- Row 3 -->
            <button type="button" class="calc-key op" data-key="^">xʸ</button>
            <button type="button" class="calc-key num" data-key="4">4</button>
            <button type="button" class="calc-key num" data-key="5">5</button>
            <button type="button" class="calc-key num" data-key="6">6</button>
            <button type="button" class="calc-key op" data-key="*">×</button>

            <!-- Row 4 -->
            <button type="button" class="calc-key op" data-key="%">%</button>
            <button type="button" class="calc-key num" data-key="1">1</button>
            <button type="button" class="calc-key num" data-key="2">2</button>
            <button type="button" class="calc-key num" data-key="3">3</button>
            <button type="button" class="calc-key op" data-key="-">−</button>

            <!-- Row 5 -->
            <button type="button" class="calc-key num" data-key="00">00</button>
            <button type="button" class="calc-key num" data-key="0">0</button>
            <button type="button" class="calc-key num" data-key=".">,</button>
            <button type="button" class="calc-key op" data-key="+">+</button>
            <button type="button" class="calc-key op" data-key="pi">π</button>

            <!-- Row 6 -->
            <button type="button" class="calc-key" id="btn-copy-calc-result" style="grid-column: span 3; font-size: 0.85rem;" title="Скопировать число в буфер обмена">
              📋 Скопировать
            </button>
            <button type="button" class="calc-key equals" data-key="=">=</button>
          </div>
        </div>

        <!-- Right: Calculation History Tape -->
        <div class="calc-history-card">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">
            <div style="font-weight: 700; font-size: 0.92rem;">📜 Журнал вычислений</div>
            <button type="button" class="btn btn-sm btn-danger" id="btn-clear-calc-history" style="font-size: 0.72rem; padding: 2px 6px;">
              Очистить историю
            </button>
          </div>
          
          <div class="calc-history-list" id="calc-history-list">
            ${this.calcHistory.length === 0 ? `
              <div style="text-align: center; padding: 3rem 1rem; color: var(--text-muted); font-size: 0.85rem;">
                История вычислений пуста.<br>Выполните расчет с помощью клавиши «=» или Enter.
              </div>
            ` : this.calcHistory.map((item, idx) => `
              <div class="calc-history-item" data-history-idx="${idx}" title="Нажмите, чтобы вставить этот результат в формулу">
                <div style="display: flex; justify-content: space-between;">
                  <span class="calc-hist-expr">${this.escapeHtml(item.expression)} =</span>
                  <span style="font-size: 0.7rem; color: var(--text-muted);">${item.time || ''}</span>
                </div>
                <div class="calc-hist-res">${this.escapeHtml(item.result)}</div>
              </div>
            `).join('')}
          </div>
        </div>

      </div>
    `;
  }

  bindStandardCalculatorEvents() {
    const exprInput = document.getElementById('calc-input-expr');
    const displayResult = document.getElementById('calc-display-result');

    // Live typing on input
    exprInput?.addEventListener('input', (e) => {
      this.calcExpression = e.target.value;
      this.evaluateLiveResult();
    });

    // Enter & Escape keys
    exprInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.executeCalculation();
      } else if (e.key === 'Escape') {
        this.calcExpression = '';
        this.calcResult = '0';
        if (exprInput) exprInput.value = '';
        if (displayResult) displayResult.textContent = '0';
      }
    });

    // Keypad clicks
    document.querySelectorAll('.calc-key').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.key;
        if (!key) return;

        if (key === 'clear_all') {
          this.calcExpression = '';
          this.calcResult = '0';
        } else if (key === 'clear_entry') {
          this.calcExpression = '';
        } else if (key === 'backspace') {
          this.calcExpression = this.calcExpression.slice(0, -1);
        } else if (key === '=') {
          this.executeCalculation();
          return;
        } else if (key === 'sqrt') {
          this.calcExpression += 'sqrt(';
        } else if (key === '^') {
          this.calcExpression += '^';
        } else if (key === 'pi') {
          this.calcExpression += 'π';
        } else {
          this.calcExpression += key;
        }

        if (exprInput) {
          exprInput.value = this.calcExpression;
          exprInput.focus();
        }
        this.evaluateLiveResult();
      });
    });

    // Quick macros
    document.querySelectorAll('.calc-quick-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const macro = btn.dataset.macro;
        let curVal = this.getNumericCurrentValue();

        if (macro === 'vat_add') {
          this.calcExpression = `(${curVal} * 1.20)`;
        } else if (macro === 'vat_sub') {
          this.calcExpression = `(${curVal} / 1.20)`;
        } else if (macro === 'mul_1k') {
          this.calcExpression = `(${curVal} * 1000)`;
        } else if (macro === 'div_1k') {
          this.calcExpression = `(${curVal} / 1000)`;
        }

        if (exprInput) exprInput.value = this.calcExpression;
        this.executeCalculation();
      });
    });

    // Copy result
    document.getElementById('btn-copy-calc-result')?.addEventListener('click', async () => {
      const cleanNum = this.calcResult.replace(/\s/g, '').replace(',', '.');
      try {
        await navigator.clipboard.writeText(cleanNum);
        window.app.showToast(`Результат ${this.calcResult} скопирован в буфер`, 'success');
      } catch (e) {
        window.app.showToast('Не удалось скопировать', 'warning');
      }
    });

    // History tape item click
    document.querySelectorAll('.calc-history-item').forEach(item => {
      item.addEventListener('click', () => {
        const idx = parseInt(item.dataset.historyIdx, 10);
        const hist = this.calcHistory[idx];
        if (hist) {
          const rawNum = hist.result.replace(/\s/g, '').replace(',', '.');
          this.calcExpression += rawNum;
          if (exprInput) {
            exprInput.value = this.calcExpression;
            exprInput.focus();
          }
          this.evaluateLiveResult();
        }
      });
    });

    // Clear history
    document.getElementById('btn-clear-calc-history')?.addEventListener('click', () => {
      this.calcHistory = [];
      localStorage.removeItem('calc_history_tape');
      this.render();
      window.app.showToast('История вычислений очищена', 'info');
    });
  }

  getNumericCurrentValue() {
    let clean = this.calcResult.replace(/\s/g, '').replace(',', '.');
    let num = parseFloat(clean);
    return isNaN(num) ? (parseFloat(this.calcExpression) || 0) : num;
  }

  evaluateLiveResult() {
    const displayResult = document.getElementById('calc-display-result');
    if (!displayResult) return;

    if (!this.calcExpression.trim()) {
      displayResult.textContent = '0';
      return;
    }

    try {
      const val = this.evaluateMathExpression(this.calcExpression);
      displayResult.textContent = this.formatNumber(val);
    } catch (e) {
      // Keep showing previous or ellipsis while typing incomplete formula
    }
  }

  executeCalculation() {
    const displayResult = document.getElementById('calc-display-result');
    const exprInput = document.getElementById('calc-input-expr');

    if (!this.calcExpression.trim()) return;

    try {
      const val = this.evaluateMathExpression(this.calcExpression);
      this.calcResult = this.formatNumber(val);
      if (displayResult) displayResult.textContent = this.calcResult;

      // Save to history
      const now = new Date();
      const timeStr = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      
      this.calcHistory.unshift({
        expression: this.calcExpression,
        result: this.calcResult,
        time: timeStr
      });

      if (this.calcHistory.length > 50) this.calcHistory.pop();
      localStorage.setItem('calc_history_tape', JSON.stringify(this.calcHistory));

      // Re-render history pane without losing focus
      const historyListEl = document.getElementById('calc-history-list');
      if (historyListEl) {
        historyListEl.innerHTML = this.calcHistory.map((item, idx) => `
          <div class="calc-history-item" data-history-idx="${idx}" title="Нажмите, чтобы вставить этот результат в формулу">
            <div style="display: flex; justify-content: space-between;">
              <span class="calc-hist-expr">${this.escapeHtml(item.expression)} =</span>
              <span style="font-size: 0.7rem; color: var(--text-muted);">${item.time || ''}</span>
            </div>
            <div class="calc-hist-res">${this.escapeHtml(item.result)}</div>
          </div>
        `).join('');

        historyListEl.querySelectorAll('.calc-history-item').forEach(item => {
          item.addEventListener('click', () => {
            const idx = parseInt(item.dataset.historyIdx, 10);
            const hist = this.calcHistory[idx];
            if (hist) {
              const rawNum = hist.result.replace(/\s/g, '').replace(',', '.');
              this.calcExpression += rawNum;
              if (exprInput) {
                exprInput.value = this.calcExpression;
                exprInput.focus();
              }
              this.evaluateLiveResult();
            }
          });
        });
      }

    } catch (err) {
      if (displayResult) displayResult.textContent = 'Ошибка';
      window.app.showToast('Ошибка в формуле: проверьте скобки и знаки', 'warning');
    }
  }

  evaluateMathExpression(expr) {
    if (!expr || !expr.trim()) return 0;
    
    let str = expr.trim()
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .replace(/,/g, '.')
      .replace(/π/g, 'Math.PI')
      .replace(/\bpi\b/gi, 'Math.PI')
      .replace(/\be\b/gi, 'Math.E')
      .replace(/√/g, 'Math.sqrt')
      .replace(/sqrt/gi, 'Math.sqrt')
      .replace(/abs/gi, 'Math.abs')
      .replace(/round/gi, 'Math.round')
      .replace(/floor/gi, 'Math.floor')
      .replace(/ceil/gi, 'Math.ceil')
      .replace(/sin/gi, 'Math.sin')
      .replace(/cos/gi, 'Math.cos')
      .replace(/tan/gi, 'Math.tan')
      .replace(/ln/gi, 'Math.log')
      .replace(/log/gi, 'Math.log10')
      .replace(/\^/g, '**');

    // Percentage handling: e.g. "500 + 10%" -> "500 + (500 * 0.1)" or "10%" -> "0.1"
    str = str.replace(/(\d+(?:\.\d+)?)%/g, '($1/100)');

    // Whitelist security validation: strictly allowed characters only
    if (!/^[0-9+\-*/().,% MathPIEsqrTabclonfdg]+$/.test(str)) {
      throw new Error('Недопустимый символ');
    }

    const res = Function(`"use strict"; return (${str})`)();
    if (typeof res !== 'number' || isNaN(res) || !isFinite(res)) {
      throw new Error('Некорректный результат');
    }
    return res;
  }

  formatNumber(n) {
    if (typeof n !== 'number' || isNaN(n)) return '0';
    if (Math.abs(n) < 1e-6 && n !== 0) return n.toExponential(4);
    
    // Round to 8 decimal places max to avoid JS floating point artifacts
    const rounded = Math.round(n * 1e8) / 1e8;
    const parts = rounded.toString().split('.');
    
    const integerFormatted = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return parts.length > 1 ? `${integerFormatted},${parts[1]}` : integerFormatted;
  }

  // ============================================================
  // 2. TEXT CASE CONVERTER (КОНВЕРТЕР РЕГИСТРОВ)
  // ============================================================

  renderCaseConverterHtml() {
    return `
      <div>
        <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--text-primary);">🔤 Конвертер регистров текста</h3>
        <p style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 2px;">
          Мгновенное изменение регистра: все большие буквы, все маленькие буквы, как в предложениях, каждое слово с заглавной и инверсия.
        </p>
      </div>

      <div class="text-tool-layout">
        
        <!-- Action Buttons Grid -->
        <div class="text-actions-grid">
          <button type="button" class="btn-tool-action" id="btn-case-upper" title="Сделать ВСЕ БУКВЫ ЗАГЛАВНЫМИ">
            <span>🔠</span>
            <span>ВСЕ ЗАГЛАВНЫЕ</span>
          </button>
          <button type="button" class="btn-tool-action" id="btn-case-lower" title="Сделать все буквы строчными">
            <span>🔡</span>
            <span>все строчные</span>
          </button>
          <button type="button" class="btn-tool-action" id="btn-case-sentence" title="Сделать первые буквы каждого предложения заглавными">
            <span>📝</span>
            <span>Как в предложениях</span>
          </button>
          <button type="button" class="btn-tool-action" id="btn-case-title" title="Сделать Первые Буквы Каждого Слова Большими">
            <span>🔤</span>
            <span>Каждое Слово С Заглавной</span>
          </button>
          <button type="button" class="btn-tool-action" id="btn-case-toggle" title="Инвертировать регистр: заглавные станут строчными, строчные — заглавными">
            <span>🔄</span>
            <span>иНВЕРСИЯ рЕГИСТРА</span>
          </button>
          <button type="button" class="btn-tool-action" id="btn-case-clean" title="Удалить двойные пробелы, пустые строки и пробелы по краям">
            <span>🧹</span>
            <span>Очистить пробелы</span>
          </button>
        </div>

        <!-- Text Area -->
        <div class="form-group">
          <textarea id="case-text-input" class="form-control" rows="12" style="font-size: 0.95rem; line-height: 1.5; font-family: inherit;" placeholder="Вставьте или введите текст для преобразования регистра...">${this.escapeHtml(this.caseText)}</textarea>
        </div>

        <!-- Bottom Stats & Clipboard Controls -->
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
          <div class="text-stats-bar" id="case-stats-bar">
            <span class="text-stat-chip">Символов: <b id="case-stat-chars">0</b></span>
            <span class="text-stat-chip">Без пробелов: <b id="case-stat-nospace">0</b></span>
            <span class="text-stat-chip">Слов: <b id="case-stat-words">0</b></span>
            <span class="text-stat-chip">Строк: <b id="case-stat-lines">0</b></span>
          </div>

          <div style="display: flex; gap: 0.5rem;">
            <button type="button" class="btn btn-primary" id="btn-copy-case-text">
              📋 Скопировать результат
            </button>
            <button type="button" class="btn" id="btn-paste-case-text">
              📥 Вставить из буфера
            </button>
            <button type="button" class="btn" id="btn-clear-case-text">
              🗑 Очистить
            </button>
          </div>
        </div>

      </div>
    `;
  }

  bindCaseConverterEvents() {
    const textInput = document.getElementById('case-text-input');
    
    const updateStats = () => {
      this.caseText = textInput?.value || '';
      const text = this.caseText;

      const charCount = text.length;
      const noSpaceCount = text.replace(/\s/g, '').length;
      const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
      const lineCount = text ? text.split('\n').length : 0;

      const elChars = document.getElementById('case-stat-chars');
      const elNoSpace = document.getElementById('case-stat-nospace');
      const elWords = document.getElementById('case-stat-words');
      const elLines = document.getElementById('case-stat-lines');

      if (elChars) elChars.textContent = String(charCount);
      if (elNoSpace) elNoSpace.textContent = String(noSpaceCount);
      if (elWords) elWords.textContent = String(wordCount);
      if (elLines) elLines.textContent = String(lineCount);
    };

    textInput?.addEventListener('input', updateStats);
    updateStats();

    // 1. UPPERCASE
    document.getElementById('btn-case-upper')?.addEventListener('click', () => {
      if (!textInput) return;
      textInput.value = textInput.value.toUpperCase();
      updateStats();
      window.app.showToast('Текст преобразован в ЗАГЛАВНЫЕ буквы', 'success');
    });

    // 2. lowercase
    document.getElementById('btn-case-lower')?.addEventListener('click', () => {
      if (!textInput) return;
      textInput.value = textInput.value.toLowerCase();
      updateStats();
      window.app.showToast('Текст преобразован в строчные буквы', 'success');
    });

    // 3. Sentence case
    document.getElementById('btn-case-sentence')?.addEventListener('click', () => {
      if (!textInput) return;
      let text = textInput.value.toLowerCase();
      // Capitalize first character and any character after period, exclamation, question mark, or newline
      text = text.replace(/(^\s*|[.!?\n]\s+)([a-zа-яё])/gu, (match, prefix, char) => {
        return prefix + char.toUpperCase();
      });
      textInput.value = text;
      updateStats();
      window.app.showToast('Применен регистр: Как в предложениях', 'success');
    });

    // 4. Title Case (Каждое Слово С Заглавной)
    document.getElementById('btn-case-title')?.addEventListener('click', () => {
      if (!textInput) return;
      let text = textInput.value.toLowerCase();
      text = text.replace(/(^|[\s\-_—–"«'(\[])([a-zа-яё])/gu, (match, sep, char) => {
        return sep + char.toUpperCase();
      });
      textInput.value = text;
      updateStats();
      window.app.showToast('Каждое слово сделано с заглавной буквы', 'success');
    });

    // 5. Toggle Case (иНВЕРСИЯ рЕГИСТРА)
    document.getElementById('btn-case-toggle')?.addEventListener('click', () => {
      if (!textInput) return;
      const text = textInput.value;
      let toggled = '';
      for (let i = 0; i < text.length; i++) {
        const c = text[i];
        toggled += c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase();
      }
      textInput.value = toggled;
      updateStats();
      window.app.showToast('Регистр букв инвертирован', 'success');
    });

    // 6. Clean Whitespace
    document.getElementById('btn-case-clean')?.addEventListener('click', () => {
      if (!textInput) return;
      const cleaned = textInput.value
        .split('\n')
        .map(line => line.replace(/[ \t]+/g, ' ').trim())
        .filter((line, idx, arr) => line.length > 0 || (idx > 0 && arr[idx - 1].length > 0))
        .join('\n')
        .trim();
      textInput.value = cleaned;
      updateStats();
      window.app.showToast('Лишние пробелы и пустые строки удалены', 'success');
    });

    // Copy text
    document.getElementById('btn-copy-case-text')?.addEventListener('click', async () => {
      if (!textInput || !textInput.value) {
        window.app.showToast('Нет текста для копирования', 'warning');
        return;
      }
      try {
        await navigator.clipboard.writeText(textInput.value);
        window.app.showToast('Текст успешно скопирован в буфер обмена', 'success');
      } catch (e) {
        window.app.showToast('Не удалось скопировать текст', 'warning');
      }
    });

    // Paste text
    document.getElementById('btn-paste-case-text')?.addEventListener('click', async () => {
      if (!textInput) return;
      try {
        const clipText = await navigator.clipboard.readText();
        textInput.value = clipText;
        updateStats();
        window.app.showToast('Текст вставлен из буфера обмена', 'info');
      } catch (e) {
        window.app.showToast('Буфер обмена недоступен (используйте Ctrl+V)', 'warning');
      }
    });

    // Clear
    document.getElementById('btn-clear-case-text')?.addEventListener('click', () => {
      if (textInput) {
        textInput.value = '';
        updateStats();
        textInput.focus();
      }
    });
  }

  // ============================================================
  // 3. KEYBOARD LAYOUT CONVERTER (КОНВЕРТЕР РАСКЛАДОК)
  // ============================================================

  renderLayoutConverterHtml() {
    return `
      <div>
        <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--text-primary);">🌐 Конвертер раскладок клавиатуры (Punto Switcher)</h3>
        <p style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 2px;">
          Быстрое исправление текста, набранного не в той раскладке (например: <code>Ghbdtn, rfr ltkf?</code> ➡️ <code>Привет, как дела?</code> или <code>руддщ</code> ➡️ <code>hello</code>).
        </p>
      </div>

      <div class="text-tool-layout">
        
        <!-- Action Buttons -->
        <div class="text-actions-grid">
          <button type="button" class="btn-tool-action btn-primary" id="btn-layout-auto" title="Автоматически определить язык и сменить раскладку на противоположную">
            <span>🔄</span>
            <span>Автоопределение и смена</span>
          </button>
          <button type="button" class="btn-tool-action" id="btn-layout-en-ru" title="Преобразовать английские буквы в русские (ghbdtn -> привет)">
            <span>🇬🇧 ➡️ 🇷🇺</span>
            <span>English ➡️ Русский</span>
          </button>
          <button type="button" class="btn-tool-action" id="btn-layout-ru-en" title="Преобразовать русские буквы в английские (руддщ -> hello)">
            <span>🇷🇺 ➡️ 🇬🇧</span>
            <span>Русский ➡️ English</span>
          </button>
          <button type="button" class="btn-tool-action" id="btn-layout-translit-ru" title="Транслитерация русского текста латиницей по ГОСТ 7.79 (Москва -> Moskva)">
            <span>🔤</span>
            <span>Транслит (Рус ➡️ Lat)</span>
          </button>
        </div>

        <!-- Input / Output Text Area -->
        <div class="form-group">
          <textarea id="layout-text-input" class="form-control" rows="12" style="font-size: 0.95rem; line-height: 1.5; font-family: inherit;" placeholder="Вставьте текст с ошибочной раскладкой (например: Ghbdtn, rfr ltkf?)...">${this.escapeHtml(this.layoutText)}</textarea>
        </div>

        <!-- Bottom Controls -->
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
          <div class="text-stats-bar" id="layout-stats-bar">
            <span class="text-stat-chip">Символов: <b id="layout-stat-chars">0</b></span>
            <span class="text-stat-chip">Слов: <b id="layout-stat-words">0</b></span>
            <span class="text-stat-chip">Язык: <b id="layout-stat-lang">Латиница</b></span>
          </div>

          <div style="display: flex; gap: 0.5rem;">
            <button type="button" class="btn btn-primary" id="btn-copy-layout-text">
              📋 Скопировать результат
            </button>
            <button type="button" class="btn" id="btn-paste-layout-text">
              📥 Вставить из буфера
            </button>
            <button type="button" class="btn" id="btn-clear-layout-text">
              🗑 Очистить
            </button>
          </div>
        </div>

      </div>
    `;
  }

  bindLayoutConverterEvents() {
    const textInput = document.getElementById('layout-text-input');

    const updateStats = () => {
      this.layoutText = textInput?.value || '';
      const text = this.layoutText;

      const charCount = text.length;
      const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
      
      const latCount = (text.match(/[a-zA-Z]/g) || []).length;
      const cyrCount = (text.match(/[а-яА-ЯёЁ]/g) || []).length;
      
      let lang = 'Смешанный';
      if (latCount > 0 && cyrCount === 0) lang = 'Английский (QWERTY)';
      else if (cyrCount > 0 && latCount === 0) lang = 'Русский (ЙЦУКЕН)';
      else if (latCount > cyrCount) lang = 'Преобладает Англ.';
      else if (cyrCount > latCount) lang = 'Преобладает Рус.';
      else if (charCount === 0) lang = '—';

      const elChars = document.getElementById('layout-stat-chars');
      const elWords = document.getElementById('layout-stat-words');
      const elLang = document.getElementById('layout-stat-lang');

      if (elChars) elChars.textContent = String(charCount);
      if (elWords) elWords.textContent = String(wordCount);
      if (elLang) elLang.textContent = lang;
    };

    textInput?.addEventListener('input', updateStats);
    updateStats();

    // 1. Auto detect & switch
    document.getElementById('btn-layout-auto')?.addEventListener('click', () => {
      if (!textInput || !textInput.value) return;
      const text = textInput.value;
      const latCount = (text.match(/[a-zA-Z]/g) || []).length;
      const cyrCount = (text.match(/[а-яА-ЯёЁ]/g) || []).length;

      if (latCount >= cyrCount) {
        textInput.value = this.convertEnToRu(text);
        window.app.showToast('Раскладка изменена: English ➡️ Русский', 'success');
      } else {
        textInput.value = this.convertRuToEn(text);
        window.app.showToast('Раскладка изменена: Русский ➡️ English', 'success');
      }
      updateStats();
    });

    // 2. English -> Russian
    document.getElementById('btn-layout-en-ru')?.addEventListener('click', () => {
      if (!textInput || !textInput.value) return;
      textInput.value = this.convertEnToRu(textInput.value);
      updateStats();
      window.app.showToast('Текст переведен в русскую раскладку (ЙЦУКЕН)', 'success');
    });

    // 3. Russian -> English
    document.getElementById('btn-layout-ru-en')?.addEventListener('click', () => {
      if (!textInput || !textInput.value) return;
      textInput.value = this.convertRuToEn(textInput.value);
      updateStats();
      window.app.showToast('Текст переведен в английскую раскладку (QWERTY)', 'success');
    });

    // 4. Transliteration (ГОСТ 7.79)
    document.getElementById('btn-layout-translit-ru')?.addEventListener('click', () => {
      if (!textInput || !textInput.value) return;
      textInput.value = this.transliterateRuToEn(textInput.value);
      updateStats();
      window.app.showToast('Выполнена транслитерация по ГОСТ 7.79', 'success');
    });

    // Copy
    document.getElementById('btn-copy-layout-text')?.addEventListener('click', async () => {
      if (!textInput || !textInput.value) {
        window.app.showToast('Нет текста для копирования', 'warning');
        return;
      }
      try {
        await navigator.clipboard.writeText(textInput.value);
        window.app.showToast('Исправленный текст скопирован в буфер обмена', 'success');
      } catch (e) {
        window.app.showToast('Не удалось скопировать', 'warning');
      }
    });

    // Paste
    document.getElementById('btn-paste-layout-text')?.addEventListener('click', async () => {
      if (!textInput) return;
      try {
        const clipText = await navigator.clipboard.readText();
        textInput.value = clipText;
        updateStats();
        window.app.showToast('Текст вставлен из буфера обмена', 'info');
      } catch (e) {
        window.app.showToast('Буфер обмена недоступен (используйте Ctrl+V)', 'warning');
      }
    });

    // Clear
    document.getElementById('btn-clear-layout-text')?.addEventListener('click', () => {
      if (textInput) {
        textInput.value = '';
        updateStats();
        textInput.focus();
      }
    });
  }

  convertEnToRu(text) {
    if (!text) return '';
    let res = '';
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      res += this.enToRuMap[c] !== undefined ? this.enToRuMap[c] : c;
    }
    return res;
  }

  convertRuToEn(text) {
    if (!text) return '';
    let res = '';
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      res += this.ruToEnMap[c] !== undefined ? this.ruToEnMap[c] : c;
    }
    return res;
  }

  transliterateRuToEn(text) {
    if (!text) return '';
    const map = {
      'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'zh',
      'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
      'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'kh', 'ц': 'ts',
      'ч': 'ch', 'ш': 'sh', 'щ': 'shch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
      'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'Yo', 'Ж': 'Zh',
      'З': 'Z', 'И': 'I', 'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M', 'Н': 'N', 'О': 'O',
      'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U', 'Ф': 'F', 'Х': 'Kh', 'Ц': 'Ts',
      'Ч': 'Ch', 'Ш': 'Sh', 'Щ': 'Shch', 'Ъ': '', 'Ы': 'Y', 'Ь': '', 'Э': 'E', 'Ю': 'Yu', 'Я': 'Ya'
    };
    return text.split('').map(c => map[c] !== undefined ? map[c] : c).join('');
  }

  // ============================================================
  // 4. VAT CALCULATOR
  // ============================================================

  renderVatCalculatorHtml() {
    return `
      <div>
        <h3 style="font-size: 1.1rem; font-weight: 700;">💰 Калькулятор НДС (20%, 10%, 0%)</h3>
        <p style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 2px;">
          Выделение НДС из суммы («в т.ч. НДС») и начисление налога сверху для счетов, договоров и спецификаций.
        </p>
      </div>

      <div class="calc-card" style="max-width: 680px;">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Исходная сумма (руб):</label>
            <input type="number" id="vat-input-sum" class="form-control" placeholder="100000" value="100000" min="0" step="1000">
          </div>
          <div class="form-group">
            <label class="form-label">Ставка НДС:</label>
            <select id="vat-rate" class="form-control">
              <option value="20" selected>20% (Основная ставка)</option>
              <option value="10">10% (Льготная ставка)</option>
              <option value="0">0% (Без НДС / Экспорт)</option>
            </select>
          </div>
        </div>

        <div class="form-group" style="margin-top: 0.75rem;">
          <label class="form-label">Режим расчета:</label>
          <select id="vat-mode" class="form-control">
            <option value="extract" selected>Выделить НДС из суммы («в т.ч. НДС»)</option>
            <option value="add">Начислить НДС сверху на сумму (+ НДС)</option>
          </select>
        </div>

        <div style="background: var(--bg-tertiary); padding: 1.25rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color); margin-top: 1rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
            <span style="font-weight: 700; color: var(--text-primary); font-size: 1.05rem;">Итоговый результат:</span>
            <b id="vat-result-total" style="font-size: 1.4rem; color: var(--accent-primary);">0.00 ₽</b>
          </div>
          <div id="vat-result-breakdown" style="font-size: 0.88rem; display: flex; flex-direction: column; gap: 0.35rem; color: var(--text-secondary); border-top: 1px solid var(--border-color); padding-top: 0.75rem;"></div>
        </div>

        <div style="margin-top: 1rem; text-align: right;">
          <button type="button" class="btn btn-primary" id="btn-copy-vat">
            📋 Скопировать формулировку для счета
          </button>
        </div>
      </div>
    `;
  }

  bindVatEvents() {
    ['vat-input-sum', 'vat-rate', 'vat-mode'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', () => this.calcVat());
      if (el) el.addEventListener('change', () => this.calcVat());
    });

    document.getElementById('btn-copy-vat')?.addEventListener('click', () => this.copyVatResult());
  }

  calcVat() {
    const sumInput = document.getElementById('vat-input-sum');
    const rateInput = document.getElementById('vat-rate');
    const modeInput = document.getElementById('vat-mode');

    const totalValEl = document.getElementById('vat-result-total');
    const breakdownEl = document.getElementById('vat-result-breakdown');

    if (!sumInput || !totalValEl) return;

    const rawSum = parseFloat(sumInput.value);
    const rate = parseFloat(rateInput?.value) || 0;
    const mode = modeInput?.value || 'extract';

    if (isNaN(rawSum) || rawSum < 0) {
      totalValEl.textContent = '0.00 ₽';
      if (breakdownEl) breakdownEl.innerHTML = '<span style="color:var(--danger)">Введите корректную сумму</span>';
      return;
    }

    let sumWithoutVat = 0;
    let vatAmount = 0;
    let sumWithVat = 0;

    if (mode === 'extract') {
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

  // ============================================================
  // 5. WORKING DAYS CALCULATOR
  // ============================================================

  renderDatesCalculatorHtml() {
    const todayStr = new Date().toISOString().split('T')[0];
    const nextMonth = new Date();
    nextMonth.setDate(nextMonth.getDate() + 30);
    const nextMonthStr = nextMonth.toISOString().split('T')[0];

    return `
      <div>
        <h3 style="font-size: 1.1rem; font-weight: 700;">📅 Калькулятор рабочих дней и производственных сроков</h3>
        <p style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 2px;">
          Точный расчет количества рабочих дней без суббот и воскресений, а также расчет даты дедлайна прибавки рабочих дней по 44-ФЗ/223-ФЗ.
        </p>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem;">
        
        <!-- Part A: Diff between dates -->
        <div class="calc-card">
          <h4 style="font-size: 0.95rem; font-weight: 700; margin-bottom: 0.75rem;">1. Количество рабочих дней между датами</h4>
          
          <div class="form-group">
            <label class="form-label">Дата начала:</label>
            <input type="date" id="wd-start-date" class="form-control" value="${todayStr}">
          </div>
          <div class="form-group">
            <label class="form-label">Дата окончания:</label>
            <input type="date" id="wd-end-date" class="form-control" value="${nextMonthStr}">
          </div>

          <div style="background: var(--bg-tertiary); padding: 1rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color); margin-top: 1rem;">
            <div style="font-size: 0.8rem; color: var(--text-muted);">Рабочих дней (Пн-Пт):</div>
            <div id="wd-diff-result" style="font-size: 1.6rem; font-weight: 800; color: var(--accent-primary);">—</div>
            <div id="wd-diff-desc" style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 4px;"></div>
          </div>
        </div>

        <!-- Part B: Add working days -->
        <div class="calc-card">
          <h4 style="font-size: 0.95rem; font-weight: 700; margin-bottom: 0.75rem;">2. Прибавить рабочие дни к дате</h4>
          
          <div class="form-group">
            <label class="form-label">Дата отсчета:</label>
            <input type="date" id="wd-add-start" class="form-control" value="${todayStr}">
          </div>
          <div class="form-group">
            <label class="form-label">Количество рабочих дней (+ N дней):</label>
            <input type="number" id="wd-add-count" class="form-control" value="15" min="1" max="500">
          </div>

          <div style="background: var(--bg-tertiary); padding: 1rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color); margin-top: 1rem;">
            <div style="font-size: 0.8rem; color: var(--text-muted);">Итоговая дата дедлайна:</div>
            <div id="wd-add-result" style="font-size: 1.6rem; font-weight: 800; color: #10b981;">—</div>
            <div id="wd-add-desc" style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 4px;"></div>
          </div>

          <button type="button" class="btn btn-sm btn-primary" id="btn-copy-deadline" style="margin-top: 0.75rem;">
            📋 Скопировать дату
          </button>
        </div>

      </div>
    `;
  }

  bindDatesEvents() {
    ['wd-start-date', 'wd-end-date'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', () => this.calcWorkDaysDiff());
      if (el) el.addEventListener('change', () => this.calcWorkDaysDiff());
    });

    ['wd-add-start', 'wd-add-count'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', () => this.calcAddWorkDays());
      if (el) el.addEventListener('change', () => this.calcAddWorkDays());
    });

    document.getElementById('btn-copy-deadline')?.addEventListener('click', () => this.copyDeadlineResult());
  }

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

    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) {
      resEl.textContent = 'Ошибка';
      return;
    }

    if (d2 < d1) {
      resEl.textContent = '0 дн.';
      if (descEl) descEl.innerHTML = '<span style="color:var(--danger)">Дата окончания раньше даты начала!</span>';
      return;
    }

    let cur = new Date(d1);
    let workDaysCount = 0;
    let calendarDays = 0;

    while (cur <= d2) {
      const day = cur.getDay();
      calendarDays++;
      if (day !== 0 && day !== 6) {
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
      return;
    }

    let cur = new Date(dStr);
    if (isNaN(cur.getTime())) {
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

  // ============================================================
  // 6. LABOR COST & FOT CALCULATOR
  // ============================================================

  renderFotCalculatorHtml() {
    return `
      <div>
        <h3 style="font-size: 1.1rem; font-weight: 700;">👥 Калькулятор ФОТ и себестоимости человеко-часа</h3>
        <p style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 2px;">
          Расчет прямых затрат на оплату труда с учетом страховых взносов (ПФР, ФОМС, ФСС) и накладных расходов проекта.
        </p>
      </div>

      <div class="calc-card" style="max-width: 680px;">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Трудоемкость задачи (часы):</label>
            <input type="number" id="fot-hours" class="form-control" value="80" min="0">
          </div>
          <div class="form-group">
            <label class="form-label">Базовая ставка специалиста (₽/час):</label>
            <input type="number" id="fot-rate" class="form-control" value="1500" min="0" step="100">
          </div>
        </div>

        <div class="form-row" style="margin-top: 0.75rem;">
          <div class="form-group">
            <label class="form-label">Страховые взносы и налоги (%):</label>
            <input type="number" id="fot-tax" class="form-control" value="30.2" step="0.1" min="0">
          </div>
          <div class="form-group">
            <label class="form-label">Накладные расходы проекта (%):</label>
            <input type="number" id="fot-overhead" class="form-control" value="20" min="0">
          </div>
        </div>

        <div style="background: var(--bg-tertiary); padding: 1.25rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color); margin-top: 1rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
            <span style="font-weight: 700; color: var(--text-primary);">Полная себестоимость этапа:</span>
            <b id="fot-result-total" style="font-size: 1.4rem; color: var(--accent-primary);">0 ₽</b>
          </div>
          <div id="fot-result-breakdown" style="font-size: 0.85rem; display: flex; flex-direction: column; gap: 0.35rem; color: var(--text-secondary); border-top: 1px solid var(--border-color); padding-top: 0.75rem;"></div>
        </div>
      </div>
    `;
  }

  bindFotEvents() {
    ['fot-hours', 'fot-rate', 'fot-tax', 'fot-overhead'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', () => this.calcFot());
    });
  }

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

  // ============================================================
  // 7. EVM CALCULATOR
  // ============================================================

  renderEvmCalculatorHtml() {
    return `
      <div>
        <h3 style="font-size: 1.1rem; font-weight: 700;">📈 Экспресс-калькулятор освоенного объема (EVM)</h3>
        <p style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 2px;">
          Быстрый расчет индексов выполнения сроков (SPI) и стоимости (CPI) по стандарту ГОСТ Р ИСО 21508.
        </p>
      </div>

      <div class="calc-card" style="max-width: 680px;">
        <div class="form-row-3">
          <div class="form-group">
            <label class="form-label">Плановый объем (PV, руб):</label>
            <input type="number" id="evm-pv" class="form-control" value="10000000" step="100000">
          </div>
          <div class="form-group">
            <label class="form-label">Освоенный объем (EV, руб):</label>
            <input type="number" id="evm-ev" class="form-control" value="10500000" step="100000">
          </div>
          <div class="form-group">
            <label class="form-label">Фактическая стоимость (AC, руб):</label>
            <input type="number" id="evm-ac" class="form-control" value="9800000" step="100000">
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1rem;">
          <div style="background: var(--bg-tertiary); padding: 1rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
            <div style="font-size: 0.8rem; color: var(--text-muted);">Индекс выполнения сроков (SPI = EV/PV):</div>
            <div id="evm-spi-val" style="font-size: 1.6rem; font-weight: 800; color: #10b981;">1.05</div>
          </div>
          <div style="background: var(--bg-tertiary); padding: 1rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
            <div style="font-size: 0.8rem; color: var(--text-muted);">Индекс выполнения стоимости (CPI = EV/AC):</div>
            <div id="evm-cpi-val" style="font-size: 1.6rem; font-weight: 800; color: #3b82f6;">1.07</div>
          </div>
        </div>

        <div id="evm-summary-desc" style="background: var(--bg-primary); border: 1px solid var(--border-color); padding: 0.85rem; border-radius: var(--radius-sm); font-size: 0.85rem; margin-top: 1rem;"></div>
      </div>
    `;
  }

  bindEvmEvents() {
    ['evm-pv', 'evm-ev', 'evm-ac'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', () => this.calcEvm());
    });
  }

  calcEvm() {
    const pv = Math.max(0, parseFloat(document.getElementById('evm-pv')?.value) || 0);
    const ev = Math.max(0, parseFloat(document.getElementById('evm-ev')?.value) || 0);
    const ac = Math.max(0, parseFloat(document.getElementById('evm-ac')?.value) || 0);

    const cpi = ac > 0 ? (ev / ac) : 1;
    const spi = pv > 0 ? (ev / pv) : 1;
    const cv = ev - ac;
    const sv = ev - pv;

    const spiEl = document.getElementById('evm-spi-val');
    const cpiEl = document.getElementById('evm-cpi-val');
    const descEl = document.getElementById('evm-summary-desc');

    if (spiEl) {
      spiEl.textContent = isFinite(spi) ? spi.toFixed(2) : '1.00';
      spiEl.style.color = spi >= 1 ? '#10b981' : '#ef4444';
    }
    if (cpiEl) {
      cpiEl.textContent = isFinite(cpi) ? cpi.toFixed(2) : '1.00';
      cpiEl.style.color = cpi >= 1 ? '#3b82f6' : '#ef4444';
    }

    if (descEl) {
      const spiStatus = spi >= 1 ? '🟢 С опережением графика' : '🔴 Отставание по срокам';
      const cpiStatus = cpi >= 1 ? '🟢 Экономия бюджета' : '🔴 Превышение бюджета';
      descEl.innerHTML = `
        <div>График (SPI = ${spi.toFixed(2)}): <b>${spiStatus}</b> (${new Intl.NumberFormat('ru-RU').format(Math.round(sv))} ₽)</div>
        <div>Бюджет (CPI = ${cpi.toFixed(2)}): <b>${cpiStatus}</b> (${new Intl.NumberFormat('ru-RU').format(Math.round(cv))} ₽)</div>
      `;
    }
  }

  escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}

window.calculatorsModule = new CalculatorsModule();
