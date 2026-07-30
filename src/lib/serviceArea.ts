import { useEffect, useState } from "react";

/** Single source of truth for the default marketplace location. */
export const SERVICE_CITY = "Purnea";
export const SERVICE_REGION = "Bihar";
export const SERVICE_CITY_LABEL = `${SERVICE_CITY}, ${SERVICE_REGION}`;

export const LOCATION_STORAGE_KEY = "rr.location";
export const LOCATION_CHANGE_EVENT = "rr:location-change";

/**
 * The marketplace is data-driven: any city with an approved, active shop should
 * be browseable. Keep a non-empty city guard so invalid/blank locations still
 * show the unavailable state instead of querying the whole catalogue.
 */
export function isServiceableCity(city: string | null | undefined): boolean {
  return !!city?.trim();
}

/** Common spelling variants for a serviceable city (e.g. Purnea / Purnia).
 * Every product/store query MUST use these variants so a store saved under
 * either spelling is discoverable everywhere (Home, Browse, Search, Store). */
export function cityVariants(city: string): string[] {
  return /^purn(e|i)a$/i.test(city) ? ["Purnea", "Purnia"] : [city];
}

/** Postgrest `.or()` expression for filtering a `city` column across variants. */
export function cityOrExpr(city: string, column = "city"): string {
  return cityVariants(city).map((c) => `${column}.ilike.${c}`).join(",");
}

export function readSavedCity(): string {
  try {
    return localStorage.getItem(LOCATION_STORAGE_KEY) || SERVICE_CITY;
  } catch {
    return SERVICE_CITY;
  }
}

export function setSavedCity(city: string) {
  try {
    localStorage.setItem(LOCATION_STORAGE_KEY, city);
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new CustomEvent(LOCATION_CHANGE_EVENT, { detail: city }));
  } catch {
    /* ignore */
  }
}

/** Reactive hook — re-renders when the user changes city anywhere in the app. */
export function useServiceCity() {
  const [city, setCity] = useState<string>(() => readSavedCity());

  useEffect(() => {
    const onChange = (ev: Event) => {
      const detail = (ev as CustomEvent).detail;
      if (typeof detail === "string") setCity(detail);
      else setCity(readSavedCity());
    };
    const onStorage = (ev: StorageEvent) => {
      if (ev.key === LOCATION_STORAGE_KEY) setCity(readSavedCity());
    };
    window.addEventListener(LOCATION_CHANGE_EVENT, onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(LOCATION_CHANGE_EVENT, onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return { city, isServiceable: isServiceableCity(city) };
}
