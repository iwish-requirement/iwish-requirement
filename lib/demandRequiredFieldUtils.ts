export type DemandRequiredField = {
  id?: string | null;
  key?: string | null;
  label?: string | null;
  required?: boolean | null;
};

export function isDemandFieldValueEmpty(value: unknown): boolean {
  if (value === undefined || value === null) {
    return true;
  }
  if (typeof value === "string") {
    return value.trim() === "";
  }
  if (Array.isArray(value)) {
    return value.length === 0 || value.every((item) => isDemandFieldValueEmpty(item));
  }
  return false;
}

export function getDemandFieldStorageKey(field: DemandRequiredField): string {
  return String(field.id || field.key || "").trim();
}

export function findMissingRequiredDemandFields(
  fields: DemandRequiredField[],
  values: Record<string, unknown> | null | undefined,
): string[] {
  const source = values && typeof values === "object" ? values : {};
  const missing: string[] = [];

  for (const field of fields) {
    if (!field.required) {
      continue;
    }

    const key = getDemandFieldStorageKey(field);
    const label = String(field.label || key).trim();
    if (!key) {
      continue;
    }

    const value = Object.prototype.hasOwnProperty.call(source, key)
      ? source[key]
      : label && Object.prototype.hasOwnProperty.call(source, label)
        ? source[label]
        : undefined;

    if (isDemandFieldValueEmpty(value)) {
      missing.push(label || key);
    }
  }

  return missing;
}
