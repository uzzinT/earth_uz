// Only allow http(s) links so a bad entry can't run script via "javascript:" URLs.
function safeUrl(u) {
  try { return ["http:", "https:"].includes(new URL(u, location.href).protocol) ? u : ""; }
  catch { return ""; }
}

// shortcut: no thumbnail → free WordPress mShots screenshot of the site's first screen;
// the first load can show a placeholder for ~1 min. Upload a thumbnail if it stays wrong.
function thumbSrc(app) {
  if (app.thumb) return safeUrl(app.thumb);
  const url = safeUrl(app.url);
  return url ? "https://s0.wp.com/mshots/v1/" + encodeURIComponent(url) + "?w=640&h=400" : "";
}
