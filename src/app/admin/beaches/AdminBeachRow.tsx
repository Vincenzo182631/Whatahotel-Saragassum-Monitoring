"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RiskBadge } from "@/components/RiskBadge";
import type { RiskLevel } from "@/lib/risk";

interface Props {
  id: string;
  name: string;
  country: string;
  riskScore: number;
  riskLevel: RiskLevel;
  hotelsConnected: number;
  lastUpdatedLabel: string;
}

/**
 * Editable admin table row (Feature 6). Submits a manual override to
 * PATCH /api/admin/beaches/[id] and refreshes the server component.
 */
export function AdminBeachRow({
  id,
  name,
  country,
  riskScore,
  riskLevel,
  hotelsConnected,
  lastUpdatedLabel,
}: Props) {
  const router = useRouter();
  const [score, setScore] = useState(riskScore);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/beaches/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          riskScore: score,
          notes: notes || undefined,
          source: "Manual override",
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Update failed.");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed.");
    } finally {
      setSaving(false);
    }
  }

  const dirty = score !== riskScore || notes.trim().length > 0;

  return (
    <tr className="border-b last:border-0 align-top">
      <td className="px-4 py-3">
        <div className="font-medium text-gray-900">{name}</div>
        <div className="text-xs text-gray-400">{country}</div>
      </td>
      <td className="px-4 py-3">
        <RiskBadge level={riskLevel} score={riskScore} size="sm" />
      </td>
      <td className="px-4 py-3 text-gray-700">{hotelsConnected}</td>
      <td className="px-4 py-3 text-gray-500">{lastUpdatedLabel}</td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={100}
              value={score}
              onChange={(e) => setScore(Number(e.target.value))}
              className="w-32"
            />
            <input
              type="number"
              min={0}
              max={100}
              value={score}
              onChange={(e) => setScore(Number(e.target.value))}
              className="w-16 rounded border px-2 py-1 text-sm"
            />
          </div>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Note (optional)"
            className="w-56 rounded border px-2 py-1 text-xs"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={save}
              disabled={!dirty || saving}
              className="rounded bg-sky-600 px-3 py-1 text-xs font-medium text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? "Saving…" : "Save override"}
            </button>
            {error && <span className="text-xs text-red-600">{error}</span>}
          </div>
        </div>
      </td>
    </tr>
  );
}
