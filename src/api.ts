// Calls Expresso's local API (server/api.ts). Writes carry the x-expresso header the API requires.
export async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, body === undefined ? { cache: 'no-store' } : {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-expresso': '1' }, body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${response.status}`);
  return data as T;
}

export interface Report {
  trained_at: string; seconds: number; epochs: number; accuracy: number; has_none: boolean;
  signs: Record<string, { recordings: number; held_out: number; correct: number; accuracy: number | null }>;
  confusions: { sign: string; read_as: string; times: number }[];
}
export interface Job { running: boolean; code: number | null; log: string; startedAt?: string }

/** How Autonoma will read a sign: its gloss is spoken text for Autonoma's command parser. */
export const asCommand = (sign: string) => sign === '_none' ? '(ignored: random movement)' : `“${sign.toLowerCase()}”`;
export const RECORD_TARGET = 15, NONE_TARGET = 25, MIN_TO_TRAIN = 8;
