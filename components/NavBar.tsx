import Link from "next/link";
import Image from "next/image";
import { getCurrentUser } from "@/lib/auth";
import { LogoutButton } from "./LogoutButton";

export async function NavBar() {
  const user = await getCurrentUser();

  return (
    <header className="border-b border-line bg-ink/80 backdrop-blur">
      <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="glow flex items-center gap-3 font-display text-xl font-medium">
          <Image src="/logo.png" alt="" width={40} height={40} priority />
          Clonify
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/pricing" className="text-muted hover:text-ink-text">
            Pricing
          </Link>
          {user ? (
            <>
              <Link href="/scans" className="text-muted hover:text-ink-text">
                Scans
              </Link>
              <Link href="/scan" className="text-muted hover:text-ink-text">
                New scan
              </Link>
              <Link href="/account" className="text-muted hover:text-ink-text">
                Account
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
