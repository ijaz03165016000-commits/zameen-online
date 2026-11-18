// =========================================================
//  Shared layout (header, footer) and helpers
// =========================================================
import { SITE } from "./firebase-config.js";
import { LIVE, ready, getUser, onAuth, signOut, getThumbs } from "./db.js?v=20261118_02";
import { TYPES, CITIES, AJK_CITIES } from "./seed.js";

export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const params = () => Object.fromEntries(new URLSearchParams(location.search));
export const typeLabel = v => (TYPES.find(t => t.value === v) || { label: v || "" }).label;
export const isAJK = c => AJK_CITIES.includes(c);
export const fallbackImg = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 275"><rect width="400" height="275" fill="#dfe6ef"/><path d="M160 160l40-40 40 40v40h-80z" fill="#b6c3d6"/><rect x="190" y="170" width="20" height="30" fill="#dfe6ef"/></svg>');

export function formatPrice(p, purpose) {
  p = Number(p) || 0;
  let s;
  if (p >= 1e7) s = `PKR ${+(p / 1e7).toFixed(2)} Crore`;
  else if (p >= 1e5) s = `PKR ${+(p / 1e5).toFixed(2)} Lakh`;
  else s = `PKR ${p.toLocaleString("en-PK")}`;
  return purpose === "rent" ? `${s}<small> /month</small>` : s;
}
export const timeAgo = ms => {
  if (!ms || ms < 100000000000) return "Just now";
  const diff = Date.now() - ms;
  if (diff < 60000) return "Just now";
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(diff / 3600000);
  if (hrs < 24) return `${hrs}h ago`;
  const d = Math.floor(diff / 86400000);
  if (d === 1) return "Yesterday";
  if (d < 30) return `${d} days ago`;
  return new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};
