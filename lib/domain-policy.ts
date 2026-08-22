const blockedDomains = new Set([
  "redgifs.com",
  "grindr.com",
  "pornhub.com",
  "xhamster.com",
  "rip.website",
  "rip.this.website",
]);

export function isBlockedDomain(domain: string) {
  return blockedDomains.has(domain) || /^[0-9a-f]{16}\.rip(?:\.com)?$/i.test(domain);
}
