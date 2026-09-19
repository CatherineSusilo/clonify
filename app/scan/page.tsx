"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ROLE_INFO, type RoleKey } from "@/lib/roles";
import { ROLE_SCAN_FIELDS } from "@/lib/scanFields";

export default function ScanPage() {
  const router = useRouter();
  const [role, setRole] = useState<RoleKey | null>(null);
  const [loading, setLoading] = useState(true);
  const [address, setAddress] = useState({ street: "", city: "", state: "", country: "" });
  const [metadata, setMetadata] = useState<Record<string, string>>({});
  const [photos, setPhotos] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/user")
      .then((r) => r.json())
      .then((data) => {
        if (!data.user?.role) {
          router.replace("/onboarding");
          return;
        }
        setRole(data.user.role);
        setLoading(false);
      });
  }, [router]);

  if (loading || !role) {
    return <div className="flex flex-1 items-center justify-center text-zinc-500">Loading...</div>;
  }

  const info = ROLE_INFO[role];
  const fields = ROLE_SCAN_FIELDS[role];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const form = new FormData();
    form.set("street", address.street);
    form.set("city", address.city);
    form.set("state", address.state);
    form.set("country", address.country);
    form.set("metadata", JSON.stringify(metadata));
    photos.forEach((p) => form.append("photos", p));

    try {
      const res = await fetch("/api/scans", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create scan");
      router.push(`/scan/${data.scan.id}/processing`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
      <p className="text-xs font-semibold tracking-widest text-indigo-400 uppercase">
        {info.sdg} · {info.label}
      </p>
      <h1 className="mt-2 text-3xl font-bold">Tell us about the space</h1>

      <form onSubmit={handleSubmit} className="mt-8 space-y-8">
        <fieldset className="space-y-4">
          <legend className="mb-2 text-sm font-semibold text-zinc-300">Location</legend>
          <input
            required
            placeholder="Street Address"
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2.5"
            value={address.street}
            onChange={(e) => setAddress({ ...address, street: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-4">
            <input
              required
              placeholder="City"
              className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2.5"
              value={address.city}
              onChange={(e) => setAddress({ ...address, city: e.target.value })}
            />
            <input
              placeholder="State / ZIP"
              className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2.5"
              value={address.state}
              onChange={(e) => setAddress({ ...address, state: e.target.value })}
            />
          </div>
          <input
            placeholder="Country"
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2.5"
            value={address.country}
            onChange={(e) => setAddress({ ...address, country: e.target.value })}
          />
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="mb-2 text-sm font-semibold text-zinc-300">
            {info.label} details
          </legend>
          {fields.map((field) =>
            field.type === "select" ? (
              <select
                key={field.name}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2.5"
                value={metadata[field.name] ?? ""}
                onChange={(e) => setMetadata({ ...metadata, [field.name]: e.target.value })}
              >
                <option value="" disabled>
                  {field.label}
                </option>
                {field.options?.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            ) : (
              <input
                key={field.name}
                type={field.type}
                placeholder={field.label}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2.5"
                value={metadata[field.name] ?? ""}
                onChange={(e) => setMetadata({ ...metadata, [field.name]: e.target.value })}
              />
            )
          )}
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-zinc-300">
            Multi-angle source photos
          </legend>
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-800 px-6 py-12 text-center hover:border-indigo-500">
            <input
              type="file"
              accept="image/png,image/jpeg"
              multiple
              className="hidden"
              onChange={(e) => setPhotos(Array.from(e.target.files ?? []))}
            />
            <span className="text-zinc-400">
              {photos.length > 0
                ? `${photos.length} photo(s) selected`
                : "Click to upload .png / .jpg photos"}
            </span>
          </label>
        </fieldset>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-indigo-500 px-8 py-3 font-semibold text-white transition hover:bg-indigo-400 disabled:opacity-40"
        >
          {submitting ? "Uploading..." : "Start Reconstruction"}
        </button>
      </form>
    </div>
  );
}
