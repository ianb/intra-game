/**
 * What the game has spent, and on what.
 *
 * A single total says the game is expensive; the breakdown says it is expensive
 * because the character prompts carry the history and are never cached. So this
 * shows per-prompt-type rows, and offers the records as CSV, since "how does
 * cost grow as the game goes on" is a spreadsheet question.
 */

import { useEffect } from "react";
import { Button } from "@/components/input";
import { clearUsage, usageLog } from "@/lib/llm";
import { byPromptType, toCsv, totals } from "@/lib/usage";
import type { UsageRecordType } from "@/lib/usage";
import { fetchServerUsage, remoteSession } from "./session";
import { useSignal } from "@preact/signals-react";
import { useSignals } from "@preact/signals-react/runtime";

function money(cost: number): string {
  if (!cost) {
    return "—";
  }
  return cost < 0.01 ? `$${cost.toFixed(4)}` : `$${cost.toFixed(2)}`;
}

function download(records: UsageRecordType[]): void {
  const blob = new Blob([toCsv(records)], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "intra-usage.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export function Costs() {
  useSignals();
  const session = remoteSession.value;
  const remote = useSignal<UsageRecordType[] | null>(null);
  const error = useSignal("");
  useEffect(() => {
    if (!session) {
      return;
    }
    // Server play keeps its records with the session, not in this tab: the
    // point of a server session is that it outlives the browser holding it.
    fetchServerUsage(session).then(
      (records) => (remote.value = records),
      (e) => (error.value = String(e)),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const records = session ? (remote.value ?? []) : usageLog.value;
  const sum = totals(records);
  const perType = Object.entries(byPromptType(records)).sort(
    (a, b) => b[1].promptTokens - a[1].promptTokens,
  );

  return (
    <div className="mt-4">
      <div className="mb-1">
        Model usage {session ? "(this server game)" : "(this tab)"}
      </div>
      {error.value && <div className="text-sm text-red-300">{error.value}</div>}
      {!records.length && (
        <div className="text-sm text-gray-300">
          Nothing recorded yet. Records appear as turns are played.
        </div>
      )}
      {records.length > 0 && (
        <>
          <div className="text-sm">
            {sum.calls} calls · {sum.promptTokens.toLocaleString()} in (
            {sum.cachedTokens.toLocaleString()} cached) ·{" "}
            {sum.completionTokens.toLocaleString()} out · {money(sum.cost)}
            {sum.errors > 0 && ` · ${sum.errors} failed`}
          </div>
          {sum.cachedTokens === 0 && (
            <div className="text-xs text-amber-300 mt-1">
              No cached tokens. Nothing requests prompt caching yet — see
              TODO.md.
            </div>
          )}
          <table className="text-xs mt-2 w-full">
            <thead className="text-gray-400">
              <tr>
                <th className="text-left">prompt</th>
                <th className="text-right">calls</th>
                <th className="text-right">in</th>
                <th className="text-right">cached</th>
                <th className="text-right">out</th>
                <th className="text-right">cost</th>
              </tr>
            </thead>
            <tbody>
              {perType.map(([type, group]) => (
                <tr key={type}>
                  <td>{type}</td>
                  <td className="text-right">{group.calls}</td>
                  <td className="text-right">
                    {group.promptTokens.toLocaleString()}
                  </td>
                  <td className="text-right">
                    {group.cachedTokens.toLocaleString()}
                  </td>
                  <td className="text-right">
                    {group.completionTokens.toLocaleString()}
                  </td>
                  <td className="text-right">{money(group.cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2">
            <Button className="text-sm mr-1" onClick={() => download(records)}>
              Download CSV
            </Button>
            {!session && (
              <Button className="text-sm" onClick={clearUsage}>
                Clear
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
