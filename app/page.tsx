import Link from "next/link";
import { ROLE_INFO, ROLES } from "@/lib/roles";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <section className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-16 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:py-24">
        <div>
          <h1 className="font-display max-w-md text-4xl font-medium leading-[1.1] sm:text-5xl">
            Map every room before you walk in.
          </h1>
          <p className="mt-6 max-w-md text-lg text-muted">
            Photograph a space and Clonify builds a walkable indoor map:
            floor plan, 3D twin, and the measurements your job actually needs
            — slope, clearance, square footage, damage.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/signup"
              className="border border-blueprint-light bg-blueprint px-6 py-3 font-medium hover:bg-blueprint/80"
            >
              Start a scan
            </Link>
            <Link
              href="/pricing"
              className="border border-line px-6 py-3 font-medium text-muted hover:border-muted hover:text-ink-text"
            >
              See pricing
            </Link>
          </div>
        </div>

        <div className="tick relative border border-line bg-ink-soft p-2">
          <model-viewer
            suppressHydrationWarning
            src="https://modelviewer.dev/shared-assets/models/Astronaut.glb"
            alt="Sample reconstructed space"
            camera-controls
            auto-rotate
            shadow-intensity="1"
            exposure="1"
            style={{ width: "100%", height: "360px", backgroundColor: "#0e1218" }}
          />
          <p className="mt-2 font-mono text-xs text-muted">sample reconstruction — demo model</p>
        </div>
      </section>

      <section className="border-t border-line">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="font-display text-2xl font-medium">Built around what you're there to do</h2>
          <p className="mt-2 max-w-xl text-muted">
            Onboarding sets your default fields, tools, and exports — no
            generic dashboard to configure.
          </p>

          <div className="mt-10 divide-y divide-line border-y border-line">
            {ROLES.map((role) => {
              const info = ROLE_INFO[role];
              return (
                <div
                  key={role}
                  className="grid gap-2 py-6 sm:grid-cols-[1fr_1.4fr] sm:items-center sm:gap-8"
                >
                  <h3 className="font-display text-lg font-medium">{info.label}</h3>
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                    <p className="text-sm text-muted">{info.tagline}</p>
                    <p className="font-mono text-xs text-blueprint-light">{info.sdg}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-4 px-6 py-16 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-2xl font-medium">Ready to scan a space?</h2>
            <p className="mt-2 text-muted">Free to start. One active scan, no card required.</p>
          </div>
          <Link
            href="/signup"
            className="shrink-0 border border-blueprint-light bg-blueprint px-6 py-3 font-medium hover:bg-blueprint/80"
          >
            Create an account
          </Link>
        </div>
      </section>
    </div>
  );
}
