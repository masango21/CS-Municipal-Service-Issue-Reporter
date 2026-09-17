"use client";

import { useMemo, useState } from "react";
import { southAfricanLocations } from "@/data/southAfricanLocations";
import type { IssueLocation } from "@/types/issue";

type LocationPickerProps = {
  value?: IssueLocation | null;
  onSelect: (location: IssueLocation) => void;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function LocationPicker({ value, onSelect }: LocationPickerProps) {
  const [selectedLocation, setSelectedLocation] = useState<IssueLocation | null>(value ?? null);

  const cityMarkers = useMemo(() =>
    southAfricanLocations.map((location) => ({
      ...location,
      left: `${((location.longitude - 15) / 18) * 100}%`,
      top: `${((35 + location.latitude) / 13) * 100}%`,
    })),
  [],
  );

  const handleMapClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    const y = clamp((event.clientY - rect.top) / rect.height, 0, 1);

    const latitude = -35 + (1 - y) * 13;
    const longitude = 15 + x * 18;

    const nearestCity = southAfricanLocations.reduce((closest, current) => {
      const closestDistance = Math.hypot(
        closest.latitude - latitude,
        closest.longitude - longitude,
      );
      const currentDistance = Math.hypot(
        current.latitude - latitude,
        current.longitude - longitude,
      );

      return currentDistance < closestDistance ? current : closest;
    }, southAfricanLocations[0]);

    const nextLocation: IssueLocation = {
      latitude: Number(latitude.toFixed(4)),
      longitude: Number(longitude.toFixed(4)),
      city: nearestCity.city,
      municipality: nearestCity.municipality,
      address: `${nearestCity.city} municipal area`,
    };

    setSelectedLocation(nextLocation);
    onSelect(nextLocation);
  };

  const markerLeft = selectedLocation
    ? `${((selectedLocation.longitude - 15) / 18) * 100}%`
    : "50%";
  const markerTop = selectedLocation
    ? `${((35 + selectedLocation.latitude) / 13) * 100}%`
    : "50%";

  return (
    <div className="space-y-4">
      <div
        className="relative h-[380px] w-full overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-sky-100 via-emerald-50 to-emerald-100 shadow-inner"
        onClick={handleMapClick}
        role="button"
        tabIndex={0}
        aria-label="Interactive map for selecting issue location in South Africa"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(16,185,129,0.18),transparent_40%),linear-gradient(135deg,#dbeafe_0%,#ecfeff_35%,#dcfce7_100%)]" />

        <div className="absolute inset-x-5 top-6 text-center text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
          South Africa
        </div>

        {["Pretoria", "Johannesburg", "Cape Town", "Durban"].map((label) => (
          <div
            key={label}
            className="absolute rounded-full border border-white/70 bg-white/70 px-2 py-1 text-[10px] font-medium text-slate-700 shadow-sm"
            style={{
              left: `${(label === "Pretoria" ? 62 : label === "Johannesburg" ? 68 : label === "Cape Town" ? 18 : 75)}%`,
              top: `${(label === "Pretoria" ? 28 : label === "Johannesburg" ? 32 : label === "Cape Town" ? 74 : 55)}%`,
            }}
          >
            {label}
          </div>
        ))}

        {cityMarkers.map((location) => (
          <div
            key={location.city}
            className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-500/80 shadow-sm"
            style={{ left: location.left, top: location.top }}
            title={location.city}
          />
        ))}

        {selectedLocation && (
          <div
            className="absolute z-10 flex h-5 w-5 -translate-x-1/2 -translate-y-full items-center justify-center rounded-full border-2 border-white bg-rose-500 shadow-lg"
            style={{ left: markerLeft, top: markerTop }}
            title="Selected issue location"
          >
            <span className="h-2 w-2 rounded-full bg-white" />
          </div>
        )}
      </div>

      <p className="text-sm text-slate-600">
        Click or tap the map to place the exact issue location. The selected coordinates are saved with the report.
      </p>
    </div>
  );
}
