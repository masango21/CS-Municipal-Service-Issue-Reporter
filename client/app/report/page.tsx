"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { issueCategories } from "@/data/issueCategories";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useReports } from "@/context/ReportsContext";
import type { IssueDraft, IssueLocation, IssuePriority } from "@/types/issue";

const LocationPicker = dynamic(
  () => import("@/components/LocationPicker").then((module) => module.LocationPicker),
  { ssr: false },
);

const priorities: IssuePriority[] = ["Low", "Medium", "High", "Critical"];
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export default function ReportIssuePage() {
  const router = useRouter();
  const { residentUser, adminUser, isAuthReady } = useAuth();
  const { addReport } = useReports();
  const { t } = useLanguage();

  const [category, setCategory] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<IssuePriority>("High");
  const [image, setImage] = useState("");
  const [imageName, setImageName] = useState("");
  const [selectedLocation, setSelectedLocation] = useState<IssueLocation | null>(null);
  const [locationStatus, setLocationStatus] = useState<"idle" | "loading" | "resolved" | "error">("idle");
  const [locationError, setLocationError] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isAuthReady || residentUser) return;
    router.replace(adminUser ? "/admin/dashboard" : "/login?next=/report");
  }, [adminUser, isAuthReady, residentUser, router]);

  useEffect(() => {
    const latitude = selectedLocation?.latitude;
    const longitude = selectedLocation?.longitude;
    if (latitude === undefined || longitude === undefined) return;

    const controller = new AbortController();
    let active = true;

    void fetch(`${API_BASE_URL}/api/location/resolve`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ latitude, longitude }),
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json() as { location?: IssueLocation; message?: string };
        if (!response.ok || !payload.location?.municipalityId) {
          throw new Error(payload.message ?? "We couldn't determine the municipality for this location. Please move the pin and try again.");
        }
        if (!active) return;
        setSelectedLocation(payload.location);
        setLocationStatus("resolved");
      })
      .catch((lookupError: unknown) => {
        if (!active || (lookupError instanceof DOMException && lookupError.name === "AbortError")) return;
        setLocationStatus("error");
        setLocationError(lookupError instanceof Error ? lookupError.message : "Location could not be determined.");
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [selectedLocation?.latitude, selectedLocation?.longitude]);

  const handleLocationChange = (location: IssueLocation) => {
    setLocationStatus("loading");
    setLocationError("");
    setSelectedLocation({ latitude: location.latitude, longitude: location.longitude });
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setError("");

    if (!file) {
      setImage("");
      setImageName("");
      return;
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type) || file.size > 3 * 1024 * 1024) {
      setImage("");
      setImageName("");
      event.target.value = "";
      setError("Choose a JPEG, PNG, or WebP image no larger than 3 MB.");
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      setImage(typeof reader.result === "string" ? reader.result : "");
      setImageName(file.name);
    };

    reader.readAsDataURL(file);
  };

  const handleResetSelection = () => {
    setSelectedLocation(null);
    setLocationStatus("idle");
    setLocationError("");
    setCategory("");
    setError("");
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isAuthReady || !residentUser) {
      router.replace(adminUser ? "/admin/dashboard" : "/login?next=/report");
      return;
    }

    if (!category || !title.trim() || !description.trim() || !selectedLocation?.municipalityId || locationStatus !== "resolved") {
      setError(t("reportValidationError"));
      return;
    }

    const draft: IssueDraft = {
      title: title.trim(),
      category,
      description: description.trim(),
      location: selectedLocation,
      priority,
      reportedBy: residentUser.name,
      image: image || undefined,
    };

    setError("");
    setIsSubmitting(true);
    try {
      const newReport = await addReport(draft);
      router.push(`/issues/${newReport.id}`);
    } catch {
      setError("Your report could not be saved. Check your connection and try again.");
      setIsSubmitting(false);
    }
  };

  if (!isAuthReady || !residentUser) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center bg-slate-50 px-4" aria-busy="true">
        <p role="status" className="text-sm font-medium text-slate-600">Checking resident access...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">{t("residentReporting")}</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">{t("reportIssueHeading")}</h1>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <label htmlFor="title" className="mb-2 block text-sm font-medium text-slate-700">
                {t("issueTitleLabel")}
              </label>
              <input
                id="title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={t("issueTitlePlaceholder")}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white"
              />
            </div>

            <div>
              <label htmlFor="description" className="mb-2 block text-sm font-medium text-slate-700">
                {t("descriptionLabel")}
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={5}
                placeholder={t("descriptionPlaceholder")}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white"
              />
            </div>

            <section aria-label="Detected location" className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">{t("addressLabel")}</p>
                <p className="mt-1 text-sm text-slate-800">
                  {locationStatus === "loading" ? "Finding address..." : selectedLocation?.address || "Select a point on the map"}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">{t("municipalityLabel")}</p>
                <p className="mt-1 text-sm text-slate-800">
                  {locationStatus === "loading" ? "Determining municipality..." : selectedLocation?.municipality || "Not determined"}
                </p>
              </div>
              {locationStatus === "error" && <p role="alert" className="text-sm text-rose-700">{locationError}</p>}
              {locationStatus === "resolved" && !selectedLocation?.address && (
                <p role="status" className="text-sm text-amber-800">Address could not be detected. The selected coordinates and municipality are confirmed.</p>
              )}
              {selectedLocation?.geocodingAttribution && (
                <p className="text-xs text-slate-500">{selectedLocation.geocodingAttribution}</p>
              )}
            </section>

            <div>
              <label htmlFor="priority" className="mb-2 block text-sm font-medium text-slate-700">
                {t("priorityLabel")}
              </label>
              <select
                id="priority"
                value={priority}
                onChange={(event) => setPriority(event.target.value as IssuePriority)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white"
              >
                {priorities.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="photo" className="mb-2 block text-sm font-medium text-slate-700">
                {t("evidencePhotoLabel")}
              </label>
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
                <input
                  id="photo"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileUpload}
                  className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-full file:border-0 file:bg-emerald-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-emerald-700"
                />
                <p className="mt-3 text-xs text-slate-500">
                  {t("evidencePhotoHelp")}
                </p>
                {imageName && (
                  <p className="mt-3 text-sm font-medium text-emerald-700">{t("selectedFile")} {imageName}</p>
                )}
                {image && (
                  <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <Image src={image} alt="Issue evidence preview" width={800} height={400} unoptimized className="h-48 w-full object-cover" />
                  </div>
                )}
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                {error}
              </div>
            )}

            <button
              disabled={isSubmitting || locationStatus !== "resolved" || !selectedLocation?.municipalityId}
              type="submit"
              className="w-full rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60"
            >
              {isSubmitting ? "Submitting report..." : t("submitReport")}
            </button>
          </div>

          <div className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <h2 className="text-xl font-bold text-slate-900">{t("selectLocationTitle")}</h2>
              <p className="mt-2 text-sm text-slate-600">{t("selectLocationHint")}</p>
            </div>

            <LocationPicker
              value={selectedLocation}
              selectedCategory={category}
              onSelect={handleLocationChange}
            />
            <p className="text-xs leading-5 text-slate-500">
              Municipality boundaries are checked against MDB data. Address lookup uses the configured geocoding service; selected coordinates are sent to that service. © OpenStreetMap contributors.
            </p>

            {selectedLocation ? (
              <div className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-800">{t("choosePinCategory")}</p>
                    {category && (
                      <span className="rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white">
                        {category}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {issueCategories.map((item) => {
                      const isSelected = category === item;

                      return (
                        <button
                          key={item}
                          type="button"
                          onClick={() => setCategory(item)}
                          aria-pressed={isSelected}
                          className={[
                            "rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition",
                            isSelected
                              ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
                              : "border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:text-emerald-700",
                          ].join(" ")}
                        >
                          {item}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-xl border border-emerald-200 bg-white p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-emerald-700">{t("locationSelected")} ✓</p>
                    <button
                      type="button"
                      onClick={handleResetSelection}
                      className="text-xs font-semibold text-emerald-700 underline decoration-emerald-300 underline-offset-2 transition hover:text-emerald-800"
                    >
                      {t("reset")}
                    </button>
                  </div>
                  <p className="mt-2 text-sm text-slate-700">
                    {t("latitude")}: {selectedLocation.latitude.toFixed(4)}
                  </p>
                  <p className="text-sm text-slate-700">
                    {t("longitude")}: {selectedLocation.longitude.toFixed(4)}
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                {t("selectMapHint")}
              </div>
            )}
          </div>
        </form>
      </div>
    </main>
  );
}
