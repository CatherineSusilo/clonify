"use client";

import { useEffect, useRef, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PROCESSING_LOGS, type RoleKey } from "@/lib/roles";

export default function ProcessingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [logLines, setLogLines] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const roleRef = useRef<RoleKey | null>(null);
  const logIndexRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    const logTimer = setInterval(() => {
      const role = roleRef.current;
      if (!role) return;
      const logs = PROCESSING_LOGS[role];
      if (logIndexRef.current < logs.length) {
        setLogLines((prev) => [...prev, logs[logIndexRef.current]]);
        logIndexRef.current += 1;
      }
    }, 900);

    const poll = setInterval(async () => {
      const res = await fetch(`/api/scans/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      if (cancelled) return;
      roleRef.current = data.scan.role;
      if (data.scan.status === "ready") {
        clearInterval(poll);
        clearInterval(logTimer);
        router.push(`/viewer/${id}`);
      }
      if (data.scan.status === "error") {
        clearInterval(poll);
        clearInterval(logTimer);
        setErrorMessage(data.scan.errorMessage ?? "Reconstruction failed.");
      }
    }, 500);

    return () => {
      cancelled = true;
      clearInterval(poll);
      clearInterval(logTimer);
    };
  }, [id, router]);

  async function retry() {
    setRetrying(true);
    setErrorMessage(null);
    setLogLines([]);
    logIndexRef.current = 0;
    await fetch(`/api/scans/${id}/retry`, { method: "POST" });
    window.location.reload();
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-2xl border border-line bg-ink-soft p-8 font-mono text-sm">
        {errorMessage ? (
          <>
            <p className="mb-4 text-danger">Reconstruction failed</p>
            <p className="text-muted">{errorMessage}</p>
            <div className="mt-6 flex gap-3 font-sans">
              <button
                type="button"
                onClick={retry}
                disabled={retrying}
                className="border border-blueprint-light bg-blueprint px-4 py-2 text-sm font-medium hover:bg-blueprint/80 disabled:opacity-50"
              >
                {retrying ? "Retrying…" : "Retry"}
              </button>
              <Link href="/scans" className="border border-line px-4 py-2 text-sm hover:border-muted">
                Back to scans
              </Link>
            </div>
          </>
        ) : (
          <>
            <p className="mb-4 text-muted">
              <span className="mr-2 inline-block h-2 w-2 animate-pulse bg-signal" />
              Building your 3D environment…
            </p>
            {logLines.map((line, i) => (
              <p key={i} className="text-signal">
                {"> "}
                {line}
              </p>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
