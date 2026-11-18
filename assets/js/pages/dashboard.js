import { requireUser, $, $$, esc, formatPrice, timeAgo, toast, favs, propertyCard, waLink, coverImg, hydrateThumbs, cityOptions } from "../app.js";
import { getMyListings, deleteListing, getMyInquiries, markInquiry, getApprovedListings, updateProfile, signOut, getDealer, saveDealer, resetPassword } from "../db.js?v=20261118_01";
import { PACKAGES } from "../seed.js";

const u = await requireUser();

if (u) {
  const isDealer = u.role === "dealer";
  const plan = PACKAGES.find(p => p.name === (u.plan || "Basic")) || PACKAGES[0];

  $("#hello").textContent = `Assalam o Alaikum, ${u.name.split(" ")[0]}`;
  $("#sub").textContent = `${isDealer ? "Real Estate Dealer" : u.role === "super_admin" ? "Super Admin" : u.role === "admin" ? "Admin" : u.role === "district_admin" ? "District Admin" : "Private Member"} · ${plan.name} Plan`;

  const badgeSlot = $("#user-badge-slot");
  if (badgeSlot) {
    const roleBadge = isDealer 
      ? '<span class="badge badge-dealer" style="padding:6px 14px;font-size:12px">🏢 Real Estate Dealer</span>' 
      : '<span class="badge badge-user" style="padding:6px 14px;font-size:12px">👤 Private Seller</span>';
    badgeSlot.innerHTML = roleBadge;
  }

  // Show Agency tab if user is a dealer
  const agencyBtn = $("#tab-agency-btn");
  if (agencyBtn && isDealer) {
    agencyBtn.style.display = "flex";
  }

  const q = new URLSearchParams(location.search);
  if (q.get("posted")) toast("Your property was submitted and is under review by admin.", 4000);
  if (q.get("saved")) toast("Settings saved successfully.", 3000);

  let inquiries = [];
  const refreshUnread = () => {
    const n = inquiries.filter(i => !i.read).length;
    const badge = $("#unread");
    if (badge) {
      badge.textContent = n;
      badge.classList.toggle("hidden", !n);
    }
  };

  getMyInquiries(u.uid).then(r => { inquiries = r; refreshUnread(); }).catch(console.error);

  let adFilter = "all";
  let inqFilter = "all";

  const tabs = {
    async ads() {
      const ads = await getMyListings(u.uid);
      const views = ads.reduce((s, a) => s + (a.views || 0), 0);
      const totalAds = ads.length;
      const maxAds = plan.ads || 3;
      const usagePercent = Math.min(100, Math.round((totalAds / maxAds) * 100));

      const quotaColorClass = usagePercent >= 100 ? "danger" : usagePercent >= 80 ? "warning" : "";

      const filteredAds = ads.filter(a => {
        if (adFilter === "approved") return a.status === "approved";
        if (adFilter === "pending") return a.status === "pending";
        if (adFilter === "rejected") return a.status === "rejected";
        return true;
      });

      return `
        <!-- Ad Quota Visualizer -->
        <div class="quota-box">
          <div class="quota-head">
            <div>
              <b style="font-size:16px">Ad Quota: ${totalAds} of ${maxAds} Slots Used</b>
              <div style="font-size:13px;color:var(--muted);margin-top:2px">Current Plan: <b>${esc(plan.name)}</b> (${plan.price ? 'PKR ' + plan.price.toLocaleString() + ' / month' : 'Free'})</div>
            </div>
            <div>
              <a class="btn btn-accent btn-sm" href="packages.html">Upgrade Package</a>
            </div>
          </div>
          <div class="quota-bar">
            <div class="quota-fill ${quotaColorClass}" style="width:${usagePercent}%"></div>
          </div>
          ${usagePercent >= 80 ? `
            <div style="font-size:12px;color:#d97706;margin-top:8px;font-weight:600">
              ⚠️ You have used ${usagePercent}% of your ad limit. Upgrade to post more listings and get priority placement.
            </div>
          ` : ""}
        </div>

        <div class="kpis">
          <div class="kpi"><small>Total Listings</small><b>${ads.length}</b></div>
          <div class="kpi"><small>Live on Portal</small><b>${ads.filter(a => a.status === "approved").length}</b></div>
          <div class="kpi"><small>Waiting Approval</small><b style="color:var(--accent)">${ads.filter(a => a.status === "pending").length}</b></div>
          <div class="kpi"><small>Total Views</small><b>${views}</b></div>
        </div>

        <div class="results-bar">
          <h2>My Properties (${filteredAds.length})</h2>
          ${totalAds < maxAds ? `<a class="btn btn-accent" href="post-ad.html">+ Post New Property</a>` : `<a class="btn btn-outline" href="packages.html">Quota Full — Upgrade</a>`}
        </div>

        <!-- Filter pills -->
        <div class="filter-pills" id="ad-filter-pills">
          <button class="filter-pill ${adFilter === 'all' ? 'active' : ''}" data-ad-filter="all">All (${ads.length})</button>
          <button class="filter-pill ${adFilter === 'approved' ? 'active' : ''}" data-ad-filter="approved">Live Approved (${ads.filter(a => a.status === "approved").length})</button>
          <button class="filter-pill ${adFilter === 'pending' ? 'active' : ''}" data-ad-filter="pending">Pending Approval (${ads.filter(a => a.status === "pending").length})</button>
          <button class="filter-pill ${adFilter === 'rejected' ? 'active' : ''}" data-ad-filter="rejected">Rejected (${ads.filter(a => a.status === "rejected").length})</button>
        </div>

        ${filteredAds.length ? `<div class="table-wrap"><table><thead><tr><th></th><th>Property</th><th>Price</th><th>Status</th><th>Views</th><th>Actions</th></tr></thead><tbody>
          ${filteredAds.map(a => `<tr>
            <td>${coverImg(a, "thumb")}</td>
            <td>
              <a href="property.html?id=${encodeURIComponent(a.id)}" target="_blank" style="font-weight:700">${esc(a.title)}</a>
              <br><small style="color:var(--muted)">${esc(a.city)} · ${timeAgo(a.createdAt)}</small>
            </td>
            <td style="white-space:nowrap">${formatPrice(a.price, a.purpose)}</td>
            <td>
              <span class="badge badge-${esc(a.status)}">${esc(a.status)}</span>
              ${a.featured ? ' <span class="badge badge-featured">★</span>' : ""}
            </td>
            <td>${a.views || 0}</td>
            <td>
              <div class="actions">
                <a class="btn btn-outline btn-sm" href="post-ad.html?id=${encodeURIComponent(a.id)}">Edit</a>
                <button class="btn btn-danger btn-sm" data-del="${esc(a.id)}">Delete</button>
              </div>
            </td>
          </tr>`).join("")}</tbody></table></div>`
        : '<div class="empty"><b>No properties found under this status.</b></div>'}`;
    },

    async inbox() {
      if (!inquiries.length) {
        return '<div class="empty"><b>No buyer messages yet.</b>When someone sends an inquiry on your property, their contact and message will appear here.</div>';
      }

      const filteredInquiries = inquiries.filter(i => {
        if (inqFilter === "unread") return !i.read;
        if (inqFilter === "read") return i.read;
        return true;
      });

      return `
        <div class="results-bar">
          <h2>Buyer Inquiries &amp; Leads (${inquiries.length})</h2>
        </div>

        <div class="filter-pills" id="inq-filter-pills">
          <button class="filter-pill ${inqFilter === 'all' ? 'active' : ''}" data-inq-filter="all">All (${inquiries.length})</button>
          <button class="filter-pill ${inqFilter === 'unread' ? 'active' : ''}" data-inq-filter="unread">Unread (${inquiries.filter(i => !i.read).length})</button>
          <button class="filter-pill ${inqFilter === 'read' ? 'active' : ''}" data-inq-filter="read">Read (${inquiries.filter(i => i.read).length})</button>
        </div>

        <div style="display:grid;gap:14px">
          ${filteredInquiries.map(i => `
            <div class="panel" style="margin:0;border-left:4px solid ${i.read ? 'var(--border)' : 'var(--accent)'};box-shadow:var(--shadow-sm)">
              <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">
                <div>
                  <b style="font-size:16px">${esc(i.name)}</b>
                  <span style="margin:0 6px;color:var(--muted)">·</span>
                  <a href="tel:${esc(i.phone)}" style="font-weight:600;color:var(--primary)">${esc(i.phone)}</a>
                </div>
                <small style="color:var(--muted)">${timeAgo(i.createdAt)}</small>
              </div>

              <div style="margin:6px 0 10px;font-size:13px;color:var(--muted)">
                Property: <a href="property.html?id=${encodeURIComponent(i.listingId)}" target="_blank" style="color:var(--primary);font-weight:600">${esc(i.listingTitle || "View Property")}</a>
              </div>

              <p style="background:#f8fafc;padding:12px;border-radius:8px;margin:8px 0 14px;font-size:14px">${esc(i.message)}</p>

              <div class="actions" style="display:flex;gap:8px;flex-wrap:wrap">
                <a class="btn btn-primary btn-sm" href="tel:${esc(i.phone)}">📞 Call Buyer</a>
                <a class="btn btn-green btn-sm" target="_blank" rel="noopener" href="${waLink(String(i.phone).replace(/\D/g, "").replace(/^0/, "92"), 'Assalam o Alaikum, regarding your inquiry on Zameen Online: ' + (i.listingTitle || ''))}">💬 Reply on WhatsApp</a>
                ${i.read ? "" : `<button class="btn btn-outline btn-sm" data-read="${esc(i.id)}">Mark as Read</button>`}
              </div>
            </div>
          `).join("")}
        </div>
      `;
    },

    async agency() {
      if (!isDealer) return '<div class="empty">This section is for registered Real Estate Dealers only.</div>';
      const dealerData = (await getDealer(u.uid)) || {};

      return `
        <div class="form-card" style="max-width:680px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px">
            <div>
              <h2 style="margin:0">🏢 Agency Profile &amp; Branding</h2>
              <small style="color:var(--muted)">This information appears on your public agency profile and dealer directory listing.</small>
            </div>
            <div>
              ${dealerData.verified 
                ? '<span class="badge badge-verified" style="padding:6px 12px">✓ Verified Agency</span>' 
                : '<span class="badge" style="background:#fef3c7;color:#92400e;padding:6px 12px">Unverified Agency</span>'}
            </div>
          </div>

          <form id="agency-form">
            <div class="form-group">
              <label>Agency / Company Name</label>
              <input class="field" name="name" required value="${esc(dealerData.name || u.name)}">
            </div>

            <div class="grid-2">
              <div class="form-group">
                <label>Owner / Principal Broker Name</label>
                <input class="field" name="owner" value="${esc(dealerData.owner || u.name)}">
              </div>
              <div class="form-group">
                <label>City / Main Operating Area</label>
                <select class="field" name="city">
                  ${cityOptions(dealerData.city || "Mirpur AJK", "")}
                </select>
              </div>
            </div>

            <div class="grid-2">
              <div class="form-group">
                <label>Official Phone Number</label>
                <input class="field" name="phone" required value="${esc(dealerData.phone || u.phone || '')}">
              </div>
              <div class="form-group">
                <label>WhatsApp Number for Inquiries</label>
                <input class="field" name="whatsapp" placeholder="923440807888" value="${esc(dealerData.whatsapp || (u.phone ? u.phone.replace(/\D/g, '').replace(/^0/, '92') : ''))}">
              </div>
            </div>

            <div class="form-group">
              <label>Office Address</label>
              <input class="field" name="address" placeholder="e.g. Office #4, Chowk Shaheedan, Mirpur AJK" value="${esc(dealerData.address || '')}">
            </div>

            <div class="form-group">
              <label>About Your Agency (Services &amp; Specialization)</label>
              <textarea class="field" name="about" rows="4" style="min-height:90px">${esc(dealerData.about || '')}</textarea>
            </div>

            <button class="btn btn-primary" type="submit">Save Agency Profile</button>
          </form>

          ${!dealerData.verified ? `
            <div class="panel" style="margin-top:24px;background:#f0fdf4;border-color:#bbf7d0">
              <h4 style="margin:0 0 6px;color:#166534">Get Verified Agency Badge</h4>
              <p style="font-size:13px;color:#166534;margin:0 0 12px">Verified agencies receive 3x more buyer inquiries and higher trust on Zameen Online.</p>
              <a class="btn btn-green btn-sm" href="${waLink(undefined, 'Assalam o Alaikum, I want to verify my agency on Zameen Online: ' + (dealerData.name || u.name))}" target="_blank" rel="noopener">WhatsApp Support for Verification</a>
            </div>
          ` : ""}
        </div>
      `;
    },

    async favs() {
      const ids = favs.get();
      const all = ids.length ? (await getApprovedListings()).filter(l => ids.includes(l.id)) : [];
      return `<h2 style="margin-bottom:16px">Saved Properties</h2>` + (all.length ? `<div class="prop-grid">${all.map(propertyCard).join("")}</div>`
        : '<div class="empty"><b>No saved properties.</b>Tap the ♥ on any property to save it here for quick access.</div>');
    },

    async profile() {
      return `
        <div class="form-card" style="max-width:580px">
          <h2 style="margin-top:0">My Account Profile</h2>
          <form id="profile">
            <div class="form-group"><label>Full Name</label><input class="field" name="name" value="${esc(u.name)}" required></div>
            <div class="form-group"><label>Phone / WhatsApp</label><input class="field" name="phone" value="${esc(u.phone || "")}"></div>
            <div class="form-group"><label>Registered Email</label><input class="field" value="${esc(u.email)}" disabled style="background:#f1f5f9;cursor:not-allowed"></div>
            <button class="btn btn-primary">Save Profile</button>
          </form>

          <hr style="margin:24px 0;border:0;border-top:1px solid var(--border)">

          <h3>Account Security</h3>
          <p style="font-size:14px;color:var(--muted)">Need to update your password? Click below and we will send a secure reset link to your email.</p>
          <button class="btn btn-outline" id="btn-reset-pass">Send Password Reset Email</button>
        </div>
      `;
    }
  };

  async function show(name) {
    $$("#tabs [data-tab]").forEach(b => b.classList.toggle("active", b.dataset.tab === name));
    $("#panel").innerHTML = '<div class="skeleton" style="height:220px"></div>';

    try { 
      $("#panel").innerHTML = await tabs[name](); 
      hydrateThumbs($("#panel")); 
    } catch (e) { 
      console.error(e); 
      $("#panel").innerHTML = '<div class="alert alert-error">Could not load this tab. Please refresh the page.</div>'; 
    }

    // Ad delete listener
    $$("[data-del]").forEach(b => b.onclick = async () => {
      if (!confirm("Permanently delete this property listing?")) return;
      await deleteListing(b.dataset.del);
      toast("Property listing deleted");
      show("ads");
    });

    // Inquiries mark as read
    $$("[data-read]").forEach(b => b.onclick = async () => {
      await markInquiry(b.dataset.read, true);
      const target = inquiries.find(i => i.id === b.dataset.read);
      if (target) target.read = true;
      refreshUnread();
      show("inbox");
    });

    // Ad filter pills
    $$("[data-ad-filter]").forEach(b => b.onclick = () => {
      adFilter = b.dataset.adFilter;
      show("ads");
    });

    // Inquiries filter pills
    $$("[data-inq-filter]").forEach(b => b.onclick = () => {
      inqFilter = b.dataset.inqFilter;
      show("inbox");
    });

    // Profile form
    const pf = $("#profile");
    if (pf) {
      pf.onsubmit = async e => {
        e.preventDefault();
        const f = new FormData(pf);
        await updateProfile({ name: f.get("name").trim(), phone: f.get("phone").trim() });
        toast("Profile saved successfully");
      };
    }

    // Agency form
    const af = $("#agency-form");
    if (af) {
      af.onsubmit = async e => {
        e.preventDefault();
        const f = new FormData(af);
        const agencyData = {
          name: f.get("name").trim(),
          owner: f.get("owner").trim(),
          city: f.get("city"),
          phone: f.get("phone").trim(),
          whatsapp: f.get("whatsapp").trim().replace(/\D/g, ""),
          address: f.get("address").trim(),
          about: f.get("about").trim()
        };
        await saveDealer(u.uid, agencyData);
        toast("Agency branding saved successfully");
      };
    }

    // Password reset button
    const btnReset = $("#btn-reset-pass");
    if (btnReset) {
      btnReset.onclick = async () => {
        try {
          await resetPassword(u.email);
          toast("Password reset link sent to " + u.email, 4000);
        } catch (err) {
          toast(err.message || "Failed to send reset link");
        }
      };
    }
  }

  $$("#tabs [data-tab]").forEach(b => b.onclick = () => show(b.dataset.tab));
  $("#logout").onclick = async () => { await signOut(); location.href = "index.html"; };

  show("ads");
}
