"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function AdminPage() {
  const [enabled, setEnabled] = useState(false);
  const [allowed, setAllowed] = useState(false);
  useEffect(() => { fetch("/api/admin/robotics").then((res) => res.json()).then((data) => { setEnabled(data.enabled); setAllowed(data.isAdmin); }); }, []);
  if (!allowed) return <main className="mx-auto max-w-2xl flex-1 px-6 py-20"><h1 className="font-display text-2xl">Admin access required</h1><Link href="/" className="mt-6 inline-block text-blueprint-light">Return home</Link></main>;
  return <main className="mx-auto max-w-3xl flex-1 px-6 py-20"><p className="eyebrow">CLONIFY ADMIN</p><h1 className="font-display text-3xl">Product controls</h1><div className="mt-8 border border-line bg-ink-soft p-6"><div className="flex items-center justify-between gap-4"><div><h2 className="font-medium">Reveal Clonify Robotics</h2><p className="mt-2 text-sm text-muted">Only enable after IP and patent approval.</p></div><button type="button" onClick={async () => { const next = !enabled; const res = await fetch("/api/admin/robotics", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: next }) }); if (res.ok) setEnabled(next); }} className="border border-blueprint-light px-4 py-2">{enabled ? "Enabled" : "Disabled"}</button></div></div></main>;
}
