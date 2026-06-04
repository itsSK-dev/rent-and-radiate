import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "rental-proofs";
const SIGN_TTL = 60 * 60; // 1 hour

/** Extract the storage object path from either a stored public URL or a raw path. */
export function extractProofPath(stored: string): string {
  if (!stored) return stored;
  const marker = `/${BUCKET}/`;
  const idx = stored.indexOf(marker);
  if (idx >= 0) return stored.slice(idx + marker.length);
  return stored.replace(/^\/+/, "");
}

const cache = new Map<string, { url: string; exp: number }>();
const accessLogged = new Set<string>();

function logAccess(path: string) {
  if (accessLogged.has(path)) return;
  accessLogged.add(path);
  (supabase as any).rpc("log_proof_access", { _path: path, _context: "rental-proofs view" }).then(() => {});
}

export async function getSignedProofUrl(stored: string): Promise<string> {
  if (!stored) return stored;
  const path = extractProofPath(stored);
  const now = Date.now();
  const hit = cache.get(path);
  if (hit && hit.exp > now + 30_000) { logAccess(path); return hit.url; }
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGN_TTL);
  if (error || !data?.signedUrl) return stored;
  cache.set(path, { url: data.signedUrl, exp: now + SIGN_TTL * 1000 });
  logAccess(path);
  return data.signedUrl;
}

export function useSignedProofUrl(stored: string | undefined | null): string | undefined {
  const [url, setUrl] = useState<string | undefined>(undefined);
  useEffect(() => {
    let active = true;
    if (!stored) { setUrl(undefined); return; }
    getSignedProofUrl(stored).then((u) => { if (active) setUrl(u); });
    return () => { active = false; };
  }, [stored]);
  return url;
}
