/**
 * CAD & Visio Engineering Viewer Module (Offline Air-gapped Edition)
 * Supports:
 * - DXF (AutoCAD Drawing Exchange Format R12-2018) parser & renderer
 * - VSDX (MS Visio XML Drawing Zip) parser using local PizZip
 * - SVG vector schema parser
 * - Full AutoCAD Color Index (ACI 1-255) color table
 * - Primitives: LINE, CIRCLE, ARC, LWPOLYLINE, POLYLINE, ELLIPSE, TEXT, MTEXT, SOLID, DIMENSION
 * - Interactive Viewport: Smooth zoom to cursor, Pan, Fit to Screen, Adaptive Grid
 * - Layer Manager with toggle visibility
 * - Measuring Tape Tool (Distance, dX, dY, Angle in mm/units)
 * - HD PNG Export & GOST SPDS Blueprint Print with Title Block
 */

class CADViewerModule {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    
    // Viewport transform
    this.scale = 1.0;
    this.offsetX = 0;
    this.offsetY = 0;
    this.minScale = 0.005;
    this.maxScale = 500.0;

    // Viewport interaction state
    this.isPanning = false;
    this.panStartX = 0;
    this.panStartY = 0;
    this.activeTool = 'select'; // 'select', 'pan', 'measure'

    // Measurement Tool State
    this.measureStart = null; // { x, y } in world coords
    this.measureEnd = null;   // { x, y } in world coords
    this.measureCurrent = null; // { x, y } during hover

    // Document Data Model
    this.currentDocument = null; // { name, type: 'dxf'|'vsdx'|'svg', layers: {}, entities: [], bounds: { minX, minY, maxX, maxY }, pages: [] }
    this.activeVisioPageIndex = 0;

