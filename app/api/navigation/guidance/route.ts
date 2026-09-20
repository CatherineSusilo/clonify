import { NextResponse } from "next/server";
import { z } from "zod";

const requestSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  nextRoom: z.string().min(1),
  floor: z.number(),
  step: z.number().int().positive(),
  totalSteps: z.number().int().positive(),
  reroute: z.boolean().optional(),
});

function fallbackDirection(input: z.infer<typeof requestSchema>) {
  if (input.reroute) {
    return `Rerouting from ${input.from}. Continue toward ${input.nextRoom}, then follow the updated path to ${input.to}.`;
  }
  const level = input.floor === 1 ? "ground level" : `level ${input.floor}`;
  return input.step === input.totalSteps
    ? `You are arriving at ${input.to} on ${level}.`
    : `Continue from ${input.from} toward ${input.nextRoom} on ${level}.`;
}

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid route guidance input." }, { status: 400 });
  }

  const input = parsed.data;
  const endpoint = process.env.LOCAL_MODEL_URL;
  const model = process.env.LOCAL_MODEL_NAME ?? "llama3.2:3b";
  if (!endpoint) {
    return NextResponse.json({ text: fallbackDirection(input), source: "local-fallback" });
  }

  try {
    const response = await fetch(`${endpoint.replace(/\/$/, "")}/api/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model,
        stream: false,
        prompt: [
          "You are an indoor navigation voice assistant.",
          "Return one short, calm direction under 18 words. No markdown, no lists.",
          `From: ${input.from}. Next room: ${input.nextRoom}. Destination: ${input.to}.`,
          `Floor: ${input.floor}. Step ${input.step} of ${input.totalSteps}. Reroute: ${input.reroute ? "yes" : "no"}.`,
        ].join("\n"),
      }),
      signal: AbortSignal.timeout(3500),
    });
    if (!response.ok) throw new Error(`Local model responded with ${response.status}`);
    const data = (await response.json()) as { response?: string };
    const text = data.response?.trim();
    if (!text) throw new Error("Local model returned empty guidance.");
    return NextResponse.json({ text, source: "local-model" });
  } catch {
    return NextResponse.json({ text: fallbackDirection(input), source: "local-fallback" });
  }
}
