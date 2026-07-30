import { useEffect, useState } from "react";

/** Radius (km) that counts as "nearby" for the Nearby Verified Shops rail. */
export const NEARBY_RADIUS_KM = 25;

export const COORDS_STORAGE_KEY = "rr.coords";
export const COORDS_CHANGE_EVENT = "rr:coords-change";

export type Coords = { lat: number; lng: number };

export function haversineKm(a: Coords, b: Coords): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function readSavedCoords(): Coords | null {
  try {
    const raw = localStorage.getItem(COORDS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.lat === "number" && typeof parsed?.lng === "number") {
      return { lat: parsed.lat, lng: parsed.lng };
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function setSavedCoords(coords: Coords) {
  try {
    localStorage.setItem(COORDS_STORAGE_KEY, JSON.stringify(coords));
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new CustomEvent(COORDS_CHANGE_EVENT, { detail: coords }));
  } catch {
    /* ignore */
  }
}

/** Reactive access to the visitor's last known coordinates (opt-in only). */
export function useUserCoords() {
  const [coords, setCoords] = useState<Coords | null>(() => readSavedCoords());
  useEffect(() => {
    const onChange = () => setCoords(readSavedCoords());
    window.addEventListener(COORDS_CHANGE_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(COORDS_CHANGE_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);
  return coords;
}
