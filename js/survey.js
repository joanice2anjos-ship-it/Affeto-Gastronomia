import { api, showLogo } from './api.js';
import { surveyStatus } from './survey-status.js';
import { questions } from './questions.js';

const byId = id => document.getElementById(id);
const answers = {};
let index = 0;
let sending = false;
let submissionId;
const error = byId('survey-error');
const form = byId('questions');
const options = byId('options');
const next = byId('continue');
const back = byId('back');

void showLogo();

const startButton = byId('start');
const retryAvailability = byId('retry-availability');

function showUnavailable(status, focus = false) {
  startButton.disabled = true;
  byId('intro').hidden = true;
  form.hidden = true;
  byId(status).hidden = false;
  if (focus) byId(status + '-title').focus();
}

async function checkAvailability() {
  retryAvailability.hidden = true;
  byId('availability-error').textContent = '';
  try {
    const status = await surveyStatus();
    if (status === 'active') startButton.disabled = false;
    else showUnavailable(status);
  } catch {
    byId('availability-error').textContent = 'Não foi possível verificar a disponibilidade da pesquisa.';
    retryAvailability.hidden = false;
  }
}

retryAvailability.addEventListener('click', checkAvailability);
void checkAvailability();

function render() {
  const { key, title, multiple, options: choices } = questions[index];
  byId('progress-text').textContent = (index + 1) + ' de ' + questions.length;
  byId('progress').value = index + 1;
  byId('question-title').textContent = title;
  byId('question-hint').textContent = multiple ? 'Escolha até 2 opções.' : choices ? '' : 'Opcional';
  error.textContent = '';
  options.replaceChildren();
  next.textContent = choices ? 'Continuar' : 'Enviar respostas';

  if (choices) {
    choices.forEach(choice => {
      const label = document.createElement('label');
      label.className = 'option';
      const input = document.createElement('input');
      input.type = multiple ? 'checkbox' : 'radio';
      input.name = key;
      input.checked = multiple ? (answers[key] || []).includes(choice) : answers[key] === choice;
      input.addEventListener('change', () => {
        if (multiple) {
          const selected = answers[key] || [];
          if (input.checked && selected.length >= 2) {
            input.checked = false;
            error.textContent = 'Você já escolheu 2 opções. Para escolher outra, desmarque uma delas.';
            return;
          }
          answers[key] = input.checked ? [...selected, choice] : selected.filter(value => value !== choice);
        } else {
          answers[key] = choice;
        }
        error.textContent = '';
      });
      label.append(input, choice);
      options.append(label);
    });
  } else {
    const textarea = document.createElement('textarea');
    const counter = document.createElement('p');
    textarea.maxLength = 300;
    textarea.rows = 5;
    textarea.value = answers.suggestion || '';
    textarea.setAttribute('aria-labelledby', 'question-title');
    textarea.setAttribute('aria-describedby', 'question-hint counter');
    counter.id = 'counter';
    counter.className = 'counter';
    const updateCounter = () => {
      answers.suggestion = textarea.value;
      counter.textContent = textarea.value.length + ' / 300 caracteres';
    };
    textarea.addEventListener('input', updateCounter);
    updateCounter();
    options.append(textarea, counter);
  }
  byId('question-title').focus();
}

startButton.addEventListener('click', () => {
  byId('intro').hidden = true;
  form.hidden = false;
  render();
});

back.addEventListener('click', () => {
  if (sending) return;
  if (index > 0) {
    index -= 1;
    render();
  } else {
    form.hidden = true;
    byId('intro').hidden = false;
    byId('start').focus();
  }
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (sending || form.hidden) return;
  const { key, options: choices } = questions[index];
  if (choices && !answers[key]?.length) {
    error.textContent = 'Escolha uma opção para continuar.';
    return;
  }
  if (index < questions.length - 1) {
    index += 1;
    render();
    return;
  }

  sending = true;
  next.disabled = back.disabled = true;
  const textarea = options.querySelector('textarea');
  textarea.readOnly = true;
  error.textContent = '';
  next.textContent = 'Enviando...';
  try {
    submissionId ??= crypto.randomUUID();
    try {
      await api('/rest/v1/responses_affeto', {
        method: 'POST',
        body: { ...answers, id: submissionId, suggestion: answers.suggestion.trim() || null },
        headers: { Prefer: 'return=minimal' },
      });
    } catch (failure) {
      // A tentativa anterior pode ter sido gravada antes de a conexão cair.
      if (failure.code !== '23505') throw failure;
    }
    form.hidden = true;
    byId('thanks').hidden = false;
    byId('thanks-title').focus();
  } catch (failure) {
    if (failure.code === 'AF001') showUnavailable('paused', true);
    else if (failure.code === 'AF002') showUnavailable('finalized', true);
    else error.textContent = 'Não foi possível enviar agora. Suas respostas continuam aqui. Tente novamente.';
  } finally {
    sending = false;
    next.disabled = back.disabled = false;
    textarea.readOnly = false;
    next.textContent = 'Enviar respostas';
  }
});
