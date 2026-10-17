const findingTemplates = [
  {
    id: "quantity",
    kind: "issue",
    title: "Net quantity doesn’t match",
    summary: "The front panel shows <b>750 mL</b>; approved product data says <b>1 L</b>.",
    expectedLabel: "APPROVED SPECIFICATION",
    expected: "1 L",
    observedLabel: "ON ARTWORK · FRONT",
    observed: "750 mL",
    explanation: "The printed quantity is different from the approved product specification. Check that the artwork uses the current fill volume before print.",
    file: "data/product-spec.json",
    location: "Page 1 · Product identity · Net contents",
    quote: "Net contents: 1 L (1000 mL). This value is the approved pack size for SKU FD-OAT-1042.",
    rule: "The net quantity shown on the retail artwork must match the approved product specification, including the value and unit.",
    artworkLocation: "Front panel · lower left · observed text: ‘750 mL’",
    marker: "quantity",
    action: "Mark addressed"
  },
  {
    id: "storage",
    kind: "issue",
    title: "Storage statement not found",
    summary: "The checklist requires <b>“Refrigerate after opening.”</b> No matching statement was detected.",
    expectedLabel: "CHECKLIST REQUIREMENT",
    expected: "Refrigerate after opening",
    observedLabel: "ON ARTWORK · BACK",
    observed: "Not detected",
    explanation: "The supplied sample checklist requires this statement on the retail pack. The back panel has no matching storage copy in the designated area.",
    file: "data/packaging-checklist.json",
    location: "Page 2 · Storage · Requirement 04",
    quote: "After-opening storage statement: ‘Refrigerate after opening.’ Include on each retail package.",
    rule: "Required statement · exact copy · every retail pack",
    artworkLocation: "Back panel · Package care section · no matching storage statement",
    marker: "storage",
    action: "Mark addressed"
  },
  {
    id: "claim",
    kind: "human",
    title: "Verify claim approval",
    summary: "The artwork says <b>“No Added Sugar”</b>; the supplied claims register has no matching approval record.",
    expectedLabel: "APPROVED CLAIMS REGISTER",
    expected: "Approval record",
    observedLabel: "ON ARTWORK · FRONT",
    observed: "No Added Sugar",
    explanation: "The phrase is visible on the artwork, but the supplied materials do not show whether this claim was reviewed and approved. A reviewer must confirm its status and intended use.",
    file: "data/approved-claims.json",
    location: "Page 1 · Approved claims · No entry found",
    quote: "The supplied claims register contains no approval entry for ‘No Added Sugar’. This is a gap in the provided evidence, not proof that the claim is invalid.",
    rule: "Marketing claims require a traceable approval record in the supplied claims register.",
    artworkLocation: "Front panel · claim badge · text: ‘NO ADDED SUGAR’",
    marker: "claim",
    action: "Confirm cleared"
  }
];

let findings = [];
let checksClear = 0;
let totalChecks = 12;
let sourcesReady = false;
let checkResults = [];

function normalized(text) { return String(text || "").replace(/\s+/g, " ").trim().toLocaleLowerCase(); }
function hasPhrase(artworkText, phrase) { return normalized(artworkText).includes(normalized(phrase)); }

