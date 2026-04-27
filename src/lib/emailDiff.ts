// Lightweight line-level diff utilities for the email preview.
// - htmlToText: strip HTML to a plain-text approximation suitable for diffing
//   against the explicit plain-text template.
// - diffLines: classic LCS line diff returning aligned rows for side-by-side
//   rendering. Each row has optional left/right line and a status:
//     "equal"    — same on both sides
//     "changed"  — both sides have a line, but content differs
//     "added"    — only on the right (plain text has it, HTML doesn't)
//     "removed"  — only on the left  (HTML has it, plain text doesn't)

export type DiffStatus = "equal" | "changed" | "added" | "removed";

export type DiffRow = {
  left?: { lineNo: number; text: string };
  right?: { lineNo: number; text: string };
  status: DiffStatus;
};

export function htmlToText(html: string): string {
  // Drop scripts/styles/heads, then convert block-ish tags to newlines and
  // strip remaining tags. Decode a few common entities. This isn't a full
  // HTML→text engine but is good enough to surface meaningful differences
  // between the rendered email and its plain-text alternate part.
  let s = html
    .replace(/<!doctype[^>]*>/gi, "")
    .replace(/<head[\s\S]*?<\/head>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<\/(p|div|section|article|header|footer|li|tr|h[1-6]|table|thead|tbody)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // Collapse excess whitespace per line, trim, drop blank runs.
  return s
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .filter((l, i, arr) => !(l === "" && arr[i - 1] === ""))
    .join("\n")
    .trim();
}

export function diffLines(leftText: string, rightText: string): DiffRow[] {
  const a = leftText.split("\n");
  const b = rightText.split("\n");
  const n = a.length;
  const m = b.length;

  // LCS table
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const rows: DiffRow[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      rows.push({
        left: { lineNo: i + 1, text: a[i] },
        right: { lineNo: j + 1, text: b[j] },
        status: "equal",
      });
      i++; j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      // line only on left → either removed, or paired with an upcoming add as "changed"
      rows.push({ left: { lineNo: i + 1, text: a[i] }, status: "removed" });
      i++;
    } else {
      rows.push({ right: { lineNo: j + 1, text: b[j] }, status: "added" });
      j++;
    }
  }
  while (i < n) { rows.push({ left: { lineNo: i + 1, text: a[i] }, status: "removed" }); i++; }
  while (j < m) { rows.push({ right: { lineNo: j + 1, text: b[j] }, status: "added" }); j++; }

  // Coalesce adjacent removed+added pairs into "changed" rows so the side-by-side
  // view aligns the lines that drifted, instead of stacking them as separate rows.
  const merged: DiffRow[] = [];
  for (let k = 0; k < rows.length; k++) {
    const cur = rows[k];
    const next = rows[k + 1];
    if (cur.status === "removed" && next && next.status === "added") {
      merged.push({ left: cur.left, right: next.right, status: "changed" });
      k++; // skip next
    } else if (cur.status === "added" && next && next.status === "removed") {
      merged.push({ left: next.left, right: cur.right, status: "changed" });
      k++;
    } else {
      merged.push(cur);
    }
  }
  return merged;
}

export function diffSummary(rows: DiffRow[]) {
  let equal = 0, changed = 0, added = 0, removed = 0;
  for (const r of rows) {
    if (r.status === "equal") equal++;
    else if (r.status === "changed") changed++;
    else if (r.status === "added") added++;
    else if (r.status === "removed") removed++;
  }
  return { equal, changed, added, removed, total: rows.length };
}
