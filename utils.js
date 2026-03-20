export function formatDate(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getBrowser() {
  const ua = navigator.userAgent;
  if (/Edg/i.test(ua)) return "Edge";
  if (/OPR|Opera/i.test(ua)) return "Opera";
  if (/Chrome/i.test(ua)) return "Chrome";
  if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) return "Safari";
  if (/Firefox/i.test(ua)) return "Firefox";
  return "Outro";
}

export function getDeviceType() {
  const ua = navigator.userAgent;
  if (/Tablet|iPad/i.test(ua)) return "Tablet";
  if (/Mobi|Android|iPhone/i.test(ua)) return "Mobile";
  return "Desktop";
}

export function getTrafficType(referrer) {
  if (!referrer) return "direto";
  const r = referrer.toLowerCase();

  if (r.includes("google.")) return "google";
  if (
    r.includes("instagram.") ||
    r.includes("facebook.") ||
    r.includes("tiktok.") ||
    r.includes("twitter.") ||
    r.includes("x.com") ||
    r.includes("linkedin.") ||
    r.includes("youtube.")
  ) return "social";

  return "externo";
}

export function getUTM() {
  const p = new URLSearchParams(location.search);
  return {
    source: p.get("utm_source") || "",
    medium: p.get("utm_medium") || "",
    campaign: p.get("utm_campaign") || "",
    term: p.get("utm_term") || "",
    content: p.get("utm_content") || ""
  };
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}