let config;
export async function configuration() {
  config ??= import('./config.js').catch(() => ({}));
  return config;
}

export async function showLogo() {
  const { LOGO_URL } = await configuration();
  if (!LOGO_URL) return;
  const slot = document.querySelector('[data-logo]');
  const logo = new Image();
  logo.alt = 'Affeto Gastronomia Funcional';
  logo.addEventListener('load', () => {
    slot.append(logo);
    slot.hidden = false;
    slot.nextElementSibling.hidden = true;
  });
  logo.src = new URL(LOGO_URL, new URL('../', import.meta.url));
}

export async function api(path, { method = 'GET', body, token, headers = {} } = {}) {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = await configuration();
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || SUPABASE_URL.includes('SEU-PROJETO')) {
    throw new Error('A conexão com o Supabase ainda precisa ser configurada.');
  }
  const bearer = token || (SUPABASE_ANON_KEY.startsWith('eyJ') ? SUPABASE_ANON_KEY : null);
  const response = await fetch(new URL(path, SUPABASE_URL), {
    method,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      ...(bearer && { Authorization: 'Bearer ' + bearer }),
      ...(body && { 'Content-Type': 'application/json' }),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  const content = await response.text();
  const isJson = response.headers.get('content-type')?.includes('json');
  const data = content && isJson ? JSON.parse(content) : null;
  if (!response.ok) {
    throw Object.assign(new Error('O Supabase não concluiu a solicitação.'), {
      status: response.status, code: data?.code,
    });
  }
  return data;
}
