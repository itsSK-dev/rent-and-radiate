import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SupportContact = {
  email: string | null;
  phone: string | null;
  link_url: string | null;
  link_label: string | null;
  hours: string | null;
};

export const SUPPORT_CONTACT_FALLBACK: SupportContact = {
  email: "support@bloom.example",
  phone: null,
  link_url: null,
  link_label: null,
  hours: null,
};

export function useSupportContact() {
  const [contact, setContact] = useState<SupportContact>(SUPPORT_CONTACT_FALLBACK);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("support_contact")
      .select("email,phone,link_url,link_label,hours")
      .maybeSingle();
    if (data) setContact(data as SupportContact);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  return { contact, setContact, loading, reload: load };
}