function analyzeSources(productSpec, checklist, claimsRegister, artworkXml) {
  const artworkText = [...artworkXml.querySelectorAll("text")].map(node => node.textContent || "").join(" ");
  const netNode = artworkXml.querySelector('[data-evidence="net-quantity"]');
  const quantityText = (netNode?.textContent || "").trim();
  const quantityMatch = quantityText.match(/(\d+(?:\.\d+)?)\s*(ml|l)\b/i);
  let artworkQuantityMl = null;
  if (quantityMatch) artworkQuantityMl = Number(quantityMatch[1]) * (quantityMatch[2].toLowerCase() === "l" ? 1000 : 1);
  const templates = Object.fromEntries(findingTemplates.map(item => [item.id, item]));
  const found = [];
  let passed = 0;
  checkResults = [];

  checklist.requirements.forEach(requirement => {
    let clear = false;
    if (requirement.type === "phrase_present") clear = hasPhrase(artworkText, requirement.phrase);
    if (requirement.type === "all_phrases_present") clear = requirement.phrases.every(phrase => hasPhrase(artworkText, phrase));
    if (requirement.type === "net_quantity_match") clear = artworkQuantityMl !== null && artworkQuantityMl === productSpec.product.netQuantity.millilitres;
    const itemObserved = requirement.type === "net_quantity_match"
      ? (quantityText || "Not detected")
      : requirement.type === "all_phrases_present"
        ? requirement.phrases.filter(phrase => hasPhrase(artworkText, phrase)).join(" · ") || "Not detected"
        : hasPhrase(artworkText, requirement.phrase || "")
          ? requirement.expected
          : "Not detected";
    checkResults.push({
      title: requirement.title,
      status: clear ? "Clear" : "Issue found",
      expected: requirement.expected || (requirement.phrase ? requirement.phrase : requirement.phrases.join(" · ")),
      observed: itemObserved,
      rule: requirement.rule,
      source: checklist.source,
      location: requirement.sourcePath
    });
    if (clear) { passed += 1; return; }

    const templateId = requirement.id === "net-quantity" ? "quantity" : requirement.id === "storage-statement" ? "storage" : null;
    if (!templateId) return;
    const template = templates[templateId];
    const isQuantity = templateId === "quantity";
    found.push({
      ...template,
      expected: isQuantity ? `${productSpec.product.netQuantity.display} (${productSpec.product.netQuantity.millilitres} mL)` : requirement.phrase,
      observed: isQuantity ? (quantityText || "Not detected") : "Not detected",
      file: isQuantity ? productSpec.source : checklist.source,
      location: isQuantity ? "$.product.netQuantity" : requirement.sourcePath,
      quote: isQuantity ? JSON.stringify(productSpec.product.netQuantity) : JSON.stringify({storageStatement: requirement.phrase}),
      rule: requirement.rule,
      evidenceText: isQuantity ? quantityText : ""
    });
  });

  const claimNodes = [...artworkXml.querySelectorAll('[data-evidence="claim"]')];
  const approvedClaims = (claimsRegister.approvedClaims || []).map(normalized);
  claimNodes.forEach(node => {
    const claimText = (node.textContent || "").trim();
    const claimApproved = !claimText || approvedClaims.some(approved => approved === normalized(claimText));
    checkResults.push({
      title: "Marketing claim approval record",
      status: claimApproved ? "Clear" : "Human review",
      expected: "A traceable approval entry for each marketing claim",
      observed: claimText || "No claim detected",
      rule: "Confirm that each printed marketing claim has an approval record in the supplied claims register.",
      source: claimsRegister.source,
      location: "$.approvedClaims"
    });
    if (claimApproved) { passed += 1; return; }
    const template = templates.claim;
    found.push({
      ...template,
      expected: "Approval record",
      observed: claimText,
      file: claimsRegister.source,
      location: "$.approvedClaims",
      quote: claimsRegister.note,
      rule: "Confirm that each printed marketing claim has an approval record in the supplied claims register.",
      evidenceText: claimText
    });
  });

  checksClear = passed;
  totalChecks = checklist.requirements.length + Math.max(claimNodes.length, 1);
  return found;
}

async function initializeReview() {
  try {
    const [specResponse, checklistResponse, claimsResponse, artworkResponse] = await Promise.all([
      fetch("data/product-spec.json"),
      fetch("data/packaging-checklist.json"),
      fetch("data/approved-claims.json"),
      fetch("assets/fieldday-artwork.svg")
    ]);
    if (![specResponse, checklistResponse, claimsResponse, artworkResponse].every(response => response.ok)) throw new Error("A sample source file could not be loaded.");
    const [productSpec, checklist, claimsRegister, artworkSource] = await Promise.all([
      specResponse.json(), checklistResponse.json(), claimsResponse.json(), artworkResponse.text()
    ]);
    const artworkXml = new DOMParser().parseFromString(artworkSource, "image/svg+xml");
    findings = analyzeSources(productSpec, checklist, claimsRegister, artworkXml);
    sourcesReady = true;
    if (findings.length) activeFinding = findings[0].id;
    renderReview();
  } catch (error) {
    showToast("Couldn’t load the sample sources. Start the app using the README command.");
    document.querySelector("#finding-list").innerHTML = '<div class="finding-empty">Start the local server to load the sample source files.</div>';
  }
}

const pageIds = ["overview", "reviews", "rules", "sources"];
let activePage = "overview";
let activeFinding = "quantity";
let activeFilter = "all";
let zoom = 1;
let markersVisible = true;
let toastTimer;

