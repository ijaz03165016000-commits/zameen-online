import { initPage, $, $$, ICON, propertyCard, cityOptions, typeOptions, hydrateThumbs } from "../app.js?v=20261118_02";
import { subscribeApprovedListings } from "../db.js?v=20261118_02";
import { SERVICE_CATEGORIES } from "../seed.js";

initPage();

// Search box
let purpose = "sale";
$("#hero-city").innerHTML = cityOptions();
$("#hero-type").innerHTML = typeOptions();
$$("#hero-search .tabs button").forEach(b => b.onclick = () => {
  $$("#hero-search .tabs button").forEach(x => x.classList.remove("active"));
  b.classList.add("active"); purpose = b.dataset.purpose;
});
$("#hero-search").onsubmit = e => {
  e.preventDefault();
  const f = new FormData(e.target);
  const p = new URLSearchParams({ purpose });
  for (const k of ["q", "city", "type"]) if (f.get(k)) p.set(k, f.get(k));
  location.href = "listings.html?" + p;
};

// Property types
const types = [
  ["house", "Houses", "home", "ti-blue"], ["apartment", "Apartments", "building", "ti-purple"],
  ["plot", "Plots", "grid", "ti-green"], ["commercial", "Commercial", "store", "ti-orange"]
];
$("#type-grid").innerHTML = types.map(([v, t, i, c]) =>
  `<a class="type-card" href="listings.html?type=${v}"><div class="type-icon ${c}">${ICON[i]}</div>${t}</a>`).join("");

// Cities
const cities = [
  ["Mirpur AJK", "3,400+", "photo-1712651794803-fdf91d31d7b9", true], ["Muzaffarabad", "2,100+", "photo-1661668636477-93deb9969439", true],
  ["Rawalakot", "1,800+", "photo-1621232082074-1a7750ecc557", true], ["Kotli", "1,200+", "photo-1723579038258-2a9c9e777509", true],
  ["Islamabad", "9,400+", "photo-1629542209026-c4eac6755127"], ["Lahore", "18,200+", "photo-1629552441775-f348a18a391c"],
  ["Karachi", "12,500+", "photo-1640698951132-b6498c51147b"], ["Rawalpindi", "5,800+", "photo-1752731904224-618b504783e3"]
];
$("#city-grid").innerHTML = cities.map(([c, n, img, ajk]) =>
  `<a class="city-card" href="listings.html?city=${encodeURIComponent(c)}">
     <img src="https://images.unsplash.com/${img}?w=600" alt="${c}" loading="lazy">
     ${ajk ? '<span class="badge badge-ajk">AJK</span>' : ""}
     <div class="info"><h3>${c}</h3><span>${n} listings</span></div></a>`).join("");

// Services
$("#service-grid").innerHTML = SERVICE_CATEGORIES.map(s =>
  `<a class="service-card" href="services.html?category=${s.slug}"><span class="emoji">${s.emoji}</span>${s.name}</a>`).join("");

// Featured listings (real-time live updates as soon as admin approves an ad)
const unsubFeatured = subscribeApprovedListings(
  all => {
    let list = all.filter(l => l.featured);
    if (list.length < 6) list = [...list, ...all.filter(l => !l.featured)].slice(0, 6);
    $("#featured").innerHTML = list.length ? list.slice(0, 6).map(propertyCard).join("")
      : '<div class="empty" style="grid-column:1/-1"><b>No featured properties yet.</b>Be the first — <a href="post-ad.html" style="color:var(--primary);font-weight:700">post your property</a>.</div>';
    hydrateThumbs($("#featured"));
  },
  e => {
    console.error(e);
    $("#featured").innerHTML = '<div class="empty" style="grid-column:1/-1"><b>Could not load properties.</b>Please refresh the page.</div>';
  }
);
window.addEventListener("beforeunload", () => { try { unsubFeatured(); } catch {} });
