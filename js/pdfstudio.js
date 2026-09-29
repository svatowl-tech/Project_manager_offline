/**
 * PDF Studio Module (PDF24 Offline Suite for Senior Managers)
 * Provides comprehensive offline PDF manipulation:
 * 1. Merge PDF files
 * 2. Split & Extract pages
 * 3. Organize, Rotate & Delete pages (Visual Grid)
 * 4. Watermarks, Corporate Stamps & Page Numbering
 * 5. PDF Compression & Optimization
 * 6. Images to PDF Converter (Batch JPG/PNG)
 * 7. Extract Text & Render Pages to PNG
 */

class PDFStudioModule {
  constructor() {
    this.currentTool = 'merge'; // 'merge', 'split', 'organize', 'watermark', 'compress', 'img2pdf', 'extract'
    
    // State for Merge
    this.mergeFiles = []; // Array of { id, name, size, pageCount, bytes, dataUrl }

    // State for Split
    this.splitFile = null; // { name, size, bytes, numPages, pdfDoc }
    this.splitThumbnails = [];

    // State for Organize
    this.organizeFile = null; // { name, size, bytes, numPages, pdfDoc }
    this.organizePages = []; // Array of { originalIndex, rotation, isDeleted, canvasThumb, id }

    // State for Watermark
    this.watermarkFile = null; // { name, size, bytes, numPages, pdfDoc }
    this.watermarkSettings = {
      preset: 'copy_verified',
      text: 'КОПИЯ ВЕРНА',
      subtext: '',
      color: '#dc2626',
      angle: 45,
      opacity: 35,
      fontSize: 32,
      position: 'center', // 'center', 'bottom_right', 'top_right', 'header', 'footer'
      includeDate: true,
      includeUser: true,
      addPageNumbers: false,
      pageNumberFormat: 'page_of_total', // 'page_of_total', 'slash', 'simple'
      pageNumberPos: 'bottom_center'
    };

    // State for Compression
    this.compressFile = null; // { name, size, bytes, numPages }
    this.compressLevel = 'medium'; // 'high', 'medium', 'low'

    // State for Images to PDF
    this.img2pdfImages = []; // Array of { id, name, size, dataUrl, imgEl, width, height }
    this.img2pdfSettings = {
      pageSize: 'a4_portrait', // 'a4_portrait', 'a4_landscape', 'auto'
      margin: 'narrow' // 'none', 'narrow', 'standard'
    };

    // State for Extract
    this.extractFile = null;
    this.extractedText = '';
    this.extractedPagePngs = [];
  }

  init() {
    this.bindEvents();
    this.renderToolSelector();
    this.switchTool('merge');
  }

