export const CATALOG_DEBUG_KEY = "rr.catalogDebug";

export function catalogLog(scope: string, payload?: unknown) {
  const enabled =
    import.meta.env.DEV ||
    (typeof window !== "undefined" && window.localStorage.getItem(CATALOG_DEBUG_KEY) === "1");

  if (!enabled) return;
  if (payload === undefined) {
    console.info(`[catalog:${scope}]`);
    return;
  }
  console.info(`[catalog:${scope}]`, payload);
}