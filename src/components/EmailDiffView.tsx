import { useMemo } from "react";
import { diffLines, diffSummary, htmlToText, type DiffRow } from "@/lib/emailDiff";
import { cn } from "@/lib/utils";

const sideClass = (status: DiffRow["status"], side: "left" | "right") => {
  if (status === "equal") return "bg-transparent";
  if (status === "changed") return side === "left" ? "bg-amber-500/10" : "bg-amber-500/15";
  if (status === "removed") return side === "left" ? "bg-rose-500/10" : "bg-muted/30";
  if (status === "added") return side === "left" ? "bg-muted/30" : "bg-emerald-500/10";
  return "";
};

const markerFor = (status: DiffRow["status"], side: "left" | "right") => {
  if (status === "equal") return " ";
  if (status === "changed") return "~";
  if (status === "removed") return side === "left" ? "−" : " ";
  if (status === "added")   return side === "right" ? "+" : " ";
  return " ";
};

export function EmailDiffView({ html, text }: { html: string; text: string }) {
  const { rows, summary, leftText, rightText } = useMemo(() => {
    const leftText = htmlToText(html);
    const rightText = text.trim();
    const rows = diffLines(leftText, rightText);
    return { rows, summary: diffSummary(rows), leftText, rightText };
  }, [html, text]);

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      {/* Summary header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-secondary/40 px-3 py-2 text-[11px]">
        <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
          <span>
            <span className="font-medium text-foreground">{summary.total}</span> lines compared
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-amber-500/60" /> {summary.changed} changed
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-rose-500/60" /> {summary.removed} HTML-only
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-emerald-500/60" /> {summary.added} text-only
          </span>
        </div>
        <div className="text-muted-foreground">
          {summary.changed + summary.added + summary.removed === 0
            ? "✓ HTML and plain text are equivalent"
            : "Highlighted lines differ between the HTML and plain-text parts"}
        </div>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-2 text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
        <div className="px-3 py-1.5 border-r border-border bg-muted/20">HTML (rendered to text)</div>
        <div className="px-3 py-1.5 bg-muted/20">Plain-text alternate</div>
      </div>

      {/* Diff body */}
      <div className="grid grid-cols-2 max-h-[380px] overflow-auto font-mono text-[11px] leading-relaxed">
        {rows.length === 0 ? (
          <div className="col-span-2 p-4 text-muted-foreground text-center">No content to compare.</div>
        ) : (
          rows.map((r, idx) => (
            <DiffRowView key={idx} row={r} />
          ))
        )}
      </div>

      {/* Empty-state hint when both sides are blank */}
      {leftText === "" && rightText === "" && (
        <div className="px-3 py-2 text-[11px] text-muted-foreground border-t border-border">
          Both versions are empty.
        </div>
      )}
    </div>
  );
}

function DiffRowView({ row }: { row: DiffRow }) {
  const left = row.left;
  const right = row.right;
  return (
    <>
      <div
        className={cn(
          "px-3 py-1 border-r border-border/60 whitespace-pre-wrap break-words",
          sideClass(row.status, "left"),
        )}
      >
        <span className="select-none text-muted-foreground/60 mr-2 inline-block w-6 text-right">
          {left?.lineNo ?? ""}
        </span>
        <span className="select-none text-muted-foreground/80 mr-1">{markerFor(row.status, "left")}</span>
        <span>{left?.text ?? ""}</span>
      </div>
      <div
        className={cn(
          "px-3 py-1 whitespace-pre-wrap break-words",
          sideClass(row.status, "right"),
        )}
      >
        <span className="select-none text-muted-foreground/60 mr-2 inline-block w-6 text-right">
          {right?.lineNo ?? ""}
        </span>
        <span className="select-none text-muted-foreground/80 mr-1">{markerFor(row.status, "right")}</span>
        <span>{right?.text ?? ""}</span>
      </div>
    </>
  );
}
