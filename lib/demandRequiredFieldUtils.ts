export type DemandRequiredField = {
  id?: string | null;
  key?: string | null;
  label?: string | null;
  type?: string | null;
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

export function isQuantityDemandField(field: DemandRequiredField): boolean {
  if ((field.type || "").toLowerCase() !== "number") {
    return false;
  }

  const key = String(field.id || field.key || "").trim().toLowerCase();
  const label = String(field.label || "").trim();
  return /(?:^|_)(?:count|quantity|qty)(?:$|_)/.test(key) || /(数量|数目|个数)/.test(label);
}

export function findInvalidPositiveIntegerDemandFields(
  fields: DemandRequiredField[],
  values: Record<string, unknown> | null | undefined,
): string[] {
  const source = values && typeof values === "object" ? values : {};
  const invalid: string[] = [];

  for (const field of fields) {
    if (!isQuantityDemandField(field)) {
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
      continue;
    }

    const normalized = typeof value === "string" ? value.trim() : value;
    if (typeof normalized !== "string" && typeof normalized !== "number") {
      invalid.push(label || key);
      continue;
    }
    if (typeof normalized === "string" && !/^\d+$/.test(normalized)) {
      invalid.push(label || key);
      continue;
    }
    const numberValue = typeof normalized === "number" ? normalized : Number(normalized);
    if (!Number.isInteger(numberValue) || numberValue < 1) {
      invalid.push(label || key);
    }
  }

  return invalid;
}
