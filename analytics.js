import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
  getFirestore,
  addDoc,
  collection,
  doc,
  setDoc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
import {
  formatDate,
  getBrowser,
  getDeviceType,
  getTrafficType,
  getUTM
} from "./utils.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const SITE_CONFIG = window.SIMPLE_ANALYTICS || {};
const siteId = SITE_CONFIG.siteId || location.hostname;
const allowedDomains = SITE_CONFIG.allowedDomains || [];
const heartbeatIntervalMs = 30000;
const minVisibleMs = 4000;
const pageStart = Date.now();

let heartbeatTimer = null;
let lastVisitDocId = null;

function isAllowedDomain() {
  if (!allowedDomains.length) return true;
  return allowedDomains.includes(location.hostname);
}

function isBotOrFake() {
  const ua = navigator.userAgent || "";
  if (navigator.webdriver) return true;
  if (/bot|spider|crawl|headless|slurp|preview|facebookexternalhit|whatsapp|discord/i.test(ua)) return true;
  return false;
}

function getSessionId() {
  let sessionId = localStorage.getItem("sa_session_id");
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem("sa_session_id", sessionId);
  }
  return sessionId;
}

function getVisitKey() {
  return `sa_visit_${siteId}_${location.pathname}_${formatDate()}_${getSessionId()}`;
}

async function getCountry() {
  try {
    const res = await fetch("https://ipapi.co/json/");
    const data = await res.json();
    return data.country_name || "Desconhecido";
  } catch {
    return "Desconhecido";
  }
}

async function addRealtimeEvent(type, message, extra = {}) {
  await addDoc(collection(db, "analytics_events"), {
    siteId,
    type,
    message,
    path: location.pathname || "/",
    referrer: document.referrer || "",
    sessionId: getSessionId(),
    createdAt: serverTimestamp(),
    ...extra
  });
}

async function registerVisit() {
  if (isBotOrFake()) return;
  if (!isAllowedDomain()) return;
  if (document.visibilityState !== "visible") return;
  if (Date.now() - pageStart < minVisibleMs) return;

  const visitKey = getVisitKey();
  if (sessionStorage.getItem(visitKey)) return;
  sessionStorage.setItem(visitKey, "1");

  const country = await getCountry();
  const referrer = document.referrer || "";
  const trafficType = getTrafficType(referrer);
  const utm = getUTM();

  const visitRef = await addDoc(collection(db, "analytics_visits"), {
    siteId,
    hostname: location.hostname,
    path: location.pathname || "/",
    title: document.title || "",
    url: location.href,
    referrer,
    trafficType,
    country,
    browser: getBrowser(),
    device: getDeviceType(),
    sessionId: getSessionId(),
    isEntrance: !sessionStorage.getItem(`sa_seen_session_${getSessionId()}`),
    isExit: false,
    utm,
    day: formatDate(),
    createdAt: serverTimestamp()
  });

  lastVisitDocId = visitRef.id;
  sessionStorage.setItem(`sa_seen_session_${getSessionId()}`, "1");

  await addRealtimeEvent("page_view", `Abriu ${location.pathname}`, {
    country,
    trafficType,
    utmSource: utm.source || "",
    utmCampaign: utm.campaign || "",
    referrerLabel: referrer || "Direto"
  });
}

async function updatePresence() {
  if (isBotOrFake()) return;
  if (!isAllowedDomain()) return;
  if (document.visibilityState !== "visible") return;

  const country = await getCountry();
  await setDoc(doc(db, "analytics_presence", `${siteId}_${getSessionId()}`), {
    siteId,
    sessionId: getSessionId(),
    path: location.pathname || "/",
    country,
    referrer: document.referrer || "",
    updatedAtMs: Date.now(),
    updatedAt: serverTimestamp()
  }, { merge: true });
}

function startHeartbeat() {
  stopHeartbeat();
  updatePresence().catch(console.error);
  heartbeatTimer = setInterval(() => {
    updatePresence().catch(console.error);
  }, heartbeatIntervalMs);
}

function stopHeartbeat() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = null;
}

window.addEventListener("load", () => {
  setTimeout(() => {
    registerVisit().catch(console.error);
    startHeartbeat();
  }, minVisibleMs);
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    startHeartbeat();
  } else {
    stopHeartbeat();
  }
});

window.addEventListener("beforeunload", async () => {
  try {
    if (lastVisitDocId) {
      await updateDoc(doc(db, "analytics_visits", lastVisitDocId), {
        isExit: true
      });
    }
  } catch {}
});