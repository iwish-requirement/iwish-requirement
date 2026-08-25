export const DEMAND_TYPE_IMPORT_HEADERS = [
  "需求类型编码",
  "需求类型",
  "demandTypeCode",
  "demandType",
] as const;

export interface ImportDemandType {
  id: number;
  code: string | null;
  name: string | null;
  fieldTemplateId: number | null;
  isActive: boolean;
}

export function findDemandTypeImportColumn(
  headerIndex: Record<string, number>,
): number | undefined {
  for (const header of DEMAND_TYPE_IMPORT_HEADERS) {
    if (headerIndex[header] !== undefined) {
      return headerIndex[header];
    }
  }
  return undefined;
}

export function resolveImportDemandType(
  rawValue: unknown,
  demandTypes: ImportDemandType[],
): ImportDemandType | null {
  const token = typeof rawValue === "string" ? rawValue.trim().toLowerCase() : "";
  if (!token) {
    return null;
  }

  return (
    demandTypes.find((demandType) => {
      if (!demandType.isActive) {
        return false;
      }
      return (
        (demandType.code || "").trim().toLowerCase() === token ||
        (demandType.name || "").trim().toLowerCase() === token
      );
    }) ?? null
  );
}
