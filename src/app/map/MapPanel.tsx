"use client";

import dynamic from "next/dynamic";
import type { MapZone } from "@/components/BeachMap";

// Leaflet needs the DOM — load the map only on the client.
const BeachMap = dynamic(() => import("@/components/BeachMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[70vh] items-center justify-center rounded-xl border bg-white text-sm text-gray-400">
      Loading map…
    </div>
  ),
});

export function MapPanel({ zones }: { zones: MapZone[] }) {
  return <BeachMap zones={zones} />;
}
