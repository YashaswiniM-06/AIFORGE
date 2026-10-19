import {
  artworkMap,
  workbenchArtwork,
  findingVisual,
  revisionVisual,
  mountArtworkControls,
} from "./artwork-ui.js";
import { startWalkthrough, stopWalkthrough } from "./walkthrough.js";
import { panelZoneMapper, mountPanelZoneMapper } from "./panel-zones.js";
import { reviewPipeline } from "./review-pipeline.js";
import { storageDisclosure } from "./storage-disclosure.js";
import { engineStatusCopy } from "./engine-status-copy.js";
import { mergeReviewSummary } from "./review-summary.js";
import { sourceImpactView } from "./source-impact.js";
import "./review-actions.js";
const $ = (s) => document.querySelector(s),
  esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
const names = {
  issue: "Issue found",
  review: "Human review",
  unable: "Unable to verify",
  match: "Matches reference",
};
const symbols = { issue: "!", review: "?", unable: "—", match: "✓" };
let status = {},
  reviews = [],
  marketPresets = [],
  previousReview = null,
  current = null,
  view = "dashboard",
  tab = "findings",
  filter = "all",
  selectedFindingId = null,
  artworkPage = 1,
  activeEvidenceIndex = 0,
  artworkMode = "2d",
  cartonRotation = null,
  cartonTilt = -7,
  artworkZoom = 100,
  artworkViewport = { scale: 1, x: 0, y: 0 },
  showEvidenceBoxes = true,
  showPanelZones = false,
  timer = null,
  routeVersion = 0,
  reviewsRequest = null,
  uploads = [],
  revisionUpload = false,
  sourceRevisionUpload = false;
