import { requireUser, $, $$, esc, formatPrice, timeAgo, toast, favs, propertyCard, waLink, coverImg, hydrateThumbs } from "../app.js";
import { getMyListings, deleteListing, getMyInquiries, markInquiry, getApprovedListings, updateProfile, signOut } from "../db.js";
import { PACKAGES } from "../seed.js";

const u = await requireUser();
if (u) {
  $("#hello").textContent = `Assalam o Alaikum, ${u.name.split(" ")[0]}`;
  $("#sub").textContent = `${u.role === "dealer" ? "Dealer" : u.role === "admin" ? "Admin" : "Member"} account · ${u.plan || "Basic"} plan`;
  const q = new URLSearchParams(location.search);
  if (q.get("posted")) toast("Your ad was submitted and is waiting for approval", 4000);
  if (q.get("saved")) toast("Changes saved", 3000);

  let inquiries = [];
  const refreshUnread = () => { const n = inquiries.filter(i => !i.read).length; $("#unread").textContent = n; $("#unread").classList.toggle("hidden", !n); };
  getMyInquiries(u.uid).then(r => { inquiries = r; refreshUnread(); }).catch(console.error);

  const tabs = {
    async ads() {
      const ads = await getMyListings(u.uid);
      const plan = PACKAGES.find(p => p.name === (u.plan || "Basic")) || PACKAGES[0];
      const views = ads.reduce((s, a) => s + (a.views || 0), 0);
      return `<div class="kpis">
          <div class="kpi"><small>Total ads</small><b>${ads.length}</b></div>
          <div class="kpi"><small>Live</small><b>${ads.filter(a => a.status === "approved").length}</b></div>
          <div class="kpi"><small>Total views</small><b>${views}</b></div>
          <div class="kpi"><small>Ad limit (${esc(plan.name)})</small><b>${plan.ads}</b></div>
        </div>
        <div class="results-bar"><h2>My Ads</h2><a class="btn btn-accent" href="post-ad.html">+ Post New Ad</a></div>
        ${ads.length ? `<div class="table-wrap"><table><thead><tr><th></th><th>Property</th><th>Price</th><th>Status</th><th>Views</th><th></th></tr></thead><tbody>
          ${ads.map(a => `<tr>
            <td>${coverImg(a, "thumb")}</td>
            <td><a href="property.html?id=${encodeURIComponent(a.id)}" style="font-weight:700">${esc(a.title)}</a><br><small style="color:var(--muted)">${esc(a.city)} · ${timeAgo(a.createdAt)}</small></td>
            <td style="white-space:nowrap">${formatPrice(a.price, a.purpose)}</td>
            <td><span class="badge badge-${esc(a.status)}">${esc(a.status)}</span>${a.featured ? ' <span class="badge badge-featured">★</span>' : ""}</td>
            <td>${a.views || 0}</td>
            <td><div class="actions"><a class="btn btn-outline btn-sm" href="post-ad.html?id=${encodeURIComponent(a.id)}">Edit</a><button class="btn btn-danger btn-sm" data-del="${esc(a.id)}">Delete</button></div></td>
          </tr>`).join("")}</tbody></table></div>`
        : '<div class="empty"><b>You have not posted any ads yet.</b><br><a class="btn btn-accent" href="post-ad.html">Post your first ad — free</a></div>'}`;
    },
    async inbox() {
      if (!inquiries.length) return '<div class="empty"><b>No messages yet.</b>When someone sends an inquiry on your ad, it appears here.</div>';
      return `<h2 style="margin-bottom:16px">Messages</h2><div style="display:grid;gap:12px">${inquiries.map(i => `
        <div class="panel" style="margin:0;${i.read ? "" : "border-left:4px solid var(--accent)"}">
          <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><b>${esc(i.name)} · ${esc(i.phone)}</b><small style="color:var(--muted)">${timeAgo(i.createdAt)}</small></div>
          <small style="color:var(--muted)">About: <a href="property.html?id=${encodeURIComponent(i.listingId)}" style="color:var(--primary)">${esc(i.listingTitle)}</a></small>
          <p style="margin:8px 0 12px">${esc(i.message)}</p>
          <div class="actions" style="display:flex;gap:8px;flex-wrap:wrap">
            <a class="btn btn-primary btn-sm" href="tel:${esc(i.phone)}">Call</a>
            <a class="btn btn-green btn-sm" target="_blank" rel="noopener" href="${waLink(String(i.phone).replace(/\D/g, "").replace(/^0/, "92"), "Assalam o Alaikum, regarding your inquiry on Zameen Online: " + i.listingTitle)}">WhatsApp</a>
            ${i.read ? "" : `<button class="btn btn-outline btn-sm" data-read="${esc(i.id)}">Mark as read</button>`}
          </div></div>`).join("")}</div>`;
    },
    async favs() {
      const ids = favs.get();
      const all = ids.length ? (await getApprovedListings()).filter(l => ids.includes(l.id)) : [];
      return `<h2 style="margin-bottom:16px">Saved Properties</h2>` + (all.length ? `<div class="prop-grid">${all.map(propertyCard).join("")}</div>`
        : '<div class="empty"><b>No saved properties.</b>Tap the ♥ on any property to save it here.</div>');
    },
    async profile() {
      return `<form class="form-card" id="profile" style="max-width:560px">
        <h2 style="margin-top:0">My Profile</h2>
        <div class="form-group"><label>Name</label><input class="field" name="name" value="${esc(u.name)}" required></div>
        <div class="form-group"><label>Phone / WhatsApp</label><input class="field" name="phone" value="${esc(u.phone || "")}"></div>
        <div class="form-group"><label>Email</label><input class="field" value="${esc(u.email)}" disabled></div>
        <button class="btn btn-primary">Save</button>
        <p style="margin-top:16px;font-size:14px;color:var(--muted)">Want more ads or a verified badge? <a href="packages.html" style="color:var(--primary);font-weight:700">Upgrade your package</a>.</p>
      </form>`;
    }
  };

  async function show(name) {
    $$("#tabs [data-tab]").forEach(b => b.classList.toggle("active", b.dataset.tab === name));
    $("#panel").innerHTML = '<div class="skeleton" style="height:200px"></div>';
    try { $("#panel").innerHTML = await tabs[name](); hydrateThumbs($("#panel")); } catch (e) { console.error(e); $("#panel").innerHTML = '<div class="alert alert-error">Could not load. Please refresh.</div>'; }
    $$("[data-del]").forEach(b => b.onclick = async () => {
      if (!confirm("Delete this ad permanently?")) return;
      await deleteListing(b.dataset.del); toast("Ad deleted"); show("ads");
    });
    $$("[data-read]").forEach(b => b.onclick = async () => {
      await markInquiry(b.dataset.read, true); inquiries.find(i => i.id === b.dataset.read).read = true; refreshUnread(); show("inbox");
    });
    const pf = $("#profile");
    if (pf) pf.onsubmit = async e => { e.preventDefault(); const f = new FormData(pf); await updateProfile({ name: f.get("name").trim(), phone: f.get("phone").trim() }); toast("Profile saved"); };
  }
  $$("#tabs [data-tab]").forEach(b => b.onclick = () => show(b.dataset.tab));
  $("#logout").onclick = async () => { await signOut(); location.href = "index.html"; };
  show("ads");
}
