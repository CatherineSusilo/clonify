"use client";
import { useState } from "react";

export function LeadForm({ kind, title }: { kind: "demo-contact" | "pilot"; title: string }) {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, name: form.get("name"), email: form.get("email"), message: form.get("message") }) });
    if (!response.ok) { setError("Please check the form and try again."); return; }
    setSent(true);
  }
  if (sent) return <p className="border border-blueprint-light p-4 text-sm">Thanks — the Clonify team will follow up from mail@clonify.ca.</p>;
  return <form onSubmit={submit} className="mt-6 space-y-3 border border-line bg-ink-soft p-5"><h2 className="font-display text-xl">{title}</h2><input name="name" required placeholder="Name" className="w-full border border-line bg-transparent px-3 py-2" /><input name="email" required type="email" placeholder="Email" className="w-full border border-line bg-transparent px-3 py-2" /><textarea name="message" required minLength={10} placeholder="Tell us about your building or pilot" className="min-h-28 w-full border border-line bg-transparent px-3 py-2" />{error && <p className="text-sm text-danger">{error}</p>}<button className="border border-blueprint-light bg-blueprint px-4 py-2">Submit</button></form>;
}
