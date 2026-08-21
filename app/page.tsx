"use client";

/* eslint-disable @next/next/no-img-element -- arbitrary domain favicons cannot use a fixed Next image allowlist */

import { CSSProperties, FormEvent, KeyboardEvent, useEffect, useMemo, useState } from "react";

type Listing = { id: number | string; domain: string; url: string; description: string; bid: number; clicks: number; free_bids_remaining: number; bid_limit: number; updated_at?: string };
type Profile = Pick<Listing, "domain" | "url" | "bid" | "free_bids_remaining" | "bid_limit">;

const fallbackListings: Listing[] = [
  { id: 1, domain: "appgrowthkit.com", url: "https://appgrowthkit.com", description: "Screenshot tools for ambitious app teams.", bid: 96, clicks: 1284, free_bids_remaining: 0, bid_limit: 400 },
  { id: 2, domain: "usemotionkit.com", url: "https://usemotionkit.com", description: "A focused motion library for product teams.", bid: 78, clicks: 912, free_bids_remaining: 0, bid_limit: 400 },
  { id: 3, domain: "tinylaunch.dev", url: "https://tinylaunch.dev", description: "Launch pages made for independent builders.", bid: 61, clicks: 740, free_bids_remaining: 0, bid_limit: 400 },
  { id: 4, domain: "readme.so", url: "https://readme.so", description: "Turn product knowledge into clear documentation.", bid: 42, clicks: 488, free_bids_remaining: 0, bid_limit: 400 },
];

