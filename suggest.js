// "✨ 추천 썸네일" in the admin page: offers the app's auto screenshot, images found
// inside the app's own page, and gallery photos that match its title/description.

// Words in a link's title/description → words to look for in gallery photo names/groups.
const TOPICS = [
  [/중력|진자|낙하|역학|운동|궤도/, ["달", "행성", "궤도", "토성", "목성", "moon"]],
  [/조석|밀물|썰물|해수면|바다|해양/, ["달", "산호초", "삼각주", "물과 폭포", "빙산"]],
  [/일식|월식|달|월하|eclipse|moon/i, ["달", "태양", "지구돋이", "moon", "eclipse"]],
  [/태양|햇빛|흑점|플레어/, ["태양", "sun"]],
  [/화산|마그마|용암|지진|판 구조/, ["화산", "volcan", "eruption", "etna"]],
  [/광물|암석|결정|보석|지층|화석/, ["광물", "지형", "crystal"]],
  [/날씨|기상|구름|태풍|대기|바람|기후/, ["구름", "태풍", "뇌우", "하늘", "cloud"]],
  [/빙하|얼음|극지|남극|북극/, ["빙하", "빙산", "남극", "오로라"]],
  [/오로라|자기장|태양풍/, ["오로라", "aurora"]],
  [/별|은하|성운|우주|천체|망원경|빅뱅/, ["망원경으로 본 우주", "성운", "은하", "성단", "nebula", "galaxy"]],
  [/행성|태양계|화성|목성|토성|금성|수성|해왕성|명왕성/, ["태양계", "화성", "목성", "토성", "금성", "수성", "해왕성", "명왕성"]],
  [/지구|좌표|지도|위성|데이터|여행/, ["우주에서 본 지구", "지구", "궤도", "삼각주", "사막"]],
  [/물|강|폭포|호수|순환/, ["물과 폭포", "삼각주", "waterfall", "falls"]],
  [/산|지형|사막|협곡/, ["지형", "히말라야", "사막", "그랜드캐니언", "canyon"]],
];

