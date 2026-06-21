import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Bot, Send, X, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

const GREETING: Msg = {
  role: "assistant",
  content:
    "Hi! I'm your Rent & Radiate assistant. Ask me anything about renting, buying, deposits, payments or returns.",
};

export function SupportChat() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([GREETING]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, open]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    const next: Msg[] = [...msgs, { role: "user", content: trimmed }];
    setMsgs([...next, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token ?? ANON;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/support-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: ANON,
        },
        body: JSON.stringify({ messages: next }),
      });
      if (!res.ok || !res.body) {
        const txt = await res.text().catch(() => "");
        setMsgs((m) => {
          const copy = [...m];
          copy[copy.length - 1] = {
            role: "assistant",
            content:
              res.status === 429
                ? "I'm getting a lot of questions right now — please try again in a minute."
                : res.status === 402
                ? "AI credits are exhausted. Please contact the platform admin."
                : `Sorry, something went wrong. ${txt.slice(0, 120)}`,
          };
          return copy;
        });
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (!data || data === "[DONE]") continue;
          try {
            const json = JSON.parse(data);
            const delta = json?.choices?.[0]?.delta?.content;
            if (delta) {
              acc += delta;
              setMsgs((m) => {
                const copy = [...m];
                copy[copy.length - 1] = { role: "assistant", content: acc };
                return copy;
              });
            }
          } catch {
            /* ignore */
          }
        }
      }
    } catch (e: any) {
      setMsgs((m) => {
        const copy = [...m];
        copy[copy.length - 1] = { role: "assistant", content: `Connection error: ${e?.message ?? "unknown"}` };
        return copy;
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label={open ? "Close support chat" : "Open support chat"}
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-5 right-5 z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-petal flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
      >
        {open ? <X className="h-6 w-6" /> : <Bot className="h-6 w-6" />}
      </button>

      <div
        className={cn(
          "fixed bottom-24 right-5 z-50 w-[92vw] max-w-sm rounded-2xl border border-border bg-card shadow-petal flex flex-col overflow-hidden transition-all origin-bottom-right",
          open ? "opacity-100 scale-100 pointer-events-auto" : "opacity-0 scale-95 pointer-events-none",
        )}
        style={{ height: "min(560px, 75vh)" }}
        role="dialog"
        aria-label="Support chat"
      >
        <div className="px-4 py-3 border-b border-border flex items-center gap-2 bg-gradient-to-r from-blossom to-petal">
          <div className="h-8 w-8 rounded-full bg-background/80 flex items-center justify-center text-rose-deep">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-medium text-rose-deep">Rent & Radiate Assistant</div>
            <div className="text-[11px] text-rose-deep/70">Online · replies instantly</div>
          </div>
        </div>

        <div ref={bodyRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-background">
          {msgs.map((m, i) => (
            <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap leading-relaxed",
                  m.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-muted text-foreground rounded-bl-sm",
                )}
              >
                {m.content || (busy && i === msgs.length - 1 ? "…" : "")}
              </div>
            </div>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
          className="border-t border-border p-2 flex items-center gap-2 bg-card"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about rentals, deposits, returns…"
            className="flex-1 bg-transparent outline-none text-sm px-2 py-2"
            disabled={busy}
            aria-label="Message"
          />
          <Button type="submit" size="icon" variant="hero" disabled={busy || !input.trim()} aria-label="Send">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </>
  );
}
