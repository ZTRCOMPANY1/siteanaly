import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  query,
  orderBy,
  limit
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
import { escapeHtml } from "./utils.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const userProfile = JSON.parse(localStorage.getItem("sa_user_profile") || "null");
const allowedSites = userProfile?.sites || [];

function canSeeSite(siteId) {
  if (!userProfile) return false;
  if (userProfile.role === "owner") return true;
  return allowedSites.includes(siteId);
}

function getEl(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Elemento ${id} não encontrado`);
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

let allVisits = [];
let allPresence = [];
let allEvents = [];
let chartInstance = null;

function dateToYMD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function lastNDays(days) {
  const arr = [];
  const now = new Date();
  now.setHours(0, 0, 0, 0);

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

function topEntries(map, limitN = 10) {
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limitN)
    .map(([label, value]) => ({ label, value }));
}

function renderList(el, items, empty = "Sem dados") {
  el.innerHTML = "";
  if (!items.length) {
    el.innerHTML = `<li class="empty">${empty}</li>`;
    return;
  }

  for (const item of items) {
    const li = document.createElement("li");
    li.innerHTML = `<span>${escapeHtml(item.label)}</span><strong>${item.value}</strong>`;
    el.appendChild(li);
  }
}

function buildSiteFilter(visits) {
  const siteIds = [...new Set(visits.map(v => v.siteId).filter(Boolean))]
    .filter(canSeeSite)
    .sort();

  const current = els.siteFilter.value;
  els.siteFilter.innerHTML = `<option value="all">Todos os sites</option>`;

  for (const siteId of siteIds) {
    const opt = document.createElement("option");
    opt.value = siteId;
    opt.textContent = siteId;
    els.siteFilter.appendChild(opt);
  }

  if (siteIds.includes(current)) els.siteFilter.value = current;
}

function getFilteredVisits() {
  const selectedSite = els.siteFilter.value;
  const validDays = new Set(lastNDays(Number(els.periodFilter.value)));

  return allVisits.filter(v => {
    if (!canSeeSite(v.siteId)) return false;
    if (selectedSite !== "all" && v.siteId !== selectedSite) return false;
    return validDays.has(v.day);
  });
}

function getFilteredPresence() {
  const selectedSite = els.siteFilter.value;
  const cutoff = Date.now() - 70000;

  return allPresence.filter(p => {
    if (!canSeeSite(p.siteId)) return false;
    if (selectedSite !== "all" && p.siteId !== selectedSite) return false;
    return (p.updatedAtMs || 0) >= cutoff;
  });
}

function getCampaignLabel(v) {
  if (v.utm?.campaign) {
    return `${v.utm.source || "sem-source"} / ${v.utm.campaign}`;
  }
  return "Sem campanha";
}

function renderChart(days, dailyMap) {
  const ctx = els.chartCanvas.getContext("2d");
  const values = days.map(day => dailyMap[day] || 0);

  if (chartInstance) chartInstance.destroy();

  chartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels: days,
      datasets: [{
        label: "Visitas",
        data: values,
        borderColor: "#39ffb6",
        backgroundColor: "rgba(57,255,182,0.08)",
        fill: true,
        borderWidth: 2,
        tension: 0.28
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false
    }
  });
}

function updateDashboard() {
  const visits = getFilteredVisits();
  const online = getFilteredPresence();
  const days = lastNDays(Number(els.periodFilter.value));

  const pages = countBy(visits, v => v.path);
  const countries = countBy(visits, v => v.country);
  const browsers = countBy(visits, v => v.browser);
  const devices = countBy(visits, v => v.device);
  const referrers = countBy(visits, v => v.referrer || "Direto");
  const sites = countBy(visits, v => v.siteId);
  const daily = countBy(visits, v => v.day);

  els.totalVisits.textContent = String(visits.length);
  els.onlineNow.textContent = String(online.length);
  els.totalPages.textContent = String(Object.keys(pages).length);
  els.totalCountries.textContent = String(Object.keys(countries).length);

  renderList(els.sitesList, topEntries(sites));
  renderList(els.pagesList, topEntries(pages));
  renderList(els.referrersList, topEntries(referrers));
  renderList(els.browsersList, topEntries(browsers));
  renderList(els.devicesList, topEntries(devices));
  renderList(els.countriesList, topEntries(countries));

  renderChart(days, daily);

  console.log("Campanhas:", topEntries(countBy(visits, getCampaignLabel)));
  console.log("Entrada:", topEntries(countBy(visits.filter(v => v.isEntrance), v => v.path)));
  console.log("Saída:", topEntries(countBy(visits.filter(v => v.isExit), v => v.path)));
  console.log("Online pages:", topEntries(countBy(online, v => v.path)));
  console.log("Feed ao vivo:", allEvents);
}

async function loadAllData() {
  const [visitsSnap, presenceSnap, eventsSnap] = await Promise.all([
    getDocs(query(collection(db, "analytics_visits"), orderBy("createdAt", "asc"))),
    getDocs(collection(db, "analytics_presence")),
    getDocs(query(collection(db, "analytics_events"), orderBy("createdAt", "desc"), limit(30)))
  ]);

  allVisits = visitsSnap.docs.map(d => d.data());
  allPresence = presenceSnap.docs.map(d => d.data());
  allEvents = eventsSnap.docs.map(d => d.data());

  buildSiteFilter(allVisits);
  updateDashboard();
}

els.siteFilter.addEventListener("change", updateDashboard);
els.periodFilter.addEventListener("change", updateDashboard);
els.refreshBtn.addEventListener("click", loadAllData);

loadAllData().catch(console.error);
setInterval(() => loadAllData().catch(console.error), 30000);