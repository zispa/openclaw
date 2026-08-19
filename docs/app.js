const DATA_URL = "./top50_french_startups_stack.csv";

const GTM_TOOL_RULES = [
  { match: /hubspot/i, label: "HubSpot", category: "crm" },
  { match: /salesforce/i, label: "Salesforce", category: "crm" },
  { match: /pardot/i, label: "Pardot", category: "emailing" },
  { match: /customer\.?io/i, label: "Customer.io", category: "emailing" },
  { match: /braze/i, label: "Braze", category: "emailing" },
  { match: /klaviyo/i, label: "Klaviyo", category: "emailing" },
  { match: /mailchimp/i, label: "Mailchimp", category: "emailing" },
  { match: /intercom/i, label: "Intercom", category: "support" },
  { match: /zendesk/i, label: "Zendesk", category: "support" },
  { match: /segment/i, label: "Segment", category: "analytics" },
  { match: /amplitude/i, label: "Amplitude", category: "analytics" },
  { match: /mixpanel/i, label: "Mixpanel", category: "analytics" },
  { match: /google tag manager|gtm/i, label: "Google Tag Manager", category: "analytics" },
];

const GTM_CATEGORY_LABELS = {
  crm: "CRM",
  emailing: "Emailing",
  support: "Support",
  analytics: "Analytics",
  other: "Autres outils GTM",
};

const state = {
  rows: [],
  filtered: [],
  selectedId: null,
  filters: {
    search: "",
    sector: "",
    marketing: "",
    ai: "",
    status: "",
    sort: "rank-asc",
  },
};

const els = {
  kpiGrid: document.querySelector("#kpiGrid"),
  spotlightPanel: document.querySelector("#spotlightPanel"),
  leaderboardGrid: document.querySelector("#leaderboardGrid"),
  leaderboardMeta: document.querySelector("#leaderboardMeta"),
  mobileList: document.querySelector("#mobileList"),
  searchInput: document.querySelector("#searchInput"),
  sectorFilter: document.querySelector("#sectorFilter"),
  marketingFilter: document.querySelector("#marketingFilter"),
  aiFilter: document.querySelector("#aiFilter"),
  statusFilter: document.querySelector("#statusFilter"),
  sortFilter: document.querySelector("#sortFilter"),
  resetFilters: document.querySelector("#resetFilters"),
  tableBody: document.querySelector("#tableBody"),
  detailPanel: document.querySelector("#detailPanel"),
  resultsCount: document.querySelector("#resultsCount"),
};

init().catch((error) => {
  console.error(error);
  els.detailPanel.innerHTML = `
    <div class="empty-state">
      <div>
        <h2>Erreur de chargement</h2>
        <p>Impossible de charger le CSV. Lance la page via un petit serveur HTTP.</p>
      </div>
    </div>
  `;
});

async function init() {
  bindEvents();
  const response = await fetch(DATA_URL);
  const csv = await response.text();
  state.rows = parseCsv(csv).map(normalizeRow);
  state.selectedId = state.rows[0]?.id ?? null;
  fillSectorFilter();
  applyFilters();
}

function bindEvents() {
  els.searchInput.addEventListener("input", (event) => {
    state.filters.search = event.target.value.trim().toLowerCase();
    applyFilters();
  });

  [
    [els.sectorFilter, "sector"],
    [els.marketingFilter, "marketing"],
    [els.aiFilter, "ai"],
    [els.statusFilter, "status"],
    [els.sortFilter, "sort"],
  ].forEach(([el, key]) => {
    el.addEventListener("change", (event) => {
      state.filters[key] = event.target.value;
      applyFilters();
    });
  });

  els.resetFilters.addEventListener("click", () => {
    state.filters = { search: "", sector: "", marketing: "", ai: "", status: "", sort: "rank-asc" };
    els.searchInput.value = "";
    els.sectorFilter.value = "";
    els.marketingFilter.value = "";
    els.aiFilter.value = "";
    els.statusFilter.value = "";
    els.sortFilter.value = "rank-asc";
    applyFilters();
  });
}

