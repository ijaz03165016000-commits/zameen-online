import { initPage, $, $$, esc, cityOptions, waLink, ICON } from "../app.js";
import { getServices } from "../db.js?v=20261118_01";
import { SERVICE_CATEGORIES } from "../seed.js";
import { SITE } from "../firebase-config.js";

initPage();
const p = new URLSearchParams(location.search);
let cat = p.get("category") || "", all = [];
$("#city").innerHTML = cityOptions(p.get("city") || "");
$("#cats").innerHTML = `<button class="chip" data-v="">All Services</button>` +
  SERVICE_CATEGORIES.map(c => `<button class="chip" data-v="${c.slug}">${c.emoji} ${c.name}</button>`).join("");
const setChips = () => $$("#cats .chip").forEach(c => c.classList.toggle("active", c.dataset.v === cat));
$$("#cats .chip").forEach(c => c.onclick = () => { cat = c.dataset.v; setChips(); render(); });
setChips();

function render() {
  const city = $("#city").value;
  const r = all.filter(s => (!cat || s.category === cat) && (!city || s.city === city))
    .sort((a, b) => (b.verified - a.verified) || ((b.rating || 0) - (a.rating || 0)));
  const catName = SERVICE_CATEGORIES.find(c => c.slug === cat);
  $("#count").textContent = `${r.length} ${catName ? catName.name : "service"} provider${r.length === 1 ? "" : "s"}`;
  $("#list").innerHTML = r.length ? r.map(s => {
    const c = SERVICE_CATEGORIES.find(x => x.slug === s.category) || { emoji: "🛠", name: s.category };
    return `<div class="dealer-card">
      <div class="dealer-top"><div class="dealer-logo" style="font-size:28px">${c.emoji}</div>
        <div><h3>${esc(s.name)}</h3><div class="muted">${esc(c.name)} · ${esc(s.city)}</div></div></div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        ${s.rating ? `<span class="rating">★ ${esc(s.rating)}</span>` : ""}
        ${s.experience ? `<span class="badge" style="background:#eef2f7">${esc(s.experience)} yrs experience</span>` : ""}
        ${s.verified ? '<span class="badge badge-verified">✓ Verified</span>' : ""}
      </div>
      ${s.about ? `<p class="muted">${esc(s.about)}</p>` : ""}
      <div class="row">
        <a class="btn btn-primary btn-sm" href="tel:${esc((s.phone || "").replace(/\s/g, ""))}">${ICON.phone.replace("<svg", '<svg width="15" height="15"')} Call</a>
        <a class="btn btn-green btn-sm" target="_blank" rel="noopener" href="${waLink(s.whatsapp || s.phone, `Assalam o Alaikum, I need ${c.name} service (found you on Zameen Online).`)}">WhatsApp</a>
      </div></div>`;
  }).join("") : '<div class="empty" style="grid-column:1/-1"><b>No providers listed here yet.</b>Contact us on WhatsApp and we will arrange a trusted professional for you.</div>';
}
$("#city").onchange = render;
$("#join").onclick = e => { e.preventDefault(); window.open(waLink(SITE.whatsapp, "Assalam o Alaikum, I want to list my service on Zameen Online."), "_blank"); };
try { all = await getServices(); render(); } catch (e) { console.error(e); $("#count").textContent = "Could not load services"; }
