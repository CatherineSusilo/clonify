import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ADMIN_EMAIL } from "@/lib/products";

export default async function RoboticsPage() {
  const user = await getCurrentUser();
  const enabled = (await import("@/lib/prisma")).prisma.appSetting.findUnique({ where: { key: "robotics_enabled" } });
  const setting = await enabled;
  if (!user || user.email.toLowerCase() !== ADMIN_EMAIL || setting?.value !== "true") redirect("/");
  return <main className="mx-auto max-w-5xl flex-1 px-6 py-16"><p className="eyebrow">CONFIDENTIAL · CLONIFY ROBOTICS</p><h1 className="font-display text-4xl">Multi-floor fleet navigation</h1><p className="mt-4 max-w-2xl text-muted">The robotics phase uses the same building model, floorplan compiler, and vision evidence as navigation and renovation. Upstream ROS2 fleet foundations are available in <code>robot/</code>; patent approval is required before pilot access.</p><div className="mt-10 grid gap-4 sm:grid-cols-3">{["YOLO-family ONNX perception", "Multi-floor route planning", "Fleet telemetry and dispatch"].map((item) => <div key={item} className="border border-line bg-ink-soft p-5">{item}</div>)}</div></main>;
}
