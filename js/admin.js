import { api, showLogo } from './api.js';
import { questions } from './questions.js';
import { surveyStatus } from './survey-status.js';
import { brazilianDate, localDay, periodStart } from './report-data.js';
import { csvFile, download, excelFile } from './report-export.js';

const byId = id => document.getElementById(id);
const login = byId('login-form');
const status = byId('login-status');
const fields = ['id', ...questions.map(question => question.key), 'created_at'];
const percent = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 });
const positiveOptions = questions[0].options.slice(0, 3);
const toggleSurvey = byId('toggle-survey');
const period = byId('period');
const from = byId('date-from');
const to = byId('date-to');
let rows = [];
let visibleRows = [];
let sessionToken;
let active;
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

function leadingOption(question) {
  const counts = [...countOptions(visibleRows, question)];
  const maximum = Math.max(...counts.map(([, count]) => count));
  if (!maximum) return '—';
  const leaders = counts.filter(([, count]) => count === maximum).map(([option]) => option);
  return leaders.length === 1 ? leaders[0] : 'Empate (' + leaders.length + ' opções)';
}

function renderMetrics() {
  const total = visibleRows.length;
  const positives = visibleRows.filter(row => positiveOptions.includes(row.experience)).length;
  byId('total').textContent = total;
  byId('positive').textContent = total ? percent.format(positives / total) : '—';
  byId('top-frequency').textContent = leadingOption(questions[1]);
  byId('top-motivation').textContent = leadingOption(questions[4]);
}

function applyPeriod() {
  const custom = period.value === 'custom';
  byId('custom-period').hidden = !custom;
  const today = localDay(new Date());
  const start = custom ? from.value : period.value === 'all' ? '' : periodStart(today, Number(period.value));
  const end = custom ? to.value : period.value === 'all' ? '' : today;
  const invalid = custom && (!start || !end || start > end || !from.validity.valid || !to.validity.valid);
  visibleRows = invalid ? [] : rows.filter(row => {
    const day = localDay(new Date(row.created_at));
    return (!start || day >= start) && (!end || day <= end);
  });
  byId('period-error').textContent = invalid ? 'Informe as datas inicial e final em ordem cronológica.' : '';
  byId('export-excel').disabled = byId('export-csv').disabled = !visibleRows.length;
  renderMetrics();
  renderCharts();
  renderCrossings();
  renderSuggestions();
}

for (const input of [period, from, to]) input.addEventListener('change', applyPeriod);

function renderCharts() {
  const titles = ['Experiência geral', 'Frequência de consumo', 'Opções mais utilizadas', 'Alimentação saudável e sabor', 'O que aumentaria a frequência'];
  const charts = questions.slice(0, 5).map((question, index) => {
    const section = element('section', undefined, 'surface report');
    const list = element('ul', undefined, 'chart');
    for (const [option, count] of countOptions(visibleRows, question)) {
      const item = element('li');
      const label = element('div', undefined, 'bar-label');
      label.append(element('span', option), element('strong', count));
      const bar = element('progress');
      bar.max = visibleRows.length || 1;
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
    entries: visibleRows.filter(row => row.frequency === option),
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
  const suggestions = visibleRows.filter(row => row.suggestion?.trim());
  const items = suggestions.map(row => {
    const item = element('article', undefined, 'suggestion');
    const timestamp = element('time', brazilianDate(row.created_at));
    timestamp.dateTime = row.created_at;
    item.append(timestamp, element('p', row.suggestion));
    return item;
  });
  byId('suggestions').replaceChildren(...(items.length ? items : [element('p', 'Nenhum comentário neste período.', 'muted')]));
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
    sessionToken = token;
    period.value = 'all';
    from.value = to.value = '';
    applyPeriod();
    void loadSurveyStatus(token);
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
  visibleRows = [];
  sessionToken = undefined;
  setSurveyStatus(undefined);
  byId('survey-status-error').textContent = '';
  byId('dashboard').hidden = true;
  for (const id of ['total', 'positive', 'top-frequency', 'top-motivation']) byId(id).textContent = '';
  for (const id of ['charts', 'crossing-content', 'suggestions']) byId(id).replaceChildren();
  byId('login').hidden = false;
  status.textContent = message;
  login.elements.email.focus();
}

byId('logout').addEventListener('click', () => closeDashboard(''));

function setSurveyStatus(value) {
  active = value;
  const label = byId('survey-status');
  label.dataset.status = value === undefined ? 'unknown' : value ? 'active' : 'paused';
  label.textContent = value === undefined ? 'Status indisponível' : value ? 'Pesquisa ativa' : 'Pesquisa pausada';
  toggleSurvey.textContent = value === undefined ? 'Verificar status' : value ? 'Pausar pesquisa' : 'Reativar pesquisa';
  toggleSurvey.disabled = !sessionToken;
}

async function loadSurveyStatus(token) {
  const error = byId('survey-status-error');
  error.textContent = '';
  toggleSurvey.disabled = true;
  try {
    const value = await surveyStatus();
    if (sessionToken === token) setSurveyStatus(value);
  } catch {
    if (sessionToken !== token) return;
    setSurveyStatus(undefined);
    error.textContent = 'Não foi possível carregar o status da pesquisa.';
  }
}

toggleSurvey.addEventListener('click', async () => {
  if (!sessionToken || toggleSurvey.disabled) return;
  const token = sessionToken;
  if (active === undefined) {
    await loadSurveyStatus(token);
    return;
  }

  const error = byId('survey-status-error');
  error.textContent = '';
  toggleSurvey.disabled = true;
  try {
    const value = await surveyStatus({
      method: 'PATCH', token, body: { active: !active },
      headers: { Prefer: 'return=representation' },
    });
    if (sessionToken === token) setSurveyStatus(value);
  } catch {
    if (sessionToken !== token) return;
    setSurveyStatus(undefined);
    error.textContent = 'Não foi possível confirmar a atualização. Verifique o status antes de tentar novamente.';
  }
});

byId('export-excel').addEventListener('click', () => {
  if (sessionToken && visibleRows.length) download(excelFile(visibleRows), 'xlsx');
});
byId('export-csv').addEventListener('click', () => {
  if (sessionToken && visibleRows.length) download(csvFile(visibleRows), 'csv');
});
