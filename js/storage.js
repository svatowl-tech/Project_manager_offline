/**
 * StorageEngine: Модуль взаимодействия с File System Access API (SMB/Local),
 * кэшированием в IndexedDB, пофайловой синхронизацией JSON и механизмом блокировок.
 * 
 * Поддерживает ДВЕ независимые рабочие директории:
 * 1. Data Directory (Хранилище базы данных JSON /tasks/, /contracts/, /docs/, /locks/)
 * 2. Library Directory (Корпоративная библиотека и архив документов)
 */

class StorageEngine {
  constructor() {
    this.dataDirHandle = null;     // DirectoryHandle for JSON database
    this.libraryDirHandle = null;  // DirectoryHandle for Corporate Document Library
    this.inboxDirHandle = null;    // DirectoryHandle for Incoming Scanner Folder

    this.isVirtualMode = false;
    this.pollingInterval = null;
    this.pollingPeriodMs = 5000;
    this.listeners = new Set();
    this.currentLocks = new Map(); // key: entityType_id -> lockData
    this.activeUser = localStorage.getItem('smb_active_user') || 'Соколов В.П. (Руководитель)';
    this.sessionClientId = 'client_' + Math.random().toString(36).substring(2, 9);
    
    // In-memory cache for fast UI updates
    this.cache = {
      tasks: [],
      employees: [],
      contracts: [],
      docs: [],
      organizations: [],
      external_contacts: [],
      risks: [],
      invest: [],
      changes: [],
      raci: [],
      locks: []
    };

    this.folders = {
      tasks: null,
      employees: null,
      contracts: null,
      docs: null,
      organizations: null,
      external_contacts: null,
      risks: null,
      invest: null,
      changes: null,
      raci: null,
      locks: null
    };

    this.lastSyncTime = null;
    this.initIndexedDb();
  }

