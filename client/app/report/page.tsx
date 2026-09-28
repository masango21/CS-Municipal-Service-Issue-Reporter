"use client";

import dynamic from "next/dynamic";
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

export default function ReportIssuePage() {
  const router = useRouter();
  const { residentUser, adminUser, isAuthReady } = useAuth();
  const { addReport } = useReports();
  const { t } = useLanguage();

  const [category, setCategory] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [city, setCity] = useState("Pretoria");
  const [municipality, setMunicipality] = useState("City of Tshwane");
  const [address, setAddress] = useState("");
  const [priority, setPriority] = useState<IssuePriority>("High");
  const [image, setImage] = useState("");
  const [imageName, setImageName] = useState("");
  const [selectedLocation, setSelectedLocation] = useState<IssueLocation | null>(null);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isAuthReady || residentUser) return;
    router.replace(adminUser ? "/admin/dashboard" : "/login?next=/report");
  }, [adminUser, isAuthReady, residentUser, router]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      setImage("");
      setImageName("");
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
    setCategory("");
    setError("");
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isAuthReady || !residentUser) {
      router.replace(adminUser ? "/admin/dashboard" : "/login?next=/report");
      return;
    }

    if (!category || !title.trim() || !description.trim() || !city.trim() || !municipality.trim() || !selectedLocation) {
      setError(t("reportValidationError"));
      return;
    }

    const draft: IssueDraft = {
      title: title.trim(),
      category,
      description: description.trim(),
      location: {
        ...selectedLocation,
        address: address.trim() || selectedLocation.address || `${city}, South Africa`,
        city: city.trim(),
        municipality: municipality.trim() || selectedLocation.municipality || city.trim(),
      },
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
      setError("Your report could not be opened. Please try again.");
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

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label htmlFor="city" className="mb-2 block text-sm font-medium text-slate-700">
                  {t("cityLabel")}
                </label>
                <input
                  id="city"
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white"
                />
              </div>

              <div>
                <label htmlFor="municipality" className="mb-2 block text-sm font-medium text-slate-700">
                  {t("municipalityLabel")}
                </label>
                <input
                  id="municipality"
                  value={municipality}
                  onChange={(event) => setMunicipality(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label htmlFor="address" className="mb-2 block text-sm font-medium text-slate-700">
                {t("addressLabel")}
              </label>
              <input
                id="address"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder={t("addressPlaceholder")}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white"
              />
            </div>

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
                  accept="image/*"
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
                    <img src={image} alt="Issue evidence preview" className="h-48 w-full object-cover" />
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
              disabled={isSubmitting}
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
              onSelect={setSelectedLocation}
            />

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
