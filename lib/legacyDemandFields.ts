const CUSTOMER_PATTERNS = [
  /客户/,
  /客户名称/,
  /客户名/,
  /品牌/,
  /品牌名/,
  /公司/,
  /公司名/,
  /公司名称/,
  /customer/i,
  /brand/i,
  /company/i,
];

const PROJECT_PATTERNS = [
  /项目/,
  /项目名称/,
  /站点/,
  /店铺/,
  /链接/,
  /网址/,
  /project/i,
  /site/i,
  /url/i,
];

function stringifyLegacyValue(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (Array.isArray(value)) {
    const text = value.map((item) => stringifyLegacyValue(item)).filter(Boolean).join("、");
    return text || null;
  }
  if (typeof value === "object") return null;
  const text = String(value).trim();
  return text || null;
}

function extractByPatterns(fields: Record<string, unknown> | undefined | null, patterns: RegExp[]) {
  if (!fields || typeof fields !== "object") return null;
  for (const [key, value] of Object.entries(fields)) {
    if (patterns.some((pattern) => pattern.test(key))) {
      const text = stringifyLegacyValue(value);
      if (text) return text;
    }
  }
  return null;
}

export function extractLegacyCustomerProject(fields: Record<string, unknown> | undefined | null) {
  return {
    legacyCustomerName: extractByPatterns(fields, CUSTOMER_PATTERNS),
    legacyProjectName: extractByPatterns(fields, PROJECT_PATTERNS),
  };
}

export function legacyCustomerProjectMatches(fields: Record<string, unknown> | undefined | null, keyword: string) {
  const needle = keyword.trim().toLowerCase();
  if (!needle) return false;
  const { legacyCustomerName, legacyProjectName } = extractLegacyCustomerProject(fields);
  return [legacyCustomerName, legacyProjectName].some((value) => value?.toLowerCase().includes(needle));
}
