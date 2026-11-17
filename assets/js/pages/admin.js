import { requireUser, $, $$, esc, formatPrice, timeAgo, toast, modal, cityOptions, typeLabel, coverImg, hydrateThumbs } from "../app.js";
import * as db from "../db.js";
import { SERVICE_CATEGORIES, PACKAGES } from "../seed.js";

const me = await requireUser("admin");
if (me) {
  let cache = {};
  const load = async () => {
    const [listings, dealers, services, inquiries, users] = await Promise.all([
      db.getAllListings(), db.getDealers(), db.getServices(), db.getInquiries(), db.getUsers()
    ]);
    cache = { listings, dealers, services, inquiries, users };
    const n = listings.filter(l => l.status === "pending").length;
    $("#pending-count").textContent = n; $("#pending-count").classList.toggle("hidden", !n);
  };

  const adRows = rows => rows.length ? `<div class="table-wrap"><table><thead><tr><th></th><th>Property</th><th>Price</th><th>Posted by</th><th>Status</th><th>Actions</th></tr></thead><tbody>
    ${rows.map(a => `<tr>
      <td>${coverImg(a, "thumb")}</td>
      <td><a href="property.html?id=${encodeURIComponent(a.id)}" target="_blank" style="font-weight:700">${esc(a.title)}</a><br><small style="color:var(--muted)">${esc(typeLabel(a.type))} · ${esc(a.city)} · ${timeAgo(a.createdAt)} · ${a.views || 0} views</small></td>
      <td style="white-space:nowrap">${formatPrice(a.price, a.purpose)}</td>
      <td>${esc(a.ownerName || "")}<br><small style="color:var(--muted)">${esc(a.phone || "")}</small></td>
      <td><span class="badge badge-${esc(a.status)}">${esc(a.status)}</span>${a.featured ? ' <span class="badge badge-featured">★ Featured</span>' : ""}</td>
      <td><div class="actions">
        ${a.status !== "approved" ? `<button class="btn btn-primary btn-sm" data-act="approve" data-id="${esc(a.id)}">Approve</button>` : ""}
        ${a.status !== "rejected" ? `<button class="btn btn-outline btn-sm" data-act="reject" data-id="${esc(a.id)}">Reject</button>` : ""}
        <button class="btn btn-outline btn-sm" data-act="feature" data-id="${esc(a.id)}">${a.featured ? "Unfeature" : "★ Feature"}</button>
        <a class="btn btn-outline btn-sm" href="post-ad.html?id=${encodeURIComponent(a.id)}">Edit</a>
        <button class="btn btn-danger btn-sm" data-act="del-ad" data-id="${esc(a.id)}">Delete</button>
      </div></td></tr>`).join("")}</tbody></table></div>`
    : '<div class="empty"><b>Nothing here.</b>All caught up.</div>';

  const tabs = {
    overview() {
      const { listings: L, dealers, users, inquiries } = cache;
      return `<div class="kpis">
          <div class="kpi"><small>Live ads</small><b>${L.filter(l => l.status === "approved").length}</b></div>
          <div class="kpi"><small>Pending approval</small><b style="color:var(--accent)">${L.filter(l => l.status === "pending").length}</b></div>
          <div class="kpi"><small>Users</small><b>${users.length}</b></div>
          <div class="kpi"><small>Dealers</small><b>${dealers.length}</b></div>
        </div>
        <div class="kpis">
          <div class="kpi"><small>For sale</small><b>${L.filter(l => l.purpose === "sale").length}</b></div>
          <div class="kpi"><small>For rent</small><b>${L.filter(l => l.purpose === "rent").length}</b></div>
          <div class="kpi"><small>Featured</small><b>${L.filter(l => l.featured).length}</b></div>
          <div class="kpi"><small>Inquiries</small><b>${inquiries.length}</b></div>
        </div>
        <div class="panel">
          <h2>Tools</h2>
          ${db.LIVE
            ? `<p style="color:var(--muted);margin-bottom:12px">New database? Load the sample dealers, services and 16 sample properties so the site doesn't look empty. You can delete them later.</p>
               <button class="btn btn-primary" id="seed">Load sample data</button>`
            : `<p style="color:var(--muted);margin-bottom:12px">Demo mode: all data is saved only in this browser. Connect Firebase (see README) to go live.</p>
               <button class="btn btn-outline" id="reset-demo">Reset demo data</button>`}
        </div>`;
    },
    pending() { return `<h2 style="margin-bottom:16px">Ads waiting for approval</h2>` + adRows(cache.listings.filter(l => l.status === "pending")); },
    ads() {
      return `<div class="results-bar"><h2>All Ads (${cache.listings.length})</h2><div style="display:flex;gap:8px"><input class="field" id="ad-q" placeholder="Search title or city" style="width:220px"><a class="btn btn-accent" href="post-ad.html">+ Add Property</a></div></div><div id="ad-table">${adRows(cache.listings)}</div>`;
    },
    dealers() {
      return `<div class="results-bar"><h2>Dealers (${cache.dealers.length})</h2><button class="btn btn-accent" data-act="edit-dealer">+ Add Dealer</button></div>
      <div class="table-wrap"><table><thead><tr><th>Agency</th><th>City</th><th>Phone</th><th>Plan</th><th>Verified</th><th></th></tr></thead><tbody>
      ${cache.dealers.map(d => `<tr><td><b>${esc(d.name)}</b><br><small style="color:var(--muted)">${esc(d.owner || "")}</small></td><td>${esc(d.city)}</td><td>${esc(d.phone)}</td>
        <td>${esc(d.plan || "Basic")}</td><td>${d.verified ? '<span class="badge badge-verified">✓ Yes</span>' : "No"}</td>
        <td><div class="actions"><button class="btn btn-outline btn-sm" data-act="edit-dealer" data-id="${esc(d.id)}">Edit</button><button class="btn btn-danger btn-sm" data-act="del-dealer" data-id="${esc(d.id)}">Delete</button></div></td></tr>`).join("")}
      </tbody></table></div>`;
    },
    services() {
      return `<div class="results-bar"><h2>Service Providers (${cache.services.length})</h2><button class="btn btn-accent" data-act="edit-service">+ Add Provider</button></div>
      <div class="table-wrap"><table><thead><tr><th>Name</th><th>Category</th><th>City</th><th>Phone</th><th>Rating</th><th></th></tr></thead><tbody>
      ${cache.services.map(s => `<tr><td><b>${esc(s.name)}</b>${s.verified ? ' <span class="badge badge-verified">✓</span>' : ""}</td>
        <td>${esc((SERVICE_CATEGORIES.find(c => c.slug === s.category) || {}).name || s.category)}</td><td>${esc(s.city)}</td><td>${esc(s.phone)}</td><td>${esc(s.rating || "—")}</td>
        <td><div class="actions"><button class="btn btn-outline btn-sm" data-act="edit-service" data-id="${esc(s.id)}">Edit</button><button class="btn btn-danger btn-sm" data-act="del-service" data-id="${esc(s.id)}">Delete</button></div></td></tr>`).join("")}
      </tbody></table></div>`;
    },
    inquiries() {
      const I = cache.inquiries;
      return `<h2 style="margin-bottom:16px">All Inquiries (${I.length})</h2>` + (I.length ? `<div class="table-wrap"><table><thead><tr><th>From</th><th>Property</th><th>Message</th><th>When</th><th></th></tr></thead><tbody>
        ${I.map(i => `<tr><td><b>${esc(i.name)}</b><br><a href="tel:${esc(i.phone)}" style="color:var(--primary)">${esc(i.phone)}</a></td>
          <td><a href="property.html?id=${encodeURIComponent(i.listingId)}" target="_blank">${esc(i.listingTitle)}</a></td><td style="max-width:320px">${esc(i.message)}</td><td style="white-space:nowrap">${timeAgo(i.createdAt)}</td>
          <td><button class="btn btn-danger btn-sm" data-act="del-inq" data-id="${esc(i.id)}">Delete</button></td></tr>`).join("")}</tbody></table></div>`
        : '<div class="empty"><b>No inquiries yet.</b></div>');
    },
    users() {
      return `<h2 style="margin-bottom:16px">Users (${cache.users.length})</h2><div class="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Package</th><th>Joined</th></tr></thead><tbody>
        ${cache.users.map(x => `<tr><td><b>${esc(x.name)}</b></td><td>${esc(x.email)}</td><td>${esc(x.phone || "")}</td>
          <td><select class="field" style="padding:6px 8px;width:auto" data-role-for="${esc(x.id)}" ${x.id === me.uid ? "disabled" : ""}>${["user", "dealer", "admin"].map(r => `<option ${r === x.role ? "selected" : ""}>${r}</option>`).join("")}</select></td>
          <td><select class="field" style="padding:6px 8px;width:auto" data-plan-for="${esc(x.id)}">${PACKAGES.map(p => `<option ${p.name === (x.plan || "Basic") ? "selected" : ""}>${p.name}</option>`).join("")}</select></td>
          <td style="white-space:nowrap">${x.createdAt ? timeAgo(x.createdAt) : ""}</td></tr>`).join("")}</tbody></table></div>`;
    }
  };

  function editor(kind, id) {
    const isDealer = kind === "dealer";
    const d = (isDealer ? cache.dealers : cache.services).find(x => x.id === id) || {};
    const m = modal(`<h3>${id ? "Edit" : "Add"} ${isDealer ? "Dealer" : "Service Provider"}</h3>
      <form id="ed">
        <div class="form-group"><label>${isDealer ? "Agency name" : "Business name"}</label><input class="field" name="name" required value="${esc(d.name || "")}"></div>
        ${isDealer ? `<div class="form-group"><label>Owner name</label><input class="field" name="owner" value="${esc(d.owner || "")}"></div>`
          : `<div class="form-group"><label>Category</label><select class="field" name="category">${SERVICE_CATEGORIES.map(c => `<option value="${c.slug}" ${c.slug === d.category ? "selected" : ""}>${c.emoji} ${c.name}</option>`).join("")}</select></div>`}
        <div class="grid-2">
          <div class="form-group"><label>City</label><select class="field" name="city">${cityOptions(d.city || "Mirpur AJK", "")}</select></div>
          <div class="form-group"><label>Phone</label><input class="field" name="phone" required value="${esc(d.phone || "")}"></div>
        </div>
        <div class="grid-2">
          ${isDealer ? `<div class="form-group"><label>Package</label><select class="field" name="plan">${PACKAGES.map(p => `<option ${p.name === (d.plan || "Basic") ? "selected" : ""}>${p.name}</option>`).join("")}</select></div>
            <div class="form-group"><label>Listings count</label><input class="field" name="listings" type="number" min="0" value="${esc(d.listings || 0)}"></div>`
          : `<div class="form-group"><label>Experience (years)</label><input class="field" name="experience" type="number" min="0" value="${esc(d.experience || "")}"></div>
            <div class="form-group"><label>Rating (1–5)</label><input class="field" name="rating" type="number" min="1" max="5" step="0.1" value="${esc(d.rating || "")}"></div>`}
        </div>
        <div class="form-group"><label>About</label><textarea class="field" name="about" rows="3" style="min-height:80px">${esc(d.about || "")}</textarea></div>
        <label style="display:flex;gap:8px;align-items:center;margin-bottom:18px;font-weight:600"><input type="checkbox" name="verified" ${d.verified ? "checked" : ""}> Verified</label>
        <div style="display:flex;gap:10px"><button class="btn btn-primary">Save</button><button type="button" class="btn btn-outline" data-close>Cancel</button></div>
      </form>`);
    $("#ed", m).onsubmit = async e => {
      e.preventDefault();
      const f = new FormData(e.target);
      const data = Object.fromEntries(f.entries());
      data.verified = f.get("verified") === "on";
      data.whatsapp = data.phone.replace(/\D/g, "").replace(/^0/, "92");
      for (const k of ["listings", "experience", "rating"]) if (k in data) data[k] = Number(data[k]) || 0;
      if (isDealer) await db.saveDealer(id, data); else await db.saveService(id, data);
      m.remove(); toast("Saved"); await refresh();
    };
  }

  let current = "overview";
  async function refresh() { await load(); render(); }
  function render() {
    $$("#tabs [data-tab]").forEach(b => b.classList.toggle("active", b.dataset.tab === current));
    $("#panel").innerHTML = tabs[current]();
    hydrateThumbs($("#panel"));
    const aq = $("#ad-q");
    if (aq) aq.oninput = () => { const q = aq.value.toLowerCase(); $("#ad-table").innerHTML = adRows(cache.listings.filter(l => `${l.title} ${l.city} ${l.ownerName}`.toLowerCase().includes(q))); hydrateThumbs($("#ad-table")); };
    const seed = $("#seed");
    if (seed) seed.onclick = async () => { seed.disabled = true; seed.textContent = "Loading…"; try { await db.loadSampleData(); toast("Sample data loaded"); await refresh(); } catch (e) { toast("Failed: " + e.message); seed.disabled = false; } };
    const rd = $("#reset-demo");
    if (rd) rd.onclick = () => { if (confirm("Reset all demo data in this browser?")) { db.resetDemo(); location.reload(); } };
    $$("[data-role-for]").forEach(s => s.onchange = async () => { await db.updateUser(s.dataset.roleFor, { role: s.value }); toast("Role updated"); });
    $$("[data-plan-for]").forEach(s => s.onchange = async () => { await db.updateUser(s.dataset.planFor, { plan: s.value }); toast("Package updated"); });
  }

  $("#panel").addEventListener("click", async e => {
    const b = e.target.closest("[data-act]"); if (!b) return;
    const id = b.dataset.id, act = b.dataset.act;
    const L = cache.listings.find(l => l.id === id);
    try {
      if (act === "approve") { await db.updateListing(id, { status: "approved" }); toast("Ad approved — now live"); }
      else if (act === "reject") { await db.updateListing(id, { status: "rejected" }); toast("Ad rejected"); }
      else if (act === "feature") { await db.updateListing(id, { featured: !L.featured }); toast(L.featured ? "Removed from featured" : "Marked as featured"); }
      else if (act === "del-ad") { if (!confirm("Delete this ad permanently?")) return; await db.deleteListing(id); toast("Deleted"); }
      else if (act === "edit-dealer") return editor("dealer", id);
      else if (act === "edit-service") return editor("service", id);
      else if (act === "del-dealer") { if (!confirm("Delete this dealer?")) return; await db.deleteDealer(id); toast("Deleted"); }
      else if (act === "del-service") { if (!confirm("Delete this provider?")) return; await db.deleteService(id); toast("Deleted"); }
      else if (act === "del-inq") { if (!confirm("Delete this inquiry?")) return; await db.deleteInquiry(id); toast("Deleted"); }
      await refresh();
    } catch (err) { console.error(err); toast("Action failed: " + (err.message || err)); }
  });
  $$("#tabs [data-tab]").forEach(b => b.onclick = () => { current = b.dataset.tab; render(); });

  $("#panel").innerHTML = '<div class="skeleton" style="height:240px"></div>';
  try { await refresh(); } catch (e) { console.error(e); $("#panel").innerHTML = '<div class="alert alert-error">Could not load admin data. Check that your account role is "admin" in Firestore.</div>'; }
}
