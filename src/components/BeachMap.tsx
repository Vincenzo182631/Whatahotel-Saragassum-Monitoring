"use client";

import { MapContainer, TileLayer, CircleMarker, Tooltip, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { tierMetaFromScore } from "@/lib/levels";
import { relativeTime } from "@/lib/risk";

export interface MapZone {
  id: string;
  name: string;
  country: string;
  region: string | null;
  latitude: number;
  longitude: number;
  riskScore: number;
  lastUpdated: string;
}

/**
 * Interactive sargassum map — each monitored beach/zone is a color-coded marker
 * on the 4-tier scale (Clear / Light / Moderate / Heavy). Client-only (Leaflet
 * needs the DOM), rendered via a dynamic ssr:false import.
 */
export default function BeachMap({ zones }: { zones: MapZone[] }) {
  return (
    <MapContainer
      center={[20.5, -84]}
      zoom={5}
      scrollWheelZoom
      style={{ height: "70vh", width: "100%", borderRadius: "0.75rem" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {zones.map((z) => {
        const m = tierMetaFromScore(z.riskScore);
        return (
          <CircleMarker
            key={z.id}
            center={[z.latitude, z.longitude]}
            radius={9}
            pathOptions={{ color: "#ffffff", weight: 1.5, fillColor: m.hex, fillOpacity: 0.9 }}
          >
            <Tooltip direction="top" offset={[0, -6]}>
              <strong>{z.name}</strong> — {m.emoji} {m.label} ({z.riskScore}/100)
            </Tooltip>
            <Popup>
              <div style={{ minWidth: 180 }}>
                <div style={{ fontWeight: 600 }}>{z.name}</div>
                <div style={{ fontSize: 12, color: "#666" }}>
                  {z.region ? `${z.region}, ` : ""}
                  {z.country}
                </div>
                <div style={{ marginTop: 6 }}>
                  {m.emoji} <strong>{m.label}</strong> — {z.riskScore}/100
                </div>
                <div style={{ fontSize: 12, marginTop: 4 }}>{m.description}</div>
                <div style={{ fontSize: 11, color: "#999", marginTop: 4 }}>
                  Updated {relativeTime(z.lastUpdated)}
                </div>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
