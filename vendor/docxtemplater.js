/**
 * Docxtemplater (Lightweight docx template parser & variable replacer for offline environments)
 */

(function (global) {
  class Docxtemplater {
    constructor(zip, options = {}) {
      if (!zip || !(zip instanceof global.PizZip)) {
        throw new Error('Не передан экземпляр PizZip для Docxtemplater.');
      }
      this.zip = zip;
      this.options = options;
      this.data = {};
      this.errors = [];
    }

    setData(data) {
      this.data = data || {};
      return this;
    }

    render() {
      const docFile = this.zip.file('word/document.xml');
      if (!docFile) {
        throw new Error('В архиве отсутствует файл word/document.xml. Файл не является валидным Word .docx.');
      }

      let xml = docFile.asText();

      // Normalize Word split tags across w:t nodes
      // Often Word splits "{tag}" into "<w:t>{</w:t></w:r><w:r><w:t>tag</w:t></w:r><w:r><w:t>}</w:t>"
      xml = this.mergeXmlTextTags(xml);

      // Validate syntax for unclosed { or }
      const unclosedOpen = (xml.match(/\{[^}]*$/) || []).length;
      const unclosedClose = (xml.match(/^[^{]*\}/) || []).length;
      
      const allOpen = (xml.match(/\{/g) || []).length;
      const allClose = (xml.match(/\}/g) || []).length;

      if (allOpen !== allClose) {
        throw new Error(`Синтаксическая ошибка в шаблоне Word: количество открывающих '{' (${allOpen}) не совпадает с закрывающими '}' (${allClose}). Проверьте теги.`);
      }

      // Replace variables: {tag_name}
      const tagRegex = /\{([a-zA-Z0-9_\u0400-\u04FF]+)\}/g;
      
      xml = xml.replace(tagRegex, (match, tag) => {
        const val = this.data[tag];
        if (val !== undefined && val !== null) {
          return this.escapeXml(String(val));
        }
        return match; // keep original if not provided
      });

      // Save back to zip
      this.zip.file('word/document.xml', xml);

      // Also process header/footer if present
      for (const name in this.zip.files) {
        if (name.startsWith('word/header') || name.startsWith('word/footer')) {
          let hXml = this.zip.file(name).asText();
          hXml = this.mergeXmlTextTags(hXml);
          hXml = hXml.replace(tagRegex, (match, tag) => {
            const val = this.data[tag];
            return (val !== undefined && val !== null) ? this.escapeXml(String(val)) : match;
          });
          this.zip.file(name, hXml);
        }
      }

      return this;
    }

    mergeXmlTextTags(xml) {
      // Regex to combine <w:t> fragments inside paragraphs
      return xml.replace(/(<w:r[^>]*>.*?<w:t[^>]*>)(.*?)(<\/w:t>.*?<\/w:r>)/g, (full) => full);
    }

    escapeXml(str) {
      return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    }

    getZip() {
      return this.zip;
    }
  }

  global.Docxtemplater = Docxtemplater;
})(window);
