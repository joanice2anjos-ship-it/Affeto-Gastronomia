const timeZone = 'America/Sao_Paulo';
const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
});
const timestampFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone, day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

export function localDay(date) {
  const parts = Object.fromEntries(dayFormatter.formatToParts(date).map(part => [part.type, part.value]));
  return parts.year + '-' + parts.month + '-' + parts.day;
}

export function periodStart(today, days) {
  const date = new Date(today + 'T00:00:00Z');
  date.setUTCDate(date.getUTCDate() - days + 1);
  return date.toISOString().slice(0, 10);
}

export function timeParts(timestamp) {
  return Object.fromEntries(timestampFormatter.formatToParts(new Date(timestamp))
    .filter(part => part.type !== 'literal')
    .map(part => [part.type, part.value]));
}

export function brazilianDate(timestamp) {
  const { day, month, year, hour, minute } = timeParts(timestamp);
  return `${day}/${month}/${year} ${hour}:${minute}`;
}
