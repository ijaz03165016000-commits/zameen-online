import { initPage, $, $$, params, propertyCard, cityOptions, typeOptions, typeLabel, isAJK, hydrateThumbs } from "../app.js";
import { getApprovedListings } from "../db.js";
import { COMMERCIAL_TYPES, AJK_CITIES } from "../seed.js";

initPage();
const PER_PAGE = 12;
let all = [], state = { ...params() }, page = 1;

const form = $("#filter-form");
$("#f-city").innerHTML = cityOptions(state.city || "");
$("#f-type").innerHTML = typeOptions(state.type || "");
$("#f-q").value = state.q || "";
$("#f-region").value = state.region || "";
form.min.value = state.min || ""; form.max.value = state.max || "";
$("#sort").value = state.sort || "new";

function chips(id, key) {
  const set = v => $$(`#${id} .chip`).forEach(c => c.classList.toggle("active", c.dataset.v === (v || "")));
  set(state[key]);
  $$(`#${id} .chip`).forEach(c => c.onclick = () => { state[key] = c.dataset.v; set(c.dataset.v); apply(); });
}
chips("purpose-chips", "purpose");
chips("bed-chips", "beds");

form.onsubmit = e => {
  e.preventDefault();
  const f = new FormData(form);
  for (const k of ["q", "region", "city", "type", "min", "max"]) state[k] = f.get(k) || "";
  apply();
  $("#filters").classList.remove("open");
};
$("#f-region").onchange = () => { if ($("#f-region").value === "ajk" && !AJK_CITIES.includes($("#f-city").value)) $("#f-city").value = ""; };
$("#reset").onclick = () => { state = {}; form.reset(); $$(".chip").forEach(c => c.classList.toggle("active", c.dataset.v === "")); apply(); };
$("#sort").onchange = () => { state.sort = $("#sort").value; apply(); };
$("#toggle-filters").onclick = () => $("#filters").classList.toggle("open");

function filtered() {
  const q = (state.q || "").toLowerCase().trim();
  let r = all.filter(l => {
    if (state.purpose && l.purpose !== state.purpose) return false;
    if (state.city && l.city !== state.city) return false;
    if (state.region === "ajk" && !isAJK(l.city)) return false;
    if (state.type) {
      if (state.type === "commercial") { if (!COMMERCIAL_TYPES.includes(l.type)) return false; }
      else if (l.type !== state.type) return false;
    }
    if (state.min && l.price < +state.min) return false;
    if (state.max && l.price > +state.max) return false;
    if (state.beds && (l.beds || 0) < +state.beds) return false;
    if (q && !`${l.title} ${l.location} ${l.city} ${l.description}`.toLowerCase().includes(q)) return false;
    return true;
  });
  const s = state.sort || "new";
  r.sort((a, b) => s === "low" ? a.price - b.price : s === "high" ? b.price - a.price : s === "popular" ? (b.views || 0) - (a.views || 0)
    : (b.featured - a.featured) || (b.createdAt - a.createdAt));
  return r;
}

function titles() {
  const what = state.type ? typeLabel(state.type) + (state.type === "commercial" ? " Properties" : "s") : "Properties";
  const why = state.purpose === "rent" ? "for Rent" : state.purpose === "sale" ? "for Sale" : "for Sale & Rent";
  const where = state.city || (state.region === "ajk" ? "Azad Kashmir" : "Pakistan");
  $("#page-title").textContent = `${what} ${why} in ${where}`;
  document.title = `${what} ${why} in ${where} | Zameen Online`;
}

function render() {
  const r = filtered();
  const pages = Math.max(1, Math.ceil(r.length / PER_PAGE));
  page = Math.min(page, pages);
  $("#count").textContent = `${r.length} ${r.length === 1 ? "property" : "properties"} found`;
  $("#results").innerHTML = r.length ? r.slice((page - 1) * PER_PAGE, page * PER_PAGE).map(propertyCard).join("")
    : '<div class="empty" style="grid-column:1/-1"><b>No properties match your search.</b>Try removing some filters or searching another city.</div>';
  $("#pager").innerHTML = pages > 1 ? Array.from({ length: pages }, (_, i) => `<button class="${i + 1 === page ? "active" : ""}" data-p="${i + 1}">${i + 1}</button>`).join("") : "";
  $$("#pager button").forEach(b => b.onclick = () => { page = +b.dataset.p; render(); window.scrollTo({ top: 0, behavior: "smooth" }); });
  hydrateThumbs($("#results"));
}

function apply() {
  page = 1;
  const clean = Object.fromEntries(Object.entries(state).filter(([, v]) => v));
  history.replaceState(null, "", "listings.html" + (Object.keys(clean).length ? "?" + new URLSearchParams(clean) : ""));
  titles(); render();
}

titles();
try { all = await getApprovedListings(); render(); }
catch (e) { console.error(e); $("#count").textContent = "Could not load properties"; $("#results").innerHTML = ""; }
