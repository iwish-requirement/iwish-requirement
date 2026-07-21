export function applyDemandIdentifierFilter(query: any, identifier: string) {
  const normalized = identifier.trim();
  const numericId = /^\d+$/.test(normalized) ? Number.parseInt(normalized, 10) : null;
  return numericId && numericId > 0
    ? query.eq("id", numericId)
    : query.eq("fields->>code", normalized);
}
