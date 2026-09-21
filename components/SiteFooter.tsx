import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-sm text-muted">
        <p>Clonify — map every room before you walk in.</p>
        <nav className="flex gap-6">
          <Link href="/pricing" className="hover:text-ink-text">
            Pricing
          </Link>
          <Link href="/demo" className="hover:text-ink-text">
            Demo
          </Link>
          <Link href="/pilot" className="hover:text-ink-text">
            Pilot
          </Link>
          <Link href="/legal/ai-data" className="hover:text-ink-text">
            AI data policy
          </Link>
          <Link href="/scans" className="hover:text-ink-text">
            Scans
          </Link>
          <a href="/api/health" className="hover:text-ink-text">
            Status
          </a>
        </nav>
      </div>
    </footer>
  );
}
