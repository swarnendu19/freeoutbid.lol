"use client";

/* eslint-disable @next/next/no-img-element -- arbitrary domain favicons cannot use a fixed Next image allowlist */

import { FormEvent, KeyboardEvent, useEffect, useMemo, useState } from "react";

export type Listing = { id: number | string; domain: string; url: string; description: string; bid: number; clicks: number; updated_at?: string };
type Profile = Pick<Listing, "domain" | "url" | "bid">;

function normalizeUrl(input: string) {
  try {
    const parsed = new URL(/^https?:\/\//i.test(input.trim()) ? input.trim() : `https://${input.trim()}`);
    if (!parsed.hostname.includes(".")) return null;
    parsed.hash = "";
    return { domain: parsed.hostname.replace(/^www\./i, "").toLowerCase(), url: parsed.toString() };
  } catch { return null; }
}

function faviconUrl(input: string) {
  try { return `https://icon.horse/icon/${encodeURIComponent(new URL(input).hostname)}`; }
  catch { return null; }
}

function ListingIcon({ listing }: { listing: Listing }) {
  const [failed, setFailed] = useState(false);
  const source = faviconUrl(listing.url);

  return <span className={`avatar ${failed || !source ? "favicon-fallback" : ""}`}>
    {source && !failed && <img src={source} alt="" onError={() => setFailed(true)} />}
    <b>{listing.domain[0].toUpperCase()}</b>
  </span>;
}

export default function LeaderboardClient({ initialListings }: { initialListings: Listing[] }) {
  const [amount, setAmount] = useState(1);
  const [domainInput, setDomainInput] = useState("");
  const [profile, setProfile] = useState<Profile>({ domain: "", url: "", bid: 0 });
  const [listings, setListings] = useState<Listing[]>(initialListings);
  const [boardLoading, setBoardLoading] = useState(false);
  const [pending, setPending] = useState<{ domain: string; url: string } | null>(null);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"muted" | "error" | "success">("muted");
  const [checkoutError, setCheckoutError] = useState("");
  const [loading, setLoading] = useState(false);

  const rank = useMemo(() => listings.filter((row) => row.bid >= amount && row.domain !== profile.domain).length + 1, [amount, listings, profile.domain]);

  async function refresh(url?: string, syncAmount = false) {
    try {
      const query = url ? `?url=${encodeURIComponent(url)}` : "";
      const response = await fetch(`/api/leaderboard${query}`, { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json() as { listings: Listing[]; profile: Profile };
      setListings(data.listings);
      if (url) { setProfile(data.profile); if (syncAmount) setAmount(data.profile.bid > 0 ? data.profile.bid + 1 : 1); }
    } finally {
      setBoardLoading(false);
    }
  }

  useEffect(() => {
    const normalized = normalizeUrl(domainInput);
    if (!normalized) return;
    const timer = window.setTimeout(() => void refresh(normalized.url, true), 350);
    return () => window.clearTimeout(timer);
  }, [domainInput]);

  function changeAmount(next: number) {
    const value = Math.max(1, Math.min(10000, Math.round(next || 1)));
    setAmount(value); setCheckoutError("");
    setMessage(`Paid bid: Polar will charge exactly $${value} after confirmation.`); setMessageTone("success");
  }

  function changeDomainInput(value: string) {
    setDomainInput(value);
    if (!normalizeUrl(value)) setProfile({ domain: "", url: "", bid: 0 });
  }

  function prepareBid(event: FormEvent) {
    event.preventDefault();
    const normalized = normalizeUrl(domainInput);
    if (!normalized) { setMessage("Enter a valid domain or product URL."); setMessageTone("error"); return; }
    setPending(normalized); setCheckoutError("");
  }

  async function payWithPolar() {
    if (!pending) return;
    setLoading(true); setCheckoutError("");
    try {
      const response = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ domain: pending.domain, url: pending.url, amount }) });
      const data = await response.json() as { url?: string; error?: string };
      if (!response.ok || !data.url) throw new Error(data.error || "Polar checkout is not configured yet.");
      window.location.href = data.url;
    } catch (issue) { setCheckoutError(issue instanceof Error ? issue.message : "Could not start Polar checkout."); setLoading(false); }
  }

  function startOutbid(listing: Listing) {
    setAmount(listing.bid + 1);
    setMessage(`Bid $${listing.bid + 1} or more with your URL to move above ${listing.domain}.`); setMessageTone("success");
    document.getElementById("top")?.scrollIntoView({ behavior: "smooth" });
    window.setTimeout(() => document.querySelector<HTMLInputElement>('.claim-form input')?.focus(), 450);
  }
  function openListing(listing: Listing) {
    void fetch("/api/leaderboard", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "click", url: listing.url }), keepalive: true });
    window.open(listing.url, "_blank", "noopener,noreferrer");
  }
  function cardKey(event: KeyboardEvent<HTMLElement>, listing: Listing) { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openListing(listing); } }

  return <main>
    <header className="nav shell"><a className="brand" href="#top" aria-label="freeoutbid.lol home"><span className="logo-mark" aria-hidden="true"><i /><i /><i /></span><span>freeoutbid<em>.lol</em></span></a><nav aria-label="Primary navigation"><a href="#leaderboard">Leaderboard</a><a href="#rules">Rules</a></nav></header>
    <section className="hero shell" id="top">
      <div className="status-pill"><span /> Paid listings only <b>·</b> real payments via Polar</div>
      <h1>The leaderboard<br /><strong>money can’t fully buy.</strong></h1>
      <p>Every public bid is paid with real money. Outbid the listing above you, climb the board, and get the clicks that come with the top spot.</p>
      <div className="bid-line"><span>Claim #{rank} for</span><div className="amount-control"><button type="button" onClick={() => changeAmount(amount - 1)} aria-label="Decrease bid">−</button><b>$</b><input aria-label="Bid amount in dollars" type="number" min="1" max="10000" value={amount} onChange={(event) => changeAmount(Number(event.target.value))} /><button type="button" onClick={() => changeAmount(amount + 1)} aria-label="Increase bid">+</button></div></div>
      <p className="amount-help">Polar will charge exactly ${amount} after you confirm the checkout.</p>
      <form className="claim-form" onSubmit={prepareBid} noValidate><label className={messageTone === "error" && !normalizeUrl(domainInput) ? "input-error" : ""}><span>◎</span><input value={domainInput} onChange={(event) => changeDomainInput(event.target.value)} placeholder="Your product URL" aria-label="Product URL" /></label><button className="claim-button">Claim your spot <span>↗</span></button></form>
      <p className={`form-message ${messageTone}`}>{message || "Enter a URL and bid amount to continue to secure Polar checkout."}</p>
      <div className="credit-strip" aria-label="Listing options"><span><b>Paid bids only</b></span><i /><span>Secure checkout <b>Polar</b></span><i /><span>{profile.bid ? <>Current bid <b>${profile.bid}</b></> : <b>New URL</b>}</span></div>
      <div className="free-listing"><span>Want a manually reviewed free listing?</span><a href="https://x.com/SwarnCode" target="_blank" rel="noopener noreferrer">Follow @SwarnCode on X <b>↗</b></a><small>Follow first, then request your listing directly. It will not be published automatically.</small></div>
    </section>
    <section className="leaderboard shell" id="leaderboard"><div className="board-head"><div><small>THE PUBLIC BOARD</small><h2>Highest bid. Highest rank.</h2></div><button type="button" onClick={() => void refresh(profile.url)}>↻ Refresh</button></div><p className="disclosure">Click a card to visit its site. Free and promotional bids count toward displayed totals.</p><div className="rows">{boardLoading ? <div className="board-state">Loading the live leaderboard…</div> : listings.length === 0 ? <div className="board-state"><strong>No bidders yet.</strong><span>Enter your URL above and become the first.</span></div> : listings.map((listing, index) => <article className={`leader-row ${index === 0 ? "top" : ""} ${listing.domain === profile.domain ? "owned" : ""}`} key={listing.domain} role="link" tabIndex={0} onClick={() => openListing(listing)} onKeyDown={(event) => cardKey(event, listing)} aria-label={`Visit ${listing.domain}`}>{index === 0 && <span className="top-crown">♛ CURRENT #1</span>}<span className="rank">#{index + 1}</span><ListingIcon listing={listing} /><div className="listing-copy"><h3>{listing.domain}{listing.domain === profile.domain && <em>ACTIVE URL</em>}</h3><p>{listing.description}</p><time>{listing.updated_at ? "recently updated" : "live listing"}</time></div><dl><div><dt>BID</dt><dd>${listing.bid}</dd></div><div><dt>CLICKS</dt><dd>{listing.clicks.toLocaleString()}</dd></div><div><dt>PER CLICK</dt><dd>{listing.clicks ? `$${(listing.bid / listing.clicks).toFixed(2)}` : "—"}</dd></div></dl><button className="row-action" onClick={(event) => { event.stopPropagation(); startOutbid(listing); }}>Outbid with ${listing.bid + 1} <span>↑</span></button></article>)}</div></section>
    <section className="rules shell" id="rules"><div><small>10-SECOND RULES</small><h2>No votes. No feed algorithm. Just the number.</h2></div><ol><li><b>01</b><span><strong>Enter a URL and amount.</strong>The URL is the listing key—there is no signup.</span></li><li><b>02</b><span><strong>Pay the exact bid.</strong>Every public bid uses secure Polar checkout. There are no automatic free credits.</span></li><li><b>03</b><span><strong>Request a free listing manually.</strong>Follow @SwarnCode on X and ask for review. Only approved projects are added for free.</span></li></ol></section>
    <footer className="footer shell"><a className="brand" href="#top"><span className="logo-mark" aria-hidden="true"><i /><i /><i /></span><span>freeoutbid<em>.lol</em></span></a><p>Paid bids and manually approved promotional listings.</p><span>Leaderboard · Rules</span></footer>
    {pending && <div className="modal-backdrop" onMouseDown={() => setPending(null)}><section className="bid-modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setPending(null)} aria-label="Close">×</button><small>CONFIRM PAID BID</small><h2 id="confirm-title">Put {pending.domain}<br />at #{rank}</h2><div className="modal-stats"><div><span>YOUR BID</span><strong>${amount}</strong></div><div><span>PAY NOW</span><strong>${amount}</strong></div><div><span>CHECKOUT</span><strong>Polar</strong></div></div><p>All public bids are paid. Continue to Polar, which charges exactly ${amount}. Free listings are added manually only after following @SwarnCode and approval.</p><button className="claim-button modal-primary" onClick={payWithPolar} disabled={loading}>{loading ? "Opening Polar…" : `Pay $${amount} with Polar`} <span>↗</span></button><small className="polar-note">Secure Polar checkout · no freeoutbid account created</small>{checkoutError && <p className="checkout-error" role="alert">{checkoutError}</p>}<button className="cancel-button" onClick={() => setPending(null)}>Cancel</button></section></div>}
  </main>;
}