const pageElements = {
  overview: document.querySelector("#overview-page"),
  reviews: document.querySelector("#review-page"),
  rules: document.querySelector("#rules-page"),
  sources: document.querySelector("#sources-page")
};

function goTo(page) {
  if (!pageElements[page]) return;
  activePage = page;
  Object.entries(pageElements).forEach(([key, element]) => element.classList.toggle("hidden", key !== page));
  document.querySelectorAll(".nav-item[data-page]").forEach(button => button.classList.toggle("active", button.dataset.page === page));
  document.querySelector("#topbar-context").textContent = ({overview: "Overview", reviews: "Artwork review", rules: "Rule library", sources: "Source files"})[page];
  window.scrollTo({top: 0, behavior: "smooth"});
  if (page === "reviews") renderReview();
}

function unresolved() { return findings.filter(item => !item.resolved); }

function renderFindingList() {
  const list = document.querySelector("#finding-list");
  const shown = findings.filter(item => {
    if (activeFilter === "issue") return item.kind === "issue" && !item.resolved;
    if (activeFilter === "human") return item.kind === "human" && !item.resolved;
    return true;
  });
  if (!shown.length) {
    list.innerHTML = '<div class="finding-empty">No findings in this view.</div>';
    return;
  }
  list.innerHTML = shown.map(item => {
    const status = item.resolved ? "Addressed" : item.kind === "human" ? "Human review" : "Issue found";
    const glyph = item.resolved ? "✓" : item.kind === "human" ? "↗" : "!";
    return `<article class="finding-card ${item.id === activeFinding ? "selected" : ""} ${item.resolved ? "resolved" : ""}" data-finding="${item.id}" tabindex="0" role="button" aria-label="Open finding: ${item.title}">
      <span class="finding-icon ${item.resolved ? "resolved" : item.kind}">${glyph}</span><div class="finding-copy"><div class="finding-meta"><strong>${item.title}</strong><span class="finding-status ${item.resolved ? "resolved" : item.kind}">${status}</span></div><p>${item.summary}</p></div><span class="finding-chevron">›</span>
    </article>`;
  }).join("");
  list.querySelectorAll("[data-finding]").forEach(card => {
    const activate = () => { activeFinding = card.dataset.finding; renderReview(); };
    card.addEventListener("click", activate);
    card.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); activate(); } });
  });
}

function renderDetail() {
  const detail = document.querySelector("#finding-detail");
  const item = findings.find(candidate => candidate.id === activeFinding) || findings[0];
  if (!item) {
    detail.innerHTML = '<div class="finding-empty">Load the local sample sources to inspect review evidence.</div>';
    return;
  }
  const observedClass = item.kind === "human" ? "human-value" : "";
  detail.innerHTML = `<div class="detail-top"><span class="detail-label">${item.kind === "human" ? "HUMAN VERIFICATION" : "CHECK DETAILS"}</span><button class="detail-source-link" data-source="${item.id}">↗ View source</button></div>
    <div class="proof-comparison"><div class="proof-cell"><small>${item.expectedLabel}</small><strong>${item.expected}</strong></div><div class="proof-cell observed ${observedClass}"><small>${item.observedLabel}</small><strong>${item.observed}</strong></div></div>
    <p class="finding-explanation">${item.explanation}</p><div class="detail-evidence"><span class="evidence-glyph">⌕</span><span><b>Artwork location:</b> ${item.artworkLocation}</span></div>
    ${item.resolved ? '<div class="resolved-inline">✓ Reviewer marked this finding as addressed.</div>' : `<div class="detail-actions"><button class="detail-action" data-resolve="${item.id}">${item.action}</button><button class="detail-action secondary" data-locate="${item.id}">Locate on artwork ↗</button></div>`}`;
  detail.querySelector("[data-source]")?.addEventListener("click", () => showEvidence(item));
  detail.querySelector("[data-resolve]")?.addEventListener("click", () => resolveFinding(item));
  detail.querySelector("[data-locate]")?.addEventListener("click", () => locateFinding(item));
}

