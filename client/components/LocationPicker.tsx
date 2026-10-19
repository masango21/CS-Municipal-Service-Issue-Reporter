"use client";

import type { IssueLocation } from "@/types/issue";
import { MapView } from "@/components/MapView";

type LocationPickerProps = {
  value?: IssueLocation | null;
  selectedCategory?: string;
  onSelect: (location: IssueLocation) => void;
};

export function LocationPicker({ value, selectedCategory, onSelect }: LocationPickerProps) {
  const handleSelect = (location: {
    latitude: number;
    longitude: number;
  }) => {
    const nextLocation: IssueLocation = {
      latitude: location.latitude,
      longitude: location.longitude,
    };
    onSelect(nextLocation);
  };

  return (
    <div className="space-y-4">
      <MapView
        selectedLocation={value}
        selectedCategory={selectedCategory}
        onSelectLocation={handleSelect}
      />

      <p className="text-sm text-slate-600">
        Click or tap the map to place the exact issue location. The selected coordinates are saved with the report.
      </p>
    </div>
  );
}
