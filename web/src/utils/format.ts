export function formatDate(value?: string | null, fallback = '—'): string {
  return value ? new Date(value).toLocaleString() : fallback;
}

export function formatDateOnly(value?: string | null, fallback = '永不过期'): string {
  return value ? new Date(value).toLocaleDateString() : fallback;
}

export function displayValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  try { return JSON.stringify(value); } catch { return '—'; }
}

export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

