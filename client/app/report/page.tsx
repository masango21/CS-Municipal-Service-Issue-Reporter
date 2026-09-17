"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { issueCategories } from "@/data/issueCategories";
import { LocationPicker } from "@/components/LocationPicker";
import { useReports } from "@/context/ReportsContext";
import type { IssueDraft, IssueLocation, IssuePriority } from "@/types/issue";

const priorities: IssuePriority[] = ["Low", "Medium", "High", "Critical"];

export default function ReportIssuePage() {
  const router = useRouter();
  const { addReport } = useReports();

  const [category, setCategory] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [city, setCity] = useState("Pretoria");
  const [address, setAddress] = useState("");
  const [priority, setPriority] = useState<IssuePriority>("High");
  const [image, setImage] = useState("");
  const [selectedLocation, setSelectedLocation] = useState<IssueLocation | null>(null);
  const [error, setError] = useState("");

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!category || !title.trim() || !description.trim() || !city.trim() || !selectedLocation) {
      setError("Please complete all required fields and select the exact location of the issue on the map.");
      return;
    }

    const draft: IssueDraft = {
      title: title.trim(),
      category,
      description: description.trim(),
      location: {
        ...selectedLocation,
        address: address.trim() || selectedLocation.address || `${city}, South Africa`,
        city,
        municipality: selectedLocation.municipality ?? city,
      },
      priority,
      reportedBy: "Resident User",
      image: image || undefined,
    };

    const newReport = addReport(draft);
    setError("");
    router.push(`/issues/${newReport.id}`);
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">Resident reporting</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Report an issue</h1>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <label htmlFor="category" className="mb-2 block text-sm font-medium text-slate-700">
                Select Issue Category
              </label>
              <select
                id="category"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white"
              >
                <option value="">Choose a category</option>
                {issueCategories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="title" className="mb-2 block text-sm font-medium text-slate-700">
                Issue Title
              </label>
              <input
                id="title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Large pothole near the intersection"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white"
              />
            </div>

            <div>
              <label htmlFor="description" className="mb-2 block text-sm font-medium text-slate-700">
                Describe the problem
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={5}
                placeholder="Detail the issue, its size, urgency, and impact on residents or road users."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white"
              />
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label htmlFor="city" className="mb-2 block text-sm font-medium text-slate-700">
                  City / Municipality
                </label>
                <input
                  id="city"
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white"
                />
              </div>

              <div>
                <label htmlFor="address" className="mb-2 block text-sm font-medium text-slate-700">
                  Address / Area
                </label>
                <input
                  id="address"
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  placeholder="Street or landmark"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label htmlFor="priority" className="mb-2 block text-sm font-medium text-slate-700">
                Priority
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
                Evidence Photo
              </label>
              <input
                id="photo"
                type="url"
                value={image}
                onChange={(event) => setImage(event.target.value)}
                placeholder="Paste an image URL or leave blank"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white"
              />
            </div>

            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white transition hover:bg-emerald-700"
            >
              Submit Report
            </button>
          </div>

          <div className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Select the exact issue location</h2>
              <p className="mt-2 text-sm text-slate-600">The resident must pin the exact problem location on the map before submitting.</p>
            </div>

            <LocationPicker value={selectedLocation} onSelect={setSelectedLocation} />

            {selectedLocation && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-sm font-semibold text-emerald-700">Location Selected ✓</p>
                <p className="mt-2 text-sm text-slate-700">
                  Latitude: {selectedLocation.latitude.toFixed(4)}
                </p>
                <p className="text-sm text-slate-700">
                  Longitude: {selectedLocation.longitude.toFixed(4)}
                </p>
              </div>
            )}
          </div>
        </form>
      </div>
    </main>
  );
}