function updateCounts() {
  const open = unresolved();
  const issueCount = open.filter(item => item.kind === "issue").length;
  const humanCount = open.filter(item => item.kind === "human").length;
  const addressed = findings.length - open.length;
  const clearCount = checksClear + addressed;
  document.querySelector("#summary-issue-count").textContent = issueCount;
  document.querySelector("#summary-human-count").textContent = humanCount;
  document.querySelector("#findings-count").textContent = String(open.length).padStart(2, "0");
  document.querySelector("#attention-total").textContent = String(open.length).padStart(2, "0");
  document.querySelector(".summary-score span").innerHTML = `${Math.round(clearCount / totalChecks * 100)}<small>%</small>`;
  document.querySelector(".summary-score strong").textContent = `${clearCount} of ${totalChecks} checks clear`;
  document.querySelector(".summary-score small").textContent = open.length ? `${open.length} finding${open.length === 1 ? "" : "s"} still need a decision` : "All sample findings have been addressed";
  document.querySelector(".review-card .mini-progress span").style.width = `${Math.round(clearCount / totalChecks * 100)}%`;
  document.querySelector(".review-progress-row > span").textContent = `${clearCount} of ${totalChecks} checks clear`;
  document.querySelector(".attention-count b").textContent = String(open.length).padStart(2, "0");
  document.querySelector(".attention-count").innerHTML = `<b>${String(open.length).padStart(2, "0")}</b> findings`;
  document.querySelector(".review-card-meta .review-type").innerHTML = `<span class="status-dot ${open.length ? "status-amber" : "status-green"}"></span>${open.length ? "PRE-PRINT REVIEW" : "REVIEW COMPLETE"}`;
  document.querySelectorAll(".nav-count").forEach(node => node.textContent = open.length);
  document.querySelectorAll(".filter-tab").forEach(button => {
    if (button.dataset.filter === "all") button.querySelector("span").textContent = open.length;
    if (button.dataset.filter === "issue") button.querySelector("span").textContent = issueCount;
    if (button.dataset.filter === "human") button.querySelector("span").textContent = humanCount;
  });
}

function updateMarker() {
  document.querySelectorAll(".art-hotspot").forEach(marker => marker.classList.remove("active"));
  document.querySelector("#canvas-caption-text").textContent = "Select a finding to locate evidence on artwork";
  if (!markersVisible) return;
  const item = findings.find(candidate => candidate.id === activeFinding);
  if (!item) return;
  const marker = document.querySelector(`#hotspot-${item.marker}`);
  marker?.classList.add("active");
  document.querySelector("#canvas-caption-text").textContent = item.artworkLocation;
}

function renderReview() {
  updateCounts();
  renderFindingList();
  renderDetail();
  updateMarker();
}

function locateFinding(item) {
  activeFinding = item.id;
  renderReview();
  document.querySelector("#artwork-panel")?.scrollIntoView({behavior: "smooth", block: "nearest"});
  showToast(`Evidence located on the ${item.marker === "quantity" || item.marker === "claim" ? "front" : "back"} panel`);
}

function resolveFinding(item) {
  item.resolved = true;
  renderReview();
  renderOverviewCounts();
  showToast("Reviewer decision saved for this sample review");
}

function renderOverviewCounts() {
  const count = unresolved().length;
  document.querySelector("#attention-total").textContent = String(count).padStart(2, "0");
}

function showEvidence(item) {
  document.querySelector("#evidence-title").textContent = item.file;
  document.querySelector("#evidence-description").textContent = item.rule;
  document.querySelector("#evidence-quote").innerHTML = `“${item.quote}”`;
  document.querySelector("#evidence-location").textContent = `${item.location}  ·  ${item.artworkLocation}`;
  document.querySelector("#evidence-dialog").showModal();
}

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 2400);
}

