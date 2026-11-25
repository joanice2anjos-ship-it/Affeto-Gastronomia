import { questions } from './questions.js';
import { brazilianDate, timeParts } from './report-data.js';
import { workbook } from './xlsx.js';

const headers = [
  'Experiência geral', 'Frequência de consumo', 'Opções mais utilizadas',
  'Alimentação saudável e sabor', 'Fatores para consumir com mais frequência',
  'Sugestão, elogio ou melhoria', 'Data da resposta',
];

function answers(row) {
  return questions.map(({ key, multiple }) => multiple ? row[key].join(' | ') : row[key] ?? '');
}

function csvCell(text) {
  const safe = /^[\t\r\n]|^[\s\uFEFF]*[=+\-@]/u.test(text) ? "'" + text : text;
  return '"' + safe.replaceAll('"', '""') + '"';
}

function excelDate(timestamp) {
  const { day, month, year, hour, minute } = timeParts(timestamp);
  const milliseconds = Date.parse(`${year}-${month}-${day}T${hour}:${minute}:00Z`);
  return milliseconds / 86400000 + 25569;
}

export function csvFile(rows) {
  const values = [headers, ...rows.map(row => [...answers(row), brazilianDate(row.created_at)])];
  const csv = values.map(row => row.map(csvCell).join(';')).join('\r\n');
  return new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' });
}

export function excelFile(rows) {
  const values = rows.map(row => [...answers(row), excelDate(row.created_at)]);
  return workbook(headers, values, [34, 34, 48, 52, 58, 64, 22]);
}

export function download(file, extension) {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'respostas-affeto.' + extension;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