  /* ---------------- IndexedDB Multi-Handle Storage ---------------- */
  async initIndexedDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('SmbDirectorStorageDb', 3);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('handles')) {
          db.createObjectStore('handles');
        }
        if (!db.objectStoreNames.contains('virtual_files')) {
          db.createObjectStore('virtual_files');
        }
        if (!db.objectStoreNames.contains('virtual_library')) {
          db.createObjectStore('virtual_library');
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async saveHandleToDb(key, handle) {
    try {
      const db = await this.initIndexedDb();
      const tx = db.transaction('handles', 'readwrite');
      tx.objectStore('handles').put(handle, key);
      return new Promise((res, rej) => {
        tx.oncomplete = () => res(true);
        tx.onerror = () => rej(tx.error);
      });
    } catch (e) {
      console.warn(`Не удалось сохранить дескриптор [${key}] в IndexedDB:`, e);
    }
  }

  async getHandleFromDb(key) {
    try {
      const db = await this.initIndexedDb();
      const tx = db.transaction('handles', 'readonly');
      const req = tx.objectStore('handles').get(key);
      return new Promise((res) => {
        req.onsuccess = () => res(req.result || null);
        req.onerror = () => res(null);
      });
    } catch (e) {
      return null;
    }
  }

  /* ---------------- 1. Connect Data Directory (JSON Database) ---------------- */
  async connectDataDirectory(pickerAllowed = true) {
    try {
      if (pickerAllowed && window.showDirectoryPicker) {
        this.dataDirHandle = await window.showDirectoryPicker({
          id: 'smb_director_data_dir',
          mode: 'readwrite',
          startIn: 'documents'
        });
        await this.saveHandleToDb('dataDirectory', this.dataDirHandle);
        await this.initFolderStructure();
        this.isVirtualMode = false;
        this.startPolling();
        return { success: true, mode: 'fsa', name: this.dataDirHandle.name };
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error('Выбор папки базы данных отменен.');
      }
      console.warn('FSA Data Dir Picker error:', err);
    }

    // Try restoring saved handle from IndexedDB
    const stored = await this.getHandleFromDb('dataDirectory') || await this.getHandleFromDb('rootDirectory');
    if (stored) {
      try {
        const perm = await stored.queryPermission({ mode: 'readwrite' });
        if (perm === 'granted') {
          this.dataDirHandle = stored;
          await this.initFolderStructure();
          this.isVirtualMode = false;
          this.startPolling();
          return { success: true, mode: 'fsa', name: this.dataDirHandle.name };
        } else if (pickerAllowed) {
          const reqPerm = await stored.requestPermission({ mode: 'readwrite' });
          if (reqPerm === 'granted') {
            this.dataDirHandle = stored;
            await this.initFolderStructure();
            this.isVirtualMode = false;
            this.startPolling();
            return { success: true, mode: 'fsa', name: this.dataDirHandle.name };
          }
        }
      } catch (e) {
        console.warn('Ошибка восстановления дескриптора Data Dir:', e);
      }
    }

    // Fallback: Virtual Storage in IndexedDB
    this.isVirtualMode = true;
    await this.initVirtualStructure();
    this.startPolling();
    return { success: true, mode: 'virtual', name: 'Виртуальная БД (IndexedDB)' };
  }

  /* ---------------- 2. Connect Library Directory (Archive & Scans) ---------------- */
  async connectLibraryDirectory(pickerAllowed = true) {
    try {
      if (pickerAllowed && window.showDirectoryPicker) {
        this.libraryDirHandle = await window.showDirectoryPicker({
          id: 'smb_director_library_dir',
          mode: 'readwrite',
          startIn: 'documents'
        });
        await this.saveHandleToDb('libraryDirectory', this.libraryDirHandle);
        return { success: true, mode: 'fsa', name: this.libraryDirHandle.name };
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error('Выбор папки библиотеки отменен.');
      }
      console.warn('FSA Library Dir Picker error:', err);
    }

    // Restore saved handle
    const stored = await this.getHandleFromDb('libraryDirectory');
    if (stored) {
      try {
        const perm = await stored.queryPermission({ mode: 'readwrite' });
        if (perm === 'granted') {
          this.libraryDirHandle = stored;
          return { success: true, mode: 'fsa', name: this.libraryDirHandle.name };
        } else if (pickerAllowed) {
          const reqPerm = await stored.requestPermission({ mode: 'readwrite' });
          if (reqPerm === 'granted') {
            this.libraryDirHandle = stored;
            return { success: true, mode: 'fsa', name: this.libraryDirHandle.name };
          }
        }
      } catch (e) {}
    }

    return { success: true, mode: 'virtual', name: 'Библиотека (Внутренняя)' };
  }

  // Backward compatibility wrapper
  async connectDirectory(pickerAllowed = true) {
    const res = await this.connectDataDirectory(pickerAllowed);
    // Auto-restore library handle in background
    this.connectLibraryDirectory(false).catch(() => {});
    return res;
  }

  async initFolderStructure() {
    if (!this.dataDirHandle) return;
    try {
      // Ensure /data and all domain subdirectories inside Data Directory
      let root = this.dataDirHandle;
      let dataDir = root;
      // If root is not named 'data', create /data inside it
      if (root.name !== 'data') {
        dataDir = await root.getDirectoryHandle('data', { create: true });
      }

      this.folders.tasks = await dataDir.getDirectoryHandle('tasks', { create: true });
      this.folders.employees = await dataDir.getDirectoryHandle('employees', { create: true });
      this.folders.contracts = await dataDir.getDirectoryHandle('contracts', { create: true });
      this.folders.docs = await dataDir.getDirectoryHandle('docs', { create: true });
      this.folders.organizations = await dataDir.getDirectoryHandle('organizations', { create: true });
      this.folders.external_contacts = await dataDir.getDirectoryHandle('external_contacts', { create: true });
      this.folders.risks = await dataDir.getDirectoryHandle('risks', { create: true });
      this.folders.invest = await dataDir.getDirectoryHandle('invest', { create: true });
      this.folders.changes = await dataDir.getDirectoryHandle('changes', { create: true });
      this.folders.raci = await dataDir.getDirectoryHandle('raci', { create: true });
      this.folders.locks = await dataDir.getDirectoryHandle('locks', { create: true });
      await this.readAllData();
    } catch (e) {
      throw new Error(`Ошибка создания структуры каталогов БД: ${e.message}`);
    }
  }

  /* ---------------- Virtual SMB Mode (IndexedDB) ---------------- */
  async initVirtualStructure() {
    const db = await this.initIndexedDb();
    const tx = db.transaction('virtual_files', 'readonly');
    const store = tx.objectStore('virtual_files');
    const countReq = store.count();
    
    return new Promise((resolve) => {
      countReq.onsuccess = async () => {
        if (countReq.result === 0) {
          // Do not seed demo data automatically for production ready state
          await this.readAllData();
        } else {
          await this.readAllData();
        }
        resolve();
      };
    });
  }

  /* ---------------- File Operations (Read/Write JSON) ---------------- */
  async saveEntity(type, id, data) {
    if (!id) id = 'id_' + Date.now();
    data.id = id;
    data.updatedAt = new Date().toISOString();
    data.updatedBy = this.activeUser;

    const prefixMap = {
      docs: 'doc',
      contracts: 'cnt',
      tasks: 'task',
      employees: 'emp',
      organizations: 'org',
      external_contacts: 'ext',
      risks: 'risk',
      invest: 'passport',
      changes: 'change',
      raci: 'raci'
    };
    const prefix = prefixMap[type] || 'item';
    const fileName = (type === 'invest' && id === 'project_passport') ? 'project_passport.json' : `${prefix}_${id}.json`;

    if (!this.isVirtualMode && this.folders[type]) {
      try {
        const fileHandle = await this.folders[type].getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(JSON.stringify(data, null, 2));
        await writable.close();
      } catch (err) {
        throw new Error(`Ошибка записи файла ${fileName}: ${err.message}`);
      }
    } else {
      // Virtual mode
      const db = await this.initIndexedDb();
      const tx = db.transaction('virtual_files', 'readwrite');
      tx.objectStore('virtual_files').put(data, `${type}/${fileName}`);
      await new Promise(r => tx.oncomplete = r);
    }

    // Update in-memory cache
    const list = this.cache[type] || [];
    const idx = list.findIndex(item => String(item.id) === String(id));
    if (idx >= 0) {
      list[idx] = data;
    } else {
      list.push(data);
    }
    this.cache[type] = list;
    this.notify();
    return data;
  }

  async deleteEntity(type, id) {
    const prefixMap = {
      docs: 'doc',
      contracts: 'cnt',
      tasks: 'task',
      employees: 'emp',
      organizations: 'org',
      external_contacts: 'ext',
      risks: 'risk',
      invest: 'passport',
      changes: 'change',
      raci: 'raci'
    };
    const prefix = prefixMap[type] || 'item';
    const fileName = (type === 'invest' && id === 'project_passport') ? 'project_passport.json' : `${prefix}_${id}.json`;
    if (!this.isVirtualMode && this.folders[type]) {
      try {
        await this.folders[type].removeEntry(fileName);
      } catch (err) {
        console.warn(`Не удалось удалить файл ${fileName}:`, err);
      }
    } else {
      const db = await this.initIndexedDb();
      const tx = db.transaction('virtual_files', 'readwrite');
      tx.objectStore('virtual_files').delete(`${type}/${fileName}`);
      await new Promise(r => tx.oncomplete = r);
    }

    this.cache[type] = (this.cache[type] || []).filter(item => String(item.id) !== String(id));
    this.notify();
  }

  /* ---------------- Lock Management (/data/locks/) ---------------- */
  async acquireLock(entityType, id) {
    const lockKey = `${entityType}_${id}`;
    const lockFileName = `${lockKey}.lock`;

    const existingLock = await this.readLockFile(lockFileName);
    if (existingLock) {
      const lockAgeMinutes = (Date.now() - new Date(existingLock.lockedAt).getTime()) / 60000;
      if (existingLock.lockedBy !== this.activeUser && lockAgeMinutes < 15) {
        return {
          granted: false,
          lockedBy: existingLock.lockedBy,
          lockedAt: existingLock.lockedAt,
          minutesAgo: Math.round(lockAgeMinutes)
        };
      }
    }

    const lockData = {
      entityType,
      entityId: id,
      lockedBy: this.activeUser,
      lockedAt: new Date().toISOString(),
      clientId: this.sessionClientId
    };

    await this.writeLockFile(lockFileName, lockData);
    this.currentLocks.set(lockKey, lockData);
    return { granted: true };
  }

  async releaseLock(entityType, id) {
    const lockKey = `${entityType}_${id}`;
    const lockFileName = `${lockKey}.lock`;
    
    try {
      if (!this.isVirtualMode && this.folders.locks) {
        await this.folders.locks.removeEntry(lockFileName);
      } else {
        const db = await this.initIndexedDb();
        const tx = db.transaction('virtual_files', 'readwrite');
        tx.objectStore('virtual_files').delete(`locks/${lockFileName}`);
        await new Promise(r => tx.oncomplete = r);
      }
    } catch (e) {}
    this.currentLocks.delete(lockKey);
  }

  async readLockFile(fileName) {
    try {
      if (!this.isVirtualMode && this.folders.locks) {
        const handle = await this.folders.locks.getFileHandle(fileName);
        const file = await handle.getFile();
        const text = await file.text();
        return JSON.parse(text);
      } else {
        const db = await this.initIndexedDb();
        const tx = db.transaction('virtual_files', 'readonly');
        const req = tx.objectStore('virtual_files').get(`locks/${fileName}`);
        return new Promise(r => {
          req.onsuccess = () => r(req.result || null);
          req.onerror = () => r(null);
        });
      }
    } catch (e) {
      return null;
    }
  }

  async writeLockFile(fileName, lockData) {
    if (!this.isVirtualMode && this.folders.locks) {
      const handle = await this.folders.locks.getFileHandle(fileName, { create: true });
      const writable = await handle.createWritable();
      await writable.write(JSON.stringify(lockData, null, 2));
      await writable.close();
    } else {
      const db = await this.initIndexedDb();
      const tx = db.transaction('virtual_files', 'readwrite');
      tx.objectStore('virtual_files').put(lockData, `locks/${fileName}`);
      await new Promise(r => tx.oncomplete = r);
    }
  }

  /* ---------------- 3. Library Directory & Auto-Cataloging Operations ---------------- */

  /**
   * Recursively navigates or creates nested folder path inside a root DirectoryHandle
   * E.g. "Корреспонденция_переписка/Входящая/АО «ИТС»/Письмо_29.09.2026"
   */
  async getOrCreateNestedFolder(rootHandle, relativePath) {
    if (!rootHandle) return null;
    const segments = relativePath.split(/[\\\/]/).map(s => s.trim()).filter(Boolean);
    let currentDir = rootHandle;

    for (const seg of segments) {
      currentDir = await currentDir.getDirectoryHandle(seg, { create: true });
    }
    return currentDir;
  }

  /**
   * Saves a document into the library with Corporate Versioning Rules:
   * If a previous version of file exists, it moves the old file into an "Архив" subfolder.
   */
  async saveFileToLibraryWithVersioning(targetRelPath, fileName, fileBlobOrBytes) {
    const rootLib = this.libraryDirHandle || this.dataDirHandle;
    const fullRelPath = targetRelPath.replace(/\\/g, '/').replace(/\/+$/, '');

    if (rootLib) {
      const targetFolder = await this.getOrCreateNestedFolder(rootLib, fullRelPath);
      
      // Check if file already exists in target folder
      let existingFileHandle = null;
      try {
        existingFileHandle = await targetFolder.getFileHandle(fileName);
      } catch (e) {}

      if (existingFileHandle) {
        // RULE 3: Move previous file to "Архив" subfolder
        try {
          const archiveFolder = await targetFolder.getDirectoryHandle('Архив', { create: true });
          const oldFile = await existingFileHandle.getFile();
          const oldBytes = await oldFile.arrayBuffer();
          
          // Generate archived filename with timestamp
          const ext = fileName.includes('.') ? '.' + fileName.split('.').pop() : '';
          const baseName = fileName.replace(/\.[^/.]+$/, '');
          const modDate = new Date(oldFile.lastModified).toISOString().split('T')[0];
          const archiveFileName = `${baseName}_архив_${modDate}${ext}`;

          const archiveFileHandle = await archiveFolder.getFileHandle(archiveFileName, { create: true });
          const archiveWritable = await archiveFileHandle.createWritable();
          await archiveWritable.write(oldBytes);
          await archiveWritable.close();

          // Remove old file from active directory
          await targetFolder.removeEntry(fileName);
        } catch (archiveErr) {
          console.warn('Ошибка архивирования предыдущей версии:', archiveErr);
        }
      }

      // Write the new file
      const newFileHandle = await targetFolder.getFileHandle(fileName, { create: true });
      const writable = await newFileHandle.createWritable();
      await writable.write(fileBlobOrBytes);
      await writable.close();

      return {
        success: true,
        fullPath: `\\\\LIBRARY\\${fullRelPath.replace(/\//g, '\\')}\\${fileName}`,
        relativePath: `${fullRelPath}/${fileName}`
      };
    } else {
      // Virtual Library in IndexedDB
      const db = await this.initIndexedDb();
      const tx = db.transaction('virtual_library', 'readwrite');
      const store = tx.objectStore('virtual_library');
      const virtualKey = `${fullRelPath}/${fileName}`;
      store.put({
        path: virtualKey,
        data: fileBlobOrBytes,
        savedAt: new Date().toISOString()
      }, virtualKey);
      await new Promise(r => tx.oncomplete = r);

      return {
        success: true,
        fullPath: `\\\\VIRTUAL_LIBRARY\\${fullRelPath.replace(/\//g, '\\')}\\${fileName}`,
        relativePath: virtualKey
      };
    }
  }

  /**
   * Scans a directory handle (or incoming files) and returns metadata for batch ingestion
   */
  async scanDirectoryForFiles(dirHandle, recursive = true) {
    const results = [];
    const validExts = ['.pdf', '.docx', '.xlsx', '.png', '.jpg', '.jpeg', '.tiff', '.bmp'];

    async function walk(handle, curPath = '') {
      for await (const entry of handle.values()) {
        if (entry.kind === 'file') {
          const lowerName = entry.name.toLowerCase();
          if (validExts.some(ext => lowerName.endsWith(ext))) {
            const file = await entry.getFile();
            results.push({
              name: entry.name,
              relativePath: curPath ? `${curPath}/${entry.name}` : entry.name,
              sizeBytes: file.size,
              sizeStr: (file.size / 1024).toFixed(1) + ' КБ',
              lastModified: file.lastModified,
              fileHandle: entry,
              fileObject: file
            });
          }
        } else if (entry.kind === 'directory' && recursive && entry.name !== 'Архив' && entry.name !== '.git') {
          const nextDir = await handle.getDirectoryHandle(entry.name);
          await walk(nextDir, curPath ? `${curPath}/${entry.name}` : entry.name);
        }
      }
    }

    if (dirHandle) {
      await walk(dirHandle);
    }
    return results;
  }

  /* ---------------- Sync & Polling ---------------- */
  startPolling() {
    if (this.pollingInterval) clearInterval(this.pollingInterval);
    this.pollingInterval = setInterval(async () => {
      try {
        await this.readAllData(false);
      } catch (err) {
        console.warn('Ошибка опроса сетевой папки:', err);
      }
    }, this.pollingPeriodMs);
  }

  stopPolling() {
    if (this.pollingInterval) clearInterval(this.pollingInterval);
  }

  async readAllData(triggerNotify = true) {
    const types = ['tasks', 'employees', 'contracts', 'docs', 'organizations', 'external_contacts', 'risks', 'invest', 'changes', 'raci'];
    const newData = { tasks: [], employees: [], contracts: [], docs: [], organizations: [], external_contacts: [], risks: [], invest: [], changes: [], raci: [], locks: [] };

    for (const type of types) {
      if (!this.isVirtualMode && this.folders[type]) {
        try {
          for await (const entry of this.folders[type].values()) {
            if (entry.kind === 'file' && entry.name.endsWith('.json')) {
              try {
                const file = await entry.getFile();
                const text = await file.text();
                const json = JSON.parse(text);
                newData[type].push(json);
              } catch (parseErr) {
                console.warn(`Поврежденный файл ${entry.name}:`, parseErr);
              }
            }
          }
        } catch (e) {
          console.warn(`Ошибка чтения каталога ${type}:`, e);
        }
      } else {
        // Virtual mode
        const db = await this.initIndexedDb();
        const tx = db.transaction('virtual_files', 'readonly');
        const store = tx.objectStore('virtual_files');
        const req = store.openCursor();
        
        await new Promise((resolve) => {
          req.onsuccess = (e) => {
            const cursor = e.target.result;
            if (cursor) {
              const key = String(cursor.key);
              if (key.startsWith(`${type}/`)) {
                newData[type].push(cursor.value);
              }
              cursor.continue();
            } else {
              resolve();
            }
          };
          req.onerror = () => resolve();
        });
      }
    }

    // Read active locks
    if (!this.isVirtualMode && this.folders.locks) {
      try {
        for await (const entry of this.folders.locks.values()) {
          if (entry.kind === 'file' && entry.name.endsWith('.lock')) {
            try {
              const file = await entry.getFile();
              const text = await file.text();
              const lock = JSON.parse(text);
              const age = (Date.now() - new Date(lock.lockedAt).getTime()) / 60000;
              if (age <= 15) {
                newData.locks.push(lock);
              }
            } catch (e) {}
          }
        }
      } catch (e) {}
    }

    this.cache = newData;
    this.lastSyncTime = new Date();
    if (triggerNotify) {
      this.notify();
    }
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify() {
    for (const cb of this.listeners) {
      try { cb(this.cache); } catch (e) { console.error(e); }
    }
  }

  /* ---------------- Seed Demo Data for Executive Work ---------------- */
  async seedDemoData() {
    const demoEmployees = [
      { id: 'emp_1', name: 'Соколов В.П.', role: 'Руководитель направления', department: 'Дирекция', phone: '+7 (495) 700-10-01', rate: 1800, status: 'active', email: 'sokolov@corp.ru', load: 85 },
      { id: 'emp_2', name: 'Васильев Д.Н.', role: 'Главный системный архитектор', department: 'Архитектура и ИТ', phone: '+7 (495) 700-10-02', rate: 1600, status: 'active', email: 'vasiliev@corp.ru', load: 95 },
      { id: 'emp_3', name: 'Смирнова Е.А.', role: 'Ведущий бизнес-аналитик', department: 'Аналитика', phone: '+7 (495) 700-10-03', rate: 1300, status: 'active', email: 'smirnova@corp.ru', load: 60 },
      { id: 'emp_4', name: 'Ковалев М.С.', role: 'Старший инженер-разработчик', department: 'Разработка', phone: '+7 (495) 700-10-04', rate: 1400, status: 'active', email: 'kovalev@corp.ru', load: 90 },
      { id: 'emp_5', name: 'Попова О.В.', role: 'Юрисконсульт по контрактам', department: 'Правовой отдел', phone: '+7 (495) 700-10-05', rate: 1100, status: 'active', email: 'popova@corp.ru', load: 45 }
    ];

    const today = new Date();
    const dStr = (offsetDays) => {
      const d = new Date(today);
      d.setDate(d.getDate() + offsetDays);
      return d.toISOString().split('T')[0];
    };

    const demoTasks = [
      {
        id: 'task_101',
        title: 'Аудит совместимости с Astra Linux 1.8 и Chromium-GOST',
        description: 'Провести комплексное тестирование компонентов в защищенном контуре.',
        status: 'in_progress',
        priority: 'critical',
        assigneeId: 'emp_2',
        startDate: dStr(-4),
        endDate: dStr(3),
        progress: 65,
        estimatedHours: 40,
        actualHours: 24,
        tags: ['AstraLinux', 'Импортозамещение', 'Безопасность'],
        subtasks: [
          { text: 'Развернуть стенд тестирования', done: true },
          { text: 'Проверить работу криптографических плагинов', done: true },
          { text: 'Оформить протокол совместимости', done: false }
        ]
      },
      {
        id: 'task_102',
        title: 'Согласование ТЗ на модернизацию сетевой инфраструктуры',
        description: 'Подготовить финальную редакцию ТЗ для тендерного комитета.',
        status: 'review',
        priority: 'high',
        assigneeId: 'emp_3',
        startDate: dStr(-2),
        endDate: dStr(1),
        progress: 85,
        estimatedHours: 24,
        actualHours: 20,
        tags: ['ТЗ', 'Инфраструктура'],
        subtasks: [
          { text: 'Собрать замечания службы безопасности', done: true },
          { text: 'Свести матрицу требований', done: true }
        ]
      },
      {
        id: 'task_103',
        title: 'Разработка модуля пофайловых SMB-блокировок',
        description: 'Реализация конкурентного редактирования на уровне файловой системы.',
        status: 'done',
        priority: 'high',
        assigneeId: 'emp_4',
        startDate: dStr(-10),
        endDate: dStr(-1),
        progress: 100,
        estimatedHours: 32,
        actualHours: 30,
        tags: ['Ядро', 'Разработка'],
        subtasks: [
          { text: 'Спроектировать протокол .lock файлов', done: true },
          { text: 'Написать тесты на истечение таймаута 15 мин', done: true }
        ]
      }
    ];

    const demoContracts = [
      {
        id: 'cnt_201',
        number: 'Д-401/26-ГОЗ',
        title: 'Поставка серверного оборудования и СХД',
        counterparty: 'АО «ИнформТехноСистемы»',
        inn: '7701234567',
        kpp: '770101001',
        sum: 12500000,
        currency: 'RUB',
        startDate: dStr(-60),
        endDate: dStr(30),
        status: 'active',
        responsibleId: 'emp_1',
        type: 'Поставка',
        notes: 'Аванс 30% выплачен. Ожидается поставка 2-й партии оборудования.'
      },
      {
        id: 'cnt_202',
        number: 'УС-88/26',
        title: 'Техническая поддержка СУБД и ОС',
        counterparty: 'ООО «РусБИТех-Астра»',
        inn: '7714890123',
        kpp: '771401001',
        sum: 2400000,
        currency: 'RUB',
        startDate: dStr(-180),
        endDate: dStr(-10),
        status: 'review',
        responsibleId: 'emp_2',
        type: 'Услуги',
        notes: 'Дополнительное соглашение на пролонгацию на рассмотрении.'
      }
    ];

    const demoDocs = [
      {
        id: 'doc_301',
        type: 'Договор',
        number: 'Д-401/26-ГОЗ',
        date: dStr(-60),
        counterparty: 'АО «ИнформТехноСистемы»',
        inn: '7701234567',
        kpp: '770101001',
        sum: 12500000,
        filePath: '\\\\LIBRARY\\Договоры_и_ДС\\АО «ИнформТехноСистемы»\\dogovor_401_26.pdf',
        recognizedAt: new Date().toISOString(),
        status: 'cataloged'
      },
      {
        id: 'doc_302',
        type: 'Акт приема-передачи',
        number: 'АКТ-19/26',
        date: dStr(-15),
        counterparty: 'ООО «РусБИТех-Астра»',
        inn: '7714890123',
        kpp: '771401001',
        sum: 600000,
        filePath: '\\\\LIBRARY\\Договоры_и_ДС\\ООО «РусБИТех-Астра»\\akt_19_26.pdf',
        recognizedAt: new Date().toISOString(),
        status: 'cataloged'
      }
    ];

    const demoOrganizations = [
      {
        id: 'org_1',
        shortName: 'АО «Концерн ВКО "Алмаз-Антей"»',
        fullName: 'Акционерное общество «Концерн воздушно-космической обороны "Алмаз-Антей"»',
        type: 'customer',
        inn: '7731234567',
        kpp: '773101001',
        ogrn: '1027700123456',
        okpo: '12345678',
        legalAddress: '121471, г. Москва, ул. Верейская, д. 41',
        actualAddress: '121471, г. Москва, ул. Верейская, д. 41',
        bankName: 'Банк ВТБ (ПАО), г. Москва',
        bik: '044525187',
        rs: '40702810100000012345',
        ks: '30101810700000000187',
        headRole: 'Генеральный директор',
        headRoleGenitive: 'Генерального директора',
        headRoleDative: 'Генеральному директору',
        headName: 'Новиков Ян Валентинович',
        headNameGenitive: 'Новикова Яна Валентиновича',
        headNameDative: 'Новикову Яну Валентиновичу',
        charterBasis: 'Устава',
        email: 'info@almaz-antey.ru',
        phone: '+7 (495) 276-29-00',
        website: 'https://almaz-antey.ru',
        folderCode: 'Алмаз-Антей',
        notes: 'Генеральный Заказчик по ГОЗ и автоматизированным системам управления.'
      },
      {
        id: 'org_2',
        shortName: 'АО «ИнформТехноСистемы»',
        fullName: 'Акционерное общество «Информационные Технологические Системы»',
        type: 'general_contractor',
        inn: '7701234567',
        kpp: '770101001',
        ogrn: '1037700654321',
        okpo: '87654321',
        legalAddress: '105082, г. Москва, Спартаковская пл., д. 14, стр. 3',
        actualAddress: '105082, г. Москва, Спартаковская пл., д. 14, стр. 3',
        bankName: 'ПАО Сбербанк, г. Москва',
        bik: '044525225',
        rs: '40702810938000054321',
        ks: '30101810400000000225',
        headRole: 'Генеральный директор',
        headRoleGenitive: 'Генерального директора',
        headRoleDative: 'Генеральному директору',
        headName: 'Петров Виктор Сергеевич',
        headNameGenitive: 'Петрова Виктора Сергеевича',
        headNameDative: 'Петрову Виктору Сергеевичу',
        charterBasis: 'Устава',
        email: 'office@its-corp.ru',
        phone: '+7 (495) 645-88-00',
        website: 'https://its-corp.ru',
        folderCode: 'ИнформТехноСистемы',
        notes: 'Генподрядчик по сетевой и серверной инфраструктуре.'
      },
      {
        id: 'org_3',
        shortName: 'ООО «РусБИТех-Астра»',
        fullName: 'Общество с ограниченной ответственностью «РусБИТех-Астра»',
        type: 'supplier',
        inn: '7714890123',
        kpp: '771401001',
        ogrn: '1167746123987',
        okpo: '54321098',
        legalAddress: '117105, г. Москва, Варшавское шоссе, д. 26',
        actualAddress: '117105, г. Москва, Варшавское шоссе, д. 26',
        bankName: 'АО «АЛЬФА-БАНК», г. Москва',
        bik: '044525593',
        rs: '40702810202880098765',
        ks: '30101810200000000593',
        headRole: 'Генеральный директор',
        headRoleGenitive: 'Генерального директора',
        headRoleDative: 'Генеральному директору',
        headName: 'Сидоров Илья Анатольевич',
        headNameGenitive: 'Сидорова Ильи Анатольевича',
        headNameDative: 'Сидорову Илье Анатольевичу',
        charterBasis: 'Устава',
        email: 'sales@astralinux.ru',
        phone: '+7 (495) 369-48-16',
        website: 'https://astralinux.ru',
        folderCode: 'РусБИТех-Астра',
        notes: 'Разработчик отечественной ОС Astra Linux Special Edition.'
      },
      {
        id: 'org_4',
        shortName: 'Минпромторг России',
        fullName: 'Министерство промышленности и торговли Российской Федерации',
        type: 'authority',
        inn: '7710086884',
        kpp: '770301001',
        ogrn: '1047796324632',
        okpo: '00083750',
        legalAddress: '125039, г. Москва, Пресненская наб., д. 10, стр. 2',
        actualAddress: '125039, г. Москва, Пресненская наб., д. 10, стр. 2',
        bankName: 'Операционный департамент Банка России // Межрегиональное операционное УФК г. Москва',
        bik: '024501901',
        rs: '03100643000000017300',
        ks: '40102810045370000002',
        headRole: 'Заместитель Министра',
        headRoleGenitive: 'Заместителя Министра',
        headRoleDative: 'Заместителю Министра',
        headName: 'Шпак Василий Викторович',
        headNameGenitive: 'Шпака Василия Викторовича',
        headNameDative: 'Шпаку Василию Викторовичу',
        charterBasis: 'Положения о Министерстве',
        email: 'info_admin@minprom.gov.ru',
        phone: '+7 (495) 870-29-21',
        website: 'https://minpromtorg.gov.ru',
        folderCode: 'Минпромторг_РФ',
        notes: 'Регулятор радиоэлектронной промышленности и реестра Минпромторга.'
      },
      {
        id: 'org_5',
        shortName: 'АО «НИИ Систем Связи»',
        fullName: 'Акционерное общество «Научно-исследовательский институт систем связи и телекоммуникаций»',
        type: 'designer',
        inn: '7722334455',
        kpp: '772201001',
        ogrn: '1027739112233',
        okpo: '11223344',
        legalAddress: '111024, г. Москва, ул. Авиамоторная, д. 53',
        actualAddress: '111024, г. Москва, ул. Авиамоторная, д. 53',
        bankName: 'ПАО «Промсвязьбанк», г. Москва',
        bik: '044525555',
        rs: '40702810400000099887',
        ks: '30101810400000000555',
        headRole: 'Директор института',
        headRoleGenitive: 'Директора института',
        headRoleDative: 'Директору института',
        headName: 'Громов Алексей Николаевич',
        headNameGenitive: 'Громова Алексея Николаевича',
        headNameDative: 'Громову Алексею Николаевичу',
        charterBasis: 'Устава',
        email: 'niiss@telecom-science.ru',
        phone: '+7 (495) 918-12-34',
        website: 'https://telecom-science.ru',
        folderCode: 'НИИ_Систем_Связи',
        notes: 'Генеральный проектировщик телекоммуникационных узлов.'
      }
    ];

    const demoExternalContacts = [
      {
        id: 'ext_1',
        organizationId: 'org_1',
        organizationName: 'АО «Концерн ВКО "Алмаз-Антей"»',
        name: 'Новиков Ян Валентинович',
        nameDative: 'Новикову Яну Валентиновичу',
        nameGenitive: 'Новикова Яна Валентиновича',
        salutation: 'Уважаемый Ян Валентинович!',
        role: 'Генеральный директор',
        roleDative: 'Генеральному директору',
        category: 'head',
        phone: '+7 (495) 276-29-01',
        mobile: '+7 (985) 100-11-22',
        email: 'novikov@almaz-antey.ru',
        cabinet: 'Главный корпус, каб. 501',
        powerOfAttorney: 'Устав предприятия',
        isSignatory: true,
        notes: 'Право первой подписи государственных контрактов и соглашений.'
      },
      {
        id: 'ext_2',
        organizationId: 'org_1',
        organizationName: 'АО «Концерн ВКО "Алмаз-Антей"»',
        name: 'Кузнецов Андрей Михайлович',
        nameDative: 'Кузнецову Андрею Михайловичу',
        nameGenitive: 'Кузнецова Андрея Михайловича',
        salutation: 'Уважаемый Андрей Михайлович!',
        role: 'Главный инженер проекта (ГИП)',
        roleDative: 'Главному инженеру проекта',
        category: 'gip',
        phone: '+7 (495) 276-29-44',
        mobile: '+7 (916) 234-56-78',
        email: 'kuznetsov.am@almaz-antey.ru',
        cabinet: 'Корпус 2, каб. 312',
        powerOfAttorney: 'Доверенность № ДОВ-2026/08 от 15.01.2026',
        isSignatory: true,
        notes: 'Согласование проектных решений, протоколов испытаний и рабочей документации.'
      },
      {
        id: 'ext_3',
        organizationId: 'org_2',
        organizationName: 'АО «ИнформТехноСистемы»',
        name: 'Петров Виктор Сергеевич',
        nameDative: 'Петрову Виктору Сергеевичу',
        nameGenitive: 'Петрова Виктора Сергеевича',
        salutation: 'Уважаемый Виктор Сергеевич!',
        role: 'Генеральный директор',
        roleDative: 'Генеральному директору',
        category: 'head',
        phone: '+7 (495) 645-88-01',
        mobile: '+7 (903) 777-88-99',
        email: 'petrov@its-corp.ru',
        cabinet: 'Офис 301',
        powerOfAttorney: 'Устав',
        isSignatory: true,
        notes: 'Подписание договоров поставки и дополнительных соглашений.'
      },
      {
        id: 'ext_4',
        organizationId: 'org_2',
        organizationName: 'АО «ИнформТехноСистемы»',
        name: 'Морозов Сергей Дмитриевич',
        nameDative: 'Морозову Сергею Дмитриевичу',
        nameGenitive: 'Морозова Сергея Дмитриевича',
        salutation: 'Уважаемый Сергей Дмитриевич!',
        role: 'Руководитель дирекции поставок и логистики',
        roleDative: 'Руководителю дирекции поставок и логистики',
        category: 'curator',
        phone: '+7 (495) 645-88-15',
        mobile: '+7 (926) 345-67-89',
        email: 'morozov@its-corp.ru',
        cabinet: 'Офис 215',
        powerOfAttorney: 'Доверенность № 114/ИТС от 10.01.2026',
        isSignatory: true,
        notes: 'Ответственный за отгрузку серверов, приемку партий и акты сверок.'
      },
      {
        id: 'ext_5',
        organizationId: 'org_3',
        organizationName: 'ООО «РусБИТех-Астра»',
        name: 'Сидоров Илья Анатольевич',
        nameDative: 'Сидорову Илье Анатольевичу',
        nameGenitive: 'Сидорова Ильи Анатольевича',
        salutation: 'Уважаемый Илья Анатольевич!',
        role: 'Генеральный директор',
        roleDative: 'Генеральному директору',
        category: 'head',
        phone: '+7 (495) 369-48-16',
        mobile: '+7 (915) 555-44-33',
        email: 'sidorov@astralinux.ru',
        cabinet: 'Каб. 701',
        powerOfAttorney: 'Устав',
        isSignatory: true,
        notes: 'Лицензионные соглашения и партнерские программы.'
      },
      {
        id: 'ext_6',
        organizationId: 'org_4',
        organizationName: 'Минпромторг России',
        name: 'Шпак Василий Викторович',
        nameDative: 'Шпаку Василию Викторовичу',
        nameGenitive: 'Шпака Василия Викторовича',
        salutation: 'Уважаемый Василий Викторович!',
        role: 'Заместитель Министра промышленности и торговли РФ',
        roleDative: 'Заместителю Министра промышленности и торговли РФ',
        category: 'head',
        phone: '+7 (495) 870-29-21',
        mobile: '+7 (495) 870-20-00',
        email: 'shpak@minprom.gov.ru',
        cabinet: 'Башня 2, 14 этаж',
        powerOfAttorney: 'Приказ Минпромторга России',
        isSignatory: true,
        notes: 'Курирует радиоэлектронный комплекс и государственную поддержку ИТ.'
      },
      {
        id: 'ext_7',
        organizationId: 'org_5',
        organizationName: 'АО «НИИ Систем Связи»',
        name: 'Громов Алексей Николаевич',
        nameDative: 'Громову Алексею Николаевичу',
        nameGenitive: 'Громова Алексея Николаевича',
        salutation: 'Уважаемый Алексей Николаевич!',
        role: 'Директор института',
        roleDative: 'Директору института',
        category: 'head',
        phone: '+7 (495) 918-12-34',
        mobile: '+7 (905) 888-99-00',
        email: 'gromov@telecom-science.ru',
        cabinet: 'Каб. 200',
        powerOfAttorney: 'Устав',
        isSignatory: true,
        notes: 'Главный разработчик стандартов ведомственной связи.'
      }
    ];

    const demoRisks = [
      {
        id: 'risk_1',
        title: 'Срыв сроков поставки доверенных отечественных серверов',
        category: 'supply',
        source: 'Задержка электронных компонентов на заводе',
        probability: 4,
        impactCost: 12500000,
        emv: 10000000,
        ownerId: 'emp_2',
        ownerName: 'Васильев Д.Н.',
        strategy: 'mitigation',
        status: 'active',
        actions: 'Форвардный резерв оборудования со склада; еженедельный аудит заводского конвейера.'
      },
      {
        id: 'risk_2',
        title: 'Задержка выдачи заключения ФАУ «Главгосэкспертиза России»',
        category: 'regulatory',
        source: 'Замечания экспертной комиссии по разделу ТХ и автоматизации',
        probability: 3,
        impactCost: 8000000,
        emv: 4800000,
        ownerId: 'emp_5',
        ownerName: 'Попова О.В.',
        strategy: 'reduction',
        status: 'active',
        actions: 'Привлечение профильных экспертов для параллельной отработки смет и разделов ПСД.'
      },
      {
        id: 'risk_3',
        title: 'Несовместимость прикладного ПО с Astra Linux 1.8 Special Edition',
        category: 'technical',
        source: 'Несертифицированные драйверы контроллеров сбора телеметрии',
        probability: 2,
        impactCost: 4500000,
        emv: 1800000,
        ownerId: 'emp_4',
        ownerName: 'Ковалев М.С.',
        strategy: 'avoidance',
        status: 'monitoring',
        actions: 'Разработка нативного драйвера в сотрудничестве с инженерами РусБИТех-Астра.'
      },
      {
        id: 'risk_4',
        title: 'Рост стоимости СМР и пусконаладки из-за индексации цен подрядчиков',
        category: 'financial',
        source: 'Подорожание кабельной продукции и услуг монтажа',
        probability: 3,
        impactCost: 15000000,
        emv: 9000000,
        ownerId: 'emp_1',
        ownerName: 'Соколов В.П.',
        strategy: 'transfer',
        status: 'active',
        actions: 'Фиксация твердой предельной суммы в договоре генподряда; банковская гарантия исполнения.'
      },
      {
        id: 'risk_5',
        title: 'Дефицит аттестованных инженеров по защите КИИ',
        category: 'personnel',
        source: 'Ограниченный рынок сертифицированных специалистов ФСТЭК',
        probability: 2,
        impactCost: 2000000,
        emv: 800000,
        ownerId: 'emp_3',
        ownerName: 'Смирнова Е.А.',
        strategy: 'acceptance',
        status: 'monitoring',
        actions: 'Опережающее корпоративное обучение сотрудников в лицензированном УЦ.'
      }
    ];

    const demoPassport = {
      id: 'project_passport',
      projectName: 'Комплексная модернизация защищенного контура АСУ ТП и перевод на ОС Astra Linux (РП-3)',
      projectCode: 'ПР-АСУ-2026/01',
      sponsor: 'АО «Концерн ВКО "Алмаз-Антей"»',
      curator: 'Соколов В.П.',
      targetCompletionDate: '2027-12-31',
      wacc: 9.3,
      bac: 90000000,
      stageGates: {
        G1: {
          code: 'Г1',
          name: 'Инициация и концепция',
          status: 'passed',
          date: '2025-11-20',
          decision: 'Одобрено Инвестиционным комитетом',
          checklist: [
            { id: 'c1', title: 'Паспорт инвестиционного проекта (ПИП)', required: true, passed: true },
            { id: 'c2', title: 'Финансово-экономическое обоснование (ФЭО)', required: true, passed: true },
            { id: 'c3', title: 'Декларация о намерениях сторон', required: true, passed: true }
          ]
        },
        G2: {
          code: 'Г2',
          name: 'Обоснование инвестиций и ТЗ',
          status: 'passed',
          date: '2026-03-15',
          decision: 'Утверждено Техническим советом',
          checklist: [
            { id: 'c4', title: 'Техническое задание по ГОСТ 34.602-2020', required: true, passed: true },
            { id: 'c5', title: 'Анализ технологической независимости (ТОРП/Минпромторг)', required: true, passed: true },
            { id: 'c6', title: 'Предварительный сводный сметный расчет (ССР)', required: true, passed: true }
          ]
        },
        G3: {
          code: 'Г3',
          name: 'Проектирование и экспертиза',
          status: 'active',
          date: '2026-11-30',
          decision: 'В процессе проверки в ФАУ «Главгосэкспертиза России»',
          checklist: [
            { id: 'c7', title: 'Положительное заключение ФАУ «Главгосэкспертиза России»', required: true, passed: false },
            { id: 'c8', title: 'Утвержденная проектная документация (стадия «П»)', required: true, passed: true },
            { id: 'c9', title: 'Разрешение на строительство / реконструкцию объекта', required: true, passed: false }
          ]
        },
        G4: {
          code: 'Г4',
          name: 'Ввод в промышленную эксплуатацию',
          status: 'planned',
          date: '2027-12-15',
          decision: 'Запланировано на IV кв. 2027',
          checklist: [
            { id: 'c10', title: 'Акт Государственной приемочной комиссии (форма КС-14)', required: true, passed: false },
            { id: 'c11', title: 'Заключение органа государственного строительного надзора (ЗОС)', required: true, passed: false },
            { id: 'c12', title: 'Аттестат соответствия требованиям безопасности информации ФСТЭК', required: true, passed: false }
          ]
        }
      },
      cashFlows: [
        { year: 2025, capex: 24000000, opex: 0, revenue: 0, netFlow: -24000000 },
        { year: 2026, capex: 48000000, opex: 3000000, revenue: 15000000, netFlow: -36000000 },
        { year: 2027, capex: 18000000, opex: 8000000, revenue: 45000000, netFlow: 19000000 },
        { year: 2028, capex: 0, opex: 12000000, revenue: 62000000, netFlow: 50000000 },
        { year: 2029, capex: 0, opex: 14000000, revenue: 70000000, netFlow: 56000000 }
      ]
    };

    const demoChanges = [
      {
        id: 'change_1',
        number: 'CR-2026/01',
        title: 'Прокладка резервного оптического канала связи между корпусами 1 и 3',
        requester: 'Кузнецов А.М. (ГИП)',
        requestDate: '2026-04-10',
        reason: 'Требование службы ИБ по катастрофоустойчивости сетевого контура',
        scheduleImpactDays: 14,
        costImpactRub: 3200000,
        status: 'approved',
        ccbDecision: 'Одобрено Советом по изменениям 15.04.2026. Лимит согласован.',
        decidedDate: '2026-04-15'
      },
      {
        id: 'change_2',
        number: 'CR-2026/02',
        title: 'Замена коммутаторов уровня агрегации на линейку с сертификатом ФСТЭК 4-го уровня',
        requester: 'Васильев Д.Н.',
        requestDate: '2026-05-02',
        reason: 'Увеличение требований к классу защищенности значимого объекта КИИ',
        scheduleImpactDays: 0,
        costImpactRub: 1450000,
        status: 'under_review',
        ccbDecision: 'На рассмотрении Технического комитета.',
        decidedDate: ''
      },
      {
        id: 'change_3',
        number: 'CR-2026/03',
        title: 'Перенос сроков поставки стенда комплексного моделирования',
        requester: 'Морозов С.Д.',
        requestDate: '2026-05-18',
        reason: 'Задержка изготовления технологической оснастки на опытном производстве',
        scheduleImpactDays: 25,
        costImpactRub: 0,
        status: 'rejected',
        ccbDecision: 'Отклонено: сдвиг критического пути проекта недопустим. Поручено привлечь субподряд.',
        decidedDate: '2026-05-20'
      }
    ];

    const demoRaci = {
      id: 'raci_matrix',
      assignments: {
        'task_101': { 'emp_1': 'A', 'emp_2': 'R', 'emp_3': 'C', 'emp_4': 'C', 'emp_5': 'I' },
        'task_102': { 'emp_1': 'A', 'emp_2': 'C', 'emp_3': 'R', 'emp_4': 'I', 'emp_5': 'I' },
        'task_103': { 'emp_1': 'C', 'emp_2': 'I', 'emp_3': 'I', 'emp_4': 'I', 'emp_5': 'A' },
        'task_104': { 'emp_1': 'A', 'emp_2': 'C', 'emp_3': 'R', 'emp_4': 'I', 'emp_5': 'C' },
        'task_105': { 'emp_1': 'A', 'emp_2': 'R', 'emp_3': 'I', 'emp_4': 'R', 'emp_5': 'I' }
      }
    };

    for (const emp of demoEmployees) await this.saveEntity('employees', emp.id, emp);
    for (const org of demoOrganizations) await this.saveEntity('organizations', org.id, org);
    for (const ext of demoExternalContacts) await this.saveEntity('external_contacts', ext.id, ext);
    for (const t of demoTasks) await this.saveEntity('tasks', t.id, t);
    for (const c of demoContracts) await this.saveEntity('contracts', c.id, c);
    for (const d of demoDocs) await this.saveEntity('docs', d.id, d);
    for (const r of demoRisks) await this.saveEntity('risks', r.id, r);
    await this.saveEntity('invest', demoPassport.id, demoPassport);
    for (const ch of demoChanges) await this.saveEntity('changes', ch.id, ch);
    await this.saveEntity('raci', demoRaci.id, demoRaci);

    await this.readAllData();
  }
}

// Global Storage instance
window.storage = new StorageEngine();