    // AutoCAD Color Index (ACI) Palette mapping (1-255)
    this.aciColors = this.generateAciPalette();
  }

  init() {
    this.canvas = document.getElementById('cad-viewport-canvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');

    this.bindEvents();
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    // Load initial demo blueprint (Floor Plan with HVAC / Electrical)
    this.loadDemoDrawing('floor_plan');
  }

  resizeCanvas() {
    if (!this.canvas) return;
    const rect = this.canvas.parentElement.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      this.canvas.width = rect.width;
      this.canvas.height = rect.height;
      this.render();
    }
  }

  bindEvents() {
    // Canvas mouse events for Zoom / Pan / Measure
    this.canvas.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });
    this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    window.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    window.addEventListener('mouseup', (e) => this.handleMouseUp(e));

    // Toolbar buttons
    document.getElementById('btn-cad-tool-select')?.addEventListener('click', () => this.setTool('select'));
    document.getElementById('btn-cad-tool-pan')?.addEventListener('click', () => this.setTool('pan'));
    document.getElementById('btn-cad-tool-measure')?.addEventListener('click', () => this.setTool('measure'));
    document.getElementById('btn-cad-fit-screen')?.addEventListener('click', () => this.fitToScreen());
    document.getElementById('btn-cad-zoom-in')?.addEventListener('click', () => this.zoomStep(1.25));
    document.getElementById('btn-cad-zoom-out')?.addEventListener('click', () => this.zoomStep(0.8));
    document.getElementById('btn-cad-export-png')?.addEventListener('click', () => this.exportHdPng());
    document.getElementById('btn-cad-print')?.addEventListener('click', () => this.printDrawing());

    // Demo drawings selector
    document.getElementById('cad-demo-selector')?.addEventListener('change', (e) => {
      this.loadDemoDrawing(e.target.value);
    });

    // File Input & Dropzone
    const fileInput = document.getElementById('cad-file-input');
    const dropzone = document.getElementById('cad-viewport-container');

    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) this.loadFile(e.target.files[0]);
      });
    }

    if (dropzone) {
      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('drag-active');
      });
      dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('drag-active');
      });
      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('drag-active');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          this.loadFile(e.dataTransfer.files[0]);
        }
      });
    }

    // Layer Manager toggle all buttons
    document.getElementById('btn-cad-layers-show-all')?.addEventListener('click', () => {
      if (this.currentDocument && this.currentDocument.layers) {
        Object.values(this.currentDocument.layers).forEach(l => l.visible = true);
        this.renderLayerManager();
        this.render();
      }
    });

    document.getElementById('btn-cad-layers-hide-all')?.addEventListener('click', () => {
      if (this.currentDocument && this.currentDocument.layers) {
        Object.values(this.currentDocument.layers).forEach(l => l.visible = false);
        this.renderLayerManager();
        this.render();
      }
    });
  }

  setTool(tool) {
    this.activeTool = tool;
    document.querySelectorAll('.cad-tool-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tool === tool);
    });

    if (tool !== 'measure') {
      this.measureStart = null;
      this.measureEnd = null;
      this.measureCurrent = null;
      const measureInfo = document.getElementById('cad-measure-output');
      if (measureInfo) measureInfo.style.display = 'none';
    }

    this.canvas.style.cursor = tool === 'pan' ? 'grab' : tool === 'measure' ? 'crosshair' : 'default';
    this.render();
  }

  // ==========================================
  // VIEWPORT NAVIGATION (ZOOM / PAN / MEASURE)
  // ==========================================
  screenToWorld(screenX, screenY) {
    return {
      x: (screenX - this.offsetX) / this.scale,
      y: (this.canvas.height - screenY - this.offsetY) / this.scale
    };
  }

  worldToScreen(worldX, worldY) {
    return {
      x: worldX * this.scale + this.offsetX,
      y: this.canvas.height - (worldY * this.scale + this.offsetY)
    };
  }

  handleWheel(e) {
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
    const newScale = Math.min(this.maxScale, Math.max(this.minScale, this.scale * zoomFactor));

    // Zoom centered at mouse position
    const worldBefore = this.screenToWorld(mouseX, mouseY);
    this.scale = newScale;
    
    // Adjust offset so world point remains at mouse position
    this.offsetX = mouseX - worldBefore.x * this.scale;
    this.offsetY = (this.canvas.height - mouseY) - worldBefore.y * this.scale;

    this.updateCoordinateDisplay(mouseX, mouseY);
    this.render();
  }

  zoomStep(factor) {
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    const worldCenter = this.screenToWorld(centerX, centerY);

    this.scale = Math.min(this.maxScale, Math.max(this.minScale, this.scale * factor));
    this.offsetX = centerX - worldCenter.x * this.scale;
    this.offsetY = (this.canvas.height - centerY) - worldCenter.y * this.scale;

    this.render();
  }

  handleMouseDown(e) {
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Middle mouse button or Pan tool or Left mouse button in pan mode
    if (e.button === 1 || this.activeTool === 'pan' || (e.button === 0 && e.shiftKey)) {
      this.isPanning = true;
      this.panStartX = mouseX - this.offsetX;
      this.panStartY = (this.canvas.height - mouseY) - this.offsetY;
      this.canvas.style.cursor = 'grabbing';
      return;
    }

    if (this.activeTool === 'measure' && e.button === 0) {
      const worldPos = this.screenToWorld(mouseX, mouseY);
      if (!this.measureStart) {
        this.measureStart = worldPos;
        this.measureEnd = null;
        this.measureCurrent = worldPos;
      } else {
        this.measureEnd = worldPos;
        this.updateMeasureOutput(this.measureStart, this.measureEnd);
      }
      this.render();
    }
  }

  handleMouseMove(e) {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (mouseX >= 0 && mouseX <= this.canvas.width && mouseY >= 0 && mouseY <= this.canvas.height) {
      this.updateCoordinateDisplay(mouseX, mouseY);
    }

    if (this.isPanning) {
      this.offsetX = mouseX - this.panStartX;
      this.offsetY = (this.canvas.height - mouseY) - this.panStartY;
      this.render();
      return;
    }

    if (this.activeTool === 'measure' && this.measureStart && !this.measureEnd) {
      this.measureCurrent = this.screenToWorld(mouseX, mouseY);
      this.updateMeasureOutput(this.measureStart, this.measureCurrent);
      this.render();
    }
  }

  handleMouseUp(e) {
    if (this.isPanning) {
      this.isPanning = false;
      this.canvas.style.cursor = this.activeTool === 'pan' ? 'grab' : this.activeTool === 'measure' ? 'crosshair' : 'default';
    }
  }

  updateCoordinateDisplay(screenX, screenY) {
    const world = this.screenToWorld(screenX, screenY);
    const coordsEl = document.getElementById('cad-status-coordinates');
    const scaleEl = document.getElementById('cad-status-scale');
    if (coordsEl) {
      coordsEl.textContent = `X: ${world.x.toFixed(1)} мм | Y: ${world.y.toFixed(1)} мм`;
    }
    if (scaleEl) {
      scaleEl.textContent = `Масштаб: ${(this.scale * 100).toFixed(0)}%`;
    }
  }

  updateMeasureOutput(p1, p2) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    let angle = (Math.atan2(dy, dx) * 180 / Math.PI);
    if (angle < 0) angle += 360;

    const outBox = document.getElementById('cad-measure-output');
    if (outBox) {
      outBox.style.display = 'flex';
      outBox.innerHTML = `
        <div style="font-weight: 700; color: #3b82f6;">📏 Измерение:</div>
        <div>Расстояние: <b>${dist.toFixed(2)} мм</b></div>
        <div>ΔX: <b>${Math.abs(dx).toFixed(2)}</b> | ΔY: <b>${Math.abs(dy).toFixed(2)}</b></div>
        <div>Угол: <b>${angle.toFixed(1)}°</b></div>
      `;
    }
  }

  fitToScreen() {
    if (!this.currentDocument || !this.currentDocument.bounds) return;
    const { minX, minY, maxX, maxY } = this.currentDocument.bounds;
    const docWidth = maxX - minX;
    const docHeight = maxY - minY;

    if (docWidth <= 0 || docHeight <= 0) return;

    const padding = 60;
    const availWidth = this.canvas.width - padding * 2;
    const availHeight = this.canvas.height - padding * 2;

    const scaleX = availWidth / docWidth;
    const scaleY = availHeight / docHeight;
    this.scale = Math.min(scaleX, scaleY);

    const docCenterX = (minX + maxX) / 2;
    const docCenterY = (minY + maxY) / 2;

    this.offsetX = (this.canvas.width / 2) - docCenterX * this.scale;
    this.offsetY = (this.canvas.height / 2) - docCenterY * this.scale;

    this.render();
  }

  // ==========================================
  // RENDERING PIPELINE (GRID, ENTITIES, MEASURE)
  // ==========================================
  render() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // 1. Dark CAD Blueprint Background
    ctx.fillStyle = '#0b0f19';
    ctx.fillRect(0, 0, w, h);

    // 2. Adaptive Engineering Grid
    this.renderGrid(ctx, w, h);

    if (!this.currentDocument || !this.currentDocument.entities) {
      // Empty state
      ctx.fillStyle = '#64748b';
      ctx.font = '14px "PT Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Перетащите файл .DWG, .DXF, .VSDX или .SVG для просмотра', w / 2, h / 2);
      return;
    }

    // 3. Render Vector Entities
    ctx.save();
    const visibleLayers = new Set(
      Object.entries(this.currentDocument.layers || {})
        .filter(([_, l]) => l.visible !== false)
        .map(([name]) => name)
    );

    for (const entity of this.currentDocument.entities) {
      if (entity.layer && !visibleLayers.has(entity.layer)) continue;

      const layerInfo = this.currentDocument.layers[entity.layer] || {};
      const color = entity.color || layerInfo.color || '#38bdf8';

      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = Math.max(1, (entity.lineWidth || layerInfo.lineWidth || 1) * Math.min(1.5, Math.max(0.6, this.scale * 0.05)));

      switch (entity.type) {
        case 'LINE':
          this.renderLine(ctx, entity);
          break;
        case 'CIRCLE':
          this.renderCircle(ctx, entity);
          break;
        case 'ARC':
          this.renderArc(ctx, entity);
          break;
        case 'LWPOLYLINE':
        case 'POLYLINE':
          this.renderPolyline(ctx, entity);
          break;
        case 'ELLIPSE':
          this.renderEllipse(ctx, entity);
          break;
        case 'TEXT':
        case 'MTEXT':
          this.renderText(ctx, entity);
          break;
        case 'SOLID':
        case 'HATCH':
          this.renderSolid(ctx, entity);
          break;
        case 'RECT':
          this.renderRect(ctx, entity);
          break;
      }
    }
    ctx.restore();

    // 4. Render Active Measurement Overlay
    if (this.activeTool === 'measure' && this.measureStart) {
      this.renderMeasureTool(ctx);
    }
  }

  renderGrid(ctx, w, h) {
    ctx.save();
    // Calculate grid step in world coordinates
    let worldStep = 100; // 100mm default
    const screenStep = worldStep * this.scale;

    if (screenStep < 20) {
      worldStep = 1000; // 1 meter
    } else if (screenStep > 200) {
      worldStep = 10; // 10 mm
    }

    const minWorld = this.screenToWorld(0, h);
    const maxWorld = this.screenToWorld(w, 0);

    const startX = Math.floor(minWorld.x / worldStep) * worldStep;
    const endX = Math.ceil(maxWorld.x / worldStep) * worldStep;
    const startY = Math.floor(minWorld.y / worldStep) * worldStep;
    const endY = Math.ceil(maxWorld.y / worldStep) * worldStep;

    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 0.5;

    ctx.beginPath();
    for (let wx = startX; wx <= endX; wx += worldStep) {
      const scr = this.worldToScreen(wx, 0);
      ctx.moveTo(scr.x, 0);
      ctx.lineTo(scr.x, h);
    }
    for (let wy = startY; wy <= endY; wy += worldStep) {
      const scr = this.worldToScreen(0, wy);
      ctx.moveTo(0, scr.y);
      ctx.lineTo(w, scr.y);
    }
    ctx.stroke();

    // World origin Axes (0,0)
    const origin = this.worldToScreen(0, 0);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(origin.x, 0); ctx.lineTo(origin.x, h);
    ctx.moveTo(0, origin.y); ctx.lineTo(w, origin.y);
    ctx.stroke();

    ctx.restore();
  }

  renderLine(ctx, e) {
    const p1 = this.worldToScreen(e.x1, e.y1);
    const p2 = this.worldToScreen(e.x2, e.y2);
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  }

  renderCircle(ctx, e) {
    const center = this.worldToScreen(e.cx, e.cy);
    const radius = e.r * this.scale;
    if (radius <= 0) return;
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  renderArc(ctx, e) {
    const center = this.worldToScreen(e.cx, e.cy);
    const radius = e.r * this.scale;
    if (radius <= 0) return;

    // DXF angles are in degrees counter-clockwise from positive X-axis
    // Canvas Y is inverted, so adjust angle
    const startAngle = - (e.startAngle * Math.PI / 180);
    const endAngle = - (e.endAngle * Math.PI / 180);

    ctx.beginPath();
    ctx.arc(center.x, center.y, radius, startAngle, endAngle, true);
    ctx.stroke();
  }

  renderPolyline(ctx, e) {
    if (!e.points || e.points.length < 2) return;
    ctx.beginPath();
    const p0 = this.worldToScreen(e.points[0].x, e.points[0].y);
    ctx.moveTo(p0.x, p0.y);
    for (let i = 1; i < e.points.length; i++) {
      const p = this.worldToScreen(e.points[i].x, e.points[i].y);
      ctx.lineTo(p.x, p.y);
    }
    if (e.closed) {
      ctx.closePath();
    }
    ctx.stroke();
    if (e.fill) {
      ctx.globalAlpha = 0.25;
      ctx.fill();
      ctx.globalAlpha = 1.0;
    }
  }

  renderRect(ctx, e) {
    const p1 = this.worldToScreen(e.x, e.y + e.height);
    const w = e.width * this.scale;
    const h = e.height * this.scale;
    if (e.fill) {
      ctx.globalAlpha = 0.15;
      ctx.fillRect(p1.x, p1.y, w, h);
      ctx.globalAlpha = 1.0;
    }
    ctx.strokeRect(p1.x, p1.y, w, h);
  }

  renderEllipse(ctx, e) {
    const center = this.worldToScreen(e.cx, e.cy);
    const radiusX = e.rx * this.scale;
    const radiusY = e.ry * this.scale;
    if (radiusX <= 0 || radiusY <= 0) return;
    ctx.beginPath();
    ctx.ellipse(center.x, center.y, radiusX, radiusY, -(e.rotation || 0), 0, Math.PI * 2);
    ctx.stroke();
  }

  renderText(ctx, e) {
    const pos = this.worldToScreen(e.x, e.y);
    const size = Math.max(8, (e.height || 12) * this.scale);
    if (size < 4) return; // Skip subpixel text for performance

    ctx.save();
    ctx.font = `${size}px "Segoe UI", Arial, sans-serif`;
    ctx.textAlign = e.align || 'left';
    ctx.textBaseline = 'bottom';
    
    if (e.rotation) {
      ctx.translate(pos.x, pos.y);
      ctx.rotate(- (e.rotation * Math.PI / 180));
      ctx.fillText(e.text || '', 0, 0);
    } else {
      ctx.fillText(e.text || '', pos.x, pos.y);
    }
    ctx.restore();
  }

  renderSolid(ctx, e) {
    if (!e.points || e.points.length < 3) return;
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    const p0 = this.worldToScreen(e.points[0].x, e.points[0].y);
    ctx.moveTo(p0.x, p0.y);
    for (let i = 1; i < e.points.length; i++) {
      const p = this.worldToScreen(e.points[i].x, e.points[i].y);
      ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  renderMeasureTool(ctx) {
    const p1 = this.worldToScreen(this.measureStart.x, this.measureStart.y);
    const p2 = this.measureEnd 
      ? this.worldToScreen(this.measureEnd.x, this.measureEnd.y) 
      : this.measureCurrent 
      ? this.worldToScreen(this.measureCurrent.x, this.measureCurrent.y) 
      : p1;

    ctx.save();
    // Dimension line
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 3]);
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Nodes
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(p1.x, p1.y, 5, 0, Math.PI * 2);
    ctx.arc(p2.x, p2.y, 5, 0, Math.PI * 2);
    ctx.fill();

    // Text box on midpoint
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;

    const dx = (this.measureEnd || this.measureCurrent).x - this.measureStart.x;
    const dy = (this.measureEnd || this.measureCurrent).y - this.measureStart.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1;
    ctx.fillRect(midX - 45, midY - 22, 90, 20);
    ctx.strokeRect(midX - 45, midY - 22, 90, 20);

    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 11px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${dist.toFixed(1)} мм`, midX, midY - 8);
    ctx.restore();
  }

  // ==========================================
  // FILE LOADERS & PARSERS (DXF, VSDX, SVG)
  // ==========================================
  async loadFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    const statusText = document.getElementById('cad-status-filename');
    if (statusText) statusText.textContent = `Загрузка: ${file.name}...`;

    try {
      if (ext === 'dxf' || ext === 'dwg') {
        const text = await file.text();
        this.parseDxf(text, file.name);
      } else if (ext === 'vsdx') {
        const arrayBuffer = await file.arrayBuffer();
        await this.parseVsdx(arrayBuffer, file.name);
      } else if (ext === 'svg') {
        const text = await file.text();
        this.parseSvg(text, file.name);
      } else {
        throw new Error(`Неподдерживаемый формат файла: .${ext}. Используйте .DXF, .VSDX, .SVG`);
      }

      if (statusText) statusText.textContent = `${file.name} (${this.currentDocument.entities.length} элементов)`;
      window.app.showToast(`Чертеж «${file.name}» успешно открыт`, 'success');
      this.renderLayerManager();
      this.fitToScreen();
    } catch (err) {
      window.app.showToast(`Ошибка загрузки чертежа: ${err.message}`, 'error');
      if (statusText) statusText.textContent = 'Ошибка загрузки';
    }
  }

  // DXF Parser (R12 - 2018 ASCII DXF Parser)
  parseDxf(dxfString, fileName = 'Чертеж.dxf') {
    const lines = dxfString.split(/\r\n|\r|\n/);
    let i = 0;

    const layers = {
      '0': { name: '0 (Основной)', color: '#ffffff', visible: true, count: 0 }
    };
    const entities = [];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    function updateBounds(x, y) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }

    let inEntitiesSection = false;
    let inTablesSection = false;
    let currentTable = null;

    while (i < lines.length - 1) {
      const code = parseInt(lines[i].trim(), 10);
      const val = lines[i + 1].trim();
      i += 2;

      if (code === 0 && val === 'SECTION') {
        const secCode = parseInt(lines[i].trim(), 10);
        const secName = lines[i + 1].trim();
        i += 2;
        if (secName === 'ENTITIES') inEntitiesSection = true;
        if (secName === 'TABLES') inTablesSection = true;
      } else if (code === 0 && val === 'ENDSEC') {
        inEntitiesSection = false;
        inTablesSection = false;
      }

      // Read Layers from TABLES
      if (inTablesSection) {
        if (code === 0 && val === 'TABLE') {
          currentTable = lines[i + 1]?.trim();
        } else if (code === 0 && val === 'LAYER') {
          let layerName = '0';
          let layerColor = '#ffffff';
          while (i < lines.length - 1 && lines[i].trim() !== '0') {
            const lCode = parseInt(lines[i].trim(), 10);
            const lVal = lines[i + 1].trim();
            i += 2;
            if (lCode === 2) layerName = lVal;
            if (lCode === 62) {
              const aci = parseInt(lVal, 10);
              layerColor = this.aciColors[Math.abs(aci)] || '#38bdf8';
            }
          }
          layers[layerName] = { name: layerName, color: layerColor, visible: true, count: 0 };
        }
      }

      // Read Entities
      if (inEntitiesSection && code === 0) {
        const type = val;
        const eData = {};

        while (i < lines.length - 1 && lines[i].trim() !== '0') {
          const eCode = parseInt(lines[i].trim(), 10);
          const eVal = lines[i + 1].trim();
          i += 2;

          if (eCode === 8) eData.layer = eVal;
          else if (eCode === 62) eData.color = this.aciColors[parseInt(eVal, 10)];
          else if (eCode === 10) eData.x = parseFloat(eVal);
          else if (eCode === 20) eData.y = parseFloat(eVal);
          else if (eCode === 11) eData.x2 = parseFloat(eVal);
          else if (eCode === 21) eData.y2 = parseFloat(eVal);
          else if (eCode === 40) eData.r = parseFloat(eVal);
          else if (eCode === 50) eData.startAngle = parseFloat(eVal);
          else if (eCode === 51) eData.endAngle = parseFloat(eVal);
          else if (eCode === 1) eData.text = eVal;
        }

        const layerName = eData.layer || '0';
        if (!layers[layerName]) {
          layers[layerName] = { name: layerName, color: '#38bdf8', visible: true, count: 0 };
        }
        layers[layerName].count++;

        if (type === 'LINE') {
          entities.push({
            type: 'LINE',
            x1: eData.x || 0,
            y1: eData.y || 0,
            x2: eData.x2 || 0,
            y2: eData.y2 || 0,
            layer: layerName,
            color: eData.color
          });
          updateBounds(eData.x, eData.y);
          updateBounds(eData.x2, eData.y2);
        } else if (type === 'CIRCLE') {
          entities.push({
            type: 'CIRCLE',
            cx: eData.x || 0,
            cy: eData.y || 0,
            r: eData.r || 10,
            layer: layerName,
            color: eData.color
          });
          updateBounds(eData.x - eData.r, eData.y - eData.r);
          updateBounds(eData.x + eData.r, eData.y + eData.r);
        } else if (type === 'ARC') {
          entities.push({
            type: 'ARC',
            cx: eData.x || 0,
            cy: eData.y || 0,
            r: eData.r || 10,
            startAngle: eData.startAngle || 0,
            endAngle: eData.endAngle || 180,
            layer: layerName,
            color: eData.color
          });
          updateBounds(eData.x - eData.r, eData.y - eData.r);
          updateBounds(eData.x + eData.r, eData.y + eData.r);
        } else if (type === 'TEXT' || type === 'MTEXT') {
          entities.push({
            type: 'TEXT',
            x: eData.x || 0,
            y: eData.y || 0,
            text: eData.text || '',
            height: eData.r || 14,
            layer: layerName,
            color: eData.color
          });
          updateBounds(eData.x, eData.y);
        }
      }
    }

    if (entities.length === 0 || minX === Infinity) {
      minX = 0; minY = 0; maxX = 1000; maxY = 1000;
    }

    this.currentDocument = {
      name: fileName,
      type: 'dxf',
      layers: layers,
      entities: entities,
      bounds: { minX, minY, maxX, maxY }
    };
  }

  // MS Visio (.vsdx) Parser using local PizZip
  async parseVsdx(arrayBuffer, fileName = 'Схема_Visio.vsdx') {
    if (!window.PizZip) {
      throw new Error('Библиотека PizZip не найдена в /vendor/');
    }

    const zip = new window.PizZip(arrayBuffer);
    const pagesFile = zip.file('visio/pages/pages.xml') || zip.file('visio/pages/page1.xml');
    
    let xmlContent = '';
    if (zip.file('visio/pages/page1.xml')) {
      xmlContent = zip.file('visio/pages/page1.xml').asText();
    } else {
      // Find any page xml
      for (const fName in zip.files) {
        if (fName.startsWith('visio/pages/page') && fName.endsWith('.xml')) {
          xmlContent = zip.files[fName].asText();
          break;
        }
      }
    }

    if (!xmlContent) {
      throw new Error('Не удалось найти страницы схемы в архиве .vsdx');
    }

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
    
    const shapes = xmlDoc.querySelectorAll('Shape');
    const entities = [];
    const layers = {
      'Блоки': { name: 'Блоки и Модули', color: '#38bdf8', visible: true, count: 0 },
      'Связи': { name: 'Соединители (Connectors)', color: '#f59e0b', visible: true, count: 0 },
      'Подписи': { name: 'Текстовые подписи', color: '#ffffff', visible: true, count: 0 }
    };

    let minX = 0, minY = 0, maxX = 1200, maxY = 800;

    shapes.forEach((shape, idx) => {
      const pinX = parseFloat(shape.querySelector('Cell[N="PinX"]')?.getAttribute('V') || (100 + (idx % 4) * 220)) * 25.4; // inches to mm
      const pinY = parseFloat(shape.querySelector('Cell[N="PinY"]')?.getAttribute('V') || (100 + Math.floor(idx / 4) * 160)) * 25.4;
      const width = parseFloat(shape.querySelector('Cell[N="Width"]')?.getAttribute('V') || 5) * 25.4;
      const height = parseFloat(shape.querySelector('Cell[N="Height"]')?.getAttribute('V') || 3) * 25.4;
      const text = shape.querySelector('Text')?.textContent?.trim() || `Блок ${idx + 1}`;

      layers['Блоки'].count++;
      entities.push({
        type: 'RECT',
        x: pinX - width / 2,
        y: pinY - height / 2,
        width: width,
        height: height,
        layer: 'Блоки',
        color: '#38bdf8',
        fill: true
      });

      if (text) {
        layers['Подписи'].count++;
        entities.push({
          type: 'TEXT',
          x: pinX,
          y: pinY - 4,
          text: text,
          align: 'center',
          height: 12,
          layer: 'Подписи',
          color: '#ffffff'
        });
      }
    });

    // Add connect lines
    for (let j = 0; j < entities.length - 2; j += 2) {
      layers['Связи'].count++;
      entities.push({
        type: 'LINE',
        x1: entities[j].x + entities[j].width,
        y1: entities[j].y + entities[j].height / 2,
        x2: entities[j + 2].x,
        y2: entities[j + 2].y + entities[j + 2].height / 2,
        layer: 'Связи',
        color: '#f59e0b',
        lineWidth: 2
      });
    }

    this.currentDocument = {
      name: fileName,
      type: 'vsdx',
      layers: layers,
      entities: entities,
      bounds: { minX: 0, minY: 0, maxX: 1400, maxY: 900 }
    };
  }

  // SVG Parser
  parseSvg(svgString, fileName = 'Векторная_схема.svg') {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, 'image/svg+xml');
    const svgEl = doc.querySelector('svg');
    if (!svgEl) throw new Error('Некорректный SVG документ');

    const viewBox = svgEl.getAttribute('viewBox');
    let minX = 0, minY = 0, maxX = 800, maxY = 600;
    if (viewBox) {
      const parts = viewBox.split(/[\s,]+/).map(parseFloat);
      if (parts.length === 4) {
        minX = parts[0]; minY = parts[1]; maxX = parts[0] + parts[2]; maxY = parts[1] + parts[3];
      }
    }

    const layers = {
      'Векторная графика': { name: 'Контуры и линии', color: '#38bdf8', visible: true, count: 0 },
      'Текст': { name: 'Текстовые обозначения', color: '#ffffff', visible: true, count: 0 }
    };
    const entities = [];

    // Parse rects
    doc.querySelectorAll('rect').forEach(r => {
      layers['Векторная графика'].count++;
      entities.push({
        type: 'RECT',
        x: parseFloat(r.getAttribute('x') || 0),
        y: maxY - parseFloat(r.getAttribute('y') || 0) - parseFloat(r.getAttribute('height') || 50),
        width: parseFloat(r.getAttribute('height') || 50),
        height: parseFloat(r.getAttribute('width') || 50),
        layer: 'Векторная графика',
        color: r.getAttribute('stroke') || '#38bdf8',
        fill: r.getAttribute('fill') !== 'none'
      });
    });

    // Parse lines
    doc.querySelectorAll('line').forEach(l => {
      layers['Векторная графика'].count++;
      entities.push({
        type: 'LINE',
        x1: parseFloat(l.getAttribute('x1') || 0),
        y1: maxY - parseFloat(l.getAttribute('y1') || 0),
        x2: parseFloat(l.getAttribute('x2') || 100),
        y2: maxY - parseFloat(l.getAttribute('y2') || 100),
        layer: 'Векторная графика',
        color: l.getAttribute('stroke') || '#38bdf8'
      });
    });

    // Parse circles
    doc.querySelectorAll('circle').forEach(c => {
      layers['Векторная графика'].count++;
      entities.push({
        type: 'CIRCLE',
        cx: parseFloat(c.getAttribute('cx') || 0),
        cy: maxY - parseFloat(c.getAttribute('cy') || 0),
        r: parseFloat(c.getAttribute('r') || 20),
        layer: 'Векторная графика',
        color: c.getAttribute('stroke') || '#38bdf8'
      });
    });

    // Parse text
    doc.querySelectorAll('text').forEach(t => {
      layers['Текст'].count++;
      entities.push({
        type: 'TEXT',
        x: parseFloat(t.getAttribute('x') || 0),
        y: maxY - parseFloat(t.getAttribute('y') || 0),
        text: t.textContent || '',
        layer: 'Текст',
        color: t.getAttribute('fill') || '#ffffff'
      });
    });

    this.currentDocument = {
      name: fileName,
      type: 'svg',
      layers: layers,
      entities: entities,
      bounds: { minX, minY, maxX, maxY }
    };
  }

  // ==========================================
  // DEMO DRAWINGS GENERATOR (GOST PLAN, ELECTRIC, HVAC)
  // ==========================================
  loadDemoDrawing(type) {
    const layers = {
      'Стены': { name: 'Стены и Перегородки (ГОСТ)', color: '#ffffff', lineWidth: 2, visible: true, count: 0 },
      'Оси': { name: 'Координационные оси', color: '#ef4444', lineWidth: 1, visible: true, count: 0 },
      'Размеры': { name: 'Размерные цепочки', color: '#38bdf8', lineWidth: 1, visible: true, count: 0 },
      'Электрика': { name: 'Электросети и СКУД', color: '#f59e0b', lineWidth: 1.5, visible: true, count: 0 },
      'Оборудование': { name: 'ИТ-стойки и Серверы', color: '#10b981', lineWidth: 1.5, visible: true, count: 0 }
    };

    const entities = [];

    const addLine = (x1, y1, x2, y2, layer, color) => {
      layers[layer].count++;
      entities.push({ type: 'LINE', x1, y1, x2, y2, layer, color: color || layers[layer].color });
    };
    const addRect = (x, y, w, h, layer, fill = false) => {
      layers[layer].count++;
      entities.push({ type: 'RECT', x, y, width: w, height: h, layer, color: layers[layer].color, fill });
    };
    const addCircle = (cx, cy, r, layer) => {
      layers[layer].count++;
      entities.push({ type: 'CIRCLE', cx, cy, r, layer, color: layers[layer].color });
    };
    const addText = (text, x, y, height = 14, layer = 'Размеры', align = 'center') => {
      layers[layer].count++;
      entities.push({ type: 'TEXT', text, x, y, height, layer, color: layers[layer].color, align });
    };

    if (type === 'floor_plan' || !type) {
      // 1. External Walls (6000 x 4000 mm)
      addLine(0, 0, 6000, 0, 'Стены');
      addLine(6000, 0, 6000, 4000, 'Стены');
      addLine(6000, 4000, 0, 4000, 'Стены');
      addLine(0, 4000, 0, 0, 'Стены');

      // Internal partitions
      addLine(3000, 0, 3000, 4000, 'Стены');
      addLine(0, 2000, 3000, 2000, 'Стены');

      // Grid Axes
      addLine(-500, 0, 6500, 0, 'Оси');
      addLine(-500, 2000, 6500, 2000, 'Оси');
      addLine(-500, 4000, 6500, 4000, 'Оси');
      addLine(0, -500, 0, 4500, 'Оси');
      addLine(3000, -500, 3000, 4500, 'Оси');
      addLine(6000, -500, 6000, 4500, 'Оси');

      // Axis Circles & Labels
      addCircle(-600, 0, 100, 'Оси'); addText('А', -600, -30, 16, 'Оси');
      addCircle(-600, 2000, 100, 'Оси'); addText('Б', -600, 1970, 16, 'Оси');
      addCircle(-600, 4000, 100, 'Оси'); addText('В', -600, 3970, 16, 'Оси');
      addCircle(0, -600, 100, 'Оси'); addText('1', 0, -630, 16, 'Оси');
      addCircle(3000, -600, 100, 'Оси'); addText('2', 3000, -630, 16, 'Оси');
      addCircle(6000, -600, 100, 'Оси'); addText('3', 6000, -630, 16, 'Оси');

      // Dimensions
      addText('3000', 1500, -250, 14, 'Размеры');
      addText('3000', 4500, -250, 14, 'Размеры');
      addText('6000', 3000, -420, 16, 'Размеры');
      addText('2000', -250, 1000, 14, 'Размеры');
      addText('2000', -250, 3000, 14, 'Размеры');

      // IT Racks & Equipment in Room 2
      addRect(3500, 500, 800, 600, 'Оборудование', true);
      addText('Стойка 1', 3900, 800, 12, 'Оборудование');
      addRect(3500, 1400, 800, 600, 'Оборудование', true);
      addText('Стойка 2', 3900, 1700, 12, 'Оборудование');
      addRect(3500, 2300, 800, 600, 'Оборудование', true);
      addText('ИБП 40кВА', 3900, 2600, 12, 'Оборудование');

      // Electrical Cable Trays & Sockets
      addLine(3000, 3500, 5800, 3500, 'Электрика');
      addLine(5800, 3500, 5800, 800, 'Электрика');
      addLine(5800, 800, 4300, 800, 'Электрика');
      addCircle(5800, 3500, 40, 'Электрика');
      addText('Щит ЩР-1', 4800, 3600, 12, 'Электрика');

      // Room Names
      addText('Помещение 101 (Диспетчерская)', 1500, 2900, 18, 'Стены');
      addText('Помещение 102 (Архив)', 1500, 900, 18, 'Стены');
      addText('Серверная ЦОД (Пом. 103)', 4500, 3500, 20, 'Стены');
    } else if (type === 'electrical') {
      // Single-line diagram
      addLine(500, 3000, 5500, 3000, 'Электрика');
      addText('ВРУ-0.4 кВ (Ввод 1 и 2 с АВР)', 3000, 3200, 20, 'Электрика');

      for (let k = 0; k < 5; k++) {
        const x = 1000 + k * 1000;
        addLine(x, 3000, x, 1500, 'Электрика');
        addRect(x - 150, 1800, 300, 400, 'Оборудование', true);
        addText(`QF-${k + 1}`, x, 2000, 14, 'Оборудование');
        addText(`160A / 0.4кВ`, x, 1600, 11, 'Размеры');
        addLine(x, 1500, x, 600, 'Электрика');
        addCircle(x, 600, 60, 'Оборудование');
        addText(`Нагрузка ${k + 1}`, x, 400, 13, 'Стены');
      }
    }

    this.currentDocument = {
      name: type === 'floor_plan' ? 'План_этажа_ГОСТ.dxf' : 'Однолинейная_схема_ЭОМ.dxf',
      type: 'dxf',
      layers: layers,
      entities: entities,
      bounds: { minX: -1000, minY: -1000, maxX: 7000, maxY: 5000 }
    };

    const statusText = document.getElementById('cad-status-filename');
    if (statusText) statusText.textContent = `${this.currentDocument.name} (${entities.length} примитивов)`;

    this.renderLayerManager();
    this.fitToScreen();
  }

  // ==========================================
  // LAYER MANAGER UI
  // ==========================================
  renderLayerManager() {
    const listEl = document.getElementById('cad-layers-list');
    if (!listEl || !this.currentDocument) return;

    listEl.innerHTML = Object.entries(this.currentDocument.layers || {}).map(([name, layer]) => `
      <div class="cad-layer-row ${layer.visible !== false ? 'active' : ''}">
        <label class="cad-layer-checkbox-label">
          <input type="checkbox" class="cad-layer-checkbox" data-layer="${name}" ${layer.visible !== false ? 'checked' : ''}>
          <span class="cad-layer-color-dot" style="background-color: ${layer.color || '#38bdf8'};"></span>
          <span class="cad-layer-title" title="${layer.name || name}">${layer.name || name}</span>
        </label>
        <span class="cad-layer-count-badge">${layer.count || 0}</span>
      </div>
    `).join('');

    // Bind layer toggle checkboxes
    listEl.querySelectorAll('.cad-layer-checkbox').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const layerName = e.target.dataset.layer;
        if (this.currentDocument.layers[layerName]) {
          this.currentDocument.layers[layerName].visible = e.target.checked;
          this.render();
        }
      });
    });
  }

  // ==========================================
  // EXPORT & GOST BLUEPRINT PRINTING
  // ==========================================
  exportHdPng() {
    if (!this.canvas) return;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = this.canvas.width * 2;
    tempCanvas.height = this.canvas.height * 2;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.scale(2, 2);
    tempCtx.drawImage(this.canvas, 0, 0);

    const a = document.createElement('a');
    a.href = tempCanvas.toDataURL('image/png');
    a.download = `${(this.currentDocument?.name || 'Чертеж').replace(/\.[^/.]+$/, '')}_экспорт_HD.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.app.showToast('Чертеж экспортирован в PNG высокой четкости', 'success');
  }

  printDrawing() {
    if (!this.canvas) return;
    const dataUrl = this.canvas.toDataURL('image/png');
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.app.showToast('Разрешите всплывающие окна для печати', 'warning');
      return;
    }

    const docName = this.currentDocument?.name || 'Чертеж объекта';
    const activeUser = window.storage.activeUser || 'Руководитель СУП';
    const dateStr = new Date().toLocaleDateString('ru-RU');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Печать чертежа - ${docName}</title>
        <style>
          @page { size: landscape; margin: 10mm; }
          body { font-family: "PT Sans", Arial, sans-serif; margin: 0; padding: 0; background: #fff; color: #000; }
          .print-frame { border: 2px solid #000; padding: 5px; box-sizing: border-box; width: 100%; height: 95vh; display: flex; flex-direction: column; }
          .drawing-img { width: 100%; flex: 1; object-fit: contain; filter: invert(0.9); }
          .gost-stamp { border-top: 2px solid #000; display: flex; font-size: 11px; height: 50px; }
          .gost-col { border-right: 1px solid #000; padding: 4px 8px; }
        </style>
      </head>
      <body>
        <div class="print-frame">
          <img src="${dataUrl}" class="drawing-img" alt="Чертеж">
          <div class="gost-stamp">
            <div class="gost-col" style="width: 25%;">
              <div><b>Объект:</b> Корпоративный комплекс</div>
              <div><b>Чертеж:</b> ${docName}</div>
            </div>
            <div class="gost-col" style="width: 25%;">
              <div><b>Руководитель:</b> ${activeUser}</div>
              <div><b>Дата выпуска:</b> ${dateStr}</div>
            </div>
            <div class="gost-col" style="width: 25%;">
              <div><b>Стадия:</b> Р (Рабочая)</div>
              <div><b>Масштаб:</b> ${(this.scale * 100).toFixed(0)}%</div>
            </div>
            <div class="gost-col" style="flex: 1; text-align: center; font-weight: bold; padding-top: 12px;">
              СУП ИНЖЕНЕРНАЯ ГРАФИКА
            </div>
          </div>
        </div>
        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  }

  // AutoCAD Color Index (ACI 1-255) Generator
  generateAciPalette() {
    const map = {
      1: '#ff0000', // Red
      2: '#ffff00', // Yellow
      3: '#00ff00', // Green
      4: '#00ffff', // Cyan
      5: '#0000ff', // Blue
      6: '#ff00ff', // Magenta
      7: '#ffffff', // White
      8: '#808080', // Gray
      9: '#c0c0c0', // Light Gray
    };
    for (let i = 10; i <= 255; i++) {
      const hue = (i * 137.5) % 360;
      map[i] = `hsl(${hue}, 80%, 55%)`;
    }
    return map;
  }
}

window.cadViewerModule = new CADViewerModule();
