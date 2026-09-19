import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { LogoutButton } from "./LogoutButton";

export async function NavBar() {
  const user = await getCurrentUser();

  return (
    <header className="border-b border-line">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2 font-display text-lg font-medium">
          <span className="tick h-4 w-4 border border-blueprint-light" aria-hidden />
          Clonify
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/pricing" className="text-muted hover:text-ink-text">
            Pricing
          </Link>
          {user ? (
            <>
              <Link href="/scan" className="text-muted hover:text-ink-text">
                New scan
              </Link>
              <span className="text-muted">{user.email}</span>
              <LogoutButton />
            </>
          ) : (
            <>
              <Link href="/login" className="text-muted hover:text-ink-text">
                Sign in
              </Link>
              <Link
                href="/signup"
                className="border border-blueprint-light px-3 py-1.5 text-ink-text hover:bg-blueprint-light/10"
              >
                Get started
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
