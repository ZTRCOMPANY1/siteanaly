import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCz9FnU8nW8WtDW_OWRNavN9MMWynGp69w",
  authDomain: "analy-28eb7.firebaseapp.com",
  projectId: "analy-28eb7",
  storageBucket: "analy-28eb7.firebasestorage.app",
  messagingSenderId: "790780925231",
  appId: "1:790780925231:web:898c96d72de20b12eefdda",
  measurementId: "G-4B549F84EW"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const totalVisitsEl = document.getElementById("totalVisits");
const todayVisitsEl = document.getElementById("todayVisits");
const totalPagesEl = document.getElementById("totalPages");
const totalCountriesEl = document.getElementById("totalCountries");
const topPagesEl = document.getElementById("topPages");
const topCountriesEl = document.getElementById("topCountries");

let chartInstance = null;

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function renderList(element, items, emptyText) {
  element.innerHTML = "";

  if (!items.length) {
    element.innerHTML = `<li>${emptyText}</li>`;
    return;
  }

  for (const item of items) {
    const li = document.createElement("li");
    li.innerHTML = `<span>${item.label}</span><strong>${item.value}</strong>`;
    element.appendChild(li);
  }
}

function buildDailyChart(dailyMap) {
  const labels = Object.keys(dailyMap).sort();
  const values = labels.map(label => dailyMap[label]);

  const ctx = document.getElementById("dailyChart").getContext("2d");

  if (chartInstance) {
    chartInstance.destroy();
  }

  chartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Visitas",
          data: values,
          tension: 0.25,
          borderWidth: 2,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          labels: {
            color: "#fff"
          }
        }
      },
      scales: {
        x: {
          ticks: { color: "#cbd5e1" },
          grid: { color: "rgba(255,255,255,0.08)" }
        },
        y: {
          beginAtZero: true,
          ticks: { color: "#cbd5e1" },
          grid: { color: "rgba(255,255,255,0.08)" }
        }
      }
    }
  });
}

async function loadAnalytics() {
  const visitsRef = collection(db, "analytics_visits");
  const q = query(visitsRef, orderBy("createdAt", "asc"));
  const snapshot = await getDocs(q);

  const visits = [];
  snapshot.forEach(doc => visits.push(doc.data()));

  const totalVisits = visits.length;
  const today = formatDate(new Date());

  const pageCount = {};
  const countryCount = {};
  const dailyCount = {};

  let todayVisits = 0;

  for (const visit of visits) {
    const page = visit.path || "/";
    const country = visit.country || "Desconhecido";
    const day = visit.date || "Sem data";

    pageCount[page] = (pageCount[page] || 0) + 1;
    countryCount[country] = (countryCount[country] || 0) + 1;
    dailyCount[day] = (dailyCount[day] || 0) + 1;

    if (day === today) {
      todayVisits++;
    }
  }

  const topPages = Object.entries(pageCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([label, value]) => ({ label, value }));

  const topCountries = Object.entries(countryCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([label, value]) => ({ label, value }));

  totalVisitsEl.textContent = totalVisits;
  todayVisitsEl.textContent = todayVisits;
  totalPagesEl.textContent = Object.keys(pageCount).length;
  totalCountriesEl.textContent = Object.keys(countryCount).length;

  renderList(topPagesEl, topPages, "Nenhuma página registrada ainda.");
  renderList(topCountriesEl, topCountries, "Nenhum país registrado ainda.");
  buildDailyChart(dailyCount);
}

loadAnalytics().catch(err => {
  console.error("Erro ao carregar analytics:", err);
});