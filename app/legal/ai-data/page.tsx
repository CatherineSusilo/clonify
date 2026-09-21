import Link from "next/link";

export default function AiDataPolicyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
      <p className="eyebrow">LEGAL · AI DATA</p>
      <h1 className="font-display text-3xl">AI data and model policy</h1>
      <p className="mt-4 text-muted">
        Clonify uses one spatial workspace for navigation, showcase, renovation,
        and the confidential robotics phase.
      </p>
      <div className="mt-8 space-y-6 text-sm leading-7 text-muted">
        <section><h2 className="font-medium text-ink-text">Optional model improvement</h2><p>Customer captures are used to deliver the customer&apos;s requested features by default. They are only considered for model improvement when the account owner opts in. Opt-in can be withdrawn from Account.</p></section>
        <section><h2 className="font-medium text-ink-text">ONNX lifecycle</h2><p>Training or fine-tuning occurs in an approved source framework using consented, de-identified data. Approved models are exported to ONNX and run with ONNX Runtime in local workers. ONNX is the deployment format, not the training framework.</p></section>
        <section><h2 className="font-medium text-ink-text">Robotics confidentiality</h2><p>Robotics remains hidden until the administrator enables it after IP and patent review. Its models and fleet data are not exposed through the public demo.</p></section>
      </div>
      <Link href="/account" className="mt-8 inline-block text-blueprint-light hover:underline">Manage consent in Account →</Link>
    </main>
  );
}
