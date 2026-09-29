/**
 * Documents & Template Generator Module (.docx)
 * Uses local PizZip and Docxtemplater in /vendor/
 */

class DocumentsModule {
  constructor() {
    this.customTemplates = []; // user uploaded docx templates
    this.selectedTemplateId = 'act';
    this.loadedDocxArrayBuffer = null;
  }

  init() {
    this.bindEvents();
    this.render();
  }

  bindEvents() {
    // Select contract for document generation
    const contractSelect = document.getElementById('doc-select-contract');
    if (contractSelect) {
      contractSelect.addEventListener('change', (e) => this.onSelectContract(e.target.value));
    }

    // Select template
    const templateSelect = document.getElementById('doc-select-template');
    if (templateSelect) {
      templateSelect.addEventListener('change', (e) => {
        this.selectedTemplateId = e.target.value;
        this.toggleCustomTemplateUpload(this.selectedTemplateId === 'custom');
      });
    }

    // Upload custom docx template file input
    const uploadInput = document.getElementById('doc-upload-template-file');
    if (uploadInput) {
      uploadInput.addEventListener('change', (e) => this.handleCustomTemplateUpload(e));
    }

    // Generate Document button
    const btnGenerate = document.getElementById('btn-generate-docx');
    if (btnGenerate) {
      btnGenerate.addEventListener('click', () => this.generateDocument());
    }

    // Re-fill date with today
    const btnToday = document.getElementById('btn-doc-date-today');
    if (btnToday) {
      btnToday.addEventListener('click', () => {
        const dInput = document.getElementById('doc-field-date');
        if (dInput) dInput.value = new Date().toISOString().split('T')[0];
      });
    }
  }

  render() {
    const contractSelect = document.getElementById('doc-select-contract');
    if (!contractSelect) return;

    const { contracts = [], organizations = [] } = window.storage.cache;
    const currentVal = contractSelect.value;

    let optHtml = '<option value="">-- Выберите договор или организацию для автозаполнения --</option>';
    
    if (contracts.length > 0) {
      optHtml += '<optgroup label="📜 Реестр действующих договоров">';
      contracts.forEach(c => {
        optHtml += `<option value="cnt_${c.id}">Договор ${this.escapeHtml(c.number || 'Б/Н')} — ${this.escapeHtml(c.counterparty || 'Контрагент')} (${new Intl.NumberFormat('ru-RU').format(c.sum || 0)} ₽)</option>`;
      });
      optHtml += '</optgroup>';
    }

    if (organizations.length > 0) {
      optHtml += '<optgroup label="🏢 Внешние предприятия и ведомства">';
      organizations.forEach(o => {
        optHtml += `<option value="org_${o.id}">Организация: ${this.escapeHtml(o.shortName)} (ИНН: ${this.escapeHtml(o.inn)})</option>`;
      });
      optHtml += '</optgroup>';
    }

    contractSelect.innerHTML = optHtml;
    if (currentVal) contractSelect.value = currentVal;
  }

  onSelectContract(selectedKey) {
    if (!selectedKey) return;
    const { contracts = [], organizations = [], employees = [] } = window.storage.cache;

    const fDocNum = document.getElementById('doc-field-num');
    const fClient = document.getElementById('doc-field-client');
    const fInn = document.getElementById('doc-field-inn');
    const fKpp = document.getElementById('doc-field-kpp');
    const fSum = document.getElementById('doc-field-sum');
    const fSubject = document.getElementById('doc-field-subject');
    const fCurator = document.getElementById('doc-field-curator');
    const fDate = document.getElementById('doc-field-date');

    if (selectedKey.startsWith('cnt_')) {
      const cId = selectedKey.replace('cnt_', '');
      const c = contracts.find(item => item.id === cId);
      if (!c) return;

      const curator = employees.find(e => e.id === c.responsibleId) || { name: 'Соколов В.П.', role: 'Руководитель направления' };

      if (fDocNum) fDocNum.value = c.number || '';
      if (fClient) fClient.value = c.counterparty || '';
      if (fInn) fInn.value = c.inn || '7701234567';
      if (fKpp) fKpp.value = c.kpp || '770101001';
      if (fSum) fSum.value = c.sum || 0;
      if (fSubject) fSubject.value = c.title || '';
      if (fCurator) fCurator.value = curator.name || '';
      if (fDate && !fDate.value) fDate.value = new Date().toISOString().split('T')[0];
    } else if (selectedKey.startsWith('org_')) {
      const oId = selectedKey.replace('org_', '');
      const org = organizations.find(item => item.id === oId);
      if (!org) return;

      if (fDocNum) fDocNum.value = `Исх-${Math.floor(100 + Math.random() * 900)}/26`;
      if (fClient) fClient.value = org.fullName || org.shortName || '';
      if (fInn) fInn.value = org.inn || '';
      if (fKpp) fKpp.value = org.kpp || '';
      if (fSum) fSum.value = 0;
      if (fSubject) fSubject.value = `О согласовании документации и регламентов взаимодействия с ${org.shortName}`;
      if (fCurator) fCurator.value = 'Соколов В.П.';
      if (fDate && !fDate.value) fDate.value = new Date().toISOString().split('T')[0];
    }
  }

