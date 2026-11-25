import { api } from './api.js';

const path = '/rest/v1/affeto_survey_status?id=eq.1&select=active';

export async function surveyStatus(options) {
  const [state] = await api(path, options);
  if (typeof state?.active !== 'boolean') throw new Error('Status da pesquisa indisponível.');
  return state.active;
}
