"use client";

import { useState } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { issueCategories } from "@/data/issueCategories";

const southAfricaCenter = [-30.5595, 22.9375] as [number, number];
const southAfricaBounds: [[number, number], [number, number]] = [
  [-35.0, 16.0],
  [-22.0, 33.0],
];

const categoryColors: Record<string, string> = {
  Pothole: "#f97316",
  "Water Leak": "#0ea5e9",
  "Burst Pipe": "#0284c7",
  "Broken Streetlight": "#facc15",
  "Damaged Road": "#8b5cf6",
  "Illegal Dumping": "#22c55e",
  "Blocked Drain": "#14b8a6",
  "Sewer Problem": "#2dd4bf",
  "Traffic Signal Problem": "#f59e0b",
  "Electrical Infrastructure": "#ef4444",
  "Other Municipal Issue": "#94a3b8",
};

type LocationData = {
  latitude: number;
  longitude: number;
  city?: string;
  municipality?: string;
  address?: string;
};

type MapIssue = {
  id: string;
  title: string;
  category: string;
  location: LocationData;
};

type MapViewProps = {
  selectedLocation?: LocationData | null;
  selectedCategory?: string;
  issues?: MapIssue[];
  heightClass?: string;
  onSelectLocation?: (location: LocationData) => void;
  onSelectIssue?: (issue: MapIssue) => void;
};

function buildCategoryIcon(category: string, isSelected = false) {
  const color = isSelected ? (categoryColors[category] ?? "#ef4444") : categoryColors[category] ?? "#10b981";

  return L.divIcon({
    className: "custom-map-marker",
    html: `
      <div style="
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: ${color};
        border: 2px solid white;
        box-shadow: 0 6px 18px rgba(15, 23, 42, 0.35);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 10px;
        font-weight: 800;
      ">${category ? category.charAt(0).toUpperCase() : "•"}</div>
    `,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -12],
  });
}

function MapClickHandler({ onSelectLocation }: { onSelectLocation?: MapViewProps["onSelectLocation"] }) {
  useMapEvents({
    click(event) {
      if (!onSelectLocation) return;

      const location = {
        latitude: Number(event.latlng.lat.toFixed(6)),
        longitude: Number(event.latlng.lng.toFixed(6)),
        city: "South Africa",
        municipality: "South Africa",
        address: "Selected location",
      };

      onSelectLocation(location);
    },
  });

  return null;
}

function MapCenterController({
  target,
}: {
  target?: { latitude: number; longitude: number } | null;
}) {
  const map = useMap();

  if (target) {
    map.setView([target.latitude, target.longitude], 14, { animate: true });
  }

  return null;
}

export function MapView({
  selectedLocation,
  selectedCategory,
  issues = [],
  heightClass = "h-[380px]",
  onSelectLocation,
  onSelectIssue,
}: MapViewProps) {
  const [searchText, setSearchText] = useState("");
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [searchError, setSearchError] = useState("");

  const handleSearch = async () => {
    const query = searchText.trim();
    if (!query) {
      setSearchError("Please enter a location to search.");
      return;
    }

    setSearchError("");

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(query + ", South Africa")}`,
      );
      const results = await response.json();

      if (!Array.isArray(results) || results.length === 0) {
        setSearchError("No matching South African location found.");
        return;
      }

      const place = results[0];
      const latitude = Number(place.lat);
      const longitude = Number(place.lon);

      setCurrentLocation({ latitude, longitude });

      if (onSelectLocation) {
        onSelectLocation({
          latitude,
          longitude,
          city: place.display_name || "South Africa",
          municipality: "South Africa",
          address: place.display_name || "Searched location",
        });
      }
    } catch (error) {
      setSearchError("Search failed. Please try again.");
    }
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setSearchError("Geolocation is not supported in this browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };

        setCurrentLocation(nextLocation);
        if (onSelectLocation) {
          onSelectLocation({
            ...nextLocation,
            city: "My Location",
            municipality: "My Location",
            address: "Current device location",
          });
        }
        setSearchError("");
      },
      () => {
        setSearchError("Unable to access your current location. Please try again.");
      },
    );
  };

  return (
    <div className="space-y-3">
      <div className={`${heightClass} w-full overflow-hidden rounded-2xl border border-slate-200`}>
        <MapContainer
          center={southAfricaCenter}
          zoom={6}
          minZoom={5}
          maxZoom={18}
          maxBounds={southAfricaBounds}
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapClickHandler onSelectLocation={onSelectLocation} />
          <MapCenterController target={currentLocation ?? selectedLocation ?? null} />

          {issues.map((issue) => (
            <Marker
              key={issue.id}
              position={[issue.location.latitude, issue.location.longitude]}
              icon={buildCategoryIcon(issue.category)}
              eventHandlers={{
                click: () => onSelectIssue?.(issue),
              }}
            >
              <Popup>
                <div className="space-y-2 text-sm text-slate-700">
                  <div className="font-bold text-slate-900">{issue.title}</div>
                  <div>{issue.category}</div>
                  <div>{issue.location.city || "South Africa"}</div>
                </div>
              </Popup>
            </Marker>
          ))}

          {selectedLocation && (
            <Marker
              position={[selectedLocation.latitude, selectedLocation.longitude]}
              icon={buildCategoryIcon(selectedCategory ?? "Selected", true)}
            >
              <Popup>
                <div className="space-y-1 text-sm">
                  <div className="font-bold">Selected location</div>
                  <div>{selectedLocation.city || "South Africa"}</div>
                  <div>{selectedLocation.address || "Exact issue point"}</div>
                </div>
              </Popup>
            </Marker>
          )}
        </MapContainer>
      </div>

      <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Search for a place in South Africa"
            className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500"
          />
          <button
            type="button"
            onClick={handleSearch}
            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
          >
            Search
          </button>
          <button
            type="button"
            onClick={handleUseMyLocation}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-emerald-200 hover:text-emerald-700"
          >
            Use My Location
          </button>
        </div>

        {searchError && (
          <p className="text-sm font-medium text-rose-600">{searchError}</p>
        )}

        <div className="rounded-xl border border-slate-200 bg-white p-2">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Issue categories</p>
          <div className="flex flex-wrap gap-2">
            {issueCategories.map((category) => (
              <div
                key={category}
                className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-medium text-slate-700"
              >
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: categoryColors[category] ?? "#10b981" }}
                />
                {category}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
