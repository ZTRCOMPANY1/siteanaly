import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp
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

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getSessionKey() {
  return `analytics_visit_${location.pathname}`;
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

async function trackVisit() {
  try {
    const sessionKey = getSessionKey();

    if (sessionStorage.getItem(sessionKey)) {
      return;
    }

    sessionStorage.setItem(sessionKey, "1");

    const country = await getCountry();

    await addDoc(collection(db, "analytics_visits"), {
      path: location.pathname || "/",
      url: location.href,
      title: document.title || "",
      host: location.hostname || "",
      referrer: document.referrer || "",
      country,
      userAgent: navigator.userAgent,
      language: navigator.language || "",
      screen: `${window.screen.width}x${window.screen.height}`,
      date: formatDate(new Date()),
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Erro ao registrar visita:", error);
  }
}

trackVisit();