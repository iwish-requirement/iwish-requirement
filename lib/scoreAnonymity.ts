/** Temporary hard-coded exception; replace with permission later. */
export const SCORE_IDENTITY_VIEWER_EMAIL = "lin88@iwishweb.com";

export const ANONYMOUS_SCORER_LABEL = "匿名评分";

export function canViewScorerIdentity(email: string | null | undefined): boolean {
  return (email ?? "").trim().toLowerCase() === SCORE_IDENTITY_VIEWER_EMAIL;
}