  /* ---------------- Document Generation (.docx) ---------------- */
  async generateDocument() {
    const docNum = document.getElementById('doc-field-num')?.value.trim();
    const client = document.getElementById('doc-field-client')?.value.trim();
    const inn = document.getElementById('doc-field-inn')?.value.trim() || '—';
    const kpp = document.getElementById('doc-field-kpp')?.value.trim() || '—';
    const sum = parseFloat(document.getElementById('doc-field-sum')?.value) || 0;
    const subject = document.getElementById('doc-field-subject')?.value.trim() || 'Выполнение работ';
    const curator = document.getElementById('doc-field-curator')?.value.trim() || 'Руководитель направления';
    const docDate = document.getElementById('doc-field-date')?.value.trim() || new Date().toISOString().split('T')[0];

    if (!docNum || !client) {
      window.app.showToast('Заполните номер документа и наименование контрагента', 'error');
      return;
    }

    const sumWords = this.numberToRussianWords(sum);
    const formattedSum = new Intl.NumberFormat('ru-RU').format(sum) + ' руб.';

    const templateData = {
      doc_num: docNum,
      client: client,
      inn: inn,
      kpp: kpp,
      sum: formattedSum,
      sum_words: sumWords,
      curator: curator,
      subject: subject,
      date: docDate,
      start_date: docDate,
      end_date: docDate,
      title: subject
    };

    try {
      let zip;
      if (this.selectedTemplateId === 'custom') {
        if (!this.loadedDocxArrayBuffer) {
          throw new Error('Пожалуйста, выберите файл пользовательского шаблона .docx');
        }
        zip = new window.PizZip(this.loadedDocxArrayBuffer);
      } else {
        // Build standard docx template package on the fly
        zip = this.createBuiltInDocxTemplate(this.selectedTemplateId);
      }

      const doc = new window.Docxtemplater(zip);
      doc.setData(templateData);
      doc.render();

      const blob = doc.getZip().generate({ type: 'blob' });
      
      const fileName = `${this.selectedTemplateId}_${docNum.replace(/[/\\?%*:|"<>]/g, '_')}_${docDate}.docx`;
      
      // Trigger download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      window.app.showToast(`Документ «${fileName}» успешно сформирован!`, 'success');
    } catch (err) {
      window.app.showToast(`Ошибка генерации документа: ${err.message}`, 'error');
      console.error(err);
    }
  }

  /* ---------------- Built-in Standard Docx Templates ---------------- */
  createBuiltInDocxTemplate(type) {
    const zip = new window.PizZip();

    // 1. [Content_Types].xml
    zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);

