import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc,
  addDoc,
  collection,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const SITE_CONFIG = window.SIMPLE_ANALYTICS || {};
const siteId = SITE_CONFIG.siteId || location.hostname;
const allowedDomains = SITE_CONFIG.allowedDomains || [];
const sessionDurationMinutes = 30;
const heartbeatIntervalMs = 30000;
const minPageVisibleMs = 4000;

const pageStart = Date.now();
let heartbeatTimer = null;

function formatDate(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getBrowser() {
  const ua = navigator.userAgent;
  if (/Edg/i.test(ua)) return "Edge";
  if (/OPR|Opera/i.test(ua)) return "Opera";
  if (/Chrome/i.test(ua)) return "Chrome";
  if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) return "Safari";
  if (/Firefox/i.test(ua)) return "Firefox";
  return "Outro";
}

function getDeviceType() {
  const ua = navigator.userAgent;
  if (/Tablet|iPad/i.test(ua)) return "Tablet";
  if (/Mobi|Android|iPhone/i.test(ua)) return "Mobile";
  return "Desktop";
}

function isBotOrFake() {
  const ua = navigator.userAgent || "";
  if (navigator.webdriver) return true;
  if (/bot|spider|crawl|headless|preview|facebookexternalhit|whatsapp|discord|slurp/i.test(ua)) return true;
  return false;
}

function isDomainAllowed() {
  if (!allowedDomains.length) return true;
  return allowedDomains.includes(location.hostname);
}

function getSessionId() {
  let id = localStorage.getItem("sa_session_id");
  let startedAt = Number(localStorage.getItem("sa_session_started_at") || 0);

  const now = Date.now();
  const maxAge = sessionDurationMinutes * 60 * 1000;

  if (!id || now - startedAt > maxAge) {
    id = crypto.randomUUID();
    startedAt = now;
    localStorage.setItem("sa_session_id", id);
    localStorage.setItem("sa_session_started_at", String(startedAt));
  }

  return id;
}

function getVisitDedupKey() {
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

async function registerVisit() {
  if (isBotOrFake()) return;
  if (!isDomainAllowed()) return;
  if (document.visibilityState !== "visible") return;
  if (Date.now() - pageStart < minPageVisibleMs) return;

  const dedupKey = getVisitDedupKey();
  if (sessionStorage.getItem(dedupKey)) return;

  sessionStorage.setItem(dedupKey, "1");

  const country = await getCountry();
  const browser = getBrowser();
  const device = getDeviceType();
  const referrer = document.referrer || "Direto";
  const sessionId = getSessionId();
  const now = new Date();

  await addDoc(collection(db, "analytics_visits"), {
    siteId,
    hostname: location.hostname,
    path: location.pathname || "/",
    url: location.href,
    title: document.title || "",
    referrer,
    country,
    browser,
    device,
    language: navigator.language || "",
    screen: `${screen.width}x${screen.height}`,
    sessionId,
    day: formatDate(now),
    createdAt: serverTimestamp()
  });
}

async function updatePresence() {
  if (isBotOrFake()) return;
  if (!isDomainAllowed()) return;
  if (document.visibilityState !== "visible") return;

  const sessionId = getSessionId();
  const key = `${siteId}_${sessionId}`;
  const ref = doc(db, "analytics_presence", key);

  await setDoc(ref, {
    siteId,
    hostname: location.hostname,
    path: location.pathname || "/",
    sessionId,
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
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

window.addEventListener("load", () => {
  setTimeout(() => {
    registerVisit().catch(console.error);
    if (document.visibilityState === "visible") startHeartbeat();
  }, minPageVisibleMs);
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    startHeartbeat();
  } else {
    stopHeartbeat();
  }
});