let theme = "light";
const workspaceDataLocation = storageDisclosure(location.hostname);
try {
  theme =
    localStorage.getItem("packproof-theme") ||
    (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
} catch {}
document.documentElement.dataset.theme = theme;
const date = (s) =>
  new Date(s).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
async function api(path, options = {}) {
  const { timeoutMs = 60_000, _retried, ...fetchOptions } = options;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetch("/api" + path, {
      ...fetchOptions,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(options.method && options.method !== "GET"
          ? { "x-packproof-token": status.csrf }
          : {}),
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(
        "PackSignal did not respond in time. Check that the local server is running, then retry.",
      );
    }
    throw new Error("Could not connect to PackSignal. Check the local server and retry.");
  } finally {
    clearTimeout(timeout);
  }
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error("The server returned an unexpected response.");
  }
  if (
    response.status === 403 &&
    result.error?.includes("request token") &&
    !_retried
  ) {
    status = await (await fetch("/api/status")).json();
    return api(path, { ...options, _retried: true });
  }
  if (!response.ok) throw new Error(result.error || "Request failed.");
  return result;
}
function toast(text) {
  $("#toast").textContent = text;
  $("#toast").classList.add("show");
  setTimeout(() => $("#toast").classList.remove("show"), 5000);
}
const pill = (s) => `<span class="pill ${esc(s)}">${esc(names[s] || s)}</span>`;
const compactEvidence = (value, limit = 118) => {
  const full = String(value ?? "").replace(/\s+/g, " ").trim();
  return full.length > limit ? `${full.slice(0, limit - 1).trimEnd()}…` : full;
};
function aiStatusLabel() {
  return ({
    verified: "Packaging Vision AI · Active",
    configured: "Packaging Vision AI · Ready",
    running: "Packaging Vision AI · Processing",
    attention: "Packaging Vision AI · Standby",
    not_configured: "Deterministic Engine · Ready",
  })[status.aiConnection] || "Deterministic Engine · Ready";
}
function shell(content) {
  $("#app").innerHTML =
    `<div class="shell"><aside class="sidebar"><button class="brand" data-action="home" aria-label="PackSignal home"><img src="/icon.svg" alt="">PackSignal</button><div class="workspace-label">REVIEW WORKSPACE</div><nav><button class="nav-item ${view === "dashboard" ? "active" : ""}" data-action="home"><span class="nav-icon">▦</span> Overview</button><button class="nav-item ${view === "review" ? "active" : ""}" data-action="history"><span class="nav-icon">▤</span> Review history</button><button class="nav-item" data-action="guide"><span class="nav-icon">◇</span> How it works</button></nav><div class="sidebar-bottom"><div class="side-note"><strong>Every finding has a source.</strong>Trace the fact, requirement, artwork evidence, and reviewer decision.</div><button class="connection" data-action="settings" title="Open AI status and settings"><span class="dot ${status.aiConnection === "verified" ? "" : "off"}"></span><span class="connection-label">${esc(aiStatusLabel())}</span></button><div class="avatar"><b>AIForge workspace</b>${esc(workspaceDataLocation.workspaceLabel)} · ${esc(workspaceDataLocation.storageLabel)}</div></div></aside><main class="main"><header class="topbar"><div class="breadcrumb">Workspace <span>/</span><b>${view === "review" ? "Artwork review" : "Overview"}</b></div><div class="actions"><span class="badge">ESKO AIFORGE 2026</span><button class="ghost theme-toggle" data-action="theme" aria-label="${theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}" aria-pressed="${theme === "dark"}">${theme === "dark" ? "☀" : "☾"}</button><button class="ghost" data-action="settings" aria-label="Settings">⚙</button></div></header><div class="content">${content}</div></main></div>`;
}
function dashboard() {
  routeVersion++;
  view = "dashboard";
  current = null;
  clearTimeout(timer);
  history.replaceState(null, "", "#");
  shell(
    `<section class="hero"><div><div class="eyebrow">THE PACKAGING COMPILER</div><h1>Ready for print starts<br>with proof.</h1><p>Turn product information, review rules, and artwork into an evidence-backed review. See what matches, what differs, and what needs your judgment.</p><div class="actions"><button class="primary" data-action="upload">+ New artwork review</button><button class="secondary" data-action="sample" data-sample="organizer">Explore organizer sample ↗</button><button class="textbutton tour-start" data-action="tour">First time? Start guided tour →</button></div></div><div class="hero-art" aria-hidden="true"><div class="package">proof.<small>EVERY DETAIL COUNTS</small></div><div class="proof-tag"><span>✓</span> Evidence connected</div></div></section>${analyticsView()}<div class="section-head"><div><h2>Start with the evidence</h2><p>Two complementary cases. Real source ambiguity and a controlled revision.</p></div></div><section class="cards"><article class="sample-card"><div class="tag">01 / OFFICIAL CHALLENGE FILES</div><h3>Dancing Fish · Berry Crunch</h3><p>A carton dieline and draft content sheet. Inspect ingredient discrepancies, nutrition ambiguity, and claims that need supporting evidence.</p><div class="file-chips"><span class="file-chip">1 artwork PDF</span><span class="file-chip">1 content spreadsheet</span><span class="file-chip">United States</span></div><button class="secondary" data-action="sample" data-sample="organizer">Review organizer files <span>→</span></button></article><article class="sample-card"><div class="tag">02 / CONTROLLED FICTIONAL CASE</div><h3>Fieldday · Original Oat Drink</h3><p>Find a quantity mismatch and missing storage copy. Then check a corrected revision that introduces a different omission.</p><div class="file-chips"><span class="file-chip">12 company checks</span><span class="file-chip">V1 → V2</span><span class="file-chip">Synthetic</span></div><button class="secondary" data-action="sample" data-sample="fieldday">Explore the revision story <span>→</span></button></article></section><section class="workflow" aria-label="Review process"><div><span class="step-num">01</span><b>Read the source</b><p>Keep facts attached to documents.</p></div><div><span class="step-num">02</span><b>Resolve uncertainty</b><p>Confirm drafts and conflicting values.</p></div><div><span class="step-num">03</span><b>Inspect the proof</b><p>Compare rules with artwork evidence.</p></div><div><span class="step-num">04</span><b>Review the revision</b><p>Recheck fixes and catch regressions.</p></div></section><section id="history"><div class="section-head"><div><h2>Recent reviews</h2><p>${esc(workspaceDataLocation.historyNotice)}</p></div><button class="textbutton subtle" data-action="refresh">Refresh</button></div>${historyTable()}</section><p class="footer-note">Scope: supplied sources and supported checks. PackSignal supports a human release decision; it does not certify legal compliance or authorize printing.</p>`,
  );
}
function rememberReviewSummary(review) {
  reviews = mergeReviewSummary(reviews, review);
}
function renderDashboardReviewData() {
  if (view !== "dashboard") return;
  const analytics = $(".analytics");
  if (analytics) analytics.outerHTML = analyticsView();
  const historySection = $("#history");
  if (historySection)
    historySection.innerHTML = `<div class="section-head"><div><h2>Recent reviews</h2><p>${esc(workspaceDataLocation.historyNotice)}</p></div><button class="textbutton subtle" data-action="refresh">Refresh</button></div>${historyTable()}`;
}
function refreshReviews() {
  if (!reviewsRequest) {
    const request = api("/reviews").then((items) => {
      reviews = items;
      return items;
    }).finally(() => {
      if (reviewsRequest === request) reviewsRequest = null;
    });
    reviewsRequest = request;
  }
  return reviewsRequest;
}
function showDashboard({ scrollToHistory = false } = {}) {
  if (view !== "dashboard") {
    dashboard();
    refreshReviews().then(renderDashboardReviewData).catch(() => {
      toast("Workspace opened, but recent reviews could not be refreshed.");
    });
  }
  if (scrollToHistory && view === "dashboard")
    $("#history")?.scrollIntoView({ behavior: "smooth" });
  else window.scrollTo({ top: 0, behavior: "smooth" });
}
function sourceLink(url) {
  try {
    const u = new URL(url);
    return u.protocol === "https:"
      ? `<a class="textbutton source-link" href="${esc(u.href)}" target="_blank" rel="noopener noreferrer">Official reference ↗</a>`
      : "";
  } catch {
    return "";
  }
}
function marketSelector(selected = "none", controlId = "market-preset") {
  return `<div class="field"><label for="${controlId}">Target market ruleset</label><select id="${controlId}" name="marketPreset">${marketPresets.map((p) => `<option value="${esc(p.id)}" ${p.id === selected ? "selected" : ""}>${esc(p.label)}</option>`).join("")}</select><small>Optional starter checklist. Text cues identify topics for review; they do not establish legal applicability, correct formatting, or full compliance.</small></div>`;
}
function analyticsView() {
  const completed = reviews.filter((r) => r.status === "ready" && r.counts),
    issues = completed.reduce((n, r) => n + (Number(r.counts.issue) || 0), 0),
    findings = completed.reduce(
      (n, r) =>
        n + Object.values(r.counts).reduce((x, v) => x + (Number(v) || 0), 0),
      0,
    ),
    durations = completed
      .map((r) => (Date.parse(r.finishedAt) - Date.parse(r.createdAt)) / 1000)
      .filter((n) => Number.isFinite(n) && n >= 0),
    seconds = durations.length
      ? durations.reduce((n, d) => n + d, 0) / durations.length
      : null;
  return `<section class="analytics" aria-label="Workspace analytics"><article><span>Completed reviews</span><strong>${completed.length}</strong><small>Saved in this workspace</small></article><article><span>Issue findings</span><strong>${issues}</strong><small>Includes repeat findings across versions</small></article><article><span>Findings per review</span><strong>${completed.length ? (findings / completed.length).toFixed(1) : "—"}</strong><small>Average across completed reviews</small></article><article><span>Average time to result</span><strong>${seconds === null ? "—" : seconds >= 60 ? (seconds / 60).toFixed(1) + " min" : Math.max(1, Math.round(seconds)) + " sec"}</strong><small>Measured queue + processing time</small></article></section>`;
}
async function guidedTour() {
  if ($("#dialog").open) $("#dialog").close();
  let organizerId;
  async function organizer(nextTab, { signal } = {}) {
    if (!organizerId) {
      reviews = await api("/reviews");
      organizerId = reviews.find(
        (r) => r.sample === "organizer" && r.status === "ready",
      )?.id;
      if (!organizerId) {
        const started = await api("/reviews", {
          method: "POST",
          body: {
            sample: "organizer",
            mode: "local",
            options: { completeArtwork: false, marketPreset: "none" },
          },
        });
        organizerId = started.id;
      }
    }
    const deadline = Date.now() + 120000;
    while (true) {
      if (signal?.aborted) return;
      const r = await api("/reviews/" + organizerId);
      if (r.status === "ready") break;
      if (r.status === "failed")
        throw new Error(r.error || "Organizer review could not finish.");
      if (Date.now() > deadline)
        throw new Error(
          "The review is still processing. Open it from Recent reviews when ready.",
        );
      await new Promise((resolve) => setTimeout(resolve, 900));
    }
    if (signal?.aborted) return;
    tab = nextTab;
    filter = "all";
    await openReview(organizerId);
  }
  await startWalkthrough([
    {
      selector: ".hero",
      title: "Start with the evidence",
      text: "PackSignal connects a product source, a requirement, artwork evidence, and a reviewer decision. This tour uses the real organizer files and local checks.",
      prepare: () => {
        reviews = reviews || [];
        dashboard();
      },
    },
    {
      selector: ".counts",
      title: "Four outcomes, with different meanings",
      text: "Matches, issues, human review, and unable to verify stay separate. A green result applies to one supported check; it does not authorize printing.",
      prepare: (context) => organizer("findings", context),
    },
    {
      selector: ".findings",
      title: "Every finding has a proof chain",
      text: "Open any finding after this tour to see expected copy, observed copy, source quotations, and the exact artwork region when available.",
      prepare: (context) => organizer("findings", context),
    },
    {
      selector: ".review-body",
      title: "Read the artwork coverage map",
      text: "Green regions match a checked source; red regions have issues; amber regions need judgment. Uncolored space has no located check. This is coverage, not a confidence score.",
      prepare: (context) => organizer("artwork", context),
    },
    {
      selector: ".source-list",
      title: "Resolve the source before approving copy",
      text: "The organizer spreadsheet is marked Draft / In Review. Inspect its cells, conflicting facts, and serving basis. Confirm only what you have actually checked.",
      prepare: (context) => organizer("sources", context),
    },
    {
      selector: ".review-body",
      title: "Know the boundaries of the review",
      text: "Check coverage keeps unsupported requirements visible. Optional market presets add review prompts with official references; they are not complete regulatory approval.",
      prepare: (context) => organizer("rules", context),
    },
    {
      selector: ".review-heading .actions",
      title: "Share an inspectable result",
      text: "Export a PDF or a self-contained HTML file with findings, source quotes, artwork, and decisions. For the version story, return home and open Fieldday V1, then Review revision.",
      prepare: (context) => organizer("findings", context),
    },
  ]);
}
function historyTable() {
  return reviews.length
    ? `<div class="table-wrap"><table><thead><tr><th>Review</th><th>Status</th><th>Created</th><th></th></tr></thead><tbody>${reviews.map((r) => `<tr><td><strong>${esc(r.name)}</strong><small>${esc(r.engine || "Processing documents")}</small></td><td>${r.status === "ready" ? `${r.counts.issue} ${r.counts.issue === 1 ? "issue" : "issues"} · ${r.counts.review} to review` : `<span class="pill unable">${esc(r.status)}</span>`}</td><td class="nowrap">${date(r.createdAt)}</td><td><button class="textbutton" data-action="open" data-id="${r.id}">Open →</button></td></tr>`).join("")}</tbody></table></div>`
    : `<div class="table-wrap empty">Your first review starts with the files above, or your own packaging artwork.</div>`;
}
function renderReviewLoadError(id, error) {
  clearTimeout(timer);
  view = "review";
  const message = error?.message || "The server did not return this review.";
  $("#app").innerHTML =
    `<main class="boot" role="alert"><div class="eyebrow">REVIEW UNAVAILABLE</div><h1>Couldn’t open this review.</h1><p>${esc(message)}</p><p>Try again, or open the workspace to see which reviews are currently available on this server.</p><div class="actions"><button class="primary" data-action="retry-review" data-id="${esc(id)}">Retry</button><button class="secondary" data-action="home">Open workspace</button></div></main>`;
}
async function openReview(id, initialReview = null) {
  const requestVersion = ++routeVersion;
  clearTimeout(timer);
  view = "review";
  history.replaceState(null, "", "#review/" + id);
  try {
    const nextReview = initialReview || await api("/reviews/" + id, { timeoutMs: 15_000 });
    if (requestVersion !== routeVersion) return;
    const isNew = current?.id !== id;
    if (isNew) {
      selectedFindingId = nextReview.findings?.find((item) => item.status === "issue" || item.status === "review")?.id || nextReview.findings?.[0]?.id || null;
      activeEvidenceIndex = 0;
      cartonRotation = null;
      artworkMode = "2d";
      artworkPage = 1;
      artworkZoom = 100;
      artworkViewport = { scale: 1, x: 0, y: 0 };
    }
    const hasChanged = isNew ||
      !current ||
      current.status !== nextReview.status ||
      current.aiStatus !== nextReview.aiStatus ||
      (current.findings?.length || 0) !== (nextReview.findings?.length || 0) ||
      (current.progress?.percent || 0) !== (nextReview.progress?.percent || 0) ||
      (current.updatedAt !== nextReview.updatedAt);

    current = nextReview;
    rememberReviewSummary(nextReview);
    if (hasChanged) {
      previousReview = null;
      renderReview();
      if (current.parentId) {
        try {
          const prior = await api("/reviews/" + current.parentId, { timeoutMs: 10_000 });
          if (requestVersion !== routeVersion) return;
          previousReview = prior;
          if (tab === "revisions") renderReview();
        } catch {
          // The revision itself is usable even if its optional comparison image cannot load.
          if (requestVersion === routeVersion) previousReview = null;
        }
      }
    }
    if (["queued", "processing"].includes(current.status) || ["pending", "running"].includes(current.aiStatus))
      timer = setTimeout(() => openReview(id), 1300);
  } catch (e) {
    if (requestVersion !== routeVersion) return;
    if (current?.id !== id) renderReviewLoadError(id, e);
    else toast(e.message);
  }
}
function renderReview() {
  const r = current;
  if (r.findings?.length && !r.findings.some((item) => item.id === selectedFindingId)) {
    selectedFindingId = r.findings.find((item) => item.status === "issue" || item.status === "review")?.id || r.findings[0].id;
    activeEvidenceIndex = 0;
  }
  const statusCounts = tab === "findings" || !r.counts ? "" : `<div class="counts">${["issue", "review", "unable", "match"].map((s) => `<button class="count ${s}" data-action="filter" data-filter="${s}"><b>${r.counts[s]}</b><span>${names[s]}</span></button>`).join("")}</div>`;
  if (["queued", "processing"].includes(r.status)) {
    shell(
      `<div class="progress"><div class="spinner"></div><div class="eyebrow">COMPILING YOUR REVIEW</div><h2>${esc(r.name)}</h2><p class="subtle">${esc(r.progress)}</p><div class="notice info">Files are being read and checked. This review will stay in your history if you leave this page.</div><button class="secondary" data-action="home">Back to workspace</button></div>`,
    );
    return;
  }
  if (r.status === "failed") {
    shell(
      `<div class="progress"><div class="eyebrow">PROCESSING STOPPED</div><h2>We couldn’t finish this review.</h2><p class="notice error">${esc(r.error)}</p><button class="primary" data-action="upload">Start a new review</button></div>`,
    );
    return;
  }
  shell(
    `<div class="review-heading"><div><div class="eyebrow">${r.revisionKind === "sources" ? "SOURCE UPDATE" : r.parentId ? "ARTWORK REVISION" : "EVIDENCE-LED REVIEW"}</div><h1>${esc(r.name)}</h1><div class="subtle">${esc(r.market)} · ${esc(r.engine)} · ${date(r.createdAt)}</div></div><div class="actions"><button class="secondary" data-action="revision">↻ Review revision</button><button class="secondary" data-action="verify-seal">Verify export seal</button><a class="secondary" href="/api/reviews/${r.id}/report.html">Shareable HTML ↓</a><a class="primary" href="/api/reviews/${r.id}/report.pdf" target="_blank" rel="noopener">Export PDF ↓</a></div></div>${reviewPipeline(r,tab)}${statusCounts}${r.aiStatus === "running" ? '<div class="notice info">Local checks are ready. Multimodal intelligence is analyzing artwork and visual evidence in the background.</div>' : ""}${r.aiError ? `<div class="notice error">AI status: ${esc(r.aiError)} Exact checks completed locally.</div>` : ""}${(r.ai?.warnings||[]).map((warning) => `<div class="notice">Vision coverage note: ${esc(warning)} Untranscribed content remains unverified.</div>`).join("")}${r.ai?.transport?.cacheHit ? '<div class="notice info">Reused verified intelligence cache for identical artwork and sources. Instant audit ready.</div>' : ""}${r.signature ? `<div class="notice info">Export seal · ${esc(r.signature.algorithm)} · ${esc(r.signature.payloadHash.slice(0, 16))}…</div>` : ""}${!r.coverage.completeArtwork ? `<div class="notice">Extraction coverage is not confirmed. Missing text is marked <b>Unable to verify</b> until a reviewer checks all supplied panels. <button class="textbutton" data-action="tab" data-tab="sources">Review sources →</button></div>` : ""}<div class="tabs" role="tablist">${[
      ["findings", "Findings"],
      ["artwork", "Artwork map"],
      ["sources", "Sources & decisions"],
      ["rules", "Check coverage"],
      ["revisions", "Revision comparison"],
      ["activity", "Activity"],
    ]
      .map(
        ([id, label]) =>
          `<button role="tab" aria-selected="${tab === id}" class="tab ${tab === id ? "active" : ""}" data-action="tab" data-tab="${id}">${label}</button>`,
      )
      .join(
        "",
      )}</div><div class="review-body">${tab === "findings" ? findingView() : tab === "artwork" ? artworkMap(r) : tab === "sources" ? sourceView() : tab === "rules" ? ruleView() : tab === "revisions" ? revisionView() : activityView()}</div><p class="footer-note">${r.coverage.limits.map(esc).join(" ")}</p>`,
  );
  mountArtworkControls($(".review-body"), {
    review: r,
    previous: previousReview,
    onProof: proof,
    onRotation: (angle, tilt) => { cartonRotation = angle; cartonTilt = tilt; },
    viewport: artworkViewport,
    onViewport: next => { artworkViewport = next; artworkZoom = Math.round(next.scale * 100); },
  });
  mountPanelZoneMapper($(".review-body"), r);
}
function findingView() {
  const r = current;
  let selected = r.findings.find((item) => item.id === selectedFindingId) || r.findings[0];
  if (!selected) return '<div class="panel empty">No findings were produced for this review.</div>';
  const rows = r.findings.filter((item) => filter === "all" || item.status === filter);
  if (!rows.some((item) => item.id === selected.id) && rows[0]) selected = rows[0];
  selectedFindingId = selected.id;
  const artworkItems = selected.evidence.map((item, index) => ({ item, index })).filter(({ item }) => item.role === "artwork" && item.page);
  if (!artworkItems.some(({ index }) => index === activeEvidenceIndex)) activeEvidenceIndex = artworkItems[0]?.index ?? 0;
  const activeArtwork = artworkItems.find(({ index }) => index === activeEvidenceIndex)?.item || artworkItems[0]?.item;
  const sourceItems = selected.evidence.filter((item) => item.role !== "artwork");
  const attention = r.counts.issue + r.counts.review;
  const question = nextBestQuestion(r);
  const occurrenceLabel = selected.rule?.field === "net_quantity" && artworkItems.length > 1 ? `<div class="occurrence-note">${artworkItems.length} package quantity declarations found · every located occurrence is checked</div>` : "";
  const contextHtml = (context) => context ? `<div class="source-context"><span>Product / SKU</span><b>${esc(context.productVariant || "Not identified")}</b><span>Column · row</span><b>${esc(context.columnHeading || "—")} · ${esc(context.rowLabel || "—")}</b><span>Serving basis</span><b>${esc(context.basis || "Not identified")}</b><span>Cell</span><b>${esc(context.sheet || "")}!${esc(context.cell || "")} · row ${esc(context.row || "")}</b></div>` : "";
  const nextIndex = r.findings.findIndex((item) => item.id === selected.id);
  const next = r.findings[(nextIndex + 1) % r.findings.length];
  return `<section class="workbench-intro"><div><div class="eyebrow">ARTWORK RELEASE REVIEW</div><h2>See the issue. Trace the evidence.</h2><p>${attention} finding${attention === 1 ? "" : "s"} need attention · ${r.counts.match} checks match supplied references</p></div><div class="workbench-attention">${r.counts.issue} ${r.counts.issue === 1 ? "issue" : "issues"} <span>·</span> ${r.counts.review} review question${r.counts.review === 1 ? "" : "s"}</div></section>${question ? `<section class="next-question"><div><div class="eyebrow">HIGHEST-VALUE NEXT QUESTION</div><b>${esc(question.question)}</b><p>${esc(question.context)} ${question.impact ? `Answering this can unblock ${question.impact} comparison${question.impact === 1 ? "" : "s"}.` : ""}</p></div><button class="secondary" data-action="tab" data-tab="sources">Review source evidence →</button></section>` : ""}<div class="review-workbench"><aside class="workbench-queue"><div class="queue-head"><div><div class="eyebrow">REVIEW QUEUE</div><b>${r.findings.length} checks</b></div><span>${attention} attention</span></div><div class="queue-filters">${["all", "issue", "review", "unable", "match"].map((value) => `<button class="filter ${filter === value ? "active" : ""}" data-action="filter" data-filter="${value}">${value === "all" ? "All" : names[value]}</button>`).join("")}</div><div class="queue-list">${rows.map((item, index) => `<button class="queue-finding ${item.status} ${item.id === selected.id ? "selected" : ""}" data-action="select-finding" data-id="${item.id}" aria-current="${item.id === selected.id ? "true" : "false"}"><span class="queue-index">${String(index + 1).padStart(2, "0")}</span><span class="queue-copy"><b>${esc(item.title)}</b><small>${names[item.status]}${r.decisions[item.id]?.stale ? " · decision needs reconfirmation" : ""}</small></span><span class="queue-status">${symbols[item.status]}</span></button>`).join("") || '<div class="queue-empty">No findings in this filter.</div>'}</div></aside><section class="workbench-canvas">${workbenchArtwork(r, selected, { mode: artworkMode, pageNumber: artworkPage, activeEvidenceIndex, cartonRotation, cartonTilt, zoom:artworkZoom, showBoxes:showEvidenceBoxes, showZones:showPanelZones })}<div class="workbench-occurrences">${occurrenceLabel}${artworkItems.map(({ item, index }, n) => `<button class="occurrence-button ${index === activeEvidenceIndex ? "active" : ""}" data-action="select-evidence" data-index="${index}"><span>${String(n + 1).padStart(2, "0")}</span><b>${esc(item.quote || `Artwork evidence · page ${item.page}`)}</b><small>Page ${item.page} · ${esc(item.location || "text region")}</small></button>`).join("")}</div></section><aside class="workbench-evidence"><div class="detail-status ${selected.status}">${symbols[selected.status]} ${names[selected.status].toUpperCase()}${selected.method === "visibility_review" ? " · IMAGE CROSS-CHECK" : ""}</div><div class="eyebrow">${selected.method === "visibility_review" ? "RENDERED TEXT CHECK" : selected.method === "exact_comparison" ? "DETERMINISTIC COMPARISON" : "REVIEW EVIDENCE"}</div><h3>${esc(selected.title)}</h3><p class="detail-explanation">${esc(selected.explanation)}</p><div class="detail-values"><div class="actual"><small>Artwork evidence</small><b>${esc(compactEvidence(activeArtwork?.quote || selected.observed || "Not detected in extracted content"))}</b>${activeArtwork ? `<small>Page ${activeArtwork.page} · ${esc(activeArtwork.location || "located text")}</small>` : ""}</div><div class="expected"><small>Supplied source says</small><b>${esc(compactEvidence(selected.expected || "No approved value available"))}</b></div></div>${artworkItems.length > 1 ? `<p class="subtle">Inspect each of the ${artworkItems.length} located occurrences above. One matching occurrence does not hide another mismatch.</p>` : ""}<section class="evidence-stack"><div class="muted-title">SOURCE → REQUIREMENT → ARTWORK</div>${sourceItems.map((item) => `<article class="workbench-source"><small>${esc(item.role)} · ${esc(item.location || "source evidence")}</small><b>${esc(item.name || "Supplied document")}</b><blockquote>${esc(item.quote || "No quoted source text")}</blockquote>${contextHtml(item.context)}</article>`).join("") || '<p class="subtle">No source quote is attached. Review the requirement and extraction limits before deciding.</p>'}${selected.rule?.text ? `<article class="workbench-source rule-source"><small>Applicable supplied requirement</small><blockquote>${esc(selected.rule.text)}</blockquote></article>` : ""}</section>${selected.visibility ? `<div class="visibility-note ${selected.visibility.state}"><b>${selected.visibility.state === "image_text_corroborated" ? "Image text cross-check found the same words" : selected.visibility.state === "needs_human_review" ? "PDF text exists, but visibility needs review" : "Rendered visibility was not independently checked"}</b><p>${selected.visibility.state === "image_text_corroborated" ? "The image transcription is a second reading aid, not proof of legibility, contrast, overlap, or print quality." : selected.visibility.state === "needs_human_review" ? "The image transcription did not repeat this text. Inspect the crop; an OCR miss is not proof that the text is invisible." : "Native PDF extraction cannot prove that text is visibly rendered. Inspect the highlighted crop at full size."}</p></div>` : activeArtwork ? `<div class="visibility-note not_checked"><b>Visibility needs a person</b><p>PDF text extraction cannot confirm visible ink, legibility, contrast, or overlap. Inspect this highlighted crop in the original artwork.</p></div>` : ""}<div class="workbench-actions"><button class="primary" data-action="proof" data-id="${selected.id}">Open proof & record decision →</button><button class="secondary" data-action="select-finding" data-id="${next.id}">Next finding →</button></div></aside></div>`;
}
function nextBestQuestion(review) {
  const conflicts = review.conflicts || [];
  if (conflicts.length) {
    const conflict = conflicts[0];
    const impact = review.findings.filter((finding) => finding.rule?.field === conflict.field).length;
    return { question: `Which ${conflict.label.toLowerCase()} source is approved for this SKU?`, context: conflict.facts.map((fact) => `${fact.value} · ${fact.evidence.name} · ${fact.evidence.location}`).join(" | "), impact };
  }
  const nutrition = review.facts.find((fact) => fact.ambiguous && fact.variants?.length);
  if (nutrition) {
    const impact = review.findings.filter((finding) => String(finding.rule?.field || "").startsWith("nutrition.")).length;
    return { question: "Which nutrition column and serving basis applies to this SKU?", context: nutrition.variants.map((variant) => `${variant.variant}: ${variant.value} · ${variant.cell}`).join(" | "), impact };
  }
  if (Object.values(review.options?.staleConfirmations || {}).some(Boolean)) return { question: "Can you reconfirm the reviewer decisions after their source or artwork dependencies changed?", context: "A prior confirmation was invalidated and remains unchecked until you review it again.", impact: 0 };
  if (!review.options?.sourceConfirmed && review.findings.some((finding) => finding.key === "source-status")) return { question: "Is this product reference approved for the current SKU and artwork revision?", context: review.findings.find((finding) => finding.key === "source-status")?.observed || "Source approval is unresolved.", impact: review.findings.filter((finding) => finding.status === "review").length };
  return null;
}
function sourceView() {
  const r = current,
    variants = [...new Set(r.documents.flatMap((d) => d.variants || []))],
    staleConfirmations = Object.entries(r.options?.staleConfirmations || {}).filter(([, stale]) => stale),
    choices = Object.entries(Object.groupBy(r.facts, (f) => f.field))
      .filter(([field, facts]) => new Set(facts.map((f) => f.value)).size > 1)
      .map(([field, facts]) => ({ field, label: facts[0].label, facts }));
  return `<div class="source-list">${r.documents.map((d) => `<article class="source-item"><span class="badge">${esc(d.role)}</span><b>${esc(d.name)}</b><p>${d.pages.length ? d.pages.length + " page(s) · " : ""}${d.cells.length ? d.cells.length + " source cells · " : ""}${(d.bytes / 1024).toFixed(0)} KB</p><a class="textbutton subtle" href="/api/reviews/${r.id}/files/${d.id}">Download source</a><p>${d.warnings.map(esc).join(" ")}</p><code>SHA-256 ${d.sha256}</code></article>`).join("")}</div><form id="source-form" class="panel" style="margin-top:20px"><h3>Reviewer confirmations</h3>${marketSelector(r.options?.marketPreset || "none", "source-market-preset")}<p class="subtle">Confirm only what you have actually inspected. Each change is recorded, and the checks are recalculated.</p>${staleConfirmations.length ? `<div class="notice"><b>Decision needs reconfirmation</b><p>A dependency changed for ${staleConfirmations.map(([key]) => esc(key.replace(/([A-Z])/g, " $1").toLowerCase())).join(", ")}. Review the current source or artwork before checking these confirmations again.</p></div>` : ""}${choices.map((c) => `<div class="notice"><b>Source choice · ${esc(c.label)}</b><div class="conflict-options"><label class="checkrow"><input type="radio" name="fact:${esc(c.field)}" value="" ${!r.options.factChoices?.[c.field] ? "checked" : ""}><span>Keep unresolved</span></label>${c.facts.map((f) => `<label class="checkrow"><input type="radio" name="fact:${esc(c.field)}" value="${f.id}" ${r.options.factChoices?.[c.field] === f.id ? "checked" : ""}><span>${esc(f.value)}<small class="subtle"> — ${esc(f.evidence.name)} · ${esc(f.evidence.location)}${f.sourceContext ? ` · ${esc(f.sourceContext.productVariant)} · ${esc(f.sourceContext.columnHeading)} · ${esc(f.sourceContext.rowLabel)}` : ""}</small></span></label>`).join("")}</div></div>`).join("")}<label class="checkrow"><input type="checkbox" name="completeArtwork" ${r.options.completeArtwork ? "checked" : ""}><span>I inspected all supplied artwork panels and confirm that the extracted text covers the required areas.<br><small class="subtle">Image-only or AI-transcribed pages still require manual absence verification.</small></span></label><label class="checkrow"><input type="checkbox" name="sourceConfirmed" ${r.options.sourceConfirmed ? "checked" : ""}><span>I confirm the supplied product reference is authoritative for this review.</span></label><label class="checkrow"><input type="checkbox" name="netQuantityConfirmed" ${r.options.netQuantityConfirmed ? "checked" : ""}><span>I verified that the measurement candidates in the net-quantity finding are package quantities, not nutrition or serving amounts.</span></label><label class="checkrow"><input type="checkbox" name="panelPlacementConfirmed" ${r.options.panelPlacementConfirmed ? "checked" : ""}><span>I visually confirmed that copy is on the panels specified in the checklist.</span></label>${r.ai?.rules?.length ? `<label class="checkrow"><input type="checkbox" name="aiRulesConfirmed" ${r.options.aiRulesConfirmed ? "checked" : ""}><span>I reviewed and accept the AI-proposed rule interpretations shown under Check coverage.</span></label>` : ""}${variants.length ? `<div class="field"><label for="nutrition-variant">Nutrition source column</label><select id="nutrition-variant" name="nutritionVariant"><option value="">Not confirmed</option>${variants.map((v) => `<option ${r.options.nutritionVariant === v ? "selected" : ""}>${esc(v)}</option>`).join("")}</select><small>Pack size alone does not establish a serving basis.</small></div><label class="checkrow"><input type="checkbox" name="nutritionBasisConfirmed" ${r.options.nutritionBasisConfirmed ? "checked" : ""}><span>I verified that this nutrition column uses the same serving basis as the artwork.</span></label>` : ""}<div class="field"><label for="source-reason">Decision rationale</label><textarea id="source-reason" name="reason" required minlength="3" maxlength="2000" placeholder="Explain what you checked, which source is approved, and any remaining limitations."></textarea></div><button class="primary" type="submit">Save decisions & recalculate</button><p id="source-error" class="dialog-error"></p></form><section class="panel"><h3>Packaging truth sheet</h3><p class="subtle">Extracted source facts. Conflicting alternatives remain visible here.</p>${r.facts.map((f) => `<div class="fact"><div><b>${esc(f.label)}</b><small>${f.aiProposed ? "AI-proposed · " : ""}${esc(f.evidence.location)}</small></div><div class="fact-value">${esc(f.value)}<small>${esc(f.evidence.name)}</small>${f.sourceContext ? `<small>Product / SKU: ${esc(f.sourceContext.productVariant)} · Column: ${esc(f.sourceContext.columnHeading)} · Row: ${esc(f.sourceContext.rowLabel)} · Basis: ${esc(f.sourceContext.basis)} · ${esc(f.sourceContext.sheet)}!${esc(f.sourceContext.cell)}</small>` : ""}${f.note ? `<small>${esc(f.note)}</small>` : ""}</div></div>`).join("") || '<p class="subtle">No structured facts were extracted. Connect AI or supply a field/value CSV.</p>'}</section>`;
}
function ruleView() {
  const r = current;
  return `<div class="notice info">${r.rules.length ? "Checks come from your supplied rulebook. AI interpretations require confirmation." : "No separate rulebook was supplied. These are product-source comparisons, not a regulatory checklist."} Unsupported requirements remain visible as unverified.</div><div class="panel"><h3>What was checked</h3>${r.findings.map((f) => `<div class="fact"><div><b>${esc(f.title)}</b><small>${esc(f.method)}</small></div><div class="fact-value">${esc(f.rule?.text || f.explanation)}<div style="margin-top:8px">${pill(f.status)} ${f.rule?.aiProposed ? '<span class="badge">AI PROPOSAL</span>' : ""}${sourceLink(f.rule?.sourceURL)}</div></div></div>`).join("")}</div><div class="panel"><h3>Outside this review’s coverage</h3>${r.coverage.limits.map((x) => `<p class="subtle">${esc(x)}</p>`).join("")}</div>`;
}
function revisionView() {
  const r = current;
  return r.revision
    ? `${r.revision.kind === "artwork" && previousReview ? revisionVisual(r, previousReview) : ""}${sourceImpactView(r.revision)}<div class="notice info">${r.revision.kind === "sources" ? "The source update reran supported checks against the retained artwork. Earlier decisions tied to changed sources are listed above for rechecking." : "Every supported check ran again. A reviewer’s acknowledgment does not count as a correction. “Resolved” means the new artwork now matches that supplied check."}</div><div class="actions" style="margin-bottom:18px"><button class="secondary" data-action="open" data-id="${r.revision.previousId}">← Open previous review</button><button class="secondary" data-action="revision">Update another input ↗</button></div><div class="panel">${r.revision.changes.map((c) => `<div class="revision-row"><div><b>${esc(c.title)}</b><div class="subtle ${c.change}">${esc(c.change.replaceAll("_", " "))}</div></div><div>${c.before ? pill(c.before) : "New check"}</div><div>${c.after ? pill(c.after) : "Not rechecked"}</div></div>`).join("")}</div>`
    : `<div class="panel empty"><h3>Artwork, specifications, and checklists can all change.</h3><p class="subtle">Upload revised artwork to rerun every check. Or update a specification or checklist while retaining this artwork and its confirmed package mapping.</p><button class="primary" data-action="revision">Compare an update →</button></div>`;
}
function activityView() {
  return `<div class="panel"><div class="actions"><a class="secondary" href="/api/reviews/${current.id}/report.json">Download full JSON record ↓</a></div>${[
    ...current.audit,
  ]
    .reverse()
    .map(
      (e) =>
        `<div class="audit-item"><time>${date(e.at)}</time><b>${esc(e.action.replaceAll("_", " "))}</b><div>${esc(e.detail)}</div></div>`,
    )
    .join("")}</div>`;
}
function dialog(title, content, footer = "", wide = false) {
  const el = $("#dialog");
  el.className = wide ? "wide" : "";
  el.innerHTML = `<div class="dialog-header"><h2>${title}</h2><button class="ghost" data-action="close" aria-label="Close dialog">✕</button></div><div class="dialog-content">${content}</div>${footer ? `<div class="dialog-footer">${footer}</div>` : ""}`;
  if (!el.open) el.showModal();
}
function modeSelector() {
  return `<div class="field"><label for="review-mode">Analysis mode</label><select id="review-mode"><option value="ai" selected>AI assisted · recommended (Packaging Intelligence)</option><option value="local">Deterministic Prepress Checks only</option></select><small>Runs coordinate proofing, tabular specification checks, and multimodal artwork verification.</small></div>`;
}
function sampleDialog(sample) {
  const official = sample === "organizer";
  dialog(
    official ? "Review the organizer files" : "Explore a controlled example",
    `<div class="eyebrow">${official ? "OFFICIAL ESKO AIFORGE SAMPLE" : "FICTIONAL DEMO MATERIALS"}</div><p class="subtle">${official ? "Dancing Fish carton PDF + US content spreadsheet. The spreadsheet is marked Draft / In Review. Its nutrition columns and ingredient differences need human judgment." : "Fieldday Original Oat Drink: a product specification, company checklist, claims register, and artwork. These materials are created for demonstration and do not represent a real brand."}</p>${modeSelector()}${marketSelector()}${!official ? `<div class="field"><label for="sample-variant">Example</label><select id="sample-variant"><option value="fieldday" ${sample === "fieldday" ? "selected" : ""}>V1 · quantity mismatch, missing copy, claim review</option><option value="clean" ${sample === "clean" ? "selected" : ""}>Baseline · correct copy, review claim conditions</option><option value="conflict" ${sample === "conflict" ? "selected" : ""}>V1 + conflicting handover note</option><option value="signals" ${sample === "signals" ? "selected" : ""}>Language + barcode / QR signals</option></select></div>` : ""}<div class="notice">Missing text is initially unverified. Confirm extraction coverage in Sources after inspecting the artwork.</div><p id="dialog-error" class="dialog-error"></p>`,
    `<button class="secondary" data-action="close">Cancel</button><button class="primary" data-action="run-sample" data-sample="${sample}">Start review →</button>`,
  );
}
async function runSample(sample, button) {
  button.disabled = true;
  try {
    const r = await api("/reviews", {
      method: "POST",
      body: {
        sample: $("#sample-variant")?.value || sample,
        mode: $("#review-mode").value,
        options: {
          completeArtwork: false,
          marketPreset: $("#market-preset")?.value || "none",
        },
      },
    });
    $("#dialog").close();
    tab = "findings";
    filter = "all";
    await openReview(r.id);
  } catch (e) {
    $("#dialog-error").textContent = e.message;
    button.disabled = false;
  }
}
async function settings() {
  status = await api("/status");
  const copy = engineStatusCopy(status);
  dialog(
    "PackSignal Prepress Engine",
    `<section class="panel"><div class="eyebrow">PACKSIGNAL · CORE ARCHITECTURE</div><h3>${esc(aiStatusLabel())}</h3><p>${esc(copy.connection)}</p><p><b>Architecture:</b> Multimodal artwork review + deterministic comparisons<br><b>Review pipeline:</b> Document text, spreadsheet cells, and located artwork evidence<br><b>Availability:</b> Bounded retries; configured alternate credentials may be tried<br><b>Credential handling:</b> ${esc(copy.credentials)}</p></section>${usageSummary()}<p class="subtle">PackSignal compares supplied product information, company rules, and packaging artwork. Human review remains necessary for uncertain items and release decisions.</p>`,
  );
}
function usageSummary() {
  const copy = engineStatusCopy(status);
  return `<div class="panel"><h3>Engine Health & Availability</h3><p><b>Service check:</b> ${esc(copy.service)}<br><b>Provider pacing:</b> ${esc(copy.pacing)}</p>${copy.cooldownUntil ? `<div class="notice">One or more provider keys are cooling down until ${esc(date(copy.cooldownUntil))}.</div>` : ""}${copy.allowance ? `<div class="notice">${esc(copy.allowance)}</div>` : ""}<small class="subtle">${esc(copy.lastDispatch)} ${esc(copy.failover)}</small></div>`;
}
function showUpload(revision = false, sourceRevision = false) {
  uploads = [];
  revisionUpload = revision;
  sourceRevisionUpload = sourceRevision;
  const sourceTargets = (current?.files || []).filter(file => ["spec", "rules", "claims"].includes(file.role));
  const sourceLabel = sourceRevision ? "Replace selected specifications or checklists" : revision ? "Choose one revised artwork" : "Choose artwork, references, and an optional dieline";
  const accepted = sourceRevision ? ".pdf,.xlsx,.docx,.csv,.json,.txt,.md" : revision ? ".pdf,.png,.jpg,.jpeg,.webp" : ".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.docx,.csv,.json,.txt,.md,.dxf";
  const help = sourceRevision ? "PDF, XLSX, DOCX, CSV, JSON, TXT, MD · choose which existing source each file replaces" : "PDF, images, ASCII DXF (LINE / LWPOLYLINE), XLSX, DOCX, CSV, JSON, TXT, MD · 15 MB per file · 30 MB total";
  dialog(
    sourceRevision ? "Update specifications or checklist" : revision ? "Review revised artwork" : "New artwork review",
    `<form id="upload-form">${revision ? `<p class="subtle">The same references will be retained. Upload one revised artwork to recompute findings.</p>` : sourceRevision ? `<p class="subtle">The artwork and confirmed face mapping stay unchanged. Choose one or more existing specification, checklist, or claims files to replace.</p>${sourceTargets.length ? "" : '<div class="notice">This review has no replaceable source files.</div>'}` : `<div class="field"><label for="review-name">Review name</label><input id="review-name" value="New packaging review" required maxlength="120"></div><div class="field"><label for="market">Target market / scope</label><input id="market" placeholder="For example: US · supplied company checklist" maxlength="60"></div>`}<div class="upload-box"><b>${esc(sourceLabel)}</b><br><span class="subtle">${esc(help)}</span><br><input type="file" id="files" ${revision ? "" : "multiple"} accept="${accepted}" aria-label="Select files" ${sourceRevision && !sourceTargets.length ? "disabled" : ""}></div><div id="upload-list"></div>${modeSelector()}${marketSelector(revision || sourceRevision ? current.options?.marketPreset || "none" : "none")}<p class="subtle">${sourceRevision ? "Each replacement keeps the existing source role. The original review remains available in history." : `For a package-specific preview, add a dieline and confirm the artwork-face mapping under Sources after upload. DXF layer names can show cut/crease cues; the 3D package form remains illustrative. ${esc(workspaceDataLocation.uploadNotice)}`}</p><p id="dialog-error" class="dialog-error"></p></form>`,
    `<button class="secondary" data-action="close">Cancel</button><button class="primary" type="submit" form="upload-form">${sourceRevision ? "Compare source changes" : revision ? "Compare artwork" : "Create review"} →</button>`,
  );
}
function uploadList() {
  const sourceTargets = (current?.files || []).filter(file => ["spec", "rules", "claims"].includes(file.role));
  $("#upload-list").innerHTML = uploads
    .map(
      (f, i) =>
        `<div class="upload-row"><span>${esc(f.name)}<small class="subtle"> · ${(f.size / 1024).toFixed(0)} KB</small></span>${sourceRevisionUpload ? `<select aria-label="Source file replaced by ${esc(f.name)}" data-replace-source="${i}">${sourceTargets.map(source => `<option value="${esc(source.id)}" ${f.replaceFileId === source.id ? "selected" : ""}>${esc({spec:"Product spec",rules:"Checklist",claims:"Claims register"}[source.role])} · ${esc(source.name)}</option>`).join("")}</select>` : `<select aria-label="Role for ${esc(f.name)}" data-upload="${i}" ${revisionUpload ? "disabled" : ""}>${["artwork", "dieline", "spec", "rules", "claims"].map((role) => `<option value="${role}" ${f.role === role ? "selected" : ""}>${{ artwork: "Artwork", dieline: "Dieline / structural reference", spec: "Product spec", rules: "Rulebook", claims: "Claims register" }[role]}</option>`).join("")}</select>`}<button type="button" data-action="remove-file" data-index="${i}" aria-label="Remove ${esc(f.name)}">×</button></div>`,
    )
    .join("");
}
async function encode(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = () => reject(new Error("Could not read " + file.name));
    reader.readAsDataURL(file);
  });
}
function revisionDialog() {
  const fictional = ["fieldday", "clean", "conflict"].includes(current.sample);
  dialog(
    "Compare an artwork or source update",
    `<p class="subtle">Choose what changed. Each update creates a new review linked to this one; the original evidence remains in history.</p>${fictional ? '<div class="notice info">The fictional V2 corrects quantity and storage copy, but removes the customer-care email. Its artwork and geometry stay unchanged in a source-only update.</div>' : ""}${modeSelector()}${marketSelector(current.options?.marketPreset || "none")}<p id="dialog-error" class="dialog-error"></p>`,
    `<button class="secondary" data-action="upload-source-revision">Update specification / checklist</button><button class="secondary" data-action="upload-revision">Upload revised artwork</button>${fictional ? '<button class="primary" data-action="sample-revision">Run Fieldday V2 →</button>' : ""}`,
  );
}
function proof(id) {
  const f = current.findings.find((f) => f.id === id);
  if (!f) return;
  const evs = [
    ...new Map(f.evidence.map((e) => [JSON.stringify(e), e])).values(),
  ];
  const artifact = current.documents.find((d) => d.role === "artwork"),
    artEv = evs.find((e) => e.role === "artwork" && e.page),
    page =
      artifact.pages.find((p) => p.number === artEv?.page) || artifact.pages[0],
    box = artEv?.box,
    decision = current.decisions[id];
  const evidenceCards = evs.map((e) => `<article class="evidence-card ${e.role !== "artwork" ? "trace-source" : ""}" ${e.role !== "artwork" ? "data-trace-source" : ""}><small>${esc(e.role)} · ${esc(e.location)}</small><h4>${esc(e.name)}</h4><blockquote>${esc(e.quote)}</blockquote></article>`).join("");
  const proofContent = `${pill(f.status)}<p class="subtle">${esc(f.explanation)}</p><div class="value-pair"><div><small>Expected from source</small>${esc(f.expected)}</div><div><small>Observed on artwork</small>${esc(f.observed)}</div></div><div class="proof-grid" data-proof-grid><svg class="proof-trace-connector" data-proof-connector hidden aria-hidden="true"><path></path><circle data-trace-start r="4"></circle><circle data-trace-end r="4"></circle></svg><section class="proof-source-column"><div class="muted-title">SOURCE → REQUIREMENT</div>${evidenceCards || '<p class="subtle">No reliable evidence was located for this check.</p>'}${f.rule ? `<div class="evidence-card trace-rule" data-trace-rule><small>Applicable supplied requirement</small><blockquote>${esc(f.rule.text)}</blockquote>${sourceLink(f.rule.sourceURL)}</div>` : ""}</section><section class="proof-art-column"><div class="muted-title">ARTWORK EVIDENCE</div>${findingVisual(current, f)}<p class="art-label">Page ${page.number} · source artwork remains unchanged. Inspect the full original before making a production decision. <a href="/api/reviews/${current.id}/images/${page.image}" target="_blank" rel="noopener">Open full size ↗</a></p><form id="decision-form" data-id="${id}"><h3 style="font-size:15px">Reviewer decision</h3>${decision?.stale ? '<div class="notice">The source comparison changed after this decision. Review and record a fresh decision.</div>' : ""}<p class="subtle">A decision records your judgment. It does not turn a mismatch into a passing check.</p><div class="field"><label for="disposition">Disposition</label><select id="disposition">${[["open", "Keep open"], ["needs_changes", "Request a change"], ["acknowledged", "Acknowledge finding"], ["accepted_exception", "Accept an exception"]].map(([value, label]) => `<option value="${value}" ${decision?.disposition === value ? "selected" : ""}>${label}</option>`).join("")}</select></div><div class="field"><label for="decision-note">Reason / next action</label><textarea id="decision-note" minlength="3" maxlength="2000" required placeholder="What did you decide, and why?">${esc(decision?.note || "")}</textarea></div><p id="dialog-error" class="dialog-error"></p><button class="primary" type="submit">Record decision</button></form></section></div>`;
  dialog(
    esc(f.title),
    proofContent,
    "",
    true,
  );
  mountArtworkControls($("#dialog"), { review: current, onProof: proof });
  mountFindingTools(f, evs, artEv);
}

