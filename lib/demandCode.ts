const DEMAND_CODE_RANDOM_LENGTH = 12;

export function makeDemandCode(now = new Date()): string {
  const randomPart = crypto.randomUUID().replace(/-/g, "").slice(0, DEMAND_CODE_RANDOM_LENGTH).toUpperCase();
  return `REQ-${now.getFullYear()}-${randomPart}`;
}

export function isCopiedDemandTitle(title: string | null | undefined): boolean {
  return /[（(]复制[）)]/.test((title || "").trim());
}
