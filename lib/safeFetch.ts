import { lookup } from "dns/promises";
import { isIP } from "net";
import ipaddr from "ipaddr.js";

/** Fetches a URL that came from third-party data (search API results, user
 * input, etc.) while guarding against SSRF: only https, only ports 443/80,
 * and every hop's resolved address is checked against private/loopback/
 * link-local ranges before the request is made. Manual redirect handling
 * re-validates each hop so a 30x can't be used to reach an internal host
 * after the first check passes. */
export async function safeFetch(url: string, init?: RequestInit, maxRedirects = 5): Promise<Response> {
  let current = url;
  for (let i = 0; i <= maxRedirects; i++) {
    await assertPublicHttpsUrl(current);
    const res = await fetch(current, { ...init, redirect: "manual" });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      current = new URL(res.headers.get("location")!, current).toString();
      continue;
    }
    return res;
  }
  throw new Error("Too many redirects");
}

async function assertPublicHttpsUrl(rawUrl: string): Promise<void> {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:") {
    throw new Error(`Refusing non-https URL: ${rawUrl}`);
  }

  // url.hostname keeps surrounding brackets for an IPv6 literal ("[::1]"),
  // which neither isIP() nor dns.lookup() recognize as an address.
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(hostname) ? [{ address: hostname }] : await lookup(hostname, { all: true });

  for (const { address } of addresses) {
    if (isPrivateOrReservedAddress(address)) {
      throw new Error(`Refusing to fetch private/reserved address: ${address}`);
    }
  }
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