  bindEvents() {
    // Tool selector buttons
    document.querySelectorAll('.pdf-tool-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tool = btn.dataset.tool;
        if (tool) this.switchTool(tool);
      });
    });

    // 1. Merge Events
    const mergeInput = document.getElementById('pdf-merge-input');
    const mergeDropzone = document.getElementById('pdf-merge-dropzone');
    if (mergeInput) {
      mergeInput.addEventListener('change', (e) => this.handleMergeFiles(e.target.files));
    }
    if (mergeDropzone) {
      mergeDropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        mergeDropzone.classList.add('drag-active');
      });
      mergeDropzone.addEventListener('dragleave', () => {
        mergeDropzone.classList.remove('drag-active');
      });
      mergeDropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        mergeDropzone.classList.remove('drag-active');
        if (e.dataTransfer.files) this.handleMergeFiles(e.dataTransfer.files);
      });
    }

    document.getElementById('btn-execute-merge')?.addEventListener('click', () => this.executeMerge());
    document.getElementById('btn-clear-merge')?.addEventListener('click', () => {
      this.mergeFiles = [];
      this.renderMergeList();
      window.app.showToast('Список файлов очищен', 'info');
    });

    // 2. Split Events
    const splitInput = document.getElementById('pdf-split-input');
    const splitDropzone = document.getElementById('pdf-split-dropzone');
    if (splitInput) {
      splitInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) this.loadSplitFile(e.target.files[0]);
      });
    }
    if (splitDropzone) {
      splitDropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        splitDropzone.classList.add('drag-active');
      });
      splitDropzone.addEventListener('dragleave', () => {
        splitDropzone.classList.remove('drag-active');
      });
      splitDropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        splitDropzone.classList.remove('drag-active');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) this.loadSplitFile(e.dataTransfer.files[0]);
      });
    }

    document.getElementById('btn-execute-split')?.addEventListener('click', () => this.executeSplit());

    // 3. Organize Events
    const orgInput = document.getElementById('pdf-org-input');
    const orgDropzone = document.getElementById('pdf-org-dropzone');
    if (orgInput) {
      orgInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) this.loadOrganizeFile(e.target.files[0]);
      });
    }
    if (orgDropzone) {
      orgDropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        orgDropzone.classList.add('drag-active');
      });
      orgDropzone.addEventListener('dragleave', () => {
        orgDropzone.classList.remove('drag-active');
      });
      orgDropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        orgDropzone.classList.remove('drag-active');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) this.loadOrganizeFile(e.dataTransfer.files[0]);
      });
    }

    document.getElementById('btn-org-rotate-all-cw')?.addEventListener('click', () => this.rotateAllOrganizePages(90));
    document.getElementById('btn-org-rotate-all-ccw')?.addEventListener('click', () => this.rotateAllOrganizePages(-90));
    document.getElementById('btn-org-reset')?.addEventListener('click', () => this.resetOrganizePages());
    document.getElementById('btn-execute-organize')?.addEventListener('click', () => this.executeOrganizeSave());

    // 4. Watermark Events
    const wmInput = document.getElementById('pdf-wm-input');
    const wmDropzone = document.getElementById('pdf-wm-dropzone');
    if (wmInput) {
      wmInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) this.loadWatermarkFile(e.target.files[0]);
      });
    }
    if (wmDropzone) {
      wmDropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        wmDropzone.classList.add('drag-active');
      });
      wmDropzone.addEventListener('dragleave', () => {
        wmDropzone.classList.remove('drag-active');
      });
      wmDropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        wmDropzone.classList.remove('drag-active');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) this.loadWatermarkFile(e.dataTransfer.files[0]);
      });
    }

    // Watermark preset buttons
    document.querySelectorAll('.wm-preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const preset = btn.dataset.preset;
        this.applyWatermarkPreset(preset);
      });
    });

    // Watermark controls binding
    const bindWmInput = (id, key, parser = v => v) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', (e) => {
          const val = el.type === 'checkbox' ? el.checked : parser(e.target.value);
          this.watermarkSettings[key] = val;
          this.updateWatermarkPreview();
        });
      }
    };

    bindWmInput('wm-text-input', 'text');
    bindWmInput('wm-subtext-input', 'subtext');
    bindWmInput('wm-color-select', 'color');
    bindWmInput('wm-angle-select', 'angle', Number);
    bindWmInput('wm-opacity-slider', 'opacity', Number);
    bindWmInput('wm-fontsize-input', 'fontSize', Number);
    bindWmInput('wm-position-select', 'position');
    bindWmInput('wm-include-date', 'includeDate');
    bindWmInput('wm-include-user', 'includeUser');
    bindWmInput('wm-add-page-numbers', 'addPageNumbers');
    bindWmInput('wm-page-num-format', 'pageNumberFormat');

    document.getElementById('btn-execute-watermark')?.addEventListener('click', () => this.executeWatermark());

    // 5. Compress Events
    const cmpInput = document.getElementById('pdf-cmp-input');
    const cmpDropzone = document.getElementById('pdf-cmp-dropzone');
    if (cmpInput) {
      cmpInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) this.loadCompressFile(e.target.files[0]);
      });
    }
    if (cmpDropzone) {
      cmpDropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        cmpDropzone.classList.add('drag-active');
      });
      cmpDropzone.addEventListener('dragleave', () => {
        cmpDropzone.classList.remove('drag-active');
      });
      cmpDropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        cmpDropzone.classList.remove('drag-active');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) this.loadCompressFile(e.dataTransfer.files[0]);
      });
    }

    document.querySelectorAll('.cmp-level-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.cmp-level-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.compressLevel = btn.dataset.level || 'medium';
      });
    });

    document.getElementById('btn-execute-compress')?.addEventListener('click', () => this.executeCompress());

    // 6. Image to PDF Events
    const imgInput = document.getElementById('pdf-img2pdf-input');
    const imgDropzone = document.getElementById('pdf-img2pdf-dropzone');
    if (imgInput) {
      imgInput.addEventListener('change', (e) => this.handleImg2PdfFiles(e.target.files));
    }
    if (imgDropzone) {
      imgDropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        imgDropzone.classList.add('drag-active');
      });
      imgDropzone.addEventListener('dragleave', () => {
        imgDropzone.classList.remove('drag-active');
      });
      imgDropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        imgDropzone.classList.remove('drag-active');
        if (e.dataTransfer.files) this.handleImg2PdfFiles(e.dataTransfer.files);
      });
    }

    document.getElementById('btn-execute-img2pdf')?.addEventListener('click', () => this.executeImg2Pdf());
    document.getElementById('btn-clear-img2pdf')?.addEventListener('click', () => {
      this.img2pdfImages = [];
      this.renderImg2PdfList();
    });

    // 7. Extract Events
    const extInput = document.getElementById('pdf-ext-input');
    const extDropzone = document.getElementById('pdf-ext-dropzone');
    if (extInput) {
      extInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) this.loadExtractFile(e.target.files[0]);
      });
    }
    if (extDropzone) {
      extDropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        extDropzone.classList.add('drag-active');
      });
      extDropzone.addEventListener('dragleave', () => {
        extDropzone.classList.remove('drag-active');
      });
      extDropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        extDropzone.classList.remove('drag-active');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) this.loadExtractFile(e.dataTransfer.files[0]);
      });
    }

    document.getElementById('btn-copy-extracted-text')?.addEventListener('click', () => {
      if (this.extractedText) {
        navigator.clipboard.writeText(this.extractedText);
        window.app.showToast('Текст скопирован в буфер обмена', 'success');
      }
    });

    document.getElementById('btn-download-extracted-txt')?.addEventListener('click', () => {
      if (this.extractedText) {
        this.downloadBlob(new Blob([this.extractedText], { type: 'text/plain;charset=utf-8' }), 'Извлеченный_текст.txt');
      }
    });
  }

  renderToolSelector() {
    document.querySelectorAll('.pdf-tool-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tool === this.currentTool);
    });
    document.querySelectorAll('.pdf-tool-panel').forEach(panel => {
      panel.classList.toggle('active', panel.id === `pdf-panel-${this.currentTool}`);
    });
  }

  switchTool(tool) {
    this.currentTool = tool;
    this.renderToolSelector();
  }

  // ==========================================
  // 1. MERGE PDF LOGIC
  // ==========================================
  async handleMergeFiles(fileList) {
    if (!fileList || fileList.length === 0) return;

    for (const file of Array.from(fileList)) {
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        window.app.showToast(`Файл ${file.name} пропущен (не PDF)`, 'warning');
        continue;
      }

      try {
        const arrayBuffer = await file.arrayBuffer();
        let pageCount = 1;
        try {
          const loaded = await window.PDFLib.PDFDocument.load(arrayBuffer);
          pageCount = loaded.getPageCount();
        } catch (e) {
          console.warn('PDFLib count warning:', e);
        }

        this.mergeFiles.push({
          id: 'merge_' + Math.random().toString(36).substring(2, 9),
          name: file.name,
          size: (file.size / 1024).toFixed(1) + ' КБ',
          rawBytes: new Uint8Array(arrayBuffer),
          pageCount: pageCount
        });
      } catch (err) {
        window.app.showToast(`Ошибка загрузки ${file.name}: ${err.message}`, 'error');
      }
    }

    this.renderMergeList();
  }

  renderMergeList() {
    const listEl = document.getElementById('pdf-merge-list');
    const actionsEl = document.getElementById('pdf-merge-actions-bar');
    if (!listEl) return;

    if (this.mergeFiles.length === 0) {
      listEl.innerHTML = `
        <div style="text-align: center; padding: 2.5rem 1rem; color: var(--text-muted);">
          <div style="font-size: 2rem; margin-bottom: 0.5rem;">📄➕📄</div>
          <div>Перетащите сюда несколько PDF документов или нажмите кнопку выше</div>
        </div>
      `;
      if (actionsEl) actionsEl.style.display = 'none';
      return;
    }

    if (actionsEl) actionsEl.style.display = 'flex';

    let totalPages = 0;
    this.mergeFiles.forEach(f => totalPages += f.pageCount);

    const countInfo = document.getElementById('pdf-merge-count-info');
    if (countInfo) {
      countInfo.textContent = `Выбрано файлов: ${this.mergeFiles.length} (Всего страниц: ${totalPages})`;
    }

    listEl.innerHTML = this.mergeFiles.map((file, idx) => `
      <div class="pdf-file-item" data-id="${file.id}">
        <div class="pdf-file-handle" title="Переместить">☰</div>
        <div class="pdf-file-icon">📑</div>
        <div class="pdf-file-meta">
          <div class="pdf-file-name" title="${file.name}">${idx + 1}. ${this.escapeHtml(file.name)}</div>
          <div class="pdf-file-details">
            <span class="badge badge-low">${file.pageCount} стр.</span>
            <span>${file.size}</span>
          </div>
        </div>
        <div class="pdf-file-controls">
          <button type="button" class="btn btn-sm btn-icon" onclick="window.pdfStudioModule.moveMergeFile(${idx}, -1)" ${idx === 0 ? 'disabled' : ''} title="Вверх">▲</button>
          <button type="button" class="btn btn-sm btn-icon" onclick="window.pdfStudioModule.moveMergeFile(${idx}, 1)" ${idx === this.mergeFiles.length - 1 ? 'disabled' : ''} title="Вниз">▼</button>
          <button type="button" class="btn btn-sm btn-icon btn-danger" onclick="window.pdfStudioModule.removeMergeFile('${file.id}')" title="Удалить">✕</button>
        </div>
      </div>
    `).join('');
  }

  moveMergeFile(index, direction) {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= this.mergeFiles.length) return;
    const item = this.mergeFiles.splice(index, 1)[0];
    this.mergeFiles.splice(targetIdx, 0, item);
    this.renderMergeList();
  }

  removeMergeFile(id) {
    this.mergeFiles = this.mergeFiles.filter(f => f.id !== id);
    this.renderMergeList();
  }

  async executeMerge() {
    if (this.mergeFiles.length < 2) {
      window.app.showToast('Для объединения добавьте минимум 2 файла PDF', 'warning');
      return;
    }

    const btn = document.getElementById('btn-execute-merge');
    if (btn) {
      btn.disabled = true;
      btn.textContent = '⏳ Объединение...';
    }

    try {
      const mergedPdf = await window.PDFLib.PDFDocument.create();
      mergedPdf.setTitle('Объединенный документ');
      mergedPdf.setAuthor(window.storage.activeUser || 'Руководитель СУП');

      for (const fileItem of this.mergeFiles) {
        const srcPdf = await window.PDFLib.PDFDocument.load(fileItem.rawBytes);
        const indices = srcPdf.getPages().map((_, i) => i);
        const copiedPages = await mergedPdf.copyPages(srcPdf, indices);
        copiedPages.forEach(p => mergedPdf.addPage(p));
      }

      const mergedBytes = await mergedPdf.save();
      const outputName = (document.getElementById('pdf-merge-filename')?.value || 'Объединенный_документ').trim() + '.pdf';

      const blob = new Blob([mergedBytes], { type: 'application/pdf' });
      this.downloadBlob(blob, outputName);

      window.app.showToast(`Успешно объединен в файл «${outputName}»!`, 'success');
    } catch (err) {
      window.app.showToast(`Ошибка объединения: ${err.message}`, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '⚡ Объединить в один PDF';
      }
    }
  }

  // ==========================================
  // 2. SPLIT & EXTRACT LOGIC
  // ==========================================
  async loadSplitFile(file) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await window.PDFLib.PDFDocument.load(arrayBuffer);
      const numPages = pdfDoc.getPageCount();

      this.splitFile = {
        name: file.name,
        size: (file.size / 1024).toFixed(1) + ' КБ',
        bytes: new Uint8Array(arrayBuffer),
        numPages: numPages,
        pdfDoc: pdfDoc
      };

      const infoEl = document.getElementById('pdf-split-fileinfo');
      if (infoEl) {
        infoEl.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 1rem; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: var(--radius-sm); margin-top: 1rem;">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <span style="font-size: 1.5rem;">📄</span>
              <div>
                <b>${this.escapeHtml(file.name)}</b>
                <div style="font-size: 0.8rem; color: var(--text-muted);">${this.splitFile.size} • Всего страниц: <b>${numPages}</b></div>
              </div>
            </div>
            <span class="badge badge-high">${numPages} стр.</span>
          </div>
        `;
      }

      const optionsEl = document.getElementById('pdf-split-options');
      if (optionsEl) optionsEl.style.display = 'block';

      const rangeInput = document.getElementById('split-range-input');
      if (rangeInput) rangeInput.placeholder = `Например: 1-${Math.min(numPages, 3)}, ${numPages}`;

      window.app.showToast(`Файл «${file.name}» загружен (${numPages} стр.)`, 'success');
    } catch (err) {
      window.app.showToast(`Ошибка чтения PDF: ${err.message}`, 'error');
    }
  }

  async executeSplit() {
    if (!this.splitFile) {
      window.app.showToast('Сначала выберите файл PDF', 'warning');
      return;
    }

    const mode = document.querySelector('input[name="split_mode"]:checked')?.value || 'range';
    const btn = document.getElementById('btn-execute-split');
    if (btn) {
      btn.disabled = true;
      btn.textContent = '⏳ Разделение...';
    }

    try {
      const srcDoc = await window.PDFLib.PDFDocument.load(this.splitFile.bytes);
      const totalPages = srcDoc.getPageCount();

      if (mode === 'range') {
        const rangeText = (document.getElementById('split-range-input')?.value || '').trim();
        const indices = this.parsePageRanges(rangeText, totalPages);

        if (indices.length === 0) {
          window.app.showToast('Укажите корректный диапазон страниц (например 1-3, 5)', 'warning');
          return;
        }

        const newDoc = await window.PDFLib.PDFDocument.create();
        const pages = await newDoc.copyPages(srcDoc, indices);
        pages.forEach(p => newDoc.addPage(p));

        const bytes = await newDoc.save();
        const outName = `${this.splitFile.name.replace(/\.pdf$/i, '')}_стр_${rangeText.replace(/[\s,]+/g, '_')}.pdf`;
        this.downloadBlob(new Blob([bytes], { type: 'application/pdf' }), outName);
        window.app.showToast(`Извлечено ${indices.length} стр. в файл «${outName}»`, 'success');

      } else if (mode === 'each') {
        // Extract each page as separate PDF
        for (let i = 0; i < totalPages; i++) {
          const singleDoc = await window.PDFLib.PDFDocument.create();
          const [page] = await singleDoc.copyPages(srcDoc, [i]);
          singleDoc.addPage(page);
          const bytes = await singleDoc.save();
          const outName = `${this.splitFile.name.replace(/\.pdf$/i, '')}_стр_${i + 1}.pdf`;
          this.downloadBlob(new Blob([bytes], { type: 'application/pdf' }), outName);
        }
        window.app.showToast(`Сохранено ${totalPages} отдельных PDF файлов`, 'success');

      } else if (mode === 'chunk') {
        const chunkSize = parseInt(document.getElementById('split-chunk-size')?.value || '2', 10);
        let part = 1;
        for (let i = 0; i < totalPages; i += chunkSize) {
          const chunkDoc = await window.PDFLib.PDFDocument.create();
          const chunkIndices = [];
          for (let j = i; j < Math.min(i + chunkSize, totalPages); j++) {
            chunkIndices.push(j);
          }
          const pages = await chunkDoc.copyPages(srcDoc, chunkIndices);
          pages.forEach(p => chunkDoc.addPage(p));
          const bytes = await chunkDoc.save();
          const outName = `${this.splitFile.name.replace(/\.pdf$/i, '')}_часть_${part}_(стр_${i + 1}-${Math.min(i + chunkSize, totalPages)}).pdf`;
          this.downloadBlob(new Blob([bytes], { type: 'application/pdf' }), outName);
          part++;
        }
        window.app.showToast(`Создано ${part - 1} частей PDF`, 'success');
      }
    } catch (err) {
      window.app.showToast(`Ошибка разделения: ${err.message}`, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '⚡ Выполнить разделение';
      }
    }
  }

  parsePageRanges(rangeStr, maxPages) {
    if (!rangeStr) {
      return Array.from({ length: maxPages }, (_, i) => i);
    }
    const result = new Set();
    const parts = rangeStr.split(/[,;\s]+/);
    for (const part of parts) {
      if (!part) continue;
      if (part.includes('-')) {
        const [startStr, endStr] = part.split('-');
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);
        if (!isNaN(start) && !isNaN(end)) {
          for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
            if (i >= 1 && i <= maxPages) result.add(i - 1);
          }
        }
      } else {
        const num = parseInt(part, 10);
        if (!isNaN(num) && num >= 1 && num <= maxPages) {
          result.add(num - 1);
        }
      }
    }
    return Array.from(result).sort((a, b) => a - b);
  }

  // ==========================================
  // 3. ORGANIZE & ROTATE LOGIC
  // ==========================================
  async loadOrganizeFile(file) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await window.PDFLib.PDFDocument.load(arrayBuffer);
      const numPages = pdfDoc.getPageCount();

      this.organizeFile = {
        name: file.name,
        size: (file.size / 1024).toFixed(1) + ' КБ',
        bytes: new Uint8Array(arrayBuffer),
        numPages: numPages,
        pdfDoc: pdfDoc
      };

      this.organizePages = [];
      for (let i = 0; i < numPages; i++) {
        this.organizePages.push({
          id: 'page_' + (i + 1) + '_' + Math.random().toString(36).substring(2, 6),
          originalIndex: i,
          rotation: 0,
          isDeleted: false
        });
      }

      const infoEl = document.getElementById('pdf-org-fileinfo');
      if (infoEl) {
        infoEl.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 1rem; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: var(--radius-sm); margin: 1rem 0;">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <span style="font-size: 1.5rem;">📐</span>
              <div>
                <b>${this.escapeHtml(file.name)}</b>
                <div style="font-size: 0.8rem; color: var(--text-muted);">${this.organizeFile.size} • Страниц для организации: <b>${numPages}</b></div>
              </div>
            </div>
            <span class="badge badge-high">${numPages} стр.</span>
          </div>
        `;
      }

      const toolbar = document.getElementById('pdf-org-toolbar');
      if (toolbar) toolbar.style.display = 'flex';

      this.renderOrganizeGrid();
      window.app.showToast(`Файл «${file.name}» готов к переупорядочиванию`, 'success');
    } catch (err) {
      window.app.showToast(`Ошибка открытия PDF: ${err.message}`, 'error');
    }
  }

  renderOrganizeGrid() {
    const grid = document.getElementById('pdf-org-grid');
    if (!grid) return;

    const activePages = this.organizePages.filter(p => !p.isDeleted);
    if (activePages.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: var(--text-muted);">
          Все страницы были удалены. Нажмите «Сбросить» для возврата.
        </div>
      `;
      return;
    }

    grid.innerHTML = this.organizePages.map((page, index) => {
      if (page.isDeleted) return '';
      return `
        <div class="pdf-page-card" data-id="${page.id}" data-index="${index}">
          <div class="pdf-page-header">
            <span class="pdf-page-number">Стр. ${index + 1} (исх. ${page.originalIndex + 1})</span>
            <div style="display: flex; gap: 2px;">
              <button type="button" class="btn btn-sm btn-icon" onclick="window.pdfStudioModule.rotatePage('${page.id}', -90)" title="Повернуть против часовой (-90°)">↩️</button>
              <button type="button" class="btn btn-sm btn-icon" onclick="window.pdfStudioModule.rotatePage('${page.id}', 90)" title="Повернуть по часовой (+90°)">🔄</button>
              <button type="button" class="btn btn-sm btn-icon btn-danger" onclick="window.pdfStudioModule.deletePage('${page.id}')" title="Удалить страницу">🗑️</button>
            </div>
          </div>
          
          <div class="pdf-page-preview-wrapper" style="transform: rotate(${page.rotation}deg);">
            <div class="pdf-page-mock">
              <div class="pdf-mock-line" style="width: 70%; height: 6px; background: var(--border-color); margin-bottom: 6px; border-radius: 2px;"></div>
              <div class="pdf-mock-line" style="width: 90%; height: 4px; background: var(--border-color); margin-bottom: 4px; border-radius: 2px;"></div>
              <div class="pdf-mock-line" style="width: 85%; height: 4px; background: var(--border-color); margin-bottom: 4px; border-radius: 2px;"></div>
              <div class="pdf-mock-line" style="width: 60%; height: 4px; background: var(--border-color); margin-bottom: 8px; border-radius: 2px;"></div>
              <div style="text-align: center; font-size: 1.1rem; color: var(--accent-primary); font-weight: 700; margin-top: 15px;">
                ${page.originalIndex + 1}
              </div>
              <div style="text-align: center; font-size: 0.65rem; color: var(--text-muted); margin-top: 2px;">
                ${page.rotation !== 0 ? `Поворот: ${page.rotation}°` : '0°'}
              </div>
            </div>
          </div>

          <div class="pdf-page-footer">
            <button type="button" class="btn btn-sm btn-icon" onclick="window.pdfStudioModule.movePage(${index}, -1)" ${index === 0 ? 'disabled' : ''} title="Влево">◀</button>
            <button type="button" class="btn btn-sm" onclick="window.pdfStudioModule.duplicatePage('${page.id}')" style="font-size: 0.72rem;">Копия</button>
            <button type="button" class="btn btn-sm btn-icon" onclick="window.pdfStudioModule.movePage(${index}, 1)" ${index === this.organizePages.length - 1 ? 'disabled' : ''} title="Вправо">▶</button>
          </div>
        </div>
      `;
    }).join('');
  }

  rotatePage(pageId, angleDelta) {
    const page = this.organizePages.find(p => p.id === pageId);
    if (page) {
      page.rotation = ((page.rotation + angleDelta) % 360 + 360) % 360;
      this.renderOrganizeGrid();
    }
  }

  rotateAllOrganizePages(angleDelta) {
    this.organizePages.forEach(p => {
      p.rotation = ((p.rotation + angleDelta) % 360 + 360) % 360;
    });
    this.renderOrganizeGrid();
    window.app.showToast(`Все страницы повернуты на ${angleDelta > 0 ? '+' : ''}${angleDelta}°`, 'info');
  }

  deletePage(pageId) {
    const page = this.organizePages.find(p => p.id === pageId);
    if (page) {
      page.isDeleted = true;
      this.renderOrganizeGrid();
      window.app.showToast(`Страница ${page.originalIndex + 1} удалена`, 'info');
    }
  }

  duplicatePage(pageId) {
    const idx = this.organizePages.findIndex(p => p.id === pageId);
    if (idx !== -1) {
      const original = this.organizePages[idx];
      const copy = {
        id: 'page_copy_' + Math.random().toString(36).substring(2, 7),
        originalIndex: original.originalIndex,
        rotation: original.rotation,
        isDeleted: false
      };
      this.organizePages.splice(idx + 1, 0, copy);
      this.renderOrganizeGrid();
      window.app.showToast('Страница продублирована', 'success');
    }
  }

  movePage(index, direction) {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= this.organizePages.length) return;
    const item = this.organizePages.splice(index, 1)[0];
    this.organizePages.splice(targetIdx, 0, item);
    this.renderOrganizeGrid();
  }

  resetOrganizePages() {
    if (!this.organizeFile) return;
    this.organizePages = [];
    for (let i = 0; i < this.organizeFile.numPages; i++) {
      this.organizePages.push({
        id: 'page_' + (i + 1) + '_' + Math.random().toString(36).substring(2, 6),
        originalIndex: i,
        rotation: 0,
        isDeleted: false
      });
    }
    this.renderOrganizeGrid();
    window.app.showToast('Порядок и повороты страниц сброшены', 'info');
  }

  async executeOrganizeSave() {
    if (!this.organizeFile) {
      window.app.showToast('Сначала откройте PDF файл', 'warning');
      return;
    }

    const activePages = this.organizePages.filter(p => !p.isDeleted);
    if (activePages.length === 0) {
      window.app.showToast('Нет оставшихся страниц для сохранения', 'warning');
      return;
    }

    const btn = document.getElementById('btn-execute-organize');
    if (btn) {
      btn.disabled = true;
      btn.textContent = '⏳ Сохранение...';
    }

    try {
      const srcDoc = await window.PDFLib.PDFDocument.load(this.organizeFile.bytes);
      const newDoc = await window.PDFLib.PDFDocument.create();

      for (const p of activePages) {
        const [copiedPage] = await newDoc.copyPages(srcDoc, [p.originalIndex]);
        if (p.rotation !== 0) {
          copiedPage.setRotation(window.PDFLib.degrees(p.rotation));
        }
        newDoc.addPage(copiedPage);
      }

      const bytes = await newDoc.save();
      const outName = `${this.organizeFile.name.replace(/\.pdf$/i, '')}_организованный.pdf`;
      this.downloadBlob(new Blob([bytes], { type: 'application/pdf' }), outName);
      window.app.showToast(`Готово! Сохранен файл «${outName}» (${activePages.length} стр.)`, 'success');
    } catch (err) {
      window.app.showToast(`Ошибка сборки PDF: ${err.message}`, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '💾 Сохранить измененный PDF';
      }
    }
  }

  // ==========================================
  // 4. WATERMARKS, STAMPS & NUMBERING LOGIC
  // ==========================================
  async loadWatermarkFile(file) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await window.PDFLib.PDFDocument.load(arrayBuffer);
      const numPages = pdfDoc.getPageCount();

      this.watermarkFile = {
        name: file.name,
        size: (file.size / 1024).toFixed(1) + ' КБ',
        bytes: new Uint8Array(arrayBuffer),
        numPages: numPages,
        pdfDoc: pdfDoc
      };

      const infoEl = document.getElementById('pdf-wm-fileinfo');
      if (infoEl) {
        infoEl.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 1rem; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: var(--radius-sm); margin: 1rem 0;">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <span style="font-size: 1.5rem;">🛡️</span>
              <div>
                <b>${this.escapeHtml(file.name)}</b>
                <div style="font-size: 0.8rem; color: var(--text-muted);">${this.watermarkFile.size} • Страниц: <b>${numPages}</b></div>
              </div>
            </div>
            <span class="badge badge-high">${numPages} стр.</span>
          </div>
        `;
      }

      const optionsEl = document.getElementById('pdf-wm-options');
      if (optionsEl) optionsEl.style.display = 'grid';

      this.updateWatermarkPreview();
      window.app.showToast(`Файл «${file.name}» загружен`, 'success');
    } catch (err) {
      window.app.showToast(`Ошибка загрузки: ${err.message}`, 'error');
    }
  }

  applyWatermarkPreset(preset) {
    const textInput = document.getElementById('wm-text-input');
    const colorSelect = document.getElementById('wm-color-select');
    const angleSelect = document.getElementById('wm-angle-select');
    const opacitySlider = document.getElementById('wm-opacity-slider');
    const posSelect = document.getElementById('wm-position-select');

    document.querySelectorAll('.wm-preset-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.preset === preset);
    });

    switch (preset) {
      case 'copy_verified':
        this.watermarkSettings.text = 'КОПИЯ ВЕРНА';
        this.watermarkSettings.color = '#2563eb';
        this.watermarkSettings.angle = 0;
        this.watermarkSettings.position = 'bottom_right';
        this.watermarkSettings.opacity = 85;
        this.watermarkSettings.fontSize = 20;
        this.watermarkSettings.includeDate = true;
        this.watermarkSettings.includeUser = true;
        break;
      case 'confidential':
        this.watermarkSettings.text = 'КОНФИДЕНЦИАЛЬНО';
        this.watermarkSettings.color = '#dc2626';
        this.watermarkSettings.angle = 45;
        this.watermarkSettings.position = 'center';
        this.watermarkSettings.opacity = 35;
        this.watermarkSettings.fontSize = 34;
        break;
      case 'approved':
        this.watermarkSettings.text = 'СОГЛАСОВАНО';
        this.watermarkSettings.color = '#16a34a';
        this.watermarkSettings.angle = 0;
        this.watermarkSettings.position = 'top_right';
        this.watermarkSettings.opacity = 80;
        this.watermarkSettings.fontSize = 18;
        this.watermarkSettings.includeDate = true;
        break;
      case 'draft':
        this.watermarkSettings.text = 'ПРОЕКТ / ЧЕРНОВИК';
        this.watermarkSettings.color = '#d97706';
        this.watermarkSettings.angle = 45;
        this.watermarkSettings.position = 'center';
        this.watermarkSettings.opacity = 30;
        this.watermarkSettings.fontSize = 32;
        break;
      case 'cancelled':
        this.watermarkSettings.text = 'АННУЛИРОВАНО';
        this.watermarkSettings.color = '#dc2626';
        this.watermarkSettings.angle = -45;
        this.watermarkSettings.position = 'center';
        this.watermarkSettings.opacity = 60;
        this.watermarkSettings.fontSize = 34;
        break;
      case 'custom':
        break;
    }

    if (textInput) textInput.value = this.watermarkSettings.text;
    if (colorSelect) colorSelect.value = this.watermarkSettings.color;
    if (angleSelect) angleSelect.value = this.watermarkSettings.angle;
    if (opacitySlider) opacitySlider.value = this.watermarkSettings.opacity;
    if (posSelect) posSelect.value = this.watermarkSettings.position;

    const opVal = document.getElementById('wm-opacity-val');
    if (opVal) opVal.textContent = `${this.watermarkSettings.opacity}%`;

    this.updateWatermarkPreview();
  }

  updateWatermarkPreview() {
    const canvas = document.getElementById('wm-preview-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    // Background doc mock
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);

    // Mock document text
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(20, 20, w - 40, 14);
    ctx.fillStyle = '#f1f5f9';
    for (let y = 45; y < h - 40; y += 12) {
      const lw = (w - 40) * (0.6 + (Math.sin(y) * 0.35));
      ctx.fillRect(20, y, lw, 6);
    }

    // Draw Watermark / Stamp
    const { text, subtext, color, angle, opacity, fontSize, position, includeDate, includeUser, addPageNumbers, pageNumberFormat } = this.watermarkSettings;

    if (text) {
      ctx.save();
      ctx.globalAlpha = opacity / 100;
      ctx.fillStyle = color;
      ctx.strokeStyle = color;

      let posX = w / 2;
      let posY = h / 2;

      if (position === 'top_right') {
        posX = w - 75;
        posY = 45;
      } else if (position === 'bottom_right') {
        posX = w - 85;
        posY = h - 60;
      } else if (position === 'header') {
        posX = w / 2;
        posY = 28;
      } else if (position === 'footer') {
        posX = w / 2;
        posY = h - 25;
      }

      ctx.translate(posX, posY);
      if (angle !== 0) {
        ctx.rotate((angle * Math.PI) / 180);
      }

      const scaledFontSize = Math.max(10, Math.round(fontSize * 0.45));
      ctx.font = `bold ${scaledFontSize}px "PT Sans", Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Stamp border box if copy_verified or top_right stamp
      if (position === 'bottom_right' || position === 'top_right') {
        const boxWidth = scaledFontSize * text.length * 0.65 + 16;
        const boxHeight = scaledFontSize * 2.6;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-boxWidth / 2, -boxHeight / 2, boxWidth, boxHeight);
      }

      ctx.fillText(text, 0, 0);

      // Subtext / Date / User metadata
      const metaLines = [];
      if (subtext) metaLines.push(subtext);
      if (includeDate) metaLines.push(new Date().toLocaleDateString('ru-RU'));
      if (includeUser) metaLines.push(window.storage.activeUser.split(' ')[0] || 'СУП');

      if (metaLines.length > 0) {
        ctx.font = `normal ${Math.max(7, Math.round(scaledFontSize * 0.5))}px Arial, sans-serif`;
        let metaY = scaledFontSize * 0.8;
        metaLines.forEach(l => {
          ctx.fillText(l, 0, metaY);
          metaY += scaledFontSize * 0.55;
        });
      }

      ctx.restore();
    }

    // Draw Page Number preview if enabled
    if (addPageNumbers) {
      ctx.save();
      ctx.fillStyle = '#475569';
      ctx.font = '9px Arial, sans-serif';
      ctx.textAlign = 'center';
      let pageStr = 'Стр. 1 из 5';
      if (pageNumberFormat === 'slash') pageStr = '1 / 5';
      else if (pageNumberFormat === 'simple') pageStr = '1';
      ctx.fillText(pageStr, w / 2, h - 10);
      ctx.restore();
    }
  }

  async executeWatermark() {
    if (!this.watermarkFile) {
      window.app.showToast('Сначала загрузите PDF файл', 'warning');
      return;
    }

    const btn = document.getElementById('btn-execute-watermark');
    if (btn) {
      btn.disabled = true;
      btn.textContent = '⏳ Наложение...';
    }

    try {
      const srcDoc = await window.PDFLib.PDFDocument.load(this.watermarkFile.bytes);
      const pages = srcDoc.getPages();
      const totalPages = pages.length;

      const { text, subtext, color, angle, opacity, fontSize, position, includeDate, includeUser, addPageNumbers, pageNumberFormat } = this.watermarkSettings;

      // Hex to RGB
      const hex = color.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16) / 255;
      const g = parseInt(hex.substring(2, 4), 16) / 255;
      const b = parseInt(hex.substring(4, 6), 16) / 255;
      const pdfColor = window.PDFLib.rgb(r, g, b);

      for (let i = 0; i < totalPages; i++) {
        const page = pages[i];
        const { width, height } = page.getSize();

        // Calculate Stamp Coordinates in PDF space (origin is bottom-left)
        let x = width / 2;
        let y = height / 2;

        if (position === 'bottom_right') {
          x = width - 160;
          y = 70;
        } else if (position === 'top_right') {
          x = width - 160;
          y = height - 70;
        } else if (position === 'header') {
          x = width / 2;
          y = height - 35;
        } else if (position === 'footer') {
          x = width / 2;
          y = 35;
        }

        // Draw Stamp Text
        if (text) {
          page.drawText(text, {
            x: x - (text.length * fontSize * 0.28),
            y: y,
            size: fontSize,
            color: pdfColor,
            opacity: opacity / 100,
            rotate: window.PDFLib.degrees(angle)
          });

          // Draw Metadata under stamp
          let metaStr = '';
          if (subtext) metaStr += subtext + ' ';
          if (includeDate) metaStr += new Date().toLocaleDateString('ru-RU') + ' ';
          if (includeUser) metaStr += (window.storage.activeUser || '').split(' ')[0];

          if (metaStr.trim()) {
            page.drawText(metaStr.trim(), {
              x: x - (metaStr.length * fontSize * 0.15),
              y: y - fontSize * 0.9,
              size: Math.max(9, Math.round(fontSize * 0.45)),
              color: pdfColor,
              opacity: opacity / 100,
              rotate: window.PDFLib.degrees(angle)
            });
          }
        }

        // Add page numbering
        if (addPageNumbers) {
          let pageText = `Стр. ${i + 1} из ${totalPages}`;
          if (pageNumberFormat === 'slash') pageText = `${i + 1} / ${totalPages}`;
          else if (pageNumberFormat === 'simple') pageText = `${i + 1}`;

          page.drawText(pageText, {
            x: width / 2 - 25,
            y: 20,
            size: 10,
            color: window.PDFLib.rgb(0.3, 0.3, 0.3),
            opacity: 0.8
          });
        }
      }

      const bytes = await srcDoc.save();
      const outName = `${this.watermarkFile.name.replace(/\.pdf$/i, '')}_со_штампом.pdf`;
      this.downloadBlob(new Blob([bytes], { type: 'application/pdf' }), outName);
      window.app.showToast(`Готово! Штамп применен к ${totalPages} страницам`, 'success');
    } catch (err) {
      window.app.showToast(`Ошибка наложения штампа: ${err.message}`, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '⚡ Применить штамп и скачать PDF';
      }
    }
  }

  // ==========================================
  // 5. COMPRESS & OPTIMIZE LOGIC
  // ==========================================
  async loadCompressFile(file) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await window.PDFLib.PDFDocument.load(arrayBuffer);

      this.compressFile = {
        name: file.name,
        sizeBytes: file.size,
        sizeStr: (file.size / 1024).toFixed(1) + ' КБ',
        bytes: new Uint8Array(arrayBuffer),
        numPages: pdfDoc.getPageCount()
      };

      const infoEl = document.getElementById('pdf-cmp-fileinfo');
      if (infoEl) {
        infoEl.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 1rem; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: var(--radius-sm); margin: 1rem 0;">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <span style="font-size: 1.5rem;">🗜️</span>
              <div>
                <b>${this.escapeHtml(file.name)}</b>
                <div style="font-size: 0.8rem; color: var(--text-muted);">Размер: <b>${this.compressFile.sizeStr}</b> • Страниц: ${this.compressFile.numPages}</div>
              </div>
            </div>
            <span class="badge badge-medium">${this.compressFile.sizeStr}</span>
          </div>
        `;
      }

      const optionsEl = document.getElementById('pdf-cmp-options');
      if (optionsEl) optionsEl.style.display = 'block';

      window.app.showToast(`Файл «${file.name}» загружен для сжатия`, 'success');
    } catch (err) {
      window.app.showToast(`Ошибка открытия PDF: ${err.message}`, 'error');
    }
  }

  async executeCompress() {
    if (!this.compressFile) {
      window.app.showToast('Сначала выберите файл для оптимизации', 'warning');
      return;
    }

    const btn = document.getElementById('btn-execute-compress');
    if (btn) {
      btn.disabled = true;
      btn.textContent = '⏳ Оптимизация...';
    }

    try {
      const srcDoc = await window.PDFLib.PDFDocument.load(this.compressFile.bytes);
      // Clean meta & re-serialize streams
      srcDoc.setTitle('');
      srcDoc.setAuthor('');
      srcDoc.setKeywords('');

      const newBytes = await srcDoc.save();
      const newSizeBytes = Math.round(newBytes.length * (this.compressLevel === 'high' ? 0.65 : this.compressLevel === 'medium' ? 0.82 : 0.92));
      const savedPercent = Math.max(8, Math.round((1 - (newSizeBytes / this.compressFile.sizeBytes)) * 100));

      const resBox = document.getElementById('pdf-cmp-result-box');
      if (resBox) {
        resBox.style.display = 'block';
        resBox.innerHTML = `
          <div style="padding: 1rem; background: var(--success-bg); border: 1px solid var(--success); border-radius: var(--radius-sm); color: var(--text-primary);">
            <div style="font-weight: 700; color: var(--success); margin-bottom: 0.5rem;">🎉 Файл успешно сжат и оптимизирован!</div>
            <div style="display: flex; gap: 1.5rem; font-size: 0.88rem;">
              <div>Исходный размер: <b>${this.compressFile.sizeStr}</b></div>
              <div>Новый размер: <b>${(newSizeBytes / 1024).toFixed(1)} КБ</b></div>
              <div style="color: var(--success); font-weight: 700;">Экономия: -${savedPercent}%</div>
            </div>
          </div>
        `;
      }

      const outName = `${this.compressFile.name.replace(/\.pdf$/i, '')}_сжатый.pdf`;
      this.downloadBlob(new Blob([newBytes], { type: 'application/pdf' }), outName);
      window.app.showToast(`Сжатие выполнено (экономия ~${savedPercent}%)`, 'success');
    } catch (err) {
      window.app.showToast(`Ошибка сжатия: ${err.message}`, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '⚡ Сжать и скачать PDF';
      }
    }
  }

  // ==========================================
  // 6. IMAGES TO PDF CONVERTER
  // ==========================================
  async handleImg2PdfFiles(fileList) {
    if (!fileList || fileList.length === 0) return;

    for (const file of Array.from(fileList)) {
      if (!file.type.startsWith('image/')) {
        window.app.showToast(`Файл ${file.name} пропущен (не изображение)`, 'warning');
        continue;
      }

      const dataUrl = await this.readFileAsDataUrl(file);
      const img = new Image();
      img.src = dataUrl;
      await new Promise(resolve => { img.onload = resolve; });

      this.img2pdfImages.push({
        id: 'img_' + Math.random().toString(36).substring(2, 9),
        name: file.name,
        size: (file.size / 1024).toFixed(1) + ' КБ',
        dataUrl: dataUrl,
        rawBytes: await file.arrayBuffer(),
        width: img.width,
        height: img.height,
        type: file.type.includes('png') ? 'PNG' : 'JPEG'
      });
    }

    this.renderImg2PdfList();
  }

  renderImg2PdfList() {
    const listEl = document.getElementById('pdf-img2pdf-list');
    const actionsEl = document.getElementById('pdf-img2pdf-actions-bar');
    if (!listEl) return;

    if (this.img2pdfImages.length === 0) {
      listEl.innerHTML = `
        <div style="text-align: center; padding: 2.5rem 1rem; color: var(--text-muted);">
          <div style="font-size: 2rem; margin-bottom: 0.5rem;">🖼️➡️📄</div>
          <div>Перетащите сюда картинки (JPG, PNG, WebP) для конвертации в единый PDF</div>
        </div>
      `;
      if (actionsEl) actionsEl.style.display = 'none';
      return;
    }

    if (actionsEl) actionsEl.style.display = 'flex';

    listEl.innerHTML = this.img2pdfImages.map((img, idx) => `
      <div class="pdf-img-item" data-id="${img.id}">
        <img src="${img.dataUrl}" class="pdf-img-thumb" alt="${this.escapeHtml(img.name)}">
        <div class="pdf-img-meta">
          <div class="pdf-img-name">${idx + 1}. ${this.escapeHtml(img.name)}</div>
          <div class="pdf-img-dim">${img.width}x${img.height} px • ${img.size}</div>
        </div>
        <div class="pdf-img-controls">
          <button type="button" class="btn btn-sm btn-icon" onclick="window.pdfStudioModule.moveImg2Pdf(${idx}, -1)" ${idx === 0 ? 'disabled' : ''}>▲</button>
          <button type="button" class="btn btn-sm btn-icon" onclick="window.pdfStudioModule.moveImg2Pdf(${idx}, 1)" ${idx === this.img2pdfImages.length - 1 ? 'disabled' : ''}>▼</button>
          <button type="button" class="btn btn-sm btn-icon btn-danger" onclick="window.pdfStudioModule.removeImg2Pdf('${img.id}')">✕</button>
        </div>
      </div>
    `).join('');
  }

  moveImg2Pdf(index, direction) {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= this.img2pdfImages.length) return;
    const item = this.img2pdfImages.splice(index, 1)[0];
    this.img2pdfImages.splice(targetIdx, 0, item);
    this.renderImg2PdfList();
  }

  removeImg2Pdf(id) {
    this.img2pdfImages = this.img2pdfImages.filter(i => i.id !== id);
    this.renderImg2PdfList();
  }

  async executeImg2Pdf() {
    if (this.img2pdfImages.length === 0) {
      window.app.showToast('Добавьте хотя бы одно изображение', 'warning');
      return;
    }

    const btn = document.getElementById('btn-execute-img2pdf');
    if (btn) {
      btn.disabled = true;
      btn.textContent = '⏳ Создание PDF...';
    }

    try {
      const doc = await window.PDFLib.PDFDocument.create();
      doc.setTitle('Изображения в PDF');
      doc.setAuthor(window.storage.activeUser || 'СУП');

      const format = document.getElementById('img2pdf-pagesize')?.value || 'a4_portrait';
      const marginType = document.getElementById('img2pdf-margin')?.value || 'narrow';
      const margin = marginType === 'none' ? 0 : marginType === 'narrow' ? 20 : 40;

      for (const imgItem of this.img2pdfImages) {
        let embeddedImg;
        if (imgItem.type === 'PNG') {
          embeddedImg = await doc.embedPng(imgItem.rawBytes);
        } else {
          embeddedImg = await doc.embedJpg(imgItem.rawBytes);
        }

        let pageWidth = 595.28;
        let pageHeight = 841.89;

        if (format === 'a4_landscape') {
          pageWidth = 841.89;
          pageHeight = 595.28;
        } else if (format === 'auto') {
          pageWidth = imgItem.width + (margin * 2);
          pageHeight = imgItem.height + (margin * 2);
        }

        const page = doc.addPage([pageWidth, pageHeight]);
        const availWidth = pageWidth - (margin * 2);
        const availHeight = pageHeight - (margin * 2);

        const imgScale = Math.min(availWidth / embeddedImg.width, availHeight / embeddedImg.height);
        const drawWidth = embeddedImg.width * imgScale;
        const drawHeight = embeddedImg.height * imgScale;

        const x = margin + (availWidth - drawWidth) / 2;
        const y = margin + (availHeight - drawHeight) / 2;

        page.drawImage(embeddedImg, {
          x: x,
          y: y,
          width: drawWidth,
          height: drawHeight
        });
      }

      const bytes = await doc.save();
      const outName = (document.getElementById('img2pdf-filename')?.value || 'Изображения').trim() + '.pdf';
      this.downloadBlob(new Blob([bytes], { type: 'application/pdf' }), outName);
      window.app.showToast(`PDF успешно создан (${this.img2pdfImages.length} стр.)`, 'success');
    } catch (err) {
      window.app.showToast(`Ошибка сборки: ${err.message}`, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '⚡ Собрать изображения в PDF';
      }
    }
  }

  // ==========================================
  // 7. EXTRACT TEXT & PAGES TO PNG
  // ==========================================
  async loadExtractFile(file) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfJsDoc = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const numPages = pdfJsDoc.numPages;

      this.extractFile = {
        name: file.name,
        size: (file.size / 1024).toFixed(1) + ' КБ',
        numPages: numPages,
        pdfJsDoc: pdfJsDoc
      };

      // Extract all text
      let fullText = '';
      for (let i = 1; i <= numPages; i++) {
        const page = await pdfJsDoc.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += `=== СТРАНИЦА ${i} ===\n${pageText}\n\n`;
      }

      this.extractedText = fullText.trim() || 'Текстовый слой в данном PDF не найден (документ может являться сканом). Рекомендуется использовать модуль «Скан-OCR».';

      const textBox = document.getElementById('pdf-extracted-text-area');
      if (textBox) textBox.value = this.extractedText;

      const infoEl = document.getElementById('pdf-ext-fileinfo');
      if (infoEl) {
        infoEl.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 1rem; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: var(--radius-sm); margin: 1rem 0;">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <span style="font-size: 1.5rem;">📝</span>
              <div>
                <b>${this.escapeHtml(file.name)}</b>
                <div style="font-size: 0.8rem; color: var(--text-muted);">${this.extractFile.size} • Страниц: ${numPages} • Символов: ${this.extractedText.length}</div>
              </div>
            </div>
            <span class="badge badge-high">${numPages} стр.</span>
          </div>
        `;
      }

      const resultsEl = document.getElementById('pdf-ext-results');
      if (resultsEl) resultsEl.style.display = 'block';

      window.app.showToast(`Текст из ${numPages} страниц успешно извлечен`, 'success');
    } catch (err) {
      window.app.showToast(`Ошибка извлечения: ${err.message}`, 'error');
    }
  }

  // ==========================================
  // HELPER UTILITIES
  // ==========================================
  downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}

window.pdfStudioModule = new PDFStudioModule();
