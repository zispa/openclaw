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
  renderTable();
  renderDetail();
  els.resultsCount.textContent = `${state.filtered.length} résultat${state.filtered.length > 1 ? "s" : ""}`;
}

function renderKpis() {
  const rows = state.filtered;
  const avgScore = rows.length ? Math.round(rows.reduce((sum, row) => sum + row.top50_score_num, 0) / rows.length) : 0;
  const strongMarketing = rows.filter((row) => row.marketing_stack_confidence === "fort").length;
  const strongAi = rows.filter((row) => row.ai_stack_confidence === "fort").length;
  const partials = rows.filter((row) => row.status === "partial").length;

  const marketingDist = countBy(rows, "marketing_stack_confidence");
  const aiDist = countBy(rows, "ai_stack_confidence");

  const cards = [
    { label: "Startups visibles", value: rows.length, note: "après filtres" },
    { label: "Score moyen", value: avgScore || "—", note: "top50_score" },
    { label: "Marketing fort", value: strongMarketing, note: `${percent(strongMarketing, rows.length)} du lot` },
    { label: "IA forte", value: strongAi, note: `${percent(strongAi, rows.length)} du lot` },
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
      <span class="kpi-label">Répartition marketing</span>
      ${renderMiniBars(marketingDist, rows.length)}
    </div>
    <div class="kpi-card">
      <span class="kpi-label">Répartition IA</span>
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
              <span class="muted">${escapeHtml(row.city || "—")}</span>
            </div>
          </td>
          <td>${escapeHtml(row.sector || "—")}</td>
          <td>${pill(row.marketing_stack_confidence)}</td>
          <td>${pill(row.ai_stack_confidence)}</td>
          <td>${row.top50_score_num || "—"}</td>
          <td>${statusPill(row.status)}</td>
        </tr>
      `;
    })
    .join("");

  [...els.tableBody.querySelectorAll("tr[data-row-id]")].forEach((rowEl) => {
    rowEl.addEventListener("click", () => {
      state.selectedId = rowEl.dataset.rowId;
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
          <h2>Aucun résultat</h2>
          <p>Essaie d’élargir les filtres.</p>
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
        <span class="pill-label">Dernière vérification</span>
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
      <span class="pill-label">Sources de ranking</span>
      <p>${escapeHtml(row.list_sources || "—")}</p>
      <p>${escapeHtml(row.source_rank_notes || "")}</p>
    </div>

    <div class="detail-section detail-block">
      <span class="pill-label">Stack marketing détectée</span>
      <p><strong>${escapeHtml(row.marketing_stack_detected || "Non renseigné")}</strong></p>
      <p>${escapeHtml(row.marketing_stack_evidence_notes || "")}</p>
      ${renderLinks(row.marketing_stack_evidence_links)}
    </div>

    <div class="detail-section detail-block">
      <span class="pill-label">Stack IA détectée</span>
      <p><strong>${escapeHtml(row.ai_stack_detected || "Non renseigné")}</strong></p>
      <p>${escapeHtml(row.ai_stack_evidence_notes || "")}</p>
      ${renderLinks(row.ai_stack_evidence_links)}
    </div>

    <div class="detail-section detail-block">
      <span class="pill-label">Autres signaux</span>
      <p>${escapeHtml(row.other_tech_signals || "—")}</p>
      <p>${escapeHtml(row.proof_notes || "")}</p>
    </div>
  `;
}

function renderLinks(value) {
  const links = splitPipeList(value);
  if (!links.length) return "";
  return `<div class="source-list">${links
    .map((link) => `<a href="${escapeAttr(link)}" target="_blank" rel="noreferrer">${escapeHtml(link)}</a>`)
    .join("")}</div>`;
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
  return {
    ...row,
    id: `${row.rank || row.company_name}`,
    rank_num: Number(row.rank) || 0,
    top50_score_num: Number(row.top50_score) || 0,
  };
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