    // 2. _rels/.rels
    zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);

    let docXmlContent = '';

    if (type === 'act') {
      docXmlContent = `
        <w:p><w:r><w:rPr><w:b/><w:sz w:val="32"/></w:rPr><w:t>АКТ СДАЧИ-ПРИЕМКИ РАБОТ (УСЛУГ)</w:t></w:r></w:p>
        <w:p><w:r><w:rPr><w:b/></w:rPr><w:t>к Договору № {doc_num} от {date} г.</w:t></w:r></w:p>
        <w:p><w:r><w:t></w:t></w:r></w:p>
        <w:p><w:r><w:t>Мы, нижеподписавшиеся, представитель Заказчика, с одной стороны, и представитель Исполнителя {client} (ИНН: {inn}, КПП: {kpp}), с другой стороны, составили настоящий Акт о том, что работы (услуги) по предмету "{subject}" выполнены в полном объеме и в установленные сроки.</w:t></w:r></w:p>
        <w:p><w:r><w:t></w:t></w:r></w:p>
        <w:p><w:r><w:t>Общая стоимость оказанных услуг составляет: {sum} ({sum_words}).</w:t></w:r></w:p>
        <w:p><w:r><w:t>Стороны претензий по объему, качеству и срокам оказания услуг друг к другу не имеют.</w:t></w:r></w:p>
        <w:p><w:r><w:t></w:t></w:r></w:p>
        <w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Ответственный куратор: {curator} ________________ (подпись)</w:t></w:r></w:p>
      `;
    } else if (type === 'contract') {
      docXmlContent = `
        <w:p><w:r><w:rPr><w:b/><w:sz w:val="32"/></w:rPr><w:t>ТИПОВОЙ ДОГОВОР ПОСТАВКИ № {doc_num}</w:t></w:r></w:p>
        <w:p><w:r><w:t>г. Москва, дата заключения: {date} г.</w:t></w:r></w:p>
        <w:p><w:r><w:t></w:t></w:r></w:p>
        <w:p><w:r><w:t>1. ПРЕДМЕТ ДОГОВОРА</w:t></w:r></w:p>
        <w:p><w:r><w:t>1.1. Поставщик {client} (ИНН: {inn}, КПП: {kpp}) обязуется поставить, а Заказчик принять и оплатить: {subject}.</w:t></w:r></w:p>
        <w:p><w:r><w:t></w:t></w:r></w:p>
        <w:p><w:r><w:t>2. СУММА ДОГОВОРА И ПОРЯДОК РАСЧЕТОВ</w:t></w:r></w:p>
        <w:p><w:r><w:t>2.1. Цена настоящего Договора составляет: {sum} ({sum_words}), включая НДС.</w:t></w:r></w:p>
        <w:p><w:r><w:t></w:t></w:r></w:p>
        <w:p><w:r><w:t>3. АДРЕСА И РЕКВИЗИТЫ СТОРОН</w:t></w:r></w:p>
        <w:p><w:r><w:t>Поставщик: {client}, ИНН {inn}, КПП {kpp}</w:t></w:r></w:p>
        <w:p><w:r><w:t>Куратор направления: {curator}</w:t></w:r></w:p>
      `;
    } else {
      // Additional agreement
      docXmlContent = `
        <w:p><w:r><w:rPr><w:b/><w:sz w:val="32"/></w:rPr><w:t>ДОПОЛНИТЕЛЬНОЕ СОГЛАШЕНИЕ № 1</w:t></w:r></w:p>
        <w:p><w:r><w:t>к Договору № {doc_num} от {date} г.</w:t></w:r></w:p>
        <w:p><w:r><w:t></w:t></w:r></w:p>
        <w:p><w:r><w:t>Стороны пришли к соглашению уточнить условия договора с контрагентом {client} (ИНН: {inn}) по предмету: {subject}.</w:t></w:r></w:p>
        <w:p><w:r><w:t>Сумма финансирования этапа составляет {sum} ({sum_words}).</w:t></w:r></w:p>
        <w:p><w:r><w:t>Куратор: {curator}</w:t></w:r></w:p>
      `;
    }

    // 3. word/document.xml
    zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${docXmlContent}
  </w:body>
</w:document>`);

    return zip;
  }

  /* ---------------- Number to Russian Words Converter ---------------- */
  numberToRussianWords(num) {
    const n = Math.floor(Math.abs(num));
    if (n === 0) return 'Ноль рублей 00 копеек';

    const unitsM = ['', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
    const unitsF = ['', 'одна', 'две', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
    const teens = ['десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать', 'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать'];
    const tens = ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто'];
    const hundreds = ['', 'сто', 'двести', 'триста', 'четыреста', 'пятьсот', 'шестьсот', 'семьсот', 'восемьсот', 'девятьсот'];

    function triplet(val, isFemale) {
      const u = isFemale ? unitsF : unitsM;
      const h = Math.floor(val / 100);
      const t = Math.floor((val % 100) / 10);
      const un = val % 10;
      let res = '';
      if (h > 0) res += hundreds[h] + ' ';
      if (t === 1) {
        res += teens[un] + ' ';
      } else {
        if (t > 1) res += tens[t] + ' ';
        if (un > 0) res += u[un] + ' ';
      }
      return res.trim();
    }

    function plural(val, one, two, five) {
      const v = Math.abs(val) % 100;
      const v1 = v % 10;
      if (v > 10 && v < 20) return five;
      if (v1 > 1 && v1 < 5) return two;
      if (v1 === 1) return one;
      return five;
    }

    const billions = Math.floor(n / 1000000000);
    const millions = Math.floor((n % 1000000000) / 1000000);
    const thousands = Math.floor((n % 1000000) / 1000);
    const remainder = n % 1000;

    let words = '';
    if (billions > 0) {
      words += triplet(billions, false) + ' ' + plural(billions, 'миллиард', 'миллиарда', 'миллиардов') + ' ';
    }
    if (millions > 0) {
      words += triplet(millions, false) + ' ' + plural(millions, 'миллион', 'миллиона', 'миллионов') + ' ';
    }
    if (thousands > 0) {
      words += triplet(thousands, true) + ' ' + plural(thousands, 'тысяча', 'тысячи', 'тысяч') + ' ';
    }
    if (remainder > 0) {
      words += triplet(remainder, false) + ' ';
    }

    words = words.trim();
    const capitalized = words.charAt(0).toUpperCase() + words.slice(1);
    const rublePlural = plural(n, 'рубль', 'рубля', 'рублей');

    return `${capitalized} ${rublePlural} 00 копеек`;
  }

  escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}

window.documentsModule = new DocumentsModule();
