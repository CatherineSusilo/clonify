import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-6 py-24">
      <p className="font-mono text-sm text-blueprint-light">404</p>
      <h1 className="font-display mt-2 text-2xl font-medium">Page not found</h1>
      <p className="mt-3 text-muted">That route doesn&apos;t exist in this workspace.</p>
      <Link
        href="/"
        className="mt-8 w-fit border border-blueprint-light bg-blueprint px-6 py-3 font-medium hover:bg-blueprint/80"
      >
        Back home
      </Link>
    </div>
  );
}
