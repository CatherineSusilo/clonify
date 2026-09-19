"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ROLE_INFO, type RoleKey } from "@/lib/roles";
import { ROLE_SCAN_FIELDS } from "@/lib/scanFields";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import type { AddressSuggestion } from "@/lib/geocode";

export default function ScanPage() {
  const router = useRouter();
  const [role, setRole] = useState<RoleKey | null>(null);
  const [loading, setLoading] = useState(true);
  const [address, setAddress] = useState({ street: "", city: "", state: "", country: "" });
  const [placeTitle, setPlaceTitle] = useState("");
  const [floorCount, setFloorCount] = useState(1);
  const [metadata, setMetadata] = useState<Record<string, string>>({});
  const [photos, setPhotos] = useState<File[]>([]);
  const [panorama, setPanorama] = useState<File | null>(null);
  const [blueprint, setBlueprint] = useState<File | null>(null);
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
    return <div className="flex flex-1 items-center justify-center text-muted">Loading…</div>;
  }

  const info = ROLE_INFO[role];
  const fields = ROLE_SCAN_FIELDS[role];

  function applySuggestion(s: AddressSuggestion) {
    setAddress({ street: s.street, city: s.city, state: s.state, country: s.country });
    if (s.placeName) setPlaceTitle(s.placeName);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const form = new FormData();
    form.set("placeTitle", placeTitle);
    form.set("floorCount", String(floorCount));
    form.set("street", address.street);
    form.set("city", address.city);
    form.set("state", address.state);
    form.set("country", address.country);
    form.set("metadata", JSON.stringify(metadata));
    photos.forEach((p) => form.append("photos", p));
    if (panorama) form.set("panorama", panorama);
    if (blueprint) form.set("blueprint", blueprint);

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
      <p className="text-sm text-blueprint-light">{info.label}</p>
      <h1 className="font-display mt-2 text-2xl font-medium">Where&apos;s the space?</h1>
      <p className="mt-2 text-sm text-muted">
        If it&apos;s a public building, we&apos;ll automatically pull its footprint
        from open map data — no need to attach anything yourself.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-8">
        <fieldset className="space-y-4">
          <legend className="mb-2 text-sm text-muted">Place name</legend>
          <input
            placeholder="e.g. CN Tower, Smith family home, Riverside Apartments"
            className="w-full border border-line bg-ink-soft px-4 py-2.5 focus:border-blueprint-light focus:outline-none"
            value={placeTitle}
            onChange={(e) => setPlaceTitle(e.target.value)}
          />
          <p className="text-xs text-muted">
            We&apos;ll search open, licensed sources for full-size indoor photos only
            to help build a fuller 3D reconstruction.
          </p>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm text-muted">Levels to capture</legend>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min="1"
              max="99"
              value={floorCount}
              onChange={(event) => setFloorCount(Math.max(1, Math.min(99, Number(event.target.value) || 1)))}
              className="w-24 border border-line bg-ink-soft px-4 py-2.5 focus:border-blueprint-light focus:outline-none"
            />
            <p className="text-xs text-muted">We&apos;ll create a floor-aware capture checklist and separate navigation maps for every level.</p>
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="mb-2 text-sm text-muted">Location</legend>
          <AddressAutocomplete
            value={address.street}
            onChange={(street) => setAddress({ ...address, street })}
            onSelect={applySuggestion}
          />
          <div className="grid grid-cols-2 gap-4">
            <input
              required
              placeholder="City"
              className="border border-line bg-ink-soft px-4 py-2.5 focus:border-blueprint-light focus:outline-none"
              value={address.city}
              onChange={(e) => setAddress({ ...address, city: e.target.value })}
            />
            <input
              placeholder="State / ZIP"
              className="border border-line bg-ink-soft px-4 py-2.5 focus:border-blueprint-light focus:outline-none"
              value={address.state}
              onChange={(e) => setAddress({ ...address, state: e.target.value })}
            />
          </div>
          <input
            placeholder="Country"
            className="w-full border border-line bg-ink-soft px-4 py-2.5 focus:border-blueprint-light focus:outline-none"
            value={address.country}
            onChange={(e) => setAddress({ ...address, country: e.target.value })}
          />
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="mb-2 text-sm text-muted">{info.label} details</legend>
          {fields.map((field) =>
            field.type === "select" ? (
              <select
                key={field.name}
                className="w-full border border-line bg-ink-soft px-4 py-2.5 focus:border-blueprint-light focus:outline-none"
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
                className="w-full border border-line bg-ink-soft px-4 py-2.5 focus:border-blueprint-light focus:outline-none"
                value={metadata[field.name] ?? ""}
                onChange={(e) => setMetadata({ ...metadata, [field.name]: e.target.value })}
              />
            )
          )}
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm text-muted">Overview photos</legend>
          <p className="mb-3 text-xs text-muted">
            A few wide shots of the space, from different angles. You&apos;ll scan
            individual rooms in more detail after processing.
          </p>
          <label className="flex cursor-pointer flex-col items-center justify-center border border-dashed border-line px-6 py-10 text-center hover:border-muted">
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => setPhotos(Array.from(e.target.files ?? []))}
            />
            <span className="text-sm text-muted">
              {photos.length > 0 ? `${photos.length} photo(s) selected` : "Choose photos"}
            </span>
          </label>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm text-muted">
            360° panorama <span className="text-muted/70">(optional — improves 3D reconstruction)</span>
          </legend>
          <label className="flex cursor-pointer flex-col items-center justify-center border border-dashed border-line px-6 py-6 text-center hover:border-muted">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setPanorama(e.target.files?.[0] ?? null)}
            />
            <span className="text-sm text-muted">
              {panorama ? panorama.name : "Choose an equirectangular photo"}
            </span>
          </label>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm text-muted">
            Floor plan / blueprint <span className="text-muted/70">(optional — used directly if we can&apos;t find one online)</span>
          </legend>
          <label className="flex cursor-pointer flex-col items-center justify-center border border-dashed border-line px-6 py-6 text-center hover:border-muted">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setBlueprint(e.target.files?.[0] ?? null)}
            />
            <span className="text-sm text-muted">
              {blueprint ? blueprint.name : "Choose a floor plan image"}
            </span>
          </label>
        </fieldset>

        {error && (
          <p className="text-sm text-danger">
            {error}{" "}
            {error.toLowerCase().includes("upgrade") && (
              <a href="/pricing" className="text-blueprint-light hover:underline">
                See pricing
              </a>
            )}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full border border-blueprint-light bg-blueprint px-6 py-3 font-medium hover:bg-blueprint/80 disabled:opacity-40"
        >
          {submitting ? "Uploading…" : "Start reconstruction"}
        </button>
      </form>
    </div>
  );
}
