import type { UsageRecordFacets } from './types';

export function mergeFacets(previous: UsageRecordFacets | null, next: UsageRecordFacets | null): UsageRecordFacets | null {
  if (!next) return previous;
  if (!previous) return next;
  const byId = <T extends { id: string }>(a: T[], b: T[]): T[] => {
    const map = new Map<string, T>();
    [...a, ...b].forEach((item) => map.set(item.id, item));
    return [...map.values()];
  };
  return {
    statuses: [...new Set([...previous.statuses, ...next.statuses])],
    models: byId(previous.models, next.models),
    devices: byId(previous.devices, next.devices),
    groups: byId(previous.groups, next.groups),
    users: byId(previous.users ?? [], next.users ?? []),
  };
}
