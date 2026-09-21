import { LeadForm } from "@/components/LeadForm";

export default function PilotPage() {
  return <main className="mx-auto max-w-3xl flex-1 px-6 py-16"><p className="eyebrow">PILOT TESTING</p><h1 className="font-display text-4xl">Bring one building into Clonify.</h1><p className="mt-4 text-muted">Pilot the three-phase workflow with your accessibility, property, construction, or robotics team.</p><LeadForm kind="pilot" title="Request a pilot" /></main>;
}
