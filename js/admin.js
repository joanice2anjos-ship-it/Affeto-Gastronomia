import { api, showLogo } from './api.js';
import { questions } from './questions.js';

const byId = id => document.getElementById(id);
const login = byId('login-form');
const status = byId('login-status');
const fields = ['id', ...questions.map(question => question.key), 'created_at'];
const date = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Sao_Paulo' });
let rows = [];
let expires;
void showLogo();

function element(tag, value, className) {
  const node = document.createElement(tag);
  if (value !== undefined) node.textContent = value;
  if (className) node.className = className;
  return node;
}

async function getResponses(token) {
  const results = [];
  let cursor;
  for (;;) {
    const params = new URLSearchParams({ select: fields.join(','), order: 'id.asc', limit: '200' });
    if (cursor) params.set('id', 'gt.' + cursor);
    const page = await api('/rest/v1/responses_affeto?' + params, { token });
    if (!page.length) break;
    results.push(...page);
    cursor = page.at(-1).id;
  }
  return results.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

function countOptions(entries, question) {
  const counts = new Map(question.options.map(option => [option, 0]));
  for (const row of entries) {
    const choices = question.multiple ? row[question.key] : [row[question.key]];
    for (const choice of choices) counts.set(choice, counts.get(choice) + 1);
  }
  return counts;
}

function renderCharts() {
  byId('total').textContent = rows.length;
  const titles = ['Experiência geral', 'Frequência de consumo', 'Opções mais utilizadas', 'Alimentação saudável e sabor', 'O que aumentaria a frequência'];
  const charts = questions.slice(0, 5).map((question, index) => {
    const section = element('section', undefined, 'surface report');
    const list = element('ul', undefined, 'chart');
    for (const [option, count] of countOptions(rows, question)) {
      const item = element('li');
      const label = element('div', undefined, 'bar-label');
      label.append(element('span', option), element('strong', count));
      const bar = element('progress');
      bar.max = rows.length || 1;
      bar.value = count;
      bar.setAttribute('aria-label', option);
      item.append(label, bar);
      list.append(item);
    }
    section.append(element('h2', titles[index]), list);
    return section;
  });
  byId('charts').replaceChildren(...charts);
}

function renderCrossings() {
  const frequency = questions[1];
  const groups = frequency.options.map(option => ({
    option,
    entries: rows.filter(row => row.frequency === option),
  })).filter(group => group.entries.length >= 5);
  const section = byId('crossings');
  section.hidden = groups.length === 0;

  const titles = ['Frequência × motivos para consumir mais', 'Frequência × opções utilizadas', 'Percepção de sabor × frequência'];
  const tables = [questions[4], questions[2], questions[3]].map((question, index) => {
    const wrapper = element('div', undefined, 'table-scroll');
    wrapper.tabIndex = 0;
    wrapper.setAttribute('role', 'region');
    wrapper.setAttribute('aria-label', titles[index]);
    const table = element('table');
    table.append(element('caption', titles[index]));
    const header = table.createTHead().insertRow();
    const optionHeading = element('th', 'Alternativa');
    optionHeading.scope = 'col';
    header.append(optionHeading);
    for (const group of groups) {
      const heading = element('th', group.option + ' (' + group.entries.length + ')');
      heading.scope = 'col';
      header.append(heading);
    }
    const body = table.createTBody();
    const counts = groups.map(group => countOptions(group.entries, question));
    for (const option of question.options) {
      const row = body.insertRow();
      const heading = element('th', option);
      heading.scope = 'row';
      row.append(heading, ...counts.map(group => element('td', group.get(option))));
    }
    wrapper.append(table);
    return wrapper;
  });
  byId('crossing-content').replaceChildren(...(groups.length ? tables : []));
}

function renderSuggestions() {
  const suggestions = rows.filter(row => row.suggestion);
  const items = suggestions.map(row => {
    const item = element('article', undefined, 'suggestion');
    const timestamp = element('time', date.format(new Date(row.created_at)));
    timestamp.dateTime = row.created_at;
    item.append(timestamp, element('p', row.suggestion));
    return item;
  });
  byId('suggestions').replaceChildren(...(items.length ? items : [element('p', 'Nenhuma sugestão recebida.', 'muted')]));
}

login.addEventListener('submit', async event => {
  event.preventDefault();
  const submit = login.querySelector('button');
  if (submit.disabled) return;
  const { email, password } = Object.fromEntries(new FormData(login));
  submit.disabled = true;
  status.textContent = 'Verificando o acesso…';
  try {
    const session = await api('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } });
    const token = session.access_token;
    const allowed = await api('/rest/v1/rpc/is_affeto_admin', { method: 'POST', body: {}, token });
    if (allowed !== true) {
      status.textContent = 'Esta conta não tem acesso ao painel.';
      return;
    }
    rows = await getResponses(token);
    renderCharts();
    renderCrossings();
    renderSuggestions();
    byId('login').hidden = true;
    byId('dashboard').hidden = false;
    byId('dashboard-title').focus();
    expires = setTimeout(() => closeDashboard('Sua sessão expirou. Entre novamente.'), session.expires_in * 1000);
  } catch (error) {
    status.textContent = error.status === 400 || error.status === 401
      ? 'Não foi possível entrar. Confira o e-mail e a senha.'
      : 'Não foi possível carregar o painel. Verifique a configuração ou tente novamente.';
    rows = [];
  } finally {
    login.elements.password.value = '';
    submit.disabled = false;
  }
});

function closeDashboard(message) {
  clearTimeout(expires);
  rows = [];
  byId('dashboard').hidden = true;
  byId('total').textContent = '';
  for (const id of ['charts', 'crossing-content', 'suggestions']) byId(id).replaceChildren();
  byId('login').hidden = false;
  status.textContent = message;
  login.elements.email.focus();
}

byId('logout').addEventListener('click', () => closeDashboard(''));

function csvCell(value) {
  const text = Array.isArray(value) ? value.join(' | ') : String(value ?? '');
  const protect = /^[\t\r\n]|^[\s\uFEFF]*[=+\-@]/u.test(text) ? "'" + text : text;
  return '"' + protect.replaceAll('"', '""') + '"';
}

byId('export').addEventListener('click', () => {
  if (byId('dashboard').hidden) return;
  const lines = [fields, ...rows.map(row => fields.map(field => row[field]))];
  const csv = lines.map(line => line.map(csvCell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }));
  const link = element('a');
  link.href = url;
  link.download = 'respostas-affeto.csv';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
