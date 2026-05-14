const DESIGN_DEMAND_TYPE_CODES = ["ui_design", "graphic", "campaign_visual"];
const VIDEO_DEMAND_TYPE_CODES = ["video_editing"];

export type CreativeDemandRole = "design" | "video" | "all" | null;

export function resolveCreativeDemandRole(user: {
  position?: string | null;
  role?: string | null;
}): CreativeDemandRole {
  const role = (user.role || "").toString().toLowerCase();
  if (role === "admin" || role === "manager") {
    return "all";
  }

  const position = (user.position || "").toString().trim().toLowerCase();
  if (position === "all" || position === "manager" || position === "lead") {
    return "all";
  }
  if (position === "video" || position === "video_editor" || position === "video_editing") {
    return "video";
  }
  if (position === "design" || position === "designer" || position === "graphic" || position === "ui") {
    return "design";
  }

  return null;
}

export function getCreativeDemandTypeCodes(role: CreativeDemandRole): string[] {
  if (role === "design") return DESIGN_DEMAND_TYPE_CODES;
  if (role === "video") return VIDEO_DEMAND_TYPE_CODES;
  if (role === "all") return [...DESIGN_DEMAND_TYPE_CODES, ...VIDEO_DEMAND_TYPE_CODES];
  return [];
}

export function isDemandTypeAllowedForCreativeRole(
  role: CreativeDemandRole,
  demandTypeCode?: string | null,
) {
  if (role === "all") return true;
  const codes = getCreativeDemandTypeCodes(role);
  return !!demandTypeCode && codes.includes(demandTypeCode);
}
