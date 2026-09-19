import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPlanLimits } from "@/lib/plans";
import { ScansList } from "@/components/ScansList";

export default async function ScansPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/scans");
  if (!user.role) redirect("/onboarding");

  const scans = await prisma.scan.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { rooms: true } } },
  });

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-6 py-16">
      <ScansList
        initialScans={scans.map((scan) => ({
          ...scan,
          createdAt: scan.createdAt.toISOString(),
        }))}
        plan={getPlanLimits(user.subscription)}
      />
    </div>
  );
}
