"use client";

import { useEffect, useRef, useState, use } from "react";
import { useRouter } from "next/navigation";
import { PROCESSING_LOGS, type RoleKey } from "@/lib/roles";

export default function ProcessingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [logLines, setLogLines] = useState<string[]>([]);
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
    }, 500);

    return () => {
      cancelled = true;
      clearInterval(poll);
      clearInterval(logTimer);
    };
  }, [id, router]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-black px-6 py-16">
      <div className="w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-950 p-8 font-mono text-sm">
        <p className="mb-4 text-zinc-500">
          <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
          Reconstructing spatial twin...
        </p>
        {logLines.map((line, i) => (
          <p key={i} className="text-emerald-400">
            {"> "}
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}