function downloadReport() {
  if (!sourcesReady) { showToast("Wait for the sample source files to load"); return; }
  const generated = new Date().toLocaleString("en-IN", {dateStyle: "medium", timeStyle: "short"});
  const openItems = unresolved();
  const report = [
    "# PackSignal — Artwork review report",
    "",
    "**Product:** Fieldday Original Oat Drink  ·  **SKU:** FD-OAT-1042  ·  **Artwork:** V07",
    "**Market:** India (demo scope)  ·  **Run:** PP-2026-1042  ·  **Generated:** " + generated,
    "**Sources:** data/product-spec.json; data/packaging-checklist.json; data/approved-claims.json; assets/fieldday-artwork.svg",
    "",
    `## Summary: ${checksClear + findings.filter(item => item.resolved).length}/${totalChecks} checks clear · ${openItems.length} findings open`,
    "",
    "## Checks",
    "",
    ...checkResults.map((check, index) => `${index + 1}. **${check.status} — ${check.title}** · expected: ${check.expected} · observed: ${check.observed} · source: ${check.source} ${check.location}`),
    "",
    "## Findings and evidence",
    "",
    ...findings.map((item, index) => [
      `### ${index + 1}. ${item.title} — ${item.resolved ? "ADDRESSED BY REVIEWER" : item.kind === "human" ? "HUMAN REVIEW" : "ISSUE FOUND"}`,
      "",
      `- **Expected:** ${item.expected}`,
      `- **Observed:** ${item.observed}`,
      `- **Rule:** ${item.rule}`,
      `- **Source:** ${item.file}, ${item.location}`,
      `- **Artwork evidence:** ${item.artworkLocation}`,
      `- **Explanation:** ${item.explanation}`,
      ""
    ]).flat(),
    "## Scope and limitations",
    "This report reflects a fictional product, sample artwork illustration, and fictional internal checklist. It is not a regulatory assessment or legal sign-off. Findings are checked against the supplied sample sources; a qualified reviewer is responsible for the final release decision.",
    ""
  ].join("\n");
  const blob = new Blob([report], {type: "text/markdown;charset=utf-8"});
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "packproof-fieldday-review-PP-2026-1042.md";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  showToast("Review report downloaded");
}

document.querySelectorAll("[data-page]").forEach(button => button.addEventListener("click", () => goTo(button.dataset.page)));
document.querySelectorAll(".filter-tab").forEach(button => button.addEventListener("click", () => {
  activeFilter = button.dataset.filter;
  document.querySelectorAll(".filter-tab").forEach(tab => tab.classList.toggle("active", tab === button));
  const visible = findings.filter(item => activeFilter === "all" || (activeFilter === "issue" ? item.kind === "issue" && !item.resolved : item.kind === "human" && !item.resolved));
  if (visible.length && !visible.some(item => item.id === activeFinding)) activeFinding = visible[0].id;
  renderReview();
}));
document.querySelector("#export-report").addEventListener("click", downloadReport);
document.querySelector("#view-findings").addEventListener("click", () => document.querySelector("#findings-panel").scrollIntoView({behavior: "smooth", block: "center"}));
document.querySelector("#zoom-in").addEventListener("click", () => { zoom = Math.min(1.3, +(zoom + .1).toFixed(1)); document.querySelector("#artwork-wrap").style.transform = `scale(${zoom})`; document.querySelector("#zoom-level").textContent = `${Math.round(zoom * 100)}%`; });
document.querySelector("#zoom-out").addEventListener("click", () => { zoom = Math.max(.8, +(zoom - .1).toFixed(1)); document.querySelector("#artwork-wrap").style.transform = `scale(${zoom})`; document.querySelector("#zoom-level").textContent = `${Math.round(zoom * 100)}%`; });
document.querySelector("#fit-artwork").addEventListener("click", () => { zoom = 1; document.querySelector("#artwork-wrap").style.transform = "scale(1)"; document.querySelector("#zoom-level").textContent = "100%"; });
document.querySelector("#toggle-markers").addEventListener("click", event => { markersVisible = !markersVisible; updateMarker(); event.currentTarget.querySelector("span").textContent = markersVisible ? "Evidence markers" : "Markers hidden"; });
document.querySelector("#open-artwork").addEventListener("click", () => window.open("assets/fieldday-artwork.svg", "_blank", "noopener,noreferrer"));
document.querySelector("#export-report").setAttribute("title", "Download a cited Markdown review report");
document.querySelector("#scope-link").addEventListener("click", () => document.querySelector("#scope-dialog").showModal());
document.querySelector("#close-scope").addEventListener("click", () => document.querySelector("#scope-dialog").close());
document.querySelector("#scope-done").addEventListener("click", () => document.querySelector("#scope-dialog").close());
document.querySelector("#close-evidence").addEventListener("click", () => document.querySelector("#evidence-dialog").close());
document.querySelector("#evidence-done").addEventListener("click", () => document.querySelector("#evidence-dialog").close());
document.querySelector("#finding-menu").addEventListener("click", () => showToast("All findings include source citations and artwork locations"));
document.querySelector("#scope-dialog").addEventListener("click", event => { if (event.target === event.currentTarget) event.currentTarget.close(); });
document.querySelector("#evidence-dialog").addEventListener("click", event => { if (event.target === event.currentTarget) event.currentTarget.close(); });

initializeReview();