function normalizeUrl(input: string) {
  try {
    const parsed = new URL(/^https?:\/\//i.test(input.trim()) ? input.trim() : `https://${input.trim()}`);
    if (!parsed.hostname.includes(".")) return null;
    parsed.hash = "";
    return { domain: parsed.hostname.replace(/^www\./i, "").toLowerCase(), url: parsed.toString() };
  } catch { return null; }
}

export default function Home() {
  const [amount, setAmount] = useState(1);
  const [domainInput, setDomainInput] = useState("");
  const [profile, setProfile] = useState<Profile>({ domain: "", url: "", bid: 0, free_bids_remaining: 3, bid_limit: 100 });
  const [listings, setListings] = useState<Listing[]>(fallbackListings);
  const [pending, setPending] = useState<{ domain: string; url: string } | null>(null);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"muted" | "error" | "success">("muted");
  const [checkoutError, setCheckoutError] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [celebrating, setCelebrating] = useState(false);

  const rank = useMemo(() => listings.filter((row) => row.bid >= amount && row.domain !== profile.domain).length + 1, [amount, listings, profile.domain]);
  const freeBids = profile.free_bids_remaining;
  const bidLimit = profile.bid_limit;
  const overLimit = amount > bidLimit;
  const freeBidsGone = freeBids === 0;
  const canUseFreeBid = !freeBidsGone && !overLimit;

  async function refresh(url?: string, syncAmount = false) {
    const query = url ? `?url=${encodeURIComponent(url)}` : "";
    const response = await fetch(`/api/leaderboard${query}`, { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json() as { listings: Listing[]; profile: Profile };
    setListings(data.listings);
    if (url) { setProfile(data.profile); if (syncAmount) setAmount(data.profile.bid > 0 ? data.profile.bid + 1 : 1); }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 3800);
    return () => window.clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (!celebrating) return;
    const timer = window.setTimeout(() => setCelebrating(false), 1800);
    return () => window.clearTimeout(timer);
  }, [celebrating]);
  useEffect(() => {
    const normalized = normalizeUrl(domainInput);
    if (!normalized) return;
    const timer = window.setTimeout(() => void refresh(normalized.url, true), 350);
    return () => window.clearTimeout(timer);
  }, [domainInput]);

  function changeAmount(next: number) {
    const value = Math.max(1, Math.min(10000, Math.round(next || 1)));
    setAmount(value); setCheckoutError("");
    if (value > bidLimit) { setMessage(`Free-bid limit exceeded. Your current limit is $${bidLimit}; lower the bid or continue with Polar.`); setMessageTone("error"); }
    else if (freeBidsGone) { setMessage("All 3 free bids are gone for this URL. The next bid requires Polar payment."); setMessageTone("error"); }
    else { setMessage(`${freeBids} free bid${freeBids === 1 ? "" : "s"} left · up to $${bidLimit}.`); setMessageTone("success"); }
  }

  function changeDomainInput(value: string) {
    setDomainInput(value);
    if (!normalizeUrl(value)) setProfile({ domain: "", url: "", bid: 0, free_bids_remaining: 3, bid_limit: 100 });
  }

  function prepareBid(event: FormEvent) {
    event.preventDefault();
    const normalized = normalizeUrl(domainInput);
    if (!normalized) { setMessage("Enter a valid domain or product URL."); setMessageTone("error"); return; }
    setPending(normalized); setCheckoutError("");
  }

  async function placeFreeBid() {
    if (!pending || !canUseFreeBid) return;
    setLoading(true);
    const response = await fetch("/api/leaderboard", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: pending.url, amount }) });
    const data = await response.json() as { listing?: Listing; message?: string };
    if (!response.ok || !data.listing) { setCheckoutError(data.message || "This free bid could not be placed. Refresh and try again."); setLoading(false); await refresh(pending.url); return; }
    setProfile(data.listing); setPending(null); setLoading(false);
    setCelebrating(true);
    setNotice(`${data.listing.domain} is now on the board at $${data.listing.bid}. ${data.listing.free_bids_remaining} free bids left.`);
    setMessage(`${data.listing.free_bids_remaining} free bid${data.listing.free_bids_remaining === 1 ? "" : "s"} left · new limit $${data.listing.bid_limit}.`); setMessageTone("success");
    await refresh(data.listing.url);
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
      <div className="status-pill"><span /> 3 free bids for every new URL <b>·</b> no sign up</div>
      <h1>The leaderboard<br /><strong>money can’t fully buy.</strong></h1>
      <p>Every project starts with 3 free bids and a $100 limit. Outbid the listing above you, climb the board, and get the clicks that come with the top spot.</p>
      <div className="bid-line"><span>Claim #{rank} for</span><div className="amount-control"><button type="button" onClick={() => changeAmount(amount - 1)} aria-label="Decrease bid">−</button><b>$</b><input aria-label="Bid amount in dollars" type="number" min="1" max="10000" value={amount} onChange={(event) => changeAmount(Number(event.target.value))} /><button type="button" onClick={() => changeAmount(amount + 1)} aria-label="Increase bid">+</button></div></div>
      <p className={`amount-help ${overLimit || freeBidsGone ? "warning" : ""}`}>{overLimit ? `Your free-bid limit is $${bidLimit}. This amount requires Polar payment.` : freeBidsGone ? "All 3 free bids are gone. Your next bid requires Polar payment." : `This URL has ${freeBids} free bid${freeBids === 1 ? "" : "s"} left, usable up to $${bidLimit}.`}</p>
      <form className="claim-form" onSubmit={prepareBid} noValidate><label className={messageTone === "error" && !normalizeUrl(domainInput) ? "input-error" : ""}><span>◎</span><input value={domainInput} onChange={(event) => changeDomainInput(event.target.value)} placeholder="Your product URL" aria-label="Product URL" /></label><button className="claim-button">Claim your spot <span>↗</span></button></form>
      <p className={`form-message ${messageTone}`}>{message || "Enter a URL to instantly load its bid, free bids, and current limit."}</p>
      <div className="credit-strip" aria-label="Current free bid allowance"><span><b>{freeBids}</b> free bids left</span><i /><span>Current limit <b>${bidLimit}</b></span><i /><span>{profile.bid ? <>Current bid <b>${profile.bid}</b></> : <b>New URL</b>}</span></div>
    </section>
    <section className="leaderboard shell" id="leaderboard"><div className="board-head"><div><small>THE PUBLIC BOARD</small><h2>Highest bid. Highest rank.</h2></div><button type="button" onClick={() => void refresh(profile.url)}>↻ Refresh</button></div><p className="disclosure">Click a card to visit its site. Free and promotional bids count toward displayed totals.</p><div className="rows">{listings.map((listing, index) => <article className={`leader-row ${index === 0 ? "top" : ""} ${listing.domain === profile.domain ? "owned" : ""}`} key={listing.domain} role="link" tabIndex={0} onClick={() => openListing(listing)} onKeyDown={(event) => cardKey(event, listing)} aria-label={`Visit ${listing.domain}`}>{index === 0 && <span className="top-crown">♛ CURRENT #1</span>}<span className="rank">#{index + 1}</span><span className="avatar"><img src={`${listing.url.replace(/\/$/, "")}/favicon.ico`} alt="" onError={(event) => { event.currentTarget.hidden = true; event.currentTarget.parentElement?.classList.add("favicon-fallback"); }} /><b>{listing.domain[0].toUpperCase()}</b></span><div className="listing-copy"><h3>{listing.domain}{listing.domain === profile.domain && <em>ACTIVE URL</em>}</h3><p>{listing.description}</p><time>{listing.updated_at ? "recently updated" : "live listing"}</time></div><dl><div><dt>BID</dt><dd>${listing.bid}</dd></div><div><dt>CLICKS</dt><dd>{listing.clicks.toLocaleString()}</dd></div><div><dt>PER CLICK</dt><dd>{listing.clicks ? `$${(listing.bid / listing.clicks).toFixed(2)}` : "—"}</dd></div></dl><button className="row-action" onClick={(event) => { event.stopPropagation(); startOutbid(listing); }}>Outbid with ${listing.bid + 1} <span>↑</span></button></article>)}</div></section>
    <section className="rules shell" id="rules"><div><small>10-SECOND RULES</small><h2>No votes. No feed algorithm. Just the number.</h2></div><ol><li><b>01</b><span><strong>Enter a URL and amount.</strong>The URL is the listing key—there is no signup.</span></li><li><b>02</b><span><strong>Use the free allowance.</strong>Each URL gets 3 free bids, starting at a $100 limit. Every used free bid raises its next limit by $100, up to $400.</span></li><li><b>03</b><span><strong>Know when free ends.</strong>Once free bids are gone—or an amount exceeds the current limit—the exact bid continues through Polar.</span></li></ol></section>
    <footer className="footer shell"><a className="brand" href="#top"><span className="logo-mark" aria-hidden="true"><i /><i /><i /></span><span>freeoutbid<em>.lol</em></span></a><p>Rankings may include free or promotional bids.</p><span>Leaderboard · Rules</span></footer>
    {notice && <div className="toast" role="status"><span>✓</span>{notice}<button onClick={() => setNotice("")} aria-label="Dismiss">×</button></div>}
    {celebrating && <div className="celebration" aria-hidden="true"><strong>HURRAY!</strong>{Array.from({ length: 16 }, (_, index) => <i key={index} style={{ "--i": index } as CSSProperties} />)}</div>}
    {pending && <div className="modal-backdrop" onMouseDown={() => setPending(null)}><section className="bid-modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setPending(null)} aria-label="Close">×</button><small>CONFIRM THIS BID</small><h2 id="confirm-title">Put {pending.domain}<br />at #{rank}</h2><div className="modal-stats"><div><span>YOUR BID</span><strong>${amount}</strong></div><div><span>PAY NOW</span><strong className={canUseFreeBid ? "free" : ""}>{canUseFreeBid ? "$0" : `$${amount}`}</strong></div><div><span>FREE BIDS LEFT</span><strong>{freeBids}</strong></div></div>{canUseFreeBid ? <><p>This uses one free bid. ${amount} is within this URL’s ${bidLimit} limit. After this bid: {freeBids - 1} free bid{freeBids - 1 === 1 ? "" : "s"} left and a ${Math.min(400, bidLimit + 100)} limit.</p><button className="claim-button modal-primary" onClick={placeFreeBid} disabled={loading}>{loading ? "Placing bid…" : "Place free bid"} <span>↗</span></button></> : <><p>{freeBidsGone ? "All 3 free bids are gone for this URL." : `Your $${bidLimit} free-bid limit is exceeded by $${amount - bidLimit}.`} Lower the amount or continue to Polar, which charges exactly ${amount}.</p><button className="claim-button modal-primary" onClick={payWithPolar} disabled={loading}>{loading ? "Opening Polar…" : `Pay $${amount} with Polar`} <span>↗</span></button><small className="polar-note">Secure Polar checkout · no freeoutbid account created</small></>}{checkoutError && <p className="checkout-error" role="alert">{checkoutError}</p>}<button className="cancel-button" onClick={() => setPending(null)}>Cancel</button></section></div>}
  </main>;
}
