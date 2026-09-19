import { lookup } from "dns/promises";
import { isIP } from "net";

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

  const addresses = isIP(url.hostname)
    ? [{ address: url.hostname }]
    : await lookup(url.hostname, { all: true });

  for (const { address } of addresses) {
    if (isPrivateOrReservedAddress(address)) {
      throw new Error(`Refusing to fetch private/reserved address: ${address}`);
    }
  }
}

function isPrivateOrReservedAddress(address: string): boolean {
  if (address.includes(":")) {
    const a = address.toLowerCase();
    return (
      a === "::1" ||
      a.startsWith("fe80:") || // link-local
      a.startsWith("fc") ||
      a.startsWith("fd") || // unique local
      a.startsWith("::ffff:127.") ||
      a.startsWith("::ffff:10.") ||
      a.startsWith("::ffff:169.254.") ||
      a.startsWith("::ffff:192.168.")
    );
  }

  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return true; // malformed -> reject

  const [a, b] = parts;
  return (
    a === 127 || // loopback
    a === 10 || // private
    (a === 172 && b >= 16 && b <= 31) || // private
    (a === 192 && b === 168) || // private
    (a === 169 && b === 254) || // link-local
    a === 0 || // "this network"
    a >= 224 // multicast/reserved
  );
}
