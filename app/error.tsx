"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-6 py-24">
      <p className="font-mono text-sm text-danger">Error</p>
      <h1 className="font-display mt-2 text-2xl font-medium">Something went wrong</h1>
      <p className="mt-3 text-muted">Try again, or head back to your scans.</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={reset}
          className="border border-blueprint-light bg-blueprint px-6 py-3 font-medium hover:bg-blueprint/80"
        >
          Try again
        </button>
        <Link href="/scans" className="border border-line px-6 py-3 font-medium hover:border-muted">
          My scans
        </Link>
      </div>
    </div>
  );
}
