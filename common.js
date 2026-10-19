// Only allow http(s) links so a bad entry can't run script via "javascript:" URLs.
function safeUrl(u) {
  try { return ["http:", "https:"].includes(new URL(u, location.href).protocol) ? u : ""; }
  catch { return ""; }
}

// NASA photos (public domain, images.nasa.gov) offered as subject backgrounds.
const GALLERY = [
  ["earth", "블루 마블 · 아폴로 17호"],
  ["earthrise", "지구돋이 · 아폴로 8호"],
  ["earthset", "달 너머 지구 · 아르테미스 I"],
  ["earth-satellite", "위성에서 본 지구"],
  ["night-earth", "우주정거장에서 본 밤의 지구"],
  ["aurora", "오로라 · 우주정거장"],
  ["typhoon", "태풍의 눈 · 우주정거장"],
  ["himalaya", "히말라야 · 우주정거장"],
  ["moon", "보름달"],
  ["sun", "태양 · SDO"],
  ["mars-dunes", "화성의 모래 언덕"],
  ["carina-nebula", "카리나 성운 · 제임스 웹"],
  ["ring-nebula", "남쪽 고리 성운 · 제임스 웹"],
  ["andromeda", "안드로메다 은하"],
].map(([key, name]) => ({ src: "img/" + key + ".jpg", name }));

// Subjects without a chosen photo still get one, picked by position.
const subjectImage = (s, i) => s.image ? safeUrl(s.image) : GALLERY[i % GALLERY.length].src;

// links.json used to be a bare app array; accept both shapes.
function normalize(data) {
  return Array.isArray(data) ? { subjects: [], apps: data } : { subjects: data.subjects || [], apps: data.apps || [] };
}

// shortcut: no thumbnail → free WordPress mShots screenshot of the site's first screen;
// the first load can show a placeholder for ~1 min. Upload a thumbnail if it stays wrong.
function thumbSrc(app) {
  if (app.thumb) return safeUrl(app.thumb);
  const url = safeUrl(app.url);
  return url ? "https://s0.wp.com/mshots/v1/" + encodeURIComponent(url) + "?w=640&h=400" : "";
}
