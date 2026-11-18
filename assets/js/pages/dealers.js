import { initPage, $, esc, cityOptions, waLink, ICON } from "../app.js?v=20261118_02";
import { subscribeDealers } from "../db.js?v=20261118_02";

initPage();
$("#city").innerHTML = cityOptions(new URLSearchParams(location.search).get("city") || "");
let all = [];

function render() {
  const q = $("#q").value.toLowerCase().trim(), c = $("#city").value;
  const r = all.filter(d => (!c || d.city === c) && (!q || `${d.name} ${d.owner}`.toLowerCase().includes(q)))
    .sort((a, b) => (b.verified - a.verified) || ((b.listings || 0) - (a.listings || 0)));
  $("#count").textContent = `${r.length} dealer${r.length === 1 ? "" : "s"}`;
  $("#list").innerHTML = r.length ? r.map(d => `
    <div class="dealer-card">
      <div class="dealer-top">
        <div class="dealer-logo">${d.logo ? `<img src="${esc(d.logo)}" alt="">` : esc(d.name.split(" ").map(w => w[0]).slice(0, 2).join(""))}</div>
        <div><h3>${esc(d.name)}</h3><div class="muted">${ICON.pin.replace("<svg", '<svg width="13" height="13" style="vertical-align:-2px"')} ${esc(d.city)}${d.owner ? " · " + esc(d.owner) : ""}</div></div>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${d.verified ? '<span class="badge badge-verified">✓ Verified</span>' : ""}
        ${d.plan && d.plan !== "Basic" ? `<span class="badge badge-featured">${esc(d.plan)}</span>` : ""}
        <span class="badge" style="background:#eef2f7">${d.listings || 0} listings</span>
      </div>
      ${d.about ? `<p class="muted">${esc(d.about)}</p>` : ""}
      <div class="row">
        <a class="btn btn-primary btn-sm" href="tel:${esc((d.phone || "").replace(/\s/g, ""))}">Call</a>
        <a class="btn btn-green btn-sm" target="_blank" rel="noopener" href="${waLink(d.whatsapp || d.phone, "Assalam o Alaikum, I found you on Zameen Online.")}">WhatsApp</a>
        <a class="btn btn-outline btn-sm" href="listings.html?city=${encodeURIComponent(d.city)}">Properties</a>
      </div>
    </div>`).join("") : '<div class="empty" style="grid-column:1/-1"><b>No dealers found.</b>Try another city.</div>';
}
$("#q").oninput = render;
$("#city").onchange = render;
const unsubDealers = subscribeDealers(
  rows => { all = rows || []; render(); },
  e => { console.error(e); $("#count").textContent = "Could not load dealers"; }
);
window.addEventListener("beforeunload", () => { try { unsubDealers(); } catch {} });
