// Only allow http(s) links so a bad entry can't run script via "javascript:" URLs.
function safeUrl(u) {
  try { return ["http:", "https:"].includes(new URL(u, location.href).protocol) ? u : ""; }
  catch { return ""; }
}

// Subjects without a chosen photo still get one, picked by position.
const subjectImage = (s, i) => s.image ? safeUrl(s.image) : GALLERY[i % GALLERY.length].src;

// links.json used to be a bare app array; accept both shapes.
function normalize(data) {
  return Array.isArray(data) ? { subjects: [], apps: data } : { subjects: data.subjects || [], apps: data.apps || [] };
}

// File name the screenshot Action saves for a link; keep in sync with tools/screenshots.mjs.
const autoThumbKey = url => url.replace(/^https?:\/\//i, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();

// Thumbnail sources to try in order: uploaded image, screenshot saved by the GitHub Action,
// then the free mShots service (slow, sometimes never answers — last resort only).
function thumbCandidates(app) {
  const url = safeUrl(app.url);
  return [
    app.thumb && safeUrl(app.thumb),
    url && "thumbs/auto/" + autoThumbKey(url) + ".jpg",
    url && "https://s0.wp.com/mshots/v1/" + encodeURIComponent(url) + "?w=640&h=400",
  ].filter(Boolean);
}
const thumbSrc = app => thumbCandidates(app)[0] || "";

// Load the first thumbnail that works; call giveUp() if none does.
function setThumb(img, app, giveUp) {
  const list = thumbCandidates(app);
  let i = 0, timer = 0;
  // Async so giveUp() can replace the img even when it fails before being added to the page.
  const fail = () => { clearTimeout(timer); img.onerror = img.onload = null; setTimeout(giveUp); };
  const tryNext = () => {
    if (i >= list.length) return fail();
    const src = list[i++];
    clearTimeout(timer);
    if (src.startsWith("https://s0.wp.com/")) timer = setTimeout(() => { if (!img.naturalWidth) fail(); }, 10000);
    img.src = src;
  };
  img.onerror = tryNext;
  img.onload = () => clearTimeout(timer);
  tryNext();
}