function fillSectorFilter() {
  const sectors = [...new Set(state.rows.map((row) => row.sector).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  sectors.forEach((sector) => {
    const option = document.createElement("option");
    option.value = sector;
    option.textContent = sector;
    els.sectorFilter.appendChild(option);
  });
}

function applyFilters() {
  const { search, sector, marketing, ai, status, sort } = state.filters;
  let rows = [...state.rows].filter((row) => {
    const haystack = [
      row.company_name,
      row.sector,
      row.marketing_stack_detected,
      row.ai_stack_detected,
      row.marketing_stack_evidence_notes,
      row.ai_stack_evidence_notes,
      row.other_tech_signals,
      row.stackHighlights.join(" "),
      row.gtmHighlights.join(" "),
    ]
      .join(" ")
      .toLowerCase();

    return (
      (!search || haystack.includes(search)) &&
      (!sector || row.sector === sector) &&
      (!marketing || row.marketing_stack_confidence === marketing) &&
      (!ai || row.ai_stack_confidence === ai) &&
      (!status || row.status === status)
    );
  });

  rows = sortRows(rows, sort);
  state.filtered = rows;

  if (!rows.some((row) => row.id === state.selectedId)) {
    state.selectedId = rows[0]?.id ?? null;
  }

  render();
}

function sortRows(rows, sort) {
  const copy = [...rows];
  switch (sort) {
    case "score-desc":
      return copy.sort((a, b) => b.top50_score_num - a.top50_score_num);
    case "updated-desc":
      return copy.sort((a, b) => (b.last_checked_at || "").localeCompare(a.last_checked_at || ""));
    case "company-asc":
      return copy.sort((a, b) => a.company_name.localeCompare(b.company_name));
    case "rank-asc":
    default:
      return copy.sort((a, b) => a.rank_num - b.rank_num);
  }
}

function render() {
  renderKpis();
  renderSpotlight();
  renderLeaderboard();
  renderTable();
  renderMobileList();
  renderDetail();
  els.resultsCount.textContent = `${state.filtered.length} resultat${state.filtered.length > 1 ? "s" : ""}`;
  els.leaderboardMeta.textContent = `${state.filtered.length} startup${state.filtered.length > 1 ? "s" : ""} filtre${state.filtered.length > 1 ? "es" : ""}`;
}

function renderKpis() {
  const rows = state.filtered;
  const avgScore = rows.length ? Math.round(rows.reduce((sum, row) => sum + row.top50_score_num, 0) / rows.length) : 0;
  const strongMarketing = rows.filter((row) => row.marketing_stack_confidence === "fort").length;
  const strongAi = rows.filter((row) => row.ai_stack_confidence === "fort").length;
  const crmCoverage = rows.filter((row) => row.gtm.crm.length).length;
  const emailingCoverage = rows.filter((row) => row.gtm.emailing.length).length;
  const analyticsCoverage = rows.filter((row) => row.gtm.analytics.length).length;

  const cards = [
    { label: "Startups visibles", value: rows.length, note: "apres filtres" },
    { label: "Score moyen", value: avgScore || "—", note: "top50_score" },
    { label: "CRM detecte", value: crmCoverage, note: `${percent(crmCoverage, rows.length)} du lot` },
    { label: "Emailing detecte", value: emailingCoverage, note: `${percent(emailingCoverage, rows.length)} du lot` },
    { label: "Analytics detecte", value: analyticsCoverage, note: `${percent(analyticsCoverage, rows.length)} du lot` },
    { label: "IA forte", value: strongAi, note: `${percent(strongAi, rows.length)} du lot` },
    { label: "Marketing fort", value: strongMarketing, note: `${percent(strongMarketing, rows.length)} du lot` },
  ];

  els.kpiGrid.innerHTML = cards
    .map(
      (card) => `
      <div class="kpi-card">
        <span class="kpi-label">${escapeHtml(card.label)}</span>
        <div class="kpi-value">${escapeHtml(String(card.value))}</div>
        <div class="muted">${escapeHtml(card.note)}</div>
      </div>
    `
    )
    .join("");
}

function renderSpotlight() {
  const row = getSelectedRow();
  if (!row) {
    els.spotlightPanel.innerHTML = `
      <div class="empty-state">
        <div>
          <h2>Stack Snapshot</h2>
          <p>Aucun resultat avec ces filtres.</p>
        </div>
      </div>
    `;
    return;
  }

  const combined = row.stackHighlights.length
    ? row.stackHighlights
    : [...row.marketingHighlights, ...row.aiHighlights, ...row.otherHighlights];

  els.spotlightPanel.innerHTML = `
    <div class="panel-header">
      <div>
        <div class="eyebrow">Lecture rapide</div>
        <h2>${escapeHtml(row.company_name)}</h2>
      </div>
      <div class="spotlight-status">
        ${statusPill(row.status)}
      </div>
    </div>

    <div class="spotlight-topline">
      <span>${escapeHtml(row.sector || "Secteur non renseigne")}</span>
      <span>Score ${escapeHtml(String(row.top50_score_num || "—"))}</span>
      <span>Preuve GTM: ${escapeHtml(row.gtmEvidenceType)}</span>
    </div>

    <div class="spotlight-grid">
      <div class="spotlight-card spotlight-card-wide">
        <span class="pill-label">CRM, emailing et outils GTM</span>
        ${renderGtmBoard(row, true)}
      </div>
      <div class="spotlight-card">
        <span class="pill-label">Stack marketing</span>
        ${renderStackChips(row.marketingHighlights, 6, "Signal marketing non renseigne")}
        <p>${escapeHtml(shortText(row.marketing_stack_evidence_notes, 160))}</p>
      </div>
      <div class="spotlight-card">
        <span class="pill-label">Stack IA</span>
        ${renderStackChips(row.aiHighlights, 6, "Signal IA non renseigne")}
        <p>${escapeHtml(shortText(row.ai_stack_evidence_notes, 160))}</p>
      </div>
      <div class="spotlight-card spotlight-card-wide">
        <span class="pill-label">Snapshot combine</span>
        ${renderStackChips(combined, 8, "Peu de signaux stack disponibles")}
        <div class="confidence-inline">
          ${renderConfidenceSummary(row)}
        </div>
      </div>
    </div>
  `;
}

function renderLeaderboard() {
  const rows = state.filtered;
  const sections = [
    { title: "CRM", note: "outils CRM cites", items: buildLeaderboard(rows, (row) => row.gtm.crm) },
    { title: "Emailing", note: "automation ou lifecycle", items: buildLeaderboard(rows, (row) => row.gtm.emailing) },
    { title: "Support", note: "chat, support ou onboarding", items: buildLeaderboard(rows, (row) => row.gtm.support) },
    { title: "Analytics", note: "tracking et mesure", items: buildLeaderboard(rows, (row) => row.gtm.analytics) },
    { title: "IA", note: "produits IA les plus cites", items: buildLeaderboard(rows, (row) => row.aiHighlights) },
  ];

  els.leaderboardGrid.innerHTML = sections
    .map(
      (section) => `
      <section class="leaderboard-card">
        <div class="leaderboard-card-header">
          <h3>${escapeHtml(section.title)}</h3>
          <span class="muted">${escapeHtml(section.note)}</span>
        </div>
        ${
          section.items.length
            ? `<div class="leaderboard-list">
                ${section.items
                  .map(
                    (item) => `
                    <button class="leaderboard-item" type="button" data-term="${escapeAttr(item.label)}">
                      <span class="leaderboard-name">${escapeHtml(item.label)}</span>
                      <strong>${item.count}</strong>
                    </button>
                  `
                  )
                  .join("")}
              </div>`
            : `<p class="muted">Aucun signal fort publie dans cette categorie.</p>`
        }
      </section>
    `
    )
    .join("");

  [...els.leaderboardGrid.querySelectorAll("[data-term]")].forEach((button) => {
    button.addEventListener("click", () => {
      const term = button.dataset.term || "";
      els.searchInput.value = term;
      state.filters.search = term.toLowerCase();
      applyFilters();
    });
  });
}

function renderTable() {
  els.tableBody.innerHTML = state.filtered
    .map((row) => {
      const selected = row.id === state.selectedId ? "is-selected" : "";
      return `
        <tr class="is-clickable ${selected}" data-row-id="${row.id}">
          <td>${row.rank_num || "—"}</td>
          <td>
            <div class="company-cell">
              <span class="company-name">${escapeHtml(row.company_name)}</span>
              <span class="muted">${escapeHtml(`${row.city || "—"} · ${row.sector || "—"}`)}</span>
            </div>
          </td>
          <td>
            <div class="stack-cell">
              ${renderCompactCategoryBadges(row)}
            </div>
          </td>
          <td>
            <div class="confidence-stack">
              <span class="confidence-line">GTM ${pill(row.marketing_stack_confidence)}</span>
              <span class="confidence-line">IA ${pill(row.ai_stack_confidence)}</span>
            </div>
          </td>
          <td>${row.top50_score_num || "—"}</td>
          <td>${statusPill(row.status)}</td>
        </tr>
      `;
    })
    .join("");

  bindRowClicks();
}

function renderMobileList() {
  els.mobileList.innerHTML = state.filtered
    .map((row) => {
      const selected = row.id === state.selectedId ? "is-selected" : "";
      return `
        <button class="mobile-card ${selected}" type="button" data-row-id="${row.id}">
          <div class="mobile-card-top">
            <div>
              <div class="eyebrow">#${row.rank_num || "—"} · score ${row.top50_score_num || "—"}</div>
              <h3>${escapeHtml(row.company_name)}</h3>
              <p class="muted">${escapeHtml(row.sector || "—")}</p>
            </div>
            ${statusPill(row.status)}
          </div>
          <div class="mobile-card-section">
            <span class="pill-label">CRM / Emailing / Analytics</span>
            ${renderCompactCategoryBadges(row)}
          </div>
          <div class="mobile-card-section">
            <span class="pill-label">IA</span>
            ${renderStackChips(row.aiHighlights, 4, "Non renseigne")}
          </div>
        </button>
      `;
    })
    .join("");

  bindRowClicks();
}

function bindRowClicks() {
  [...document.querySelectorAll("[data-row-id]")].forEach((rowEl) => {
    rowEl.addEventListener("click", () => {
      state.selectedId = rowEl.dataset.rowId;
      renderSpotlight();
      renderTable();
      renderMobileList();
      renderDetail();
    });
  });
}

function renderDetail() {
  const row = getSelectedRow();
  if (!row) {
    els.detailPanel.innerHTML = `
      <div class="empty-state">
        <div>
          <h2>Aucun resultat</h2>
          <p>Essaie d'elargir les filtres.</p>
        </div>
      </div>
    `;
    return;
  }

  els.detailPanel.innerHTML = `
    <div class="detail-header">
      <div class="detail-title-block">
        <div class="eyebrow">#${row.rank_num || "—"} · ${escapeHtml(row.city || "—")}</div>
        <h2>${escapeHtml(row.company_name)}</h2>
        <p class="subtitle">${escapeHtml(row.sector || "—")}</p>
      </div>
      <div>
        ${statusPill(row.status)}
      </div>
    </div>

    <div class="detail-section detail-links">
      ${row.website ? `<a href="${escapeAttr(row.website)}" target="_blank" rel="noreferrer">Site web</a>` : ""}
      ${row.linkedin_url ? `<a href="${escapeAttr(row.linkedin_url)}" target="_blank" rel="noreferrer">LinkedIn</a>` : ""}
    </div>

    <div class="detail-section detail-grid">
      <div class="detail-block">
        <span class="pill-label">Top50 score</span>
        <strong>${row.top50_score_num || "—"}</strong>
      </div>
      <div class="detail-block">
        <span class="pill-label">Derniere verification</span>
        <strong>${escapeHtml(row.last_checked_at || "—")}</strong>
      </div>
      <div class="detail-block">
        <span class="pill-label">Preuve GTM</span>
        <strong>${escapeHtml(row.gtmEvidenceType)}</strong>
      </div>
      <div class="detail-block">
        <span class="pill-label">Confiance GTM</span>
        ${pill(row.marketing_stack_confidence)}
      </div>
    </div>

    <div class="detail-section detail-block">
      <span class="pill-label">Carte des outils GTM</span>
      ${renderGtmBoard(row)}
      <p>${escapeHtml(row.marketing_stack_evidence_notes || "")}</p>
    </div>

    <div class="detail-section detail-block">
      <span class="pill-label">Stack IA detectee</span>
      ${renderStackChips(row.aiHighlights, 8, "Non renseigne")}
      <p>${escapeHtml(row.ai_stack_evidence_notes || "")}</p>
      ${renderLinks(row.ai_stack_evidence_links)}
    </div>

    <div class="detail-section detail-block">
      <span class="pill-label">Regle de collecte</span>
      <p>Priorite aux scripts publics du site, puis aux integrations/docs officielles, puis aux signaux adjacents. Si un outil CRM ou emailing n'est pas visible publiquement, il reste vide.</p>
    </div>

    <div class="detail-section detail-block">
      <span class="pill-label">Autres signaux</span>
      <p>${escapeHtml(row.other_tech_signals || "—")}</p>
      <p>${escapeHtml(row.proof_notes || "")}</p>
      ${renderLinks(row.proof_links)}
    </div>
  `;
}

function renderGtmBoard(row, compact = false) {
  const entries = [
    ["crm", row.gtm.crm],
    ["emailing", row.gtm.emailing],
    ["support", row.gtm.support],
    ["analytics", row.gtm.analytics],
    ["other", row.gtm.other],
  ];

  return `
    <div class="gtm-grid ${compact ? "is-compact" : ""}">
      ${entries
        .map(
          ([key, items]) => `
          <div class="gtm-card">
            <span class="pill-label">${escapeHtml(GTM_CATEGORY_LABELS[key])}</span>
            ${renderStackChips(items, compact ? 3 : 5, "Non detecte publiquement")}
          </div>
        `
        )
        .join("")}
    </div>
  `;
}

function renderCompactCategoryBadges(row) {
  const ordered = [
    ["CRM", row.gtm.crm[0]],
    ["Emailing", row.gtm.emailing[0]],
    ["Support", row.gtm.support[0]],
    ["Analytics", row.gtm.analytics[0]],
  ]
    .filter(([, value]) => Boolean(value))
    .slice(0, 4);

  if (!ordered.length) {
    return renderStackChips(row.gtm.other, 2, "Non detecte publiquement");
  }

  return `
    <div class="chip-row">
      ${ordered
        .map(([label, value]) => `<span class="stack-chip category-chip"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</span>`)
        .join("")}
    </div>
  `;
}

function buildLeaderboard(rows, getter) {
  const counts = new Map();
  rows.forEach((row) => {
    getter(row).forEach((item) => {
      counts.set(item, (counts.get(item) || 0) + 1);
    });
  });

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 6)
    .map(([label, count]) => ({ label, count }));
}

function renderLinks(value) {
  const links = splitPipeList(value);
  if (!links.length) return "";
  return `<div class="source-list">${links
    .map((link) => `<a href="${escapeAttr(link)}" target="_blank" rel="noreferrer">${escapeHtml(link)}</a>`)
    .join("")}</div>`;
}

function renderConfidenceSummary(row) {
  return `
    <span class="inline-pair"><span class="muted">GTM</span> ${pill(row.marketing_stack_confidence)}</span>
    <span class="inline-pair"><span class="muted">IA</span> ${pill(row.ai_stack_confidence)}</span>
  `;
}

function renderStackChips(items, limit = 4, fallback = "Non renseigne") {
  if (!items.length) {
    return `<div class="chip-row"><span class="stack-chip is-muted">${escapeHtml(fallback)}</span></div>`;
  }

  const visible = items.slice(0, limit);
  const hidden = items.length - visible.length;
  return `
    <div class="chip-row">
      ${visible.map((item) => `<span class="stack-chip">${escapeHtml(item)}</span>`).join("")}
      ${hidden > 0 ? `<span class="stack-chip is-muted">+${hidden}</span>` : ""}
    </div>
  `;
}

function pill(value) {
  const safe = value || "n/a";
  const cls = ["fort", "moyen", "faible"].includes(safe) ? safe : "default";
  return `<span class="confidence-pill ${cls}">${escapeHtml(safe)}</span>`;
}

function statusPill(value) {
  const safe = value || "n/a";
  const cls = ["partial", "complete", "incomplete"].includes(safe) ? safe : "default";
  return `<span class="status-pill ${cls}">${escapeHtml(safe)}</span>`;
}

function percent(value, total) {
  return total ? `${Math.round((value / total) * 100)}%` : "0%";
}

function normalizeRow(row) {
  const marketingHighlights = extractStackItems(row.marketing_stack_detected);
  const aiHighlights = extractStackItems(row.ai_stack_detected);
  const otherHighlights = extractStackItems(row.other_tech_signals);
  const stackHighlights = uniqueList([...marketingHighlights, ...aiHighlights, ...otherHighlights]);
  const gtm = categorizeGtmTools(marketingHighlights);
  const gtmHighlights = uniqueList([...gtm.crm, ...gtm.emailing, ...gtm.support, ...gtm.analytics, ...gtm.other]);

  return {
    ...row,
    id: `${row.rank || row.company_name}`,
    rank_num: Number(row.rank) || 0,
    top50_score_num: Number(row.top50_score) || 0,
    marketingHighlights,
    aiHighlights,
    otherHighlights,
    stackHighlights,
    gtm,
    gtmHighlights,
    gtmEvidenceType: inferGtmEvidenceType(row.marketing_stack_evidence_notes, row.marketing_stack_evidence_links),
  };
}

function categorizeGtmTools(marketingHighlights) {
  const result = {
    crm: [],
    emailing: [],
    support: [],
    analytics: [],
    other: [],
  };

  marketingHighlights.forEach((item) => {
    const rule = GTM_TOOL_RULES.find(({ match }) => match.test(item));
    if (rule) {
      result[rule.category].push(rule.label);
    } else {
      result.other.push(item);
    }
  });

  return {
    crm: uniqueList(result.crm),
    emailing: uniqueList(result.emailing),
    support: uniqueList(result.support),
    analytics: uniqueList(result.analytics),
    other: uniqueList(result.other),
  };
}

function inferGtmEvidenceType(notes, links) {
  const haystack = `${notes || ""} ${links || ""}`.toLowerCase();
  if (/homepage html|public homepage html|loads|exposes|references|script/i.test(haystack)) {
    return "Script public";
  }
  if (/help|docs|integration|official/i.test(haystack)) {
    return "Documentation officielle";
  }
  return "Source officielle";
}

function extractStackItems(value) {
  return uniqueList(
    String(value || "")
      .split(/[;|]/)
      .map((item) => item.replace(/\s*\([^)]*\)/g, "").trim())
      .map((item) => item.replace(/\s+/g, " "))
      .map((item) => item.replace(/^[-,:/]+|[-,:/]+$/g, "").trim())
      .filter((item) => item && !/^no\b/i.test(item) && item.toLowerCase() !== "n/a" && item.toLowerCase() !== "non renseigne")
  );
}

function uniqueList(items) {
  return [...new Set(items)];
}

function shortText(value, limit = 120) {
  const text = String(value || "").trim();
  if (!text) return "Pas de note detaillee.";
  if (text.length <= limit) return text;
  return `${text.slice(0, limit).trim()}...`;
}

function splitPipeList(value) {
  return String(value || "")
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseCsv(text) {
  const rows = [];
  let current = "";
  let row = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(current);
      current = "";
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
      continue;
    }

    current += char;
  }

  if (current.length || row.length) {
    row.push(current);
    rows.push(row);
  }

  const [headers, ...dataRows] = rows;
  return dataRows.map((cells) => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = cells[index] ?? "";
    });
    return obj;
  });
}

function getSelectedRow() {
  return state.filtered.find((item) => item.id === state.selectedId);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}
