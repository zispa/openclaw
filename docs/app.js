const DATA_URL = "./top50_french_startups_stack.csv";

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
  renderDetail();
  els.resultsCount.textContent = `${state.filtered.length} resultat${state.filtered.length > 1 ? "s" : ""}`;
  els.leaderboardMeta.textContent = `${state.filtered.length} startup${state.filtered.length > 1 ? "s" : ""} filtre${state.filtered.length > 1 ? "es" : ""}`;
}

function renderKpis() {
  const rows = state.filtered;
  const avgScore = rows.length ? Math.round(rows.reduce((sum, row) => sum + row.top50_score_num, 0) / rows.length) : 0;
  const strongMarketing = rows.filter((row) => row.marketing_stack_confidence === "fort").length;
  const strongAi = rows.filter((row) => row.ai_stack_confidence === "fort").length;
  const partials = rows.filter((row) => row.status === "partial").length;
  const distinctSignals = new Set(rows.flatMap((row) => row.stackHighlights)).size;

  const marketingDist = countBy(rows, "marketing_stack_confidence");
  const aiDist = countBy(rows, "ai_stack_confidence");

  const cards = [
    { label: "Startups visibles", value: rows.length, note: "apres filtres" },
    { label: "Score moyen", value: avgScore || "—", note: "top50_score" },
    { label: "Marketing fort", value: strongMarketing, note: `${percent(strongMarketing, rows.length)} du lot` },
    { label: "IA forte", value: strongAi, note: `${percent(strongAi, rows.length)} du lot` },
    { label: "Signaux stack", value: distinctSignals || "—", note: "technos ou patterns distincts" },
    { label: "Lignes partial", value: partials, note: `${percent(partials, rows.length)} du lot` },
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
    .join("") +
    `
    <div class="kpi-card">
      <span class="kpi-label">Repartition marketing</span>
      ${renderMiniBars(marketingDist, rows.length)}
    </div>
    <div class="kpi-card">
      <span class="kpi-label">Repartition IA</span>
      ${renderMiniBars(aiDist, rows.length)}
    </div>
  `;
}

function renderMiniBars(distribution, total) {
  const order = ["fort", "moyen", "faible"];
  return `<div class="mini-bars">${order
    .map((key) => {
      const value = distribution[key] || 0;
      const width = total ? Math.round((value / total) * 100) : 0;
      return `
        <div class="mini-bar-row">
          <span>${escapeHtml(key)}</span>
          <div class="mini-bar-track"><div class="mini-bar-fill" style="width:${width}%"></div></div>
          <strong>${value}</strong>
        </div>
      `;
    })
    .join("")}</div>`;
}

function renderSpotlight() {
  const row = state.filtered.find((item) => item.id === state.selectedId);
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
      <span>Verifie le ${escapeHtml(row.last_checked_at || "—")}</span>
    </div>

    <div class="spotlight-grid">
      <div class="spotlight-card">
        <span class="pill-label">Stack marketing</span>
        ${renderStackChips(row.marketingHighlights, 5, "Signal marketing non renseigne")}
        <p>${escapeHtml(shortText(row.marketing_stack_evidence_notes, 150))}</p>
      </div>
      <div class="spotlight-card">
        <span class="pill-label">Stack IA</span>
        ${renderStackChips(row.aiHighlights, 5, "Signal IA non renseigne")}
        <p>${escapeHtml(shortText(row.ai_stack_evidence_notes, 150))}</p>
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
    {
      title: "Marketing",
      note: "signaux marketing les plus cites",
      items: buildLeaderboard(rows, (row) => row.marketingHighlights),
    },
    {
      title: "IA",
      note: "signaux IA les plus cites",
      items: buildLeaderboard(rows, (row) => row.aiHighlights),
    },
    {
      title: "Global",
      note: "mix marketing + IA + autres signaux",
      items: buildLeaderboard(rows, (row) => row.stackHighlights),
    },
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
            : `<p class="muted">Pas assez de signaux pour cette vue.</p>`
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
              ${renderStackChips(row.stackHighlights, 3, "Peu de signaux")}
            </div>
          </td>
          <td>
            <div class="confidence-stack">
              <span class="confidence-line">M ${pill(row.marketing_stack_confidence)}</span>
              <span class="confidence-line">IA ${pill(row.ai_stack_confidence)}</span>
            </div>
          </td>
          <td>${row.top50_score_num || "—"}</td>
          <td>${statusPill(row.status)}</td>
        </tr>
      `;
    })
    .join("");

  [...els.tableBody.querySelectorAll("tr[data-row-id]")].forEach((rowEl) => {
    rowEl.addEventListener("click", () => {
      state.selectedId = rowEl.dataset.rowId;
      renderSpotlight();
      renderTable();
      renderDetail();
    });
  });
}

function renderDetail() {
  const row = state.filtered.find((item) => item.id === state.selectedId);
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
        <span class="pill-label">Confiance marketing</span>
        ${pill(row.marketing_stack_confidence)}
      </div>
      <div class="detail-block">
        <span class="pill-label">Confiance IA</span>
        ${pill(row.ai_stack_confidence)}
      </div>
    </div>

    <div class="detail-section detail-block">
      <span class="pill-label">Stacks detectees</span>
      <div class="detail-stack-columns">
        <div>
          <strong>Marketing</strong>
          ${renderStackChips(row.marketingHighlights, 8, "Non renseigne")}
        </div>
        <div>
          <strong>IA</strong>
          ${renderStackChips(row.aiHighlights, 8, "Non renseigne")}
        </div>
      </div>
    </div>

    <div class="detail-section detail-block">
      <span class="pill-label">Sources de ranking</span>
      <p>${escapeHtml(row.list_sources || "—")}</p>
      <p>${escapeHtml(row.source_rank_notes || "")}</p>
    </div>

    <div class="detail-section detail-block">
      <span class="pill-label">Stack marketing detectee</span>
      <p><strong>${escapeHtml(row.marketing_stack_detected || "Non renseigne")}</strong></p>
      <p>${escapeHtml(row.marketing_stack_evidence_notes || "")}</p>
      ${renderLinks(row.marketing_stack_evidence_links)}
    </div>

    <div class="detail-section detail-block">
      <span class="pill-label">Stack IA detectee</span>
      <p><strong>${escapeHtml(row.ai_stack_detected || "Non renseigne")}</strong></p>
      <p>${escapeHtml(row.ai_stack_evidence_notes || "")}</p>
      ${renderLinks(row.ai_stack_evidence_links)}
    </div>

    <div class="detail-section detail-block">
      <span class="pill-label">Autres signaux</span>
      <p>${escapeHtml(row.other_tech_signals || "—")}</p>
      <p>${escapeHtml(row.proof_notes || "")}</p>
      ${renderLinks(row.proof_links)}
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
    .slice(0, 8)
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
    <span class="inline-pair"><span class="muted">Marketing</span> ${pill(row.marketing_stack_confidence)}</span>
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

function countBy(rows, key) {
  return rows.reduce((acc, row) => {
    const value = row[key] || "n/a";
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function percent(value, total) {
  return total ? `${Math.round((value / total) * 100)}%` : "0%";
}

function normalizeRow(row) {
  const marketingHighlights = extractStackItems(row.marketing_stack_detected);
  const aiHighlights = extractStackItems(row.ai_stack_detected);
  const otherHighlights = extractStackItems(row.other_tech_signals);
  const stackHighlights = uniqueList([...marketingHighlights, ...aiHighlights, ...otherHighlights]);

  return {
    ...row,
    id: `${row.rank || row.company_name}`,
    rank_num: Number(row.rank) || 0,
    top50_score_num: Number(row.top50_score) || 0,
    marketingHighlights,
    aiHighlights,
    otherHighlights,
    stackHighlights,
  };
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
