/**
 * Employees & Directory Module
 */

class EmployeesModule {
  constructor() {
    this.editingEmployeeId = null;
  }

  init() {
    this.bindEvents();
    this.render();
  }

  bindEvents() {
    const btnNew = document.getElementById('btn-new-employee');
    if (btnNew) btnNew.addEventListener('click', () => this.openEmployeeModal(null));
  }

  render() {
    // Forward to global directory render if directoryModule is initialized
    if (window.directoryModule) {
      window.directoryModule.render();
    }
  }

  async openEmployeeModal(id) {
    this.editingEmployeeId = id;
    const modal = document.getElementById('employee-modal');
    const deleteBtn = document.getElementById('btn-delete-employee');

    const nameInput = document.getElementById('emp-form-name');
    const roleInput = document.getElementById('emp-form-role');
    const deptInput = document.getElementById('emp-form-dept');
    const phoneInput = document.getElementById('emp-form-phone');
    const emailInput = document.getElementById('emp-form-email');
    const rateInput = document.getElementById('emp-form-rate');
    const statusSelect = document.getElementById('emp-form-status');

    let empData = {
      name: '',
      role: '',
      department: 'Разработка',
      phone: '+7 (495) 123-45-67',
      email: '',
      rate: 1500,
      load: 50,
      status: 'active'
    };

    if (id) {
      const existing = (window.storage.cache.employees || []).find(e => e.id === id);
      if (existing) empData = { ...empData, ...existing };
      deleteBtn.style.display = 'inline-flex';
    } else {
      deleteBtn.style.display = 'none';
    }

    nameInput.value = empData.name || '';
    roleInput.value = empData.role || '';
    deptInput.value = empData.department || '';
    phoneInput.value = empData.phone || '';
    emailInput.value = empData.email || '';
    rateInput.value = empData.rate || 1500;
    statusSelect.value = empData.status || 'active';

    modal.classList.add('open');
  }

  closeEmployeeModal() {
    const modal = document.getElementById('employee-modal');
    modal.classList.remove('open');
    this.editingEmployeeId = null;
  }

  async saveEmployee() {
    const name = document.getElementById('emp-form-name').value.trim();
    if (!name) {
      window.app.showToast('Введите ФИО сотрудника', 'error');
      return;
    }

    const payload = {
      id: this.editingEmployeeId || ('emp_' + Date.now()),
      name,
      role: document.getElementById('emp-form-role').value.trim() || 'Специалист',
      department: document.getElementById('emp-form-dept').value.trim() || 'Общий',
      phone: document.getElementById('emp-form-phone').value.trim() || '+7 (495) 000-00-00',
      email: document.getElementById('emp-form-email').value.trim(),
      rate: parseFloat(document.getElementById('emp-form-rate').value) || 0,
      load: 50,
      status: document.getElementById('emp-form-status').value
    };

    try {
      await window.storage.saveEntity('employees', payload.id, payload);
      window.app.showToast('Сотрудник сохранен в /data/employees/', 'success');
      this.closeEmployeeModal();
      window.app.updateUserSelector();
    } catch (e) {
      window.app.showToast(`Ошибка сохранения: ${e.message}`, 'error');
    }
  }

  async deleteEmployee() {
    if (!this.editingEmployeeId) return;
    if (confirm('Удалить сотрудника из базы?')) {
      try {
        await window.storage.deleteEntity('employees', this.editingEmployeeId);
        window.app.showToast('Сотрудник удален', 'info');
        this.closeEmployeeModal();
        window.app.updateUserSelector();
      } catch (e) {
        window.app.showToast(`Ошибка: ${e.message}`, 'error');
      }
    }
  }

  escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}

window.employeesModule = new EmployeesModule();
