export type PlanId = "starter" | "pro" | "enterprise";

export type PlanLimits = {
  id: PlanId;
  label: string;
  maxActiveScans: number | null;
  maxRoomsPerScan: number | null;
  hdExports: boolean;
  reports: boolean;
};

type SubscriptionLike = {
  isPro: boolean;
  plan: string | null;
} | null | undefined;

export function getPlanLimits(subscription: SubscriptionLike): PlanLimits {
  if (subscription?.isPro && subscription.plan === "enterprise") {
    return {
      id: "enterprise",
      label: "Enterprise",
      maxActiveScans: null,
      maxRoomsPerScan: null,
      hdExports: true,
      reports: true,
    };
  }
  if (subscription?.isPro) {
    return {
      id: "pro",
      label: "Pro",
      maxActiveScans: null,
      maxRoomsPerScan: null,
      hdExports: true,
      reports: true,
    };
  }
  return {
    id: "starter",
    label: "Starter",
    maxActiveScans: 1,
    maxRoomsPerScan: 4,
    hdExports: false,
    reports: true,
  };
}

export function isAtLimit(count: number, max: number | null) {
  return max !== null && count >= max;
}
