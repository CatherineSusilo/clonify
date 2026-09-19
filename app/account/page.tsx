import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getPlanLimits } from "@/lib/plans";
import { AccountForm } from "@/components/AccountForm";
import type { RoleKey } from "@/lib/roles";

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account");
  if (!user.role) redirect("/onboarding");

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
      <h1 className="font-display text-2xl font-medium">Account</h1>
      <p className="mt-2 text-muted">Role and units apply to new scans.</p>
      <div className="mt-10">
        <AccountForm
          email={user.email}
          initialRole={user.role as RoleKey}
          initialUnit={user.unitPreference}
          plan={getPlanLimits(user.subscription)}
        />
      </div>
    </div>
  );
}
