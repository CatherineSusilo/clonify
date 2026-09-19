import Link from "next/link";
import { ROLE_INFO, ROLES } from "@/lib/roles";

const TIERS = [
  { name: "Starter", price: "$0", features: ["1 active scan", "Standard exports", "Web viewer"] },
  { name: "Pro", price: "$99/mo", features: ["Unlimited scans", "HD exports", "Role-specific reports"], highlight: true },
  { name: "Enterprise", price: "Custom", features: ["Team seats", "BIM/CAD pipeline", "Priority support"] },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <section className="relative flex flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950 px-6 py-28 text-center">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_-10%,rgba(99,102,241,0.25),transparent_60%)]" />
        <p className="mb-4 text-sm font-medium tracking-widest text-indigo-400 uppercase">
          Spatial Digital Twins
        </p>
        <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
          Turn any space into a role-tailored 3D twin
        </h1>
        <p className="mt-6 max-w-xl text-lg text-zinc-400">
          Clonify reconstructs real spaces from photos, then configures every
          tool, prompt, and export around who you are — agent, adjuster,
          auditor, or engineer.
        </p>
        <div className="mt-10 flex flex-col gap-4 sm:flex-row">
          <Link
            href="/onboarding"
            className="rounded-full bg-indigo-500 px-8 py-3 font-semibold text-white transition hover:bg-indigo-400"
          >
            Get Started
          </Link>
          <a
            href="#sdg"
            className="rounded-full border border-zinc-700 px-8 py-3 font-semibold text-zinc-200 transition hover:border-zinc-500"
          >
            View SDG Impact
          </a>
        </div>

        <div className="mt-16 w-full max-w-2xl overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50 shadow-2xl shadow-indigo-950/50">
          <model-viewer
            src="https://modelviewer.dev/shared-assets/models/Astronaut.glb"
            alt="Demo spatial twin model"
            camera-controls
            auto-rotate
            shadow-intensity="1"
            exposure="1"
            style={{ width: "100%", height: "420px", backgroundColor: "#0a0a0c" }}
          />
        </div>
      </section>

      <section id="sdg" className="bg-zinc-950 px-6 py-20">
        <h2 className="mb-2 text-center text-3xl font-bold">Scale of Impact</h2>
        <p className="mx-auto mb-12 max-w-2xl text-center text-zinc-400">
          Every role you can onboard as connects directly to a UN Sustainable
          Development Goal.
        </p>
        <div className="mx-auto grid max-w-6xl gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {ROLES.map((role) => {
            const info = ROLE_INFO[role];
            return (
              <div
                key={role}
                className={`rounded-2xl bg-gradient-to-br ${info.color} p-[1px]`}
              >
                <div className="h-full rounded-2xl bg-zinc-950 p-6">
                  <p className="text-xs font-semibold tracking-widest text-zinc-400 uppercase">
                    {info.sdg}
                  </p>
                  <h3 className="mt-2 font-semibold text-white">{info.label}</h3>
                  <p className="mt-3 text-sm text-zinc-400">{info.sdgTitle}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="bg-zinc-900/50 px-6 py-20">
        <h2 className="mb-12 text-center text-3xl font-bold">Pricing</h2>
        <div className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-3">
          {TIERS.map((tier) => (
            <div
              key={tier.name}
              className={`rounded-2xl border p-8 ${
                tier.highlight
                  ? "border-indigo-500 bg-indigo-500/10"
                  : "border-zinc-800 bg-zinc-950"
              }`}
            >
              <h3 className="text-lg font-semibold">{tier.name}</h3>
              <p className="mt-2 text-3xl font-bold">{tier.price}</p>
              <ul className="mt-6 space-y-2 text-sm text-zinc-400">
                {tier.features.map((f) => (
                  <li key={f}>• {f}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 text-center">
          <Link
            href="/pricing"
            className="rounded-full bg-indigo-500 px-8 py-3 font-semibold text-white transition hover:bg-indigo-400"
          >
            See full pricing
          </Link>
        </div>
      </section>
    </div>
  );
}
