/**
 * Contracts & Documents Module
 */

class ContractsModule {
  constructor() {
    this.editingContractId = null;
    this.filterSearch = '';
  }

  init() {
    this.bindEvents();
    this.render();
  }

  bindEvents() {
    const btnNew = document.getElementById('btn-new-contract');
    const searchInput = document.getElementById('contract-search-input');

    if (btnNew) btnNew.addEventListener('click', () => this.openContractModal(null));
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.filterSearch = e.target.value.toLowerCase();
        this.render();
      });
    }
  }

  render() {
    const tableBody = document.getElementById('contracts-table-body');
    if (!tableBody) return;

    const { contracts = [], employees = [], locks = [] } = window.storage.cache;

    // Financial summaries
    let totalSum = 0;
    let activeCount = 0;

    const filtered = contracts.filter(c => {
      const match = (c.number || '').toLowerCase().includes(this.filterSearch) ||
                    (c.title || '').toLowerCase().includes(this.filterSearch) ||
                    (c.counterparty || '').toLowerCase().includes(this.filterSearch);
      if (c.status === 'active') activeCount++;
      totalSum += Number(c.sum) || 0;
      return match;
    });

    // Update summary badges
    const sumEl = document.getElementById('cnt-total-sum');
    const activeEl = document.getElementById('cnt-active-count');
    if (sumEl) sumEl.textContent = new Intl.NumberFormat('ru-RU').format(totalSum) + ' ₽';
    if (activeEl) activeEl.textContent = activeCount;

    if (filtered.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:2rem; color:var(--text-muted);">Договоры не найдены</td></tr>`;
      return;
    }

    const statusLabels = {
      active: { text: 'Действует', cls: 'badge-status-done' },
      review: { text: 'На согласовании', cls: 'badge-status-review' },
      closed: { text: 'Исполнен', cls: 'badge-status-backlog' },
      terminated: { text: 'Расторгнут', cls: 'badge-critical' }
    };

    tableBody.innerHTML = filtered.map(c => {
      const resp = employees.find(e => e.id === c.responsibleId) || { name: 'Не назначен' };
      const statusMeta = statusLabels[c.status] || { text: c.status, cls: 'badge-status-backlog' };
      const isLocked = locks.some(l => l.entityType === 'contracts' && l.entityId === c.id && l.lockedBy !== window.storage.activeUser);

      return `
        <tr onclick="window.contractsModule.openContractModal('${c.id}')">
          <td style="font-weight:600; color:var(--accent-primary);">
            ${isLocked ? '🔒 ' : ''}${this.escapeHtml(c.number || 'Б/Н')}
          </td>
          <td>
            <div style="font-weight:600;">${this.escapeHtml(c.counterparty || '—')}</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">${this.escapeHtml(c.title)}</div>
          </td>
          <td style="font-weight:700; white-space:nowrap;">${new Intl.NumberFormat('ru-RU').format(c.sum || 0)} ₽</td>
          <td>
            <div style="font-size:0.78rem;">по ${c.endDate || '-'}</div>
          </td>
          <td><span class="badge ${statusMeta.cls}">${statusMeta.text}</span></td>
        </tr>
      `;
    }).join('');

    const navBadge = document.getElementById('nav-badge-contracts');
    if (navBadge) navBadge.textContent = contracts.length;

    if (window.documentsModule) {
      window.documentsModule.render();
    }
  }

  async openContractModal(id) {
    this.editingContractId = id;
    const modal = document.getElementById('contract-modal');
    const lockWarning = document.getElementById('contract-lock-warning');
    const deleteBtn = document.getElementById('btn-delete-contract');

    const numInput = document.getElementById('cnt-form-number');
    const titleInput = document.getElementById('cnt-form-title');
    const counterpartyInput = document.getElementById('cnt-form-counterparty');
    const innInput = document.getElementById('cnt-form-inn');
    const kppInput = document.getElementById('cnt-form-kpp');
    const sumInput = document.getElementById('cnt-form-sum');
    const startInput = document.getElementById('cnt-form-start');
    const endInput = document.getElementById('cnt-form-end');
    const statusSelect = document.getElementById('cnt-form-status');
    const typeSelect = document.getElementById('cnt-form-type');
    const respSelect = document.getElementById('cnt-form-resp');
    const notesInput = document.getElementById('cnt-form-notes');

    // Populate employees
    const { employees = [] } = window.storage.cache;
    respSelect.innerHTML = '<option value="">-- Ответственный куратор --</option>' +
      employees.map(e => `<option value="${e.id}">${this.escapeHtml(e.name)}</option>`).join('');

    let cData = {
      number: '',
      title: '',
      counterparty: '',
      inn: '7701234567',
      kpp: '770101001',
      sum: 0,
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0],
      status: 'active',
      type: 'Поставка',
      responsibleId: '',
      notes: ''
    };

    if (id) {
      const existing = (window.storage.cache.contracts || []).find(c => c.id === id);
      if (existing) cData = { ...cData, ...existing };

      const lockRes = await window.storage.acquireLock('contracts', id);
      if (!lockRes.granted) {
        lockWarning.style.display = 'flex';
        lockWarning.innerHTML = `⚠️ Внимание: Договор заблокирован пользователем <b>${this.escapeHtml(lockRes.lockedBy)}</b>.`;
      } else {
        lockWarning.style.display = 'none';
      }
      deleteBtn.style.display = 'inline-flex';
    } else {
      lockWarning.style.display = 'none';
      deleteBtn.style.display = 'none';
    }

    numInput.value = cData.number || '';
    titleInput.value = cData.title || '';
    counterpartyInput.value = cData.counterparty || '';
    if (innInput) innInput.value = cData.inn || '';
    if (kppInput) kppInput.value = cData.kpp || '';
    sumInput.value = cData.sum || 0;
    startInput.value = cData.startDate || '';
    endInput.value = cData.endDate || '';
    statusSelect.value = cData.status || 'active';
    typeSelect.value = cData.type || 'Поставка';
    respSelect.value = cData.responsibleId || '';
    notesInput.value = cData.notes || '';

    modal.classList.add('open');
  }

  async closeContractModal() {
    const modal = document.getElementById('contract-modal');
    modal.classList.remove('open');
    if (this.editingContractId) {
      await window.storage.releaseLock('contracts', this.editingContractId);
      this.editingContractId = null;
    }
  }

  async saveContract() {
    const number = document.getElementById('cnt-form-number').value.trim();
    const title = document.getElementById('cnt-form-title').value.trim();
    const counterparty = document.getElementById('cnt-form-counterparty').value.trim();

    if (!number || !title) {
      window.app.showToast('Заполните номер и предмет договора', 'error');
      return;
    }

    const payload = {
      id: this.editingContractId || ('cnt_' + Date.now()),
      number,
      title,
      counterparty,
      inn: document.getElementById('cnt-form-inn')?.value.trim() || '7701234567',
      kpp: document.getElementById('cnt-form-kpp')?.value.trim() || '770101001',
      sum: parseFloat(document.getElementById('cnt-form-sum').value) || 0,
      currency: 'RUB',
      startDate: document.getElementById('cnt-form-start').value,
      endDate: document.getElementById('cnt-form-end').value,
      status: document.getElementById('cnt-form-status').value,
      type: document.getElementById('cnt-form-type').value,
      responsibleId: document.getElementById('cnt-form-resp').value,
      notes: document.getElementById('cnt-form-notes').value
    };

    try {
      await window.storage.saveEntity('contracts', payload.id, payload);
      window.app.showToast('Договор сохранен в /data/contracts/', 'success');
      await this.closeContractModal();
      if (window.directoryModule) window.directoryModule.render();
    } catch (e) {
      window.app.showToast(`Ошибка сохранения: ${e.message}`, 'error');
    }
  }

  async deleteContract() {
    if (!this.editingContractId) return;
    if (confirm('Удалить договор из сетевой папки (/data/contracts/)?')) {
      try {
        await window.storage.deleteEntity('contracts', this.editingContractId);
        window.app.showToast('Договор удален', 'info');
        await this.closeContractModal();
        if (window.directoryModule) window.directoryModule.render();
      } catch (e) {
        window.app.showToast(`Ошибка: ${e.message}`, 'error');
      }
    }
  }

  escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}

window.contractsModule = new ContractsModule();
