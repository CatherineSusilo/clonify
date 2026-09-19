import { lookup as dnsLookup } from "dns/promises";
import { isIP } from "net";
import { Agent } from "undici";
import ipaddr from "ipaddr.js";

/** Fetches a URL that came from third-party data (search API results, user
 * input, etc.) while guarding against SSRF: only https, and the resolved
 * address is checked against private/loopback/link-local/reserved ranges
 * before the request is made.
 *
 * Validating the hostname and then calling plain fetch() would still be
 * vulnerable to DNS rebinding: fetch() re-resolves the hostname itself, so
 * a DNS server that answers the validation lookup with a public IP and the
 * connection's own lookup with a private one slips straight past the check.
 * To close that gap, the address validated here is pinned as the *only*
 * address undici's connector is allowed to connect to, via a per-request
 * Agent with a fixed `connect.lookup` — no second resolution ever happens.
 *
 * Manual redirect handling re-validates and re-pins each hop the same way,
 * so a 30x can't be used to reach an internal host after the first check. */
export async function safeFetch(url: string, init?: RequestInit, maxRedirects = 5): Promise<Response> {
  let current = url;
  for (let i = 0; i <= maxRedirects; i++) {
    const pinnedAddress = await resolvePublicAddress(current);
    const dispatcher = new Agent({
      connect: { lookup: (_hostname, _options, callback) => callback(null, [{ address: pinnedAddress.address, family: pinnedAddress.family }]) },
    });

    const res = await fetch(current, { ...init, dispatcher, redirect: "manual" } as RequestInit);
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      current = new URL(res.headers.get("location")!, current).toString();
      continue;
    }
    return res;
  }
  throw new Error("Too many redirects");
}

/** Resolves rawUrl's hostname and returns the single address that will be
 * connected to, after confirming it's https and the address is public. */
async function resolvePublicAddress(rawUrl: string): Promise<{ address: string; family: 4 | 6 }> {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:") {
    throw new Error(`Refusing non-https URL: ${rawUrl}`);
  }

  // url.hostname keeps surrounding brackets for an IPv6 literal ("[::1]"),
  // which neither isIP() nor dns.lookup() recognize as an address.
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const ipFamily = isIP(hostname);
  const resolved = ipFamily
    ? [{ address: hostname, family: ipFamily as 4 | 6 }]
    : await dnsLookup(hostname, { all: true });

  const first = resolved.find(({ address }) => !isPrivateOrReservedAddress(address));
  if (!first) {
    const attempted = resolved.map((r) => r.address).join(", ") || hostname;
    throw new Error(`Refusing to fetch private/reserved address: ${attempted}`);
  }
  return { address: first.address, family: first.family as 4 | 6 };
}

function isPrivateOrReservedAddress(address: string): boolean {
  let parsed: ipaddr.IPv4 | ipaddr.IPv6;
  try {
    parsed = ipaddr.parse(address);
  } catch {
    return true; // unparseable -> reject
  }

  // Unwrap IPv4-mapped IPv6 addresses (::ffff:10.0.0.1 etc.) to their IPv4
  // form so the range check below sees the real address, not "ipv4Mapped".
  if (parsed.kind() === "ipv6" && (parsed as ipaddr.IPv6).isIPv4MappedAddress()) {
    parsed = (parsed as ipaddr.IPv6).toIPv4Address();
  }

  // ipaddr.js's range() covers the full IANA special-purpose registry:
  // loopback, private, linkLocal, uniqueLocal, carrierGradeNat, reserved,
  // benchmarking, etc. Only "unicast" (and IPv6 "unicast"/global) is a
  // real public address safe to fetch.
  return parsed.range() !== "unicast";
}
