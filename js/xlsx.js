// Minimal uncompressed ZIP package for a single-sheet Office Open XML workbook.
const encoder = new TextEncoder();
const ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const rel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const packageRel = 'http://schemas.openxmlformats.org/package/2006/relationships';
const mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml';
const crcTable = Uint32Array.from({ length: 256 }, (_, byte) => {
  let crc = byte;
  for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  return crc;
});

function header(size, fields) {
  const bytes = new Uint8Array(size);
  const view = new DataView(bytes.buffer);
  for (const [offset, width, value] of fields) {
    if (width === 2) view.setUint16(offset, value, true);
    else view.setUint32(offset, value, true);
  }
  return bytes;
}

function zip(files) {
  const data = [];
  const directory = [];
  let offset = 0;
  let directorySize = 0;

  for (const [path, xml] of Object.entries(files)) {
    const name = encoder.encode(path);
    const content = encoder.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' + xml);
    let crc = 0xffffffff;
    for (const byte of content) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff];
    crc ^= 0xffffffff;

    // Local file header and corresponding central directory entry.
    data.push(header(30, [
      [0, 4, 0x04034b50], [4, 2, 20], [12, 2, 33], [14, 4, crc],
      [18, 4, content.length], [22, 4, content.length], [26, 2, name.length],
    ]), name, content);
    directory.push(header(46, [
      [0, 4, 0x02014b50], [4, 2, 20], [6, 2, 20], [14, 2, 33], [16, 4, crc],
      [20, 4, content.length], [24, 4, content.length], [28, 2, name.length], [42, 4, offset],
    ]), name);
    offset += 30 + name.length + content.length;
    directorySize += 46 + name.length;
  }

  const count = directory.length / 2;
  const end = header(22, [
    [0, 4, 0x06054b50], [8, 2, count], [10, 2, count], [12, 4, directorySize], [16, 4, offset],
  ]);
  return new Blob([...data, ...directory, end], { type: mime + '.sheet' });
}

function xmlText(value) {
  // Excel escapes this pattern itself when reading a string cell.
  return value.replace(/_x[0-9a-f]{4}_/gi, match => '_x005F_' + match.slice(1))
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
    .replace(/[&<>\r]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\r': '&#13;' })[character]);
}

export function workbook(headers, rows, widths) {
  const range = 'A1:G' + (rows.length + 1);
  const cols = widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join('');
  const sheetRows = [headers, ...rows].map((values, index) => {
    const row = index + 1;
    const cells = values.map((value, column) => {
      const reference = String.fromCharCode(65 + column) + row;
      if (typeof value === 'number') return `<c r="${reference}" s="3"><v>${value}</v></c>`;
      return `<c r="${reference}" s="${index ? 2 : 1}" t="inlineStr"><is><t xml:space="preserve">${xmlText(value)}</t></is></c>`;
    }).join('');
    return `<row r="${row}">${cells}</row>`;
  }).join('');
  return zip({
    '[Content_Types].xml': `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
      <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
      <Default Extension="xml" ContentType="application/xml"/>
      <Override PartName="/xl/workbook.xml" ContentType="${mime}.sheet.main+xml"/>
      <Override PartName="/xl/worksheets/sheet1.xml" ContentType="${mime}.worksheet+xml"/>
      <Override PartName="/xl/styles.xml" ContentType="${mime}.styles+xml"/>
    </Types>`,
    '_rels/.rels': `<Relationships xmlns="${packageRel}"><Relationship Id="rId1" Type="${rel}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': `<workbook xmlns="${ns}" xmlns:r="${rel}"><sheets><sheet name="Respostas" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `<Relationships xmlns="${packageRel}">
      <Relationship Id="rId1" Type="${rel}/worksheet" Target="worksheets/sheet1.xml"/>
      <Relationship Id="rId2" Type="${rel}/styles" Target="styles.xml"/>
    </Relationships>`,
    'xl/styles.xml': `<styleSheet xmlns="${ns}">
      <numFmts count="1"><numFmt numFmtId="164" formatCode="dd/mm/yyyy hh:mm"/></numFmts>
      <fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
      <fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
      <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
      <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
      <cellXfs count="4">
        <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
        <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
        <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
        <xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf>
      </cellXfs>
      <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
    </styleSheet>`,
    'xl/worksheets/sheet1.xml': `<worksheet xmlns="${ns}"><dimension ref="${range}"/>
      <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews>
      <cols>${cols}</cols><sheetData>${sheetRows}</sheetData><autoFilter ref="${range}"/>
    </worksheet>`,
  });
}