function mountFindingTools(finding, evidenceItems, artworkEvidence) {
  const content = $("#dialog .dialog-content");
  if (!content) return;
  const coordinate =
    artworkEvidence?.box
      ?.map((value) => Math.round(value * 1000) / 1000)
      .join(", ") || "not available";
  const source = evidenceItems.find((item) => item.role === "spec");
  const panel = finding.rule?.panel && finding.rule.panel !== "all"
    ? finding.rule.panel
    : "Not established by this check";
  const sourceState = current.options?.sourceConfirmed
    ? "Reviewer-confirmed for this review; approver identity is not independently authenticated."
    : "Authority not confirmed; verify with the source owner before editing.";
  const requirement = finding.rule?.text || "See the supplied requirement shown in this finding.";
  const ticket = `PREPRESS CHANGE REQUEST\nFinding: ${finding.title}\nTarget panel: ${panel}\nArtwork: ${artworkEvidence?.page ? `page ${artworkEvidence.page}, normalized box [${coordinate}]` : "location unavailable; inspect the full source artwork"}\nObserved: ${finding.observed || "not detected"}\nSupplied reference: ${finding.expected || "confirm with the source owner"}\nReference authority: ${sourceState}\nRequirement: ${requirement}\nSource: ${source ? `${source.name} · ${source.location} · “${source.quote}”` : "see linked evidence in PackSignal"}\nType-size or prepress prescription: Not specified by this finding. Confirm applicable production requirements; none are invented here.\nAction: Confirm the source, inspect the original artwork, and make only an authorized change. Attach an approved override if the artwork is intentional.`;
  const section = document.createElement("section");
  section.className = "panel finding-actions";
  section.innerHTML = `<div class="eyebrow">FINDING ACTIONS</div><h3>Prepare the next step</h3><button type="button" class="secondary" data-ticket>Copy designer change request</button><form data-question-form><div class="field"><label for="finding-question">Query this finding</label><textarea id="finding-question" minlength="3" maxlength="1000" placeholder="Ask about only this source, rule and artwork evidence." ${status.aiConfigured ? "" : "disabled"}></textarea><small>The intelligence engine inspects only this finding’s verified evidence. The response stays anchored to the artwork context.</small></div><button type="submit" class="secondary" ${status.aiConfigured ? "" : "disabled"}>Query Evidence ↗</button><p data-answer role="status" class="subtle"></p></form></section>`;
  content.append(section);
  section.querySelector("[data-ticket]").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(ticket);
      toast("Designer change request copied.");
    } catch {
      const input = document.createElement("textarea");
      input.value = ticket;
      content.append(input);
      input.select();
      document.execCommand("copy");
      input.remove();
      toast("Designer change request copied.");
    }
  });
  section
    .querySelector("[data-question-form]")
    .addEventListener("submit", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const question = section.querySelector("#finding-question").value.trim(),
        output = section.querySelector("[data-answer]"),
        button = event.submitter;
      button.disabled = true;
      output.textContent = "Checking the evidence for this finding…";
      try {
        const result = await api("/reviews/" + current.id + "/ask", {
          method: "POST",
          body: { findingId: finding.id, question },
        });
        output.textContent =
          result.answer +
          (result.evidenceUsed?.length
            ? " Evidence used: " + result.evidenceUsed.join("; ")
            : "");
      } catch (error) {
        output.textContent = error.message;
      } finally {
        button.disabled = false;
      }
    });
}
function guide() {
  dialog(
    "How PackSignal works",
    `<div class="eyebrow">A REVIEW YOU CAN INSPECT</div>${[
      [
        "1. Establish the reference",
        "Upload product information and a supplied checklist. Draft and conflicting sources need explicit decisions.",
      ],
      [
        "2. Compile supported checks",
        "Local parsing extracts native text and spreadsheet cells. Packaging intelligence proposes facts, rule interpretations, and visual observations with exact quotations.",
      ],
      [
        "3. Inspect the proof chain",
        "Each finding links the source expectation to artwork evidence. Missing text is uncertain until extraction coverage is reviewed.",
      ],
      [
        "4. Record a human decision",
        "Request changes, acknowledge a finding, or accept an exception with a reason. The machine result stays intact.",
      ],
      [
        "5. Recheck the revision",
        "Run every supported check against revised artwork. Export a PDF or full JSON record.",
      ],
    ]
      .map(
        ([h, p]) =>
          `<div class="panel"><h3>${h}</h3><p class="subtle">${p}</p></div>`,
      )
      .join(
        "",
      )}<div class="notice">This prototype checks supplied documents. Legal applicability, print production, barcodes, and final release approval remain outside its certification scope.</div>`,
  );
}
document.addEventListener("click", async (event) => {
  const b = event.target.closest("[data-action]");
  if (!b) return;
  const action = b.dataset.action;
  if (
    [
      "home",
      "history",
      "open",
      "upload",
      "revision",
      "upload-source-revision",
      "upload-revision",
      "settings",
      "proof",
      "select-finding",
    ].includes(action)
  )
    stopWalkthrough();
  try {
    if (action === "theme") {
      theme = theme === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = theme;
      try {
        localStorage.setItem("packproof-theme", theme);
      } catch {}
      b.textContent = theme === "dark" ? "☀" : "☾";
      b.setAttribute("aria-pressed", String(theme === "dark"));
      b.setAttribute(
        "aria-label",
        theme === "dark" ? "Switch to light mode" : "Switch to dark mode",
      );
    }
    if (action === "tour") await guidedTour();
    if (action === "home") showDashboard();
    if (action === "history") {
      showDashboard({ scrollToHistory: true });
    }
    if (action === "refresh") {
      await refreshReviews();
      renderDashboardReviewData();
    }
    if (action === "close") $("#dialog").close();
    if (action === "settings") await settings();
    if (action === "guide") guide();
    if (action === "sample") sampleDialog(b.dataset.sample);
    if (action === "run-sample") await runSample(b.dataset.sample, b);
    if (action === "open") {
      tab = "findings";
      filter = "all";
      await openReview(b.dataset.id);
    }
    if (action === "retry-review") await openReview(b.dataset.id);
    if (action === "tab") {
      tab = b.dataset.tab;
      renderReview();
    }
    if (action === "filter") {
      filter = b.dataset.filter;
      tab = "findings";
      renderReview();
    }
    if (action === "select-finding") {
      selectedFindingId = b.dataset.id;
      artworkZoom = 100;
      artworkViewport = { scale: 1, x: 0, y: 0 };
      const requestedEvidence = Number(b.dataset.evidenceIndex);
      activeEvidenceIndex = Number.isInteger(requestedEvidence) ? requestedEvidence : 0;
      cartonRotation = null;
      cartonTilt = -7;
      const finding = current.findings.find((item) => item.id === selectedFindingId);
      const first = finding?.evidence?.find((item) => item.role === "artwork" && item.page);
      artworkPage = first?.page || 1;
      tab = "findings";
      renderReview();
    }
    if (action === "select-evidence") {
      activeEvidenceIndex = Number(b.dataset.index);
      artworkZoom = 100;
      artworkViewport = { scale: 1, x: 0, y: 0 };
      cartonRotation = null;
      cartonTilt = -7;
      const finding = current.findings.find((item) => item.id === selectedFindingId);
      const evidence = finding?.evidence?.[activeEvidenceIndex];
      if (evidence?.page) artworkPage = evidence.page;
      renderReview();
    }
    if (action === "workbench-mode") {
      artworkMode = b.dataset.mode === "3d" ? "3d" : "2d";
      renderReview();
    }
    if (action === "proof") proof(b.dataset.id);
    if (action === "upload") showUpload();
    if (action === "revision") revisionDialog();
    if (action === "upload-revision") showUpload(true);
    if (action === "upload-source-revision") showUpload(false, true);
    if (action === "remove-file") {
      uploads.splice(Number(b.dataset.index), 1);
      uploadList();
    }
    if (action === "sample-revision") {
      b.disabled = true;
      const r = await api("/reviews", {
        method: "POST",
        body: {
          parentId: current.id,
          sampleRevision: true,
          mode: $("#review-mode").value,
          options: {
            completeArtwork: false,
            marketPreset: $("#market-preset")?.value || "none",
          },
        },
      });
      $("#dialog").close();
      tab = "revisions";
      await openReview(r.id);
    }
  } catch (e) {
    const err = $("#dialog-error");
    if (err) err.textContent = e.message;
    else toast(e.message);
    b.disabled = false;
  }
});
document.addEventListener("input", (event) => {
  if (event.target.matches("[data-workbench-zoom]")) artworkZoom = Number(event.target.value) || 100;
  if (event.target.matches("[data-layer-boxes]")) showEvidenceBoxes = event.target.checked;
  if (event.target.matches("[data-layer-zones]")) showPanelZones = event.target.checked;
});
document.addEventListener("change", (event) => {
  if (event.target.matches("[data-workbench-page]")) {
    artworkPage = Number(event.target.value) || 1;
    artworkZoom = 100;
    artworkViewport = { scale: 1, x: 0, y: 0 };
    renderReview();
  }
  if (event.target.id === "files") {
    const added = Array.from(event.target.files);
    for (const file of added) {
      if (sourceRevisionUpload) {
        const targets = current.files.filter(source => ["spec", "rules", "claims"].includes(source.role));
        const preferred = /rule|checklist|policy/i.test(file.name) ? "rules" : /claim/i.test(file.name) ? "claims" : "spec";
        const target = targets.find(source => source.role === preferred) || targets[0];
        file.replaceFileId = target?.id || "";
        file.role = target?.role || "spec";
      } else file.role = revisionUpload
        ? "artwork"
        : /dieline|cutline|die-line/i.test(file.name)
          ? "dieline"
          : !uploads.some((f) => f.role === "artwork") &&
            /\.(pdf|png|jpe?g|webp)$/i.test(file.name)
          ? "artwork"
          : /rule|checklist/i.test(file.name)
            ? "rules"
            : /claim/i.test(file.name)
              ? "claims"
              : "spec";
      uploads.push(file);
    }
    uploadList();
    event.target.value = "";
  }
  if (event.target.dataset.replaceSource !== undefined) {
    const file = uploads[Number(event.target.dataset.replaceSource)];
    file.replaceFileId = event.target.value;
    file.role = current.files.find(source => source.id === file.replaceFileId)?.role || "spec";
  }
  if (event.target.dataset.upload !== undefined)
    uploads[Number(event.target.dataset.upload)].role = event.target.value;
});
document.addEventListener("submit", async (event) => {
  const form = event.target;
  event.preventDefault();
  const button =
    document.querySelector(`[form="${form.id}"]`) ||
    form.querySelector("button[type=submit]");
  if (button) button.disabled = true;
  try {
    if (form.id === "upload-form") {
      if (uploads.length > (revisionUpload ? 1 : 8) || !uploads.length)
        throw new Error(sourceRevisionUpload ? "Choose at least one source file to replace." : revisionUpload ? "Choose one artwork." : "Choose up to eight files.");
      if (sourceRevisionUpload) {
        const replacements = uploads.map(file => file.replaceFileId);
        if (replacements.some(id => !id) || new Set(replacements).size !== replacements.length)
          throw new Error("Choose a different existing source file for each replacement.");
      }
      if (
        uploads.some((f) => f.size > 15000000) ||
        uploads.reduce((n, f) => n + f.size, 0) > 30000000
      )
        throw new Error("Limit: 15 MB per file, 30 MB per review.");
      const files = await Promise.all(
        uploads.map(async (f) => ({
          name: f.name,
          role: f.role,
          base64: await encode(f),
          ...(sourceRevisionUpload ? { replacesFileId: f.replaceFileId } : {}),
        })),
      );
      const r = await api("/reviews", {
        method: "POST",
        body: {
          ...(sourceRevisionUpload
            ? { parentId: current.id, sourceRevision: true }
            : revisionUpload
            ? { parentId: current.id }
            : { name: $("#review-name").value, market: $("#market").value }),
          files,
          mode: $("#review-mode").value,
          options: {
            completeArtwork: false,
            marketPreset: $("#market-preset")?.value || "none",
          },
        },
      });
      $("#dialog").close();
      tab = revisionUpload || sourceRevisionUpload ? "revisions" : "findings";
      filter = "all";
      await openReview(r.id);
    }
    if (form.id === "decision-form") {
      current = await api("/reviews/" + current.id + "/decisions", {
        method: "POST",
        body: {
          findingId: form.dataset.id,
          disposition: $("#disposition").value,
          note: $("#decision-note").value,
        },
      });
      $("#dialog").close();
      renderReview();
      toast("Decision recorded. The original check result is preserved.");
    }
    if (form.id === "source-form") {
      const data = new FormData(form),
        factChoices = {};
      for (const [key, value] of data)
        if (key.startsWith("fact:")) factChoices[key.slice(5)] = value;
      const fields = {
        reason: data.get("reason"),
        factChoices,
        marketPreset: data.get("marketPreset") || "none",
        panelZones: JSON.parse(data.get("panelZones") || "{}"),
        legibilityThresholdMm: data.get("legibilityThresholdMm"),
          packageType: data.get("packageType") || undefined,
      };
      for (const key of [
        "completeArtwork",
        "sourceConfirmed",
        "aiRulesConfirmed",
        "nutritionBasisConfirmed",
        "panelPlacementConfirmed",
        "packageMappingConfirmed",
        "netQuantityConfirmed",
      ])
        if (form.elements[key]) fields[key] = data.has(key);
      if (form.elements.nutritionVariant)
        fields.nutritionVariant = data.get("nutritionVariant");
      current = await api("/reviews/" + current.id + "/sources", {
        method: "POST",
        body: fields,
      });
      renderReview();
      toast("Source decisions recorded and findings recalculated.");
    }
  } catch (e) {
    const error =
      form.id === "source-form" ? $("#source-error") : $("#dialog-error");
    if (error) error.textContent = e.message;
    else toast(e.message);
  } finally {
    if (button) button.disabled = false;
  }
});
try {
  const id = location.hash.match(/^#review\/([a-f0-9-]{36})$/)?.[1];
  const initialReview = id
    ? api("/reviews/" + id, { timeoutMs: 15_000 }).then(
        (review) => ({ review }),
        (error) => ({ error }),
      )
    : null;
  const startupData = await Promise.all([
    api("/status", { timeoutMs: 12_000 }),
    api("/market-presets", { timeoutMs: 12_000 }),
    id ? Promise.resolve([]) : api("/reviews", { timeoutMs: 20_000 }),
  ]);
  [status, marketPresets, reviews] = startupData;
  if (id) {
    const result = await initialReview;
    if (result.error) renderReviewLoadError(id, result.error);
    else await openReview(id, result.review);
  } else dashboard();
} catch (e) {
  const id = location.hash.match(/^#review\/([a-f0-9-]{36})$/)?.[1];
  if (id) renderReviewLoadError(id, e);
  else {
    $("#app").innerHTML =
      `<main class="boot" role="alert"><div class="eyebrow">LOCAL WORKSPACE</div><h1>PackSignal could not finish loading.</h1><p>${esc(e.message)}</p><p>If you see <code>EADDRINUSE</code> after starting the app, an existing PackSignal server is already using port 4173; keep it running and refresh this page.</p><button class="primary" id="retry-boot" type="button">Retry connection</button></main>`;
    $("#retry-boot")?.addEventListener("click", () => location.reload());
  }
}
