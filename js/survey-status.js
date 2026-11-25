import { api } from './api.js';

const path = '/rest/v1/affeto_survey_status?id=eq.1&select=active,finalized';

export async function surveyStatus(options) {
  const [state] = await api(path, options);
  if (typeof state?.active !== 'boolean' || typeof state.finalized !== 'boolean') {
    throw new Error('Status da pesquisa indisponível.');
  }
  if (state.finalized) return 'finalized';
  return state.active ? 'active' : 'paused';
}

export function updateSurveyStatus(status, token) {
  return surveyStatus({
    method: 'PATCH',
    token,
    body: { active: status === 'active', finalized: status === 'finalized' },
    headers: { Prefer: 'return=representation' },
  });
}