function matchingPhotos(app, max = 9) {
  const text = (app.title || "") + " " + (app.desc || "");
  const terms = TOPICS.filter(([re]) => re.test(text)).flatMap(([, t]) => t);
  const scored = GALLERY.map(g => {
    const hay = (g.name + " " + g.group).toLowerCase();
    return { g, score: terms.filter(t => hay.includes(t.toLowerCase())).length };
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score);
  // One photo per subject ("삼각주", "삼각주 2", … count once) so suggestions vary.
  const seen = new Set();
  const varied = scored.filter(({ g }) => { const base = g.name.replace(/ \d+$/, ""); return !seen.has(base) && seen.add(base); });
  if (varied.length) return varied.slice(0, max).map(x => x.g);
  // No topic matched: a spread across the gallery instead.
  const step = Math.max(1, Math.floor(GALLERY.length / max));
  return GALLERY.filter((_, i) => i % step === 0).slice(0, max);
}

// Resolves when the image loads with a usable size; null otherwise.
const probe = (src, minW = 1) => new Promise(ok => {
  const im = new Image();
  const t = setTimeout(() => ok(null), 8000);
  im.onload = () => { clearTimeout(t); ok(im.naturalWidth >= minW ? im : null); };
  im.onerror = () => { clearTimeout(t); ok(null); };
  im.src = src;
});

// Images inside the app's own page (works for apps on the same site, e.g. uzzint.github.io).
async function imagesInApp(url) {
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(res.status);
  const doc = new DOMParser().parseFromString(await res.text(), "text/html");
  const raw = [
    ...[...doc.querySelectorAll('meta[property="og:image"], meta[name="twitter:image"]')].map(m => m.content),
    ...[...doc.querySelectorAll("img[src]")].map(i => i.getAttribute("src")),
  ];
  const abs = [...new Set(raw.filter(Boolean).map(s => { try { return new URL(s, res.url).href; } catch { return ""; } }))]
    .filter(s => /^https?:/.test(s)).slice(0, 12);
  const ok = await Promise.all(abs.map(s => probe(s, 160)));
  return abs.filter((_, i) => ok[i]).slice(0, 8);
}

// ---- Free-license photo search (Wikimedia Commons + NASA; both allow browser requests, no key) ----
const textOf = html => new DOMParser().parseFromString(html || "", "text/html").body.textContent.trim();
const FREE = /^(cc0|public domain|pd\b|cc[ -]by(-sa)?[ -]?[\d.]*)/i;

async function searchCommons(q) {
  const api = "https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrlimit=24"
    + "&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=640&gsrsearch=" + encodeURIComponent(q + " filetype:bitmap");
  const pages = Object.values((await (await fetch(api)).json()).query?.pages || {}).sort((a, b) => a.index - b.index);
  return pages.map(p => {
    const ii = p.imageinfo?.[0], m = ii?.extmetadata || {};
    const license = (m.LicenseShortName?.value || "").trim();
    if (!ii?.thumburl || !FREE.test(license) || /\b(nc|nd)\b/i.test(license)) return null; // no non-commercial / no-derivatives
    return {
      thumb: ii.thumburl, full: ii.thumburl, copy: true,
      name: p.title.replace(/^File:/, "").replace(/\.\w+$/, ""),
      artist: textOf(m.Artist?.value).slice(0, 80) || "작가 미상", license, page: ii.descriptionurl,
    };
  }).filter(Boolean);
}

async function searchNasa(q) {
  const res = await (await fetch("https://images-api.nasa.gov/search?media_type=image&q=" + encodeURIComponent(q))).json();
  return (res.collection?.items || []).slice(0, 24).filter(it => it.links?.[0]?.href).map(it => {
    const d = it.data[0];
    return {
      // NASA's image server doesn't allow copying from the browser, so picks are linked (public domain, stable URLs).
      thumb: it.links[0].href, full: `https://images-assets.nasa.gov/image/${d.nasa_id}/${d.nasa_id}~medium.jpg`, copy: false,
      name: d.title.slice(0, 60), artist: "NASA" + (d.center ? " " + d.center : ""), license: "Public domain",
      page: "https://images.nasa.gov/details/" + encodeURIComponent(d.nasa_id),
    };
  });
}

async function runSearch(app, close, done) {
  const q = $("searchQ").value.trim();
  const box = $("searchGal");
  if (!q) return;
  box.replaceChildren(Object.assign(document.createElement("p"), { className: "note", textContent: "찾는 중..." }));
  const [commons, nasa] = await Promise.all([searchCommons(q).catch(() => []), searchNasa(q).catch(() => [])]);
  const pick = async r => {
    close();
    const credit = { name: r.name, artist: r.artist, license: r.license, page: r.page };
    if (r.copy) {
      // Keep our own copy so the site doesn't depend on Wikimedia; fall back to linking if the copy fails.
      try {
        const blob = await (await fetch(r.full)).blob();
        await uploadImage(blob, app, "thumb", done);
        if (app.thumb?.startsWith("thumbs/")) { app.thumbCredit = { ...credit, src: app.thumb }; return; }
      } catch {}
    }
    app.thumb = r.full;
    app.thumbCredit = { ...credit, src: r.full };
    done();
    dirty();
    say("썸네일을 바꿨어요. '저장하기'를 눌러야 반영돼요.");
  };
  const group = (title, list) => [
    Object.assign(document.createElement("h3"), { textContent: `${title} · ${list.length}장` }),
    ...(list.length ? list.map(r => {
      const b = Object.assign(document.createElement("button"), { type: "button", title: `${r.name}\n${r.artist} · ${r.license}`, onclick: () => pick(r) });
      b.append(Object.assign(document.createElement("img"), { src: r.thumb, alt: "", loading: "lazy" }),
        Object.assign(document.createElement("span"), { textContent: r.name }));
      return b;
    }) : [Object.assign(document.createElement("p"), { className: "note", textContent: "결과가 없어요. 다른 단어(영어)로 찾아보세요." })]),
  ];
  box.replaceChildren(...group("위키미디어 공용", commons), ...group("NASA", nasa));
}

function openSuggest(app, done) {
  $("searchGal").replaceChildren();
  $("searchForm").onsubmit = e => { e.preventDefault(); runSearch(app, () => $("suggest").close(), done); };
  const gal = $("suggestGal");
  const choose = thumb => { app.thumb = thumb; $("suggest").close(); done(); dirty(); say("썸네일을 바꿨어요. '저장하기'를 눌러야 반영돼요."); };
  const tile = (src, caption, thumb) => {
    const b = Object.assign(document.createElement("button"), { type: "button", title: caption, onclick: () => choose(thumb) });
    b.append(Object.assign(document.createElement("img"), { src, alt: "", loading: "lazy" }), Object.assign(document.createElement("span"), { textContent: caption }));
    return b;
  };
  const section = title => {
    const h = Object.assign(document.createElement("h3"), { textContent: title });
    const note = Object.assign(document.createElement("p"), { className: "note", textContent: "찾는 중..." });
    gal.append(h, note);
    return { note, add: els => note.replaceWith(...els), say: t => note.textContent = t };
  };
  $("suggestTitle").textContent = "추천 썸네일 · " + (app.title || "제목 없음");
  gal.replaceChildren();
  const url = safeUrl(app.url);

  const shot = section("앱 첫 화면 캡처");
  const inApp = section("앱 안에 있는 사진");
  const photos = section("어울리는 우주·지구과학 사진");
  photos.add(matchingPhotos(app).map(g => tile(g.src, g.name, g.src)));
  $("suggest").showModal();

  if (!url) {
    shot.say("링크 주소를 먼저 넣어 주세요.");
    inApp.say("링크 주소를 먼저 넣어 주세요.");
    return;
  }
  const auto = "thumbs/auto/" + autoThumbKey(url) + ".jpg";
  probe(auto).then(ok => ok
    ? shot.add([tile(auto, "자동 캡처 (기본값)", "")]) // empty thumb = use the auto screenshot
    : shot.say("아직 자동 캡처가 없어요. 링크를 저장하면 2~3분 뒤에 생겨요."));
  imagesInApp(url)
    .then(list => list.length ? inApp.add(list.map(s => tile(s, s.split("/").pop(), s))) : inApp.say("앱 안에서 쓸 만한 사진을 찾지 못했어요."))
    .catch(() => inApp.say("이 앱은 다른 사이트라 사진을 가져올 수 없어요."));
}
