import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { ImmersiveWorkspace } from "@/components/ImmersiveWorkspace";
import { prisma } from "@/lib/prisma";

const capabilities = [
  ["01", "Capture once", "Bring phone photos, 360° panoramas, depth, or connected cameras. MapAnything-inspired metric reconstruction keeps scale in the scene."],
  ["02", "Choose your view", "Switch from a bird's-eye blueprint to an immersive 3D twin or a live camera overlay without losing your route or context."],
  ["03", "Make it useful", "Navigate a guest, sell a property, or plan the renovation. One spatial source of truth, tuned to the job in front of you."],
];

export default async function Home() {
  const user = await getCurrentUser();
  const primaryHref = user ? (user.role ? "/scans" : "/onboarding") : "/signup";
  const roboticsEnabled = (await prisma.appSetting?.findUnique?.({ where: { key: "robotics_enabled" } }))?.value === "true";

  return (
    <main className="flex-1">
      <section className="hero-section">
        <div className="hero-copy">
          <p className="eyebrow"><span className="live-dot" /> SPATIAL INTELLIGENCE FOR EVERY ROOM</p>
          <h1>One building.<br /><em>Every point of view.</em></h1>
          <p className="hero-lede">Clonify turns connected camera views into a metric digital twin you can navigate, showcase, and renovate — from a phone, headset, smart glasses, or browser.</p>
          <div className="hero-actions"><Link href={primaryHref} className="primary-button">Build your first twin <span>↗</span></Link><Link href="/demo" className="secondary-button">Explore demo</Link>{roboticsEnabled && <Link href="/robotics" className="secondary-button">Clonify Robotics</Link>}</div>
          <div className="hero-proof"><span><strong>2D</strong> blueprint</span><span><strong>3D</strong> immersive</span><span><strong>LIVE</strong> camera guidance</span></div>
        </div>
        <div className="hero-orbit" aria-label="Clonify spatial intelligence preview">
          <div className="orbit-ring ring-one" /><div className="orbit-ring ring-two" /><div className="orbit-core"><span className="core-crosshair">+</span><span className="core-label">METRIC<br />TWIN</span></div>
          <div className="orbit-tag tag-top">● 94% confidence</div><div className="orbit-tag tag-right">⌖ Level 02 / 03</div><div className="orbit-tag tag-bottom">↗ Connected · 12 views</div>
          <div className="orbit-floor floor-back" /><div className="orbit-floor floor-front" />
        </div>
      </section>

      <ImmersiveWorkspace />
      <section className="capability-section"><div className="section-intro"><p className="eyebrow">THREE PHASES</p><h2>One spatial foundation, three products.</h2></div><div className="capability-grid"><article className="capability-card"><span className="capability-number">01</span><h3>Indoor Navigation</h3><p>Accessible, multi-floor guidance for people who need a clearer way through unfamiliar buildings.</p></article><article className="capability-card"><span className="capability-number">02</span><h3>Indoor Showcase + Renovation</h3><p>Publish a virtual home without a photographer, capture progress, pin issues, measure conditions, and move into a renovation plan.</p></article><article className="capability-card"><span className="capability-number">03</span><h3>Clonify Robotics</h3><p>Confidential fleet navigation using the trained spatial and vision models from the first two phases.</p></article></div></section>

      <section className="capability-section">
        <div className="section-intro"><p className="eyebrow">THE CLONIFY LOOP</p><h2>From a camera feed to a place people can understand.</h2><p>Built for the moments where a floor plan is not enough — and a 3D model alone is too much.</p></div>
        <div className="capability-grid">{capabilities.map(([number, title, description]) => <article key={number} className="capability-card"><span className="capability-number">{number}</span><h3>{title}</h3><p>{description}</p></article>)}</div>
      </section>

      <section className="role-section"><div><p className="eyebrow">PRODUCTS</p><h2>Pick the workflow that fits the building.</h2></div><div className="role-cards"><Link href="/scan" className="block"><article><span>◌</span><h3>Clonify Indoor Navigation</h3><p>Step-free routes, live camera arrows, and voice directions for visitors and accessibility teams.</p></article></Link><Link href="/demo" className="block"><article><span>◈</span><h3>Clonify Indoor Showcase</h3><p>A shareable virtual home and property twin without hiring a photographer for every room.</p></article></Link><Link href="/pilot" className="block"><article><span>⌁</span><h3>Clonify Indoor Renovation</h3><p>Capture progress, pin issues, measure conditions, and move from existing space to a renovation plan.</p></article></Link></div></section>

      <section className="cta-section"><p className="eyebrow">READY WHEN THE SPACE IS</p><h2>Give every room a clearer next step.</h2><p>Start with a phone. Connect more when the project needs it.</p><Link href={primaryHref} className="primary-button">Create your Clonify twin <span>↗</span></Link></section>
    </main>
  );
}
