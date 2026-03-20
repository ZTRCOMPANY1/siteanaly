import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function getEl(id) {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error(`Elemento com id="${id}" não encontrado no dashboard.html`);
  }
  return el;
}

const els = {
  siteFilter: getEl("siteFilter"),
  periodFilter: getEl("periodFilter"),
  refreshBtn: getEl("refreshBtn"),
  totalVisits: getEl("totalVisits"),
  onlineNow: getEl("onlineNow"),
  totalPages: getEl("totalPages"),
  totalCountries: getEl("totalCountries"),
  sitesList: getEl("sitesList"),
  pagesList: getEl("pagesList"),
  referrersList: getEl("referrersList"),
  browsersList: getEl("browsersList"),
  devicesList: getEl("devicesList"),
  countriesList: getEl("countriesList"),
  chartCanvas: getEl("chart")
};

let chartInstance = null;
let allVisits = [];
let allPresence = [];

function todayAtMidnight() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function dateToYMD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function lastNDays(days) {
  const arr = [];
  const now = todayAtMidnight();

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    arr.push(dateToYMD(d));
  }

  return arr;
}

function countBy(items, fn) {
  const map = {};
  for (const item of items) {
    const key = fn(item) || "Desconhecido";
    map[key] = (map[key] || 0) + 1;
  }
  return map;
}

function topEntries(map, limit = 10) {
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, value]) => ({ label, value }));
}

function renderList(el, items, empty = "Sem dados") {
  el.innerHTML = "";
  if (!items.length) {
    el.innerHTML = `<li>${empty}</li>`;
    return;
  }

  for (const item of items) {
    const li = document.createElement("li");
    li.innerHTML = `<span>${item.label}</span><strong>${item.value}</strong>`;
    el.appendChild(li);
  }
}

function renderChart(dayLabels, visitsMap) {
  const values = dayLabels.map(day => visitsMap[day] || 0);
  const ctx = els.chartCanvas.getContext("2d");

  if (chartInstance) {
    chartInstance.destroy();
  }

  chartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels: dayLabels,
      datasets: [{
        label: "Visitas",
        data: values,
        borderWidth: 2,
        tension: 0.25,
        fill: false
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          labels: { color: "#ffffff" }
        }
      },
      scales: {
        x: {
          ticks: { color: "#9fb2d8" },
          grid: { color: "rgba(255,255,255,0.07)" }
        },
        y: {
          beginAtZero: true,
          ticks: { color: "#9fb2d8" },
          grid: { color: "rgba(255,255,255,0.07)" }
        }
      }
    }
  });
}

function buildSiteFilter(visits) {
  const ids = [...new Set(visits.map(v => v.siteId).filter(Boolean))].sort();
  const current = els.siteFilter.value;

  els.siteFilter.innerHTML = `<option value="all">Todos os sites</option>`;

  for (const id of ids) {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = id;
    els.siteFilter.appendChild(opt);
  }

  if (ids.includes(current)) {
    els.siteFilter.value = current;
  }
}

function getFilteredVisits() {
  const site = els.siteFilter.value;
  const period = Number(els.periodFilter.value);
  const days = lastNDays(period);
  const daySet = new Set(days);

  return allVisits.filter(v => {
    const matchSite = site === "all" ? true : v.siteId === site;
    const matchDay = daySet.has(v.day);
    return matchSite && matchDay;
  });
}

function getFilteredPresence() {
  const site = els.siteFilter.value;
  const cutoff = Date.now() - 70000;

  return allPresence.filter(p => {
    const matchSite = site === "all" ? true : p.siteId === site;
    const alive = (p.updatedAtMs || 0) >= cutoff;
    return matchSite && alive;
  });
}

function updateDashboard() {
  const visits = getFilteredVisits();
  const presence = getFilteredPresence();
  const period = Number(els.periodFilter.value);
  const days = lastNDays(period);

  const pages = countBy(visits, v => v.path);
  const countries = countBy(visits, v => v.country);
  const browsers = countBy(visits, v => v.browser);
  const devices = countBy(visits, v => v.device);
  const referrers = countBy(visits, v => v.referrer || "Direto");
  const sites = countBy(visits, v => v.siteId);
  const daily = countBy(visits, v => v.day);

  els.totalVisits.textContent = String(visits.length);
  els.onlineNow.textContent = String(presence.length);
  els.totalPages.textContent = String(Object.keys(pages).length);
  els.totalCountries.textContent = String(Object.keys(countries).length);

  renderList(els.sitesList, topEntries(sites, 10), "Sem sites");
  renderList(els.pagesList, topEntries(pages, 10), "Sem páginas");
  renderList(els.referrersList, topEntries(referrers, 10), "Sem referrers");
  renderList(els.browsersList, topEntries(browsers, 10), "Sem navegadores");
  renderList(els.devicesList, topEntries(devices, 10), "Sem dispositivos");
  renderList(els.countriesList, topEntries(countries, 10), "Sem países");

  renderChart(days, daily);
}

async function loadAllData() {
  try {
    const visitsSnap = await getDocs(
      query(collection(db, "analytics_visits"), orderBy("createdAt", "asc"))
    );

    const presenceSnap = await getDocs(collection(db, "analytics_presence"));

    allVisits = visitsSnap.docs.map(doc => doc.data());
    allPresence = presenceSnap.docs.map(doc => doc.data());

    buildSiteFilter(allVisits);
    updateDashboard();
  } catch (error) {
    console.error("Erro ao carregar analytics:", error);
  }
}

els.siteFilter.addEventListener("change", updateDashboard);
els.periodFilter.addEventListener("change", updateDashboard);
els.refreshBtn.addEventListener("click", loadAllData);

loadAllData();
setInterval(loadAllData, 30000);