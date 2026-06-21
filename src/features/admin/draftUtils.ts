let clientIdSeq = 0;

const createClientId = (): string => {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return uuid;
  const suffix = `${Date.now()}${clientIdSeq++}`.padStart(12, "0").slice(-12);
  return `00000000-0000-4000-8000-${suffix}`;
};

export const nextDraftId = (_prefix: string) => createClientId();

export const toInt = (raw: string) => {
  const n = parseInt(raw.replace(/[^\d]/g, ""), 10);
  return Number.isNaN(n) ? 0 : n;
};

export const nextSort = (current: number[]) => (current.length ? Math.max(...current) + 1 : 1);

export const mapById = <T extends { id: string }>(items: T[]): Map<string, T> =>
  new Map(items.map((item) => [item.id, item]));

export const trimDraftName = (value: string): string => value.trim();

export const tombstoneFor = (id: string, actorId: string | null | undefined) => ({
  id,
  deletedByEmployeeId: actorId ?? null,
});