export const waLink = (num, text = "") => `https://wa.me/${String(num || SITE.whatsapp).replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;

export function toast(msg, ms = 2600) {
  $$(".toast").forEach(x => x.remove());
  const t = document.createElement("div"); t.className = "toast"; t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), ms);
}

export function modal(html) {
  const bg = document.createElement("div"); bg.className = "modal-bg";
  bg.innerHTML = `<div class="modal" role="dialog">${html}</div>`;
  bg.addEventListener("click", e => { if (e.target === bg || e.target.closest("[data-close]")) bg.remove(); });
  document.body.appendChild(bg);
  return bg;
}

/* ---------- Icons ---------- */
export const ICON = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg>',
  building: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1M10 21v-3h4v3"/></svg>',
  grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
  store: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 13h8M8 17h8"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
  bed: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18V7M3 13h18v5M21 18v-3a3 3 0 0 0-3-3h-7v1"/><circle cx="7" cy="10.5" r="1.5"/></svg>',
  bath: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h16v3a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM6 12V5a2 2 0 0 1 4 0M7 20l-1 2M17 20l1 2"/></svg>',
  area: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
  heart: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-7.5-4.6-9.5-9.3C1.2 8.5 3.3 5 6.8 5c2 0 3.4 1.1 4.2 2.3h2C13.8 6.1 15.2 5 17.2 5c3.5 0 5.6 3.5 4.3 6.7C19.5 16.4 12 21 12 21z"/></svg>',
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></svg>',
  mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/></svg>',
  wa: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.1-.2.3-.8.9-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.2-.5-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6l.4-.5c.2-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5 2.5 1 3 .8 3.6.8.6-.1 1.7-.7 2-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3zM12 21.8c-1.8 0-3.5-.5-5-1.4l-.4-.2-3.7 1 1-3.6-.2-.4A9.8 9.8 0 1 1 12 21.8zM12 0a12 12 0 0 0-10.3 18L0 24l6.2-1.6A12 12 0 1 0 12 0z"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>'
};
const logoHTML = `<a href="index.html" class="logo" aria-label="${SITE.name} home"><span class="logo-icon">${ICON.home}</span><span><span class="z">Zameen</span> <span class="o">Online</span></span></a>`;

/* ---------- Favourites (per browser) ---------- */
export const favs = {
  get() { try { return JSON.parse(localStorage.getItem("zo_favs") || "[]"); } catch { return []; } },
  has(id) { return this.get().includes(id); },
  toggle(id) {
    let f = this.get(); f = f.includes(id) ? f.filter(x => x !== id) : [...f, id];
    try { localStorage.setItem("zo_favs", JSON.stringify(f)); } catch {}
    return f.includes(id);
  }
};

/* ---------- Property card ---------- */
/* <img> for a listing's cover photo; uploaded photos load via hydrateThumbs() */
export function coverImg(l, cls = "") {
  const url = l.images && l.images[0];
  if (url) return `<img class="${cls}" src="${esc(url)}" alt="${esc(l.title)}" loading="lazy" onerror="this.src='${fallbackImg}'">`;
  return `<img class="${cls}" src="${fallbackImg}" alt="${esc(l.title)}" ${l.photoCount ? `data-thumb="${esc(l.id)}"` : ""}>`;
}
export async function hydrateThumbs(root = document) {
  const imgs = $$("img[data-thumb]", root); if (!imgs.length) return;
  const map = await getThumbs([...new Set(imgs.map(i => i.dataset.thumb))]);
  imgs.forEach(i => { const s = map[i.dataset.thumb]; if (s) i.src = s; i.removeAttribute("data-thumb"); });
}

export function propertyCard(l) {
  const meta = [];
  if (l.beds) meta.push(`<span>${ICON.bed}${l.beds} Beds</span>`);
  if (l.baths) meta.push(`<span>${ICON.bath}${l.baths} Baths</span>`);
  meta.push(`<span>${ICON.area}${esc(l.area)} ${esc(l.areaUnit)}</span>`);
  return `<a class="prop-card" href="property.html?id=${encodeURIComponent(l.id)}">
    <div class="prop-img">
      ${coverImg(l)}
      <div class="badges">
        <span class="badge badge-${l.purpose === "rent" ? "rent" : "sale"}">For ${l.purpose === "rent" ? "Rent" : "Sale"}</span>
        ${l.featured ? '<span class="badge badge-featured">★ Featured</span>' : ""}
      </div>
      <button class="fav-btn ${favs.has(l.id) ? "on" : ""}" data-fav="${esc(l.id)}" aria-label="Save">${ICON.heart}</button>
    </div>
    <div class="prop-body">
      <div class="price">${formatPrice(l.price, l.purpose)}</div>
      <div class="prop-title">${esc(l.title)}</div>
      <div class="prop-loc">${ICON.pin}${esc(l.location ? l.location + ", " : "")}${esc(l.city)}</div>
      <div class="prop-meta">${meta.join("")}</div>
    </div>
  </a>`;
}
document.addEventListener("click", e => {
  const b = e.target.closest("[data-fav]"); if (!b) return;
  e.preventDefault(); e.stopPropagation();
  const on = favs.toggle(b.dataset.fav); b.classList.toggle("on", on);
  toast(on ? "Saved to favourites" : "Removed from favourites");
});

/* ---------- Select option builders ---------- */
export const cityOptions = (sel = "", all = "All Cities") =>
  (all ? `<option value="">${all}</option>` : "") +
  Object.entries(CITIES).map(([g, cs]) => `<optgroup label="${g}">${cs.map(c => `<option ${c === sel ? "selected" : ""}>${c}</option>`).join("")}</optgroup>`).join("");
export const typeOptions = (sel = "", all = "All Types") =>
  (all ? `<option value="">${all}</option>` : "") + TYPES.map(t => `<option value="${t.value}" ${t.value === sel ? "selected" : ""}>${t.label}</option>`).join("");

/* ---------- Header / footer ---------- */
const NAV = [
  ["listings.html?purpose=sale", "Buy"], ["listings.html?purpose=rent", "Rent"], ["listings.html", "Browse"],
  ["dealers.html", "Dealers"], ["services.html", "🛠 Services"], ["packages.html", "Packages"]
];

export const ADMIN_ROLES = ["super_admin", "admin", "district_admin"];
export const isAdminRole = r => ADMIN_ROLES.includes(r);

function userArea(u) {
  if (!u) return `<a class="btn btn-primary desk" href="login.html">Sign In</a><a class="btn btn-accent desk" href="post-ad.html">+ Post Ad</a>`;
  const initials = esc((u.name || "U").split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase());
  return `${isAdminRole(u.role) ? '<a class="btn btn-outline desk" href="admin.html">Admin</a>' : ""}
    <a class="user-chip desk" href="dashboard.html"><span class="avatar">${initials}</span>${esc(u.name.split(" ")[0])}</a>
    <a class="btn btn-accent desk" href="post-ad.html">+ Post Ad</a>`;
}
function mobileLinks(u) {
  return NAV.map(([h, t]) => `<a href="${h}">${t}</a>`).join("") +
    (u ? `<a href="dashboard.html">My Dashboard</a>${isAdminRole(u.role) ? '<a href="admin.html">Admin Panel</a>' : ""}<a href="#" data-logout>Sign Out</a>`
       : `<a class="btn btn-primary" href="login.html">Sign In</a>`) +
    `<a class="btn btn-accent" href="post-ad.html">+ Post Ad</a>`;
}

function renderHeader() {
  const el = $("#site-header"); if (!el) return;
  const u = getUser();
  const page = location.pathname.split("/").pop() || "index.html";
  const p = params();
  const isActive = h => {
    const [file, q] = h.split("?");
    if (file !== page) return false;
    if (q) return q === "purpose=" + (p.purpose || "");
    return !p.purpose || file !== "listings.html";
  };
  el.innerHTML = `${LIVE ? "" : '<div class="demo-bar">Demo mode — sample data. Admin login: admin@zameen.online / admin123</div>'}
  <header class="site-header">
    <div class="container header-inner">
      ${logoHTML}
      <nav class="main-nav">${NAV.map(([h, t]) => `<a href="${h}" class="${isActive(h) ? "active" : ""}">${t}</a>`).join("")}</nav>
      <div class="header-actions">${userArea(u)}
        <button class="menu-toggle" aria-label="Menu">${ICON.menu}</button>
      </div>
    </div>
    <nav class="mobile-nav">${mobileLinks(u)}</nav>
  </header>`;
  $(".menu-toggle", el).onclick = () => {
    const open = $(".mobile-nav", el).classList.toggle("open");
    $(".menu-toggle", el).innerHTML = open ? ICON.close : ICON.menu;
  };
  $$("[data-logout]", el).forEach(a => a.onclick = async e => { e.preventDefault(); await signOut(); location.href = "index.html"; });
}

function renderFooter() {
  const el = $("#site-footer"); if (!el) return;
  const cityLink = c => `<li><a href="listings.html?city=${encodeURIComponent(c)}">${c}</a></li>`;
  el.innerHTML = `<footer class="site-footer">
    <div class="container footer-grid">
      <div>${logoHTML}<p>Pakistan's premier property portal connecting buyers, sellers, dealers and agents across Azad Kashmir and all major cities.</p></div>
      <div><h4>Quick Links</h4><ul>
        <li><a href="listings.html?purpose=sale&type=house">Houses for Sale</a></li>
        <li><a href="listings.html?purpose=rent&type=apartment">Apartments for Rent</a></li>
        <li><a href="listings.html?purpose=sale&type=plot">Plots for Sale</a></li>
        <li><a href="listings.html?type=commercial">Commercial Properties</a></li>
        <li><a href="packages.html">Dealer Packages</a></li>
        <li><a href="post-ad.html">Post an Ad</a></li></ul></div>
      <div><h4>Popular Cities</h4><h5>AZAD KASHMIR</h5><ul>${["Mirpur AJK", "Muzaffarabad", "Rawalakot", "Kotli", "Bhimber", "Bagh"].map(cityLink).join("")}</ul>
        <h5 style="margin-top:14px">OTHER CITIES</h5><ul>${["Islamabad", "Rawalpindi", "Lahore", "Karachi"].map(cityLink).join("")}</ul></div>
      <div><h4>Contact Us</h4>
        <a class="contact-line" href="tel:${SITE.phone.replace(/\s/g, "")}">${ICON.phone}${SITE.phone}</a>
        <a class="contact-line" href="mailto:${SITE.email}">${ICON.mail}${SITE.email}</a>
        <div class="contact-line">${ICON.pin}${SITE.address}</div>
        <a class="btn btn-green" href="${waLink(SITE.whatsapp, "Assalam o Alaikum, I need help with a property on Zameen Online.")}" target="_blank" rel="noopener">${ICON.wa.replace("<svg", '<svg width="18" height="18"')} Chat on WhatsApp</a>
      </div>
    </div>
    <div class="container footer-bottom">
      <span>© ${new Date().getFullYear()} ${SITE.name}. All rights reserved. Pakistan's Premier Property Portal. ${SITE.domain}</span>
      <span>Powered by <a href="${SITE.poweredByUrl}" target="_blank" rel="noopener">${SITE.poweredBy}</a></span>
    </div>
  </footer>
  <a class="wa-float" href="${waLink(SITE.whatsapp, "Assalam o Alaikum, I found you on Zameen Online.")}" target="_blank" rel="noopener" aria-label="WhatsApp">${ICON.wa}<span>WhatsApp</span></a>`;
}

/* Call on every page. Resolves once the user/session is known. */
export async function initPage() {
  renderFooter();
  renderHeader();
  await ready;
  renderHeader();
  onAuth(renderHeader);
  return getUser();
}

/* Redirect to login if not signed in (optionally require role or array of roles) */
export async function requireUser(role) {
  const u = await initPage();
  if (!u) { 
    location.href = "login.html?next=" + encodeURIComponent(location.pathname.split("/").pop() + location.search); 
    return null; 
  }
  if (role) {
    const list = Array.isArray(role) ? role : [role];
    const match = list.includes(u.role) || (list.includes("admin") && isAdminRole(u.role));
    if (!match) {
      document.querySelector("main").innerHTML = `<div class="container" style="padding:80px 20px"><div class="empty"><b>Access Denied</b>You do not have permission to view this control panel.<br><br><a class="btn btn-primary" href="index.html">Return to Home</a></div></div>`;
      return null;
    }
  }
  return u;
}

/* Resize an image file in the browser → compressed JPEG data URL */
export function compressImage(file, max = 1280, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject; img.src = r.result;
    };
    r.onerror = reject; r.readAsDataURL(file);
  });
}
