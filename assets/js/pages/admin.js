import { requireUser, $, $$, esc, formatPrice, timeAgo, toast, modal, cityOptions, typeLabel, coverImg, hydrateThumbs, waLink } from "../app.js?v=20261117_06";
import * as db from "../db.js?v=20261117_06";
import { SERVICE_CATEGORIES, PACKAGES, CITIES } from "../seed.js";

const me = await requireUser(["super_admin", "admin", "district_admin"]);

if (me) {
  const isOwner = (me.name && me.name.toLowerCase().includes("ijaz")) || 
                  (me.email && me.email.toLowerCase().includes("ijaz")) || 
                  me.role === "super_admin";
  const isSuper = isOwner || me.role === "super_admin" || me.role === "admin";
  const isGlobal = isSuper;
  const isDistrict = !isOwner && me.role === "district_admin";

  // Flattened list of all cities across AJK and Pakistan
  const ALL_CITIES = [...(CITIES["Azad Kashmir"] || []), ...(CITIES["Pakistan"] || [])];

  // User's assigned districts
  const userDistricts = isDistrict 
    ? (Array.isArray(me.assignedDistricts) && me.assignedDistricts.length ? me.assignedDistricts : ["Mirpur AJK"]) 
    : [];

  // Active district filter state
  let activeDistrict = isDistrict ? userDistricts[0] : "ALL";

  // Render Admin User Pill in Hero
  const roleTitle = isSuper ? "Super Admin" : isDistrict ? "District Admin" : "Global Admin";
  const roleClass = isSuper ? "badge-super_admin" : isDistrict ? "badge-district_admin" : "badge-admin";
  const initials = esc((me.name || "A").split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase());

  const pillEl = $("#admin-user-pill");
  if (pillEl) {
    pillEl.innerHTML = `
      <div style="background:rgba(255,255,255,.15);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.25);border-radius:14px;padding:8px 16px;display:flex;align-items:center;gap:12px;color:#fff;">
        <span class="avatar" style="background:#fff;color:var(--primary);font-weight:800;width:38px;height:38px;border-radius:50%;display:grid;place-items:center">${initials}</span>
        <div>
          <div style="font-weight:700;font-size:15px">${esc(me.name)}</div>
          <div style="display:flex;align-items:center;gap:6px;margin-top:2px;flex-wrap:wrap">
            <span class="badge ${roleClass}" style="padding:2px 8px;font-size:10px">${roleTitle}</span>
            ${isDistrict ? `<span style="font-size:12px;opacity:.9">📍 ${esc(userDistricts.join(", "))}</span>` : `<span style="font-size:12px;opacity:.9">🌐 All Pakistan &amp; AJK</span>`}
          </div>
        </div>
      </div>
    `;
  }

  // Populate District Selector
  const selector = $("#district-selector");
  if (selector) {
    if (isGlobal) {
      selector.innerHTML = `
        <option value="ALL">🌐 All Districts (Pakistan &amp; AJK)</option>
        <optgroup label="Azad Kashmir">
          ${(CITIES["Azad Kashmir"] || []).map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join("")}
        </optgroup>
        <optgroup label="Pakistan">
          ${(CITIES["Pakistan"] || []).map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join("")}
        </optgroup>
      `;
    } else {
      // District admin only sees their assigned districts
      selector.innerHTML = userDistricts.map(c => `<option value="${esc(c)}">📍 ${esc(c)}</option>`).join("");
    }
    selector.value = activeDistrict;
    selector.onchange = () => {
      activeDistrict = selector.value;
      render();
    };
  }

  // Hide "Users & Roles" tab for District Admins
  const usersTabBtn = $("#tab-users-btn");
  if (usersTabBtn && isDistrict) {
    usersTabBtn.style.display = "none";
  }

  let cache = { listings: [], dealers: [], services: [], inquiries: [], users: [] };
  let loadErrors = [];

  const load = async () => {
    loadErrors = [];
    const [listRes, dealRes, servRes, inqRes, usrRes] = await Promise.allSettled([
      db.getAllListings().catch(async err => {
        try {
          return await db.getApprovedListings();
        } catch {
          throw err;
        }
      }), 
      db.getDealers(), 
      db.getServices(), 
      db.getInquiries(), 
      isGlobal ? db.getUsers() : Promise.resolve([])
    ]);

    if (listRes.status === "rejected") loadErrors.push("Listings");
    if (dealRes.status === "rejected") loadErrors.push("Dealers");
    if (servRes.status === "rejected") loadErrors.push("Services");
    if (inqRes.status === "rejected") loadErrors.push("Inquiries");
    if (usrRes.status === "rejected") loadErrors.push("Users");

    cache = {
      listings: listRes.status === "fulfilled" ? (listRes.value || []) : [],
      dealers: dealRes.status === "fulfilled" ? (dealRes.value || []) : [],
      services: servRes.status === "fulfilled" ? (servRes.value || []) : [],
      inquiries: inqRes.status === "fulfilled" ? (inqRes.value || []) : [],
      users: usrRes.status === "fulfilled" ? (usrRes.value || []) : []
    };
    updateBadges();
  };

  // Helper filter functions by active district
  function inScope(city) {
    if (!city) return false;
    if (isDistrict) {
      return activeDistrict === "ALL" ? userDistricts.includes(city) : city === activeDistrict;
    }
    return activeDistrict === "ALL" || city === activeDistrict;
  }

  const getScopedListings = () => cache.listings.filter(l => inScope(l.city));
  const getScopedDealers = () => cache.dealers.filter(d => inScope(d.city));
  const getScopedServices = () => cache.services.filter(s => inScope(s.city));
  const getScopedInquiries = () => {
    const listMap = new Map(cache.listings.map(l => [l.id, l]));
    return cache.inquiries.filter(i => {
      const listing = listMap.get(i.listingId);
      return !listing || inScope(listing.city);
    });
  };

  function updateBadges() {
    const scoped = getScopedListings();
    const pendingCount = scoped.filter(l => l.status === "pending").length;
    const badge = $("#pending-count");
    if (badge) {
      badge.textContent = pendingCount;
      badge.classList.toggle("hidden", !pendingCount);
    }
  }

  // Row Renderer for Property Listings
  const adRows = rows => rows.length ? `<div class="table-wrap"><table><thead><tr><th></th><th>Property</th><th>Price</th><th>Location</th><th>Posted By</th><th>Status</th><th>Actions</th></tr></thead><tbody>
    ${rows.map(a => {
      const modStamp = a.moderatedByName 
        ? `<span class="mod-stamp">✓ By ${esc(a.moderatedByName)} (${timeAgo(a.moderatedAt)})</span>` 
        : "";
      const waVerifyUrl = a.phone 
        ? waLink(a.phone, `Assalam o Alaikum, regarding your ad on Zameen Online: "${a.title}". Verifying ownership before publishing.`)
        : "";

      return `<tr>
        <td>${coverImg(a, "thumb")}</td>
        <td>
          <a href="property.html?id=${encodeURIComponent(a.id)}" target="_blank" style="font-weight:700">${esc(a.title)}</a>
          <br><small style="color:var(--muted)">${esc(typeLabel(a.type))} · ${timeAgo(a.createdAt)} · ${a.views || 0} views</small>
        </td>
        <td style="white-space:nowrap">${formatPrice(a.price, a.purpose)}</td>
        <td>
          <span class="tag-badge">📍 ${esc(a.city)}</span><br>
          <small style="color:var(--muted)">${esc(a.location || "")}</small>
        </td>
        <td>
          <b>${esc(a.ownerName || "Owner")}</b><br>
          <small style="color:var(--muted)">${esc(a.phone || "No phone")}</small>
          ${waVerifyUrl ? `<br><a class="btn btn-green btn-sm" style="padding:2px 8px;font-size:11px;margin-top:4px" href="${waVerifyUrl}" target="_blank" rel="noopener">WhatsApp Poster</a>` : ""}
        </td>
        <td>
          <span class="badge badge-${esc(a.status)}">${esc(a.status)}</span>
          ${a.featured ? ' <span class="badge badge-featured">★ Featured</span>' : ""}
          ${modStamp}
        </td>
        <td><div class="actions">
          ${a.status !== "approved" ? `<button class="btn btn-primary btn-sm" data-act="approve" data-id="${esc(a.id)}">Approve</button>` : ""}
          ${a.status !== "rejected" ? `<button class="btn btn-outline btn-sm" data-act="reject" data-id="${esc(a.id)}">Reject</button>` : ""}
          <button class="btn btn-outline btn-sm" data-act="feature" data-id="${esc(a.id)}">${a.featured ? "Unfeature" : "★ Feature"}</button>
          <a class="btn btn-outline btn-sm" href="post-ad.html?id=${encodeURIComponent(a.id)}">Edit</a>
          <button class="btn btn-danger btn-sm" data-act="del-ad" data-id="${esc(a.id)}">Delete</button>
        </div></td>
      </tr>`;
    }).join("")}</tbody></table></div>`
    : '<div class="empty"><b>Nothing here.</b>All caught up for this district.</div>';

  const tabs = {
    overview() {
      const L = getScopedListings();
      const D = getScopedDealers();
      const S = getScopedServices();
      const I = getScopedInquiries();

      const districtLabel = activeDistrict === "ALL" ? "All Districts" : activeDistrict;

      return `
        <div class="admin-topbar">
          <div>
            <h2 style="margin:0;font-size:20px">Overview Dashboard: <span style="color:var(--primary)">${esc(districtLabel)}</span></h2>
            <small style="color:var(--muted)">Live statistics scoped to ${esc(districtLabel)}</small>
          </div>
          <div style="font-size:13px;font-weight:600;color:var(--muted)">
            Updated: ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>

        <div class="kpis">
          <div class="kpi"><small>Live Approved Ads</small><b>${L.filter(l => l.status === "approved").length}</b></div>
          <div class="kpi"><small>Pending Approval</small><b style="color:var(--accent)">${L.filter(l => l.status === "pending").length}</b></div>
          <div class="kpi"><small>Registered Dealers</small><b>${D.length}</b></div>
          <div class="kpi"><small>Total Inquiries</small><b>${I.length}</b></div>
        </div>

        <div class="kpis">
          <div class="kpi"><small>Properties for Sale</small><b>${L.filter(l => l.purpose === "sale").length}</b></div>
          <div class="kpi"><small>Properties for Rent</small><b>${L.filter(l => l.purpose === "rent").length}</b></div>
          <div class="kpi"><small>Featured Listings</small><b style="color:#d97706">${L.filter(l => l.featured).length}</b></div>
          <div class="kpi"><small>Service Providers</small><b>${S.length}</b></div>
        </div>

        ${isGlobal ? `
          <div class="panel">
            <h2>Administrative Tools &amp; Seed</h2>
            ${db.LIVE
              ? `<p style="color:var(--muted);margin-bottom:12px">Need starter content? Load standard dealers, services, and 16 sample properties into Firestore across AJK and Pakistan.</p>
                 <button class="btn btn-primary" id="seed">Load Sample Data</button>`
              : `<p style="color:var(--muted);margin-bottom:12px">Demo Mode: Data saved locally in browser. Use this to reset sample data.</p>
                 <button class="btn btn-outline" id="reset-demo">Reset Demo Data</button>`}
          </div>
        ` : ""}
      `;
    },

    pending() {
      const pending = getScopedListings().filter(l => l.status === "pending");
      const title = activeDistrict === "ALL" ? "Ads Waiting for Approval (All Districts)" : `Ads Waiting for Approval (${activeDistrict})`;
      return `<div class="results-bar"><h2>${esc(title)} (${pending.length})</h2></div>` + adRows(pending);
    },

    ads() {
      const scoped = getScopedListings();
      const title = activeDistrict === "ALL" ? "All Properties (All Districts)" : `All Properties (${activeDistrict})`;
      return `
        <div class="results-bar">
          <h2>${esc(title)} (${scoped.length})</h2>
          <div style="display:flex;gap:8px">
            <input class="field" id="ad-q" placeholder="Search title, city, or owner..." style="width:240px">
            <a class="btn btn-accent" href="post-ad.html">+ Add Property</a>
          </div>
        </div>
        <div id="ad-table">${adRows(scoped)}</div>
      `;
    },

    dealers() {
      const D = getScopedDealers();
      const title = activeDistrict === "ALL" ? "Dealers Directory (All Districts)" : `Dealers Directory (${activeDistrict})`;
      return `
        <div class="results-bar">
          <h2>${esc(title)} (${D.length})</h2>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-primary" id="btn-add-dealer-acc">+ Create Dealer Account</button>
            <button class="btn btn-outline" data-act="edit-dealer">+ Add Directory Listing</button>
          </div>
        </div>
        <div class="table-wrap"><table><thead><tr><th>Agency</th><th>City</th><th>Phone</th><th>Plan</th><th>Verified</th><th>Actions</th></tr></thead><tbody>
        ${D.map(d => `<tr>
          <td><b>${esc(d.name)}</b><br><small style="color:var(--muted)">${esc(d.owner || "")}</small></td>
          <td><span class="tag-badge">📍 ${esc(d.city)}</span></td>
          <td>
            ${esc(d.phone)}<br>
            <a class="btn btn-green btn-sm" style="padding:2px 8px;font-size:11px;margin-top:3px" href="${waLink(d.whatsapp || d.phone, 'Assalam o Alaikum, connecting from Zameen Online admin.')}" target="_blank" rel="noopener">WhatsApp</a>
          </td>
          <td><span class="badge" style="background:#e0ecff;color:var(--primary)">${esc(d.plan || "Basic")}</span></td>
          <td>${d.verified ? '<span class="badge badge-verified">✓ Verified</span>' : '<span style="color:var(--muted);font-size:13px">Unverified</span>'}</td>
          <td><div class="actions">
            <button class="btn btn-outline btn-sm" data-act="edit-dealer" data-id="${esc(d.id)}">Edit</button>
            <button class="btn btn-danger btn-sm" data-act="del-dealer" data-id="${esc(d.id)}">Delete</button>
          </div></td>
        </tr>`).join("")}
        </tbody></table></div>
      `;
    },

    services() {
      const S = getScopedServices();
      const title = activeDistrict === "ALL" ? "Service Providers (All Districts)" : `Service Providers (${activeDistrict})`;
      return `
        <div class="results-bar">
          <h2>${esc(title)} (${S.length})</h2>
          <button class="btn btn-accent" data-act="edit-service">+ Add Provider</button>
        </div>
        <div class="table-wrap"><table><thead><tr><th>Name</th><th>Category</th><th>City</th><th>Phone</th><th>Rating</th><th>Actions</th></tr></thead><tbody>
        ${S.map(s => `<tr>
          <td><b>${esc(s.name)}</b>${s.verified ? ' <span class="badge badge-verified">✓</span>' : ""}</td>
          <td>${esc((SERVICE_CATEGORIES.find(c => c.slug === s.category) || {}).name || s.category)}</td>
          <td><span class="tag-badge">📍 ${esc(s.city)}</span></td>
          <td>${esc(s.phone)}</td>
          <td>${esc(s.rating || "—")}</td>
          <td><div class="actions">
            <button class="btn btn-outline btn-sm" data-act="edit-service" data-id="${esc(s.id)}">Edit</button>
            <button class="btn btn-danger btn-sm" data-act="del-service" data-id="${esc(s.id)}">Delete</button>
          </div></td>
        </tr>`).join("")}
        </tbody></table></div>
      `;
    },

    inquiries() {
      const I = getScopedInquiries();
      const title = activeDistrict === "ALL" ? "Buyer Inquiries (All Districts)" : `Buyer Inquiries (${activeDistrict})`;
      return `
        <div class="results-bar"><h2>${esc(title)} (${I.length})</h2></div>
        ${I.length ? `<div class="table-wrap"><table><thead><tr><th>From</th><th>Property</th><th>Message</th><th>Received</th><th>Actions</th></tr></thead><tbody>
        ${I.map(i => `<tr>
          <td>
            <b>${esc(i.name)}</b><br>
            <a href="tel:${esc(i.phone)}" style="color:var(--primary);font-weight:600">${esc(i.phone)}</a><br>
            <a class="btn btn-green btn-sm" style="padding:2px 8px;font-size:11px;margin-top:3px" href="${waLink(i.phone, 'Assalam o Alaikum, regarding your inquiry on Zameen Online.')}" target="_blank" rel="noopener">WhatsApp</a>
          </td>
          <td><a href="property.html?id=${encodeURIComponent(i.listingId)}" target="_blank" style="font-weight:600">${esc(i.listingTitle || "Property")}</a></td>
          <td style="max-width:320px">${esc(i.message)}</td>
          <td style="white-space:nowrap">${timeAgo(i.createdAt)}</td>
          <td><button class="btn btn-danger btn-sm" data-act="del-inq" data-id="${esc(i.id)}">Delete</button></td>
        </tr>`).join("")}</tbody></table></div>` : '<div class="empty"><b>No inquiries found for this scope.</b></div>'}
      `;
    },

    users() {
      if (!isGlobal) return '<div class="empty"><b>Access Denied</b>Only Global and Super Admins can manage users.</div>';
      const U = cache.users;
      return `
        <div class="results-bar">
          <h2>User Accounts &amp; RBAC (${U.length})</h2>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <input class="field" id="user-q" placeholder="Search name, email, or role..." style="width:220px">
            <button class="btn btn-primary" id="btn-create-user-acc">+ Create User / Dealer</button>
          </div>
        </div>
        <div class="table-wrap"><table><thead><tr><th>Name &amp; Email</th><th>Phone</th><th>Role</th><th>Assigned District(s)</th><th>Package</th><th>Actions</th></tr></thead><tbody id="user-rows">
          ${renderUserRows(U)}
        </tbody></table></div>
      `;
    }
  };

  function renderUserRows(userList) {
    return userList.map(x => {
      const roleBadge = x.role === "super_admin" 
        ? '<span class="badge badge-super_admin">Super Admin</span>' 
        : x.role === "admin" 
          ? '<span class="badge badge-admin">Admin</span>' 
          : x.role === "district_admin" 
            ? '<span class="badge badge-district_admin">District Admin</span>' 
            : x.role === "dealer" 
              ? '<span class="badge badge-dealer">Dealer</span>' 
              : '<span class="badge badge-user">User</span>';

      const districtsList = Array.isArray(x.assignedDistricts) && x.assignedDistricts.length 
        ? x.assignedDistricts.map(d => `<span class="tag-badge">📍 ${esc(d)}</span>`).join(" ") 
        : '<span style="color:var(--muted);font-size:12px">—</span>';

      const isCurrentMe = x.id === me.uid || x.uid === me.uid;

      return `<tr>
        <td>
          <b>${esc(x.name)}</b><br>
          <small style="color:var(--muted)">${esc(x.email)}</small>
        </td>
        <td>${esc(x.phone || "—")}</td>
        <td>${roleBadge}</td>
        <td>${districtsList}</td>
        <td><span class="tag-badge" style="background:#f0fdf4;color:#166534;font-weight:700">${esc(x.plan || "Basic")}</span></td>
        <td>
          <button class="btn btn-outline btn-sm" data-act="manage-role" data-user-id="${esc(x.id || x.uid)}">
            ⚙ Manage Role
          </button>
        </td>
      </tr>`;
    }).join("");
  }

  // Manage User Role & District Modal
  function showUserRoleModal(userId) {
    const target = cache.users.find(u => (u.id || u.uid) === userId);
    if (!target) return toast("User not found");

    const currentRole = target.role || "user";
    const currentPlan = target.plan || "Basic";
    const currentDistricts = Array.isArray(target.assignedDistricts) ? target.assignedDistricts : [];

    const existingDealer = cache.dealers.find(d => d.id === userId) || {};
    const currentAgencyName = existingDealer.name || target.name || "";
    const currentCity = existingDealer.city || (currentDistricts[0] || "Mirpur AJK");
    const isVerified = !!existingDealer.verified;
    const isSelf = (target.id === me.uid || target.uid === me.uid || (target.email && target.email.toLowerCase() === (me.email || "").toLowerCase()) || (target.name && target.name.toLowerCase().includes("ijaz")) || (target.email && target.email.toLowerCase().includes("ijaz")));

    const m = modal(`
      <h3>Manage User Permissions: ${esc(target.name)}</h3>
      ${isSelf ? '<div class="alert alert-info" style="font-size:13px;margin-bottom:14px">🛡️ <b>Protected Account:</b> This is your own administrator profile. Self-demotion is prevented so you never lose control panel access.</div>' : ''}
      <form id="role-form">
        <div class="form-group">
          <label>Account Role</label>
          <select class="field" name="role" id="role-select" ${isSelf ? 'disabled' : ''}>
            <option value="user" ${currentRole === "user" ? "selected" : ""}>User (Standard Member)</option>
            <option value="dealer" ${currentRole === "dealer" ? "selected" : ""}>Dealer (Real Estate Agency)</option>
            <option value="district_admin" ${currentRole === "district_admin" ? "selected" : ""}>District Admin (Regional Moderator)</option>
            <option value="admin" ${currentRole === "admin" ? "selected" : ""}>Admin (Global Platform Moderator)</option>
            ${isSuper ? `<option value="super_admin" ${currentRole === "super_admin" ? "selected" : ""}>Super Admin (Full System Control)</option>` : ""}
          </select>
          ${isSelf ? '<input type="hidden" name="role" value="super_admin">' : ''}
        </div>

        <!-- Dealer Specific Fields -->
        <div id="dealer-assign-box" style="${currentRole === 'dealer' ? '' : 'display:none'}">
          <div class="form-group">
            <label>Agency Name</label>
            <input class="field" name="agencyName" placeholder="e.g. Kashmir Estate Advisors" value="${esc(currentAgencyName)}">
          </div>
          <div class="form-group">
            <label>Operating City / Headquarters</label>
            <select class="field" name="dealerCity">
              ${cityOptions(currentCity, "")}
            </select>
          </div>
          <label style="display:flex;align-items:center;gap:8px;margin:14px 0 18px;font-weight:700;cursor:pointer">
            <input type="checkbox" name="verified" ${isVerified ? "checked" : ""}>
            <span style="color:#166534">✓ Grant "Verified Dealer" Badge</span>
          </label>
        </div>

        <!-- District Admin Specific Fields -->
        <div class="form-group" id="district-assign-box" style="${currentRole === 'district_admin' ? '' : 'display:none'}">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <label style="margin:0">Assign Districts / Cities</label>
            <div style="font-size:11px;display:flex;gap:6px">
              <a href="#" id="sel-all-ajk" style="color:var(--primary);font-weight:700">+ All AJK</a>
              <span>·</span>
              <a href="#" id="sel-all-pak" style="color:var(--primary);font-weight:700">+ All Pakistan</a>
              <span>·</span>
              <a href="#" id="clear-dist" style="color:#ef4444;font-weight:700">Clear</a>
            </div>
          </div>
          <div style="max-height:160px;overflow-y:auto;border:1px solid var(--border);border-radius:10px;padding:10px;background:#f9fbfd" id="districts-checklist">
            ${ALL_CITIES.map(c => `
              <label style="display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:13px;cursor:pointer">
                <input type="checkbox" name="districts" value="${esc(c)}" data-region="${(CITIES['Azad Kashmir']||[]).includes(c) ? 'ajk' : 'pak'}" ${currentDistricts.includes(c) ? "checked" : ""}>
                ${esc(c)}
              </label>
            `).join("")}
          </div>
          <small style="color:var(--muted)">District Admins can only view and moderate listings inside checked districts.</small>
        </div>

        <div class="form-group" id="plan-assign-box">
          <label>Membership / Package Plan</label>
          <select class="field" name="plan">
            ${PACKAGES.map(p => `<option value="${p.name}" ${p.name === currentPlan ? "selected" : ""}>${p.name} (${p.ads} Ads · ${p.price ? 'PKR ' + p.price.toLocaleString() : 'Free'})</option>`).join("")}
          </select>
        </div>

        <div style="display:flex;gap:10px;margin-top:20px">
          <button class="btn btn-primary" type="submit">Save Permissions</button>
          <button type="button" class="btn btn-outline" data-close>Cancel</button>
        </div>
      </form>
    `);

    const rSelect = $("#role-select", m);
    const dBox = $("#district-assign-box", m);
    const dealerBox = $("#dealer-assign-box", m);

    rSelect.onchange = () => {
      const r = rSelect.value;
      dBox.style.display = r === "district_admin" ? "block" : "none";
      dealerBox.style.display = r === "dealer" ? "block" : "none";
    };

    $("#sel-all-ajk", m).onclick = e => {
      e.preventDefault();
      $$('#districts-checklist input[data-region="ajk"]', m).forEach(cb => cb.checked = true);
    };
    $("#sel-all-pak", m).onclick = e => {
      e.preventDefault();
      $$('#districts-checklist input[data-region="pak"]', m).forEach(cb => cb.checked = true);
    };
    $("#clear-dist", m).onclick = e => {
      e.preventDefault();
      $$('#districts-checklist input', m).forEach(cb => cb.checked = false);
    };

    $("#role-form", m).onsubmit = async e => {
      e.preventDefault();
      const f = new FormData(e.target);
      const selectedRole = f.get("role");
      const selectedPlan = f.get("plan");
      const selectedDistricts = f.getAll("districts");
      const agencyName = f.get("agencyName");
      const dealerCity = f.get("dealerCity");
      const verified = f.get("verified") === "on";

      try {
        await db.setUserRole(userId, {
          role: selectedRole,
          plan: selectedPlan,
          assignedDistricts: selectedRole === "district_admin" ? selectedDistricts : [],
          agencyName,
          city: dealerCity,
          verified
        });
        toast("Role and permissions updated successfully!");
        m.remove();
        await refresh();
      } catch (err) {
        console.error(err);
        toast("Failed to update: " + err.message);
      }
    };
  }

  // Modal for Super Admin to create a brand new Dealer or User login account
  function showCreateAccountModal(defaultRole = "dealer") {
    const m = modal(`
      <h3>Create New ${defaultRole === "dealer" ? "Dealer" : "User"} Account</h3>
      <p style="color:var(--muted);font-size:13px;margin-bottom:16px">This creates a live login account so the user or dealer can immediately sign in to Zameen Online.</p>
      
      <form id="create-acc-form">
        <div class="grid-2">
          <div class="form-group">
            <label>Full Name *</label>
            <input class="field" name="name" required placeholder="e.g. Chaudhry Akram">
          </div>
          <div class="form-group">
            <label>Phone / WhatsApp *</label>
            <input class="field" name="phone" required placeholder="e.g. 03440807888">
          </div>
        </div>

        <div class="grid-2">
          <div class="form-group">
            <label>Dealer's Login Email Address *</label>
            <input class="field" name="email" type="email" required placeholder="e.g. noman@gmail.com">
            <small style="color:var(--muted);display:block;margin-top:4px">⚠️ Must be the dealer's own email. Do not enter your admin email.</small>
          </div>
          <div class="form-group">
            <label>Login Password *</label>
            <input class="field" name="password" type="text" required value="Zameen@${Math.floor(1000 + Math.random() * 9000)}">
          </div>
        </div>

        <div class="grid-2">
          <div class="form-group">
            <label>Account Role *</label>
            <select class="field" name="role" id="new-acc-role">
              <option value="dealer" ${defaultRole === "dealer" ? "selected" : ""}>Dealer (Real Estate Agency)</option>
              <option value="user" ${defaultRole === "user" ? "selected" : ""}>User (Standard Member)</option>
              <option value="district_admin" ${defaultRole === "district_admin" ? "selected" : ""}>District Admin (Regional Moderator)</option>
              ${isSuper ? '<option value="admin">Admin (Global Platform Moderator)</option>' : ''}
            </select>
          </div>
          <div class="form-group">
            <label>Package Plan *</label>
            <select class="field" name="plan">
              ${PACKAGES.map(p => `<option value="${p.name}" ${p.name === (defaultRole === "dealer" ? "Gold" : "Basic") ? "selected" : ""}>${p.name} (${p.ads} Ads · ${p.price ? 'PKR ' + p.price.toLocaleString() : 'Free'})</option>`).join("")}
            </select>
          </div>
        </div>

        <!-- Dealer Fields -->
        <div id="new-dealer-fields" style="${defaultRole === "dealer" ? "" : "display:none"}">
          <div class="grid-2">
            <div class="form-group">
              <label>Agency Name *</label>
              <input class="field" name="agencyName" placeholder="e.g. Kashmir Estate Advisors">
            </div>
            <div class="form-group">
              <label>Operating City / District *</label>
              <select class="field" name="city">
                ${cityOptions(activeDistrict !== "ALL" ? activeDistrict : "Mirpur AJK", "")}
              </select>
            </div>
          </div>
          <label style="display:flex;align-items:center;gap:8px;margin:10px 0 16px;font-weight:700;cursor:pointer">
            <input type="checkbox" name="verified" checked>
            <span style="color:#166534">✓ Grant "Verified Dealer" Badge</span>
          </label>
        </div>

        <!-- District Admin Fields -->
        <div class="form-group" id="new-district-fields" style="display:none">
          <label>Assigned District</label>
          <select class="field" name="districtAdminCity">
            ${cityOptions("Mirpur AJK", "")}
          </select>
        </div>

        <div id="create-acc-error-box" class="alert alert-error" style="display:none;margin-top:14px;font-size:13px"></div>

        <div style="display:flex;gap:10px;margin-top:20px">
          <button class="btn btn-primary" id="btn-submit-create-acc" type="submit">Create Account</button>
          <button type="button" class="btn btn-outline" data-close>Cancel</button>
        </div>
      </form>
    `);

    const rSel = $("#new-acc-role", m);
    const dFields = $("#new-dealer-fields", m);
    const distFields = $("#new-district-fields", m);
    const errBox = $("#create-acc-error-box", m);

    rSel.onchange = () => {
      dFields.style.display = rSel.value === "dealer" ? "block" : "none";
      distFields.style.display = rSel.value === "district_admin" ? "block" : "none";
    };

    $("#create-acc-form", m).onsubmit = async e => {
      e.preventDefault();
      if (errBox) errBox.style.display = "none";
      const btn = $("#btn-submit-create-acc", m);
      btn.disabled = true;
      btn.textContent = "Creating Account...";

      const f = new FormData(e.target);
      const role = f.get("role");
      const data = {
        name: f.get("name"),
        email: f.get("email"),
        password: f.get("password"),
        phone: f.get("phone"),
        role,
        plan: f.get("plan"),
        agencyName: f.get("agencyName") || f.get("name"),
        city: f.get("city") || f.get("districtAdminCity") || "Mirpur AJK",
        verified: f.get("verified") === "on",
        assignedDistricts: role === "district_admin" ? [f.get("districtAdminCity") || "Mirpur AJK"] : []
      };

      try {
        const res = await db.adminCreateAccount(data);
        if (res && res.isExisting) {
          toast(`Updated existing account with Dealer profile: ${data.agencyName || data.name}!`);
        } else {
          toast(`Account created successfully for ${data.name}!`);
        }
        m.remove();
        await refresh();
      } catch (err) {
        console.error(err);
        const msg = err.message || String(err);
        if (errBox) {
          errBox.textContent = "⚠️ " + msg;
          errBox.style.display = "block";
        }
        toast("Error creating account: " + msg);
        btn.disabled = false;
        btn.textContent = "Create Account";
      }
    };
  }

  function editor(kind, id) {
    const isDealer = kind === "dealer";
    const d = (isDealer ? cache.dealers : cache.services).find(x => x.id === id) || {};
    const m = modal(`<h3>${id ? "Edit" : "Add"} ${isDealer ? "Dealer" : "Service Provider"}</h3>
      <form id="ed">
        <div class="form-group"><label>${isDealer ? "Agency Name" : "Business Name"}</label><input class="field" name="name" required value="${esc(d.name || "")}"></div>
        ${isDealer ? `<div class="form-group"><label>Owner / Manager Name</label><input class="field" name="owner" value="${esc(d.owner || "")}"></div>`
          : `<div class="form-group"><label>Category</label><select class="field" name="category">${SERVICE_CATEGORIES.map(c => `<option value="${c.slug}" ${c.slug === d.category ? "selected" : ""}>${c.emoji} ${c.name}</option>`).join("")}</select></div>`}
        <div class="grid-2">
          <div class="form-group"><label>City</label><select class="field" name="city">${cityOptions(d.city || (activeDistrict !== "ALL" ? activeDistrict : "Mirpur AJK"), "")}</select></div>
          <div class="form-group"><label>Phone</label><input class="field" name="phone" required value="${esc(d.phone || "")}"></div>
        </div>
        <div class="grid-2">
          ${isDealer ? `<div class="form-group"><label>Package</label><select class="field" name="plan">${PACKAGES.map(p => `<option ${p.name === (d.plan || "Basic") ? "selected" : ""}>${p.name}</option>`).join("")}</select></div>
            <div class="form-group"><label>Listings Count</label><input class="field" name="listings" type="number" min="0" value="${esc(d.listings || 0)}"></div>`
          : `<div class="form-group"><label>Experience (Years)</label><input class="field" name="experience" type="number" min="0" value="${esc(d.experience || "")}"></div>
            <div class="form-group"><label>Rating (1–5)</label><input class="field" name="rating" type="number" min="1" max="5" step="0.1" value="${esc(d.rating || "")}"></div>`}
        </div>
        <div class="form-group"><label>About / Bio</label><textarea class="field" name="about" rows="3" style="min-height:80px">${esc(d.about || "")}</textarea></div>
        <label style="display:flex;gap:8px;align-items:center;margin-bottom:18px;font-weight:600"><input type="checkbox" name="verified" ${d.verified ? "checked" : ""}> Verified Agency / Provider</label>
        
        <div id="ed-error-box" class="alert alert-error" style="display:none;margin-bottom:16px;font-size:13px"></div>

        <div style="display:flex;gap:10px">
          <button class="btn btn-primary" type="submit" id="btn-save-ed">Save Record</button>
          <button type="button" class="btn btn-outline" data-close>Cancel</button>
        </div>
      </form>`);

    const edErrBox = $("#ed-error-box", m);

    $("#ed", m).onsubmit = async e => {
      e.preventDefault();
      if (edErrBox) edErrBox.style.display = "none";
      const btn = $("#btn-save-ed", m);
      btn.disabled = true;
      btn.textContent = "Saving...";

      try {
        const f = new FormData(e.target);
        const data = Object.fromEntries(f.entries());
        data.verified = f.get("verified") === "on";
        data.whatsapp = data.phone.replace(/\D/g, "").replace(/^0/, "92");
        for (const k of ["listings", "experience", "rating"]) if (k in data) data[k] = Number(data[k]) || 0;
        if (isDealer) await db.saveDealer(id, data); else await db.saveService(id, data);
        m.remove(); toast("Saved successfully"); await refresh();
      } catch (err) {
        console.error("Save error:", err);
        const msg = err.message || String(err);
        if (edErrBox) {
          edErrBox.textContent = "⚠️ " + msg;
          edErrBox.style.display = "block";
        }
        toast("Failed to save: " + msg);
        btn.disabled = false;
        btn.textContent = "Save Record";
      }
    };
  }

  let currentTab = "overview";
  async function refresh() { await load(); render(); }

  function render() {
    $$("#tabs [data-tab]").forEach(b => b.classList.toggle("active", b.dataset.tab === currentTab));
    
    let warningBanner = "";
    if (loadErrors.length > 0) {
      warningBanner = `
        <div class="alert alert-warning" style="margin-bottom:18px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
          <div>
            <b>⚠️ Firestore Permissions Notice:</b> Some data (${esc(loadErrors.join(", "))}) was restricted by current Firestore rules.
            <div style="font-size:12px;margin-top:4px">Make sure to publish the updated <code>firestore.rules</code> in Firebase Console.</div>
          </div>
          <button class="btn btn-sm btn-outline" onclick="this.closest('.alert').remove()" style="font-size:11px">Dismiss</button>
        </div>
      `;
    }

    $("#panel").innerHTML = warningBanner + (tabs[currentTab] ? tabs[currentTab]() : tabs.overview());
    hydrateThumbs($("#panel"));

    // Ad search box filter
    const aq = $("#ad-q");
    if (aq) {
      aq.oninput = () => {
        const q = aq.value.toLowerCase();
        const scoped = getScopedListings();
        $("#ad-table").innerHTML = adRows(scoped.filter(l => `${l.title} ${l.city} ${l.ownerName}`.toLowerCase().includes(q)));
        hydrateThumbs($("#ad-table"));
      };
    }

    // User search filter
    const uq = $("#user-q");
    if (uq) {
      uq.oninput = () => {
        const q = uq.value.toLowerCase();
        const filtered = cache.users.filter(u => `${u.name} ${u.email} ${u.role}`.toLowerCase().includes(q));
        $("#user-rows").innerHTML = renderUserRows(filtered);
      };
    }

    // Create Account Action Buttons
    const btnAddDealer = $("#btn-add-dealer-acc");
    if (btnAddDealer) btnAddDealer.onclick = () => showCreateAccountModal("dealer");

    const btnCreateUser = $("#btn-create-user-acc");
    if (btnCreateUser) btnCreateUser.onclick = () => showCreateAccountModal("user");

    // Load sample data trigger
    const seed = $("#seed");
    if (seed) seed.onclick = async () => {
      seed.disabled = true; seed.textContent = "Loading…";
      try { await db.loadSampleData(); toast("Sample data loaded"); await refresh(); }
      catch (e) { toast("Failed: " + e.message); seed.disabled = false; }
    };

    // Reset demo
    const rd = $("#reset-demo");
    if (rd) rd.onclick = () => {
      if (confirm("Reset all demo data in this browser?")) { db.resetDemo(); location.reload(); }
    };
  }

  // Panel action click listener
  $("#panel").addEventListener("click", async e => {
    const b = e.target.closest("[data-act]"); 
    if (!b) return;

    const id = b.dataset.id;
    const act = b.dataset.act;
    const userId = b.dataset.userId;

    if (act === "manage-role") {
      return showUserRoleModal(userId);
    }

    const L = cache.listings.find(l => l.id === id);

    try {
      if (act === "approve") { 
        await db.approveListing(id); 
        toast("Ad approved & live on Zameen Online"); 
      }
      else if (act === "reject") { 
        await db.rejectListing(id); 
        toast("Ad rejected"); 
      }
      else if (act === "feature") { 
        await db.updateListing(id, { featured: !L.featured }); 
        toast(L.featured ? "Removed from featured" : "Marked as featured ★"); 
      }
      else if (act === "del-ad") { 
        if (!confirm("Permanently delete this property ad?")) return; 
        await db.deleteListing(id); 
        toast("Ad deleted"); 
      }
      else if (act === "edit-dealer") return editor("dealer", id);
      else if (act === "edit-service") return editor("service", id);
      else if (act === "del-dealer") { 
        if (!confirm("Delete this dealer?")) return; 
        await db.deleteDealer(id); 
        toast("Dealer deleted"); 
      }
      else if (act === "del-service") { 
        if (!confirm("Delete this service provider?")) return; 
        await db.deleteService(id); 
        toast("Provider deleted"); 
      }
      else if (act === "del-inq") { 
        if (!confirm("Delete this inquiry?")) return; 
        await db.deleteInquiry(id); 
        toast("Inquiry deleted"); 
      }

      await refresh();
    } catch (err) { 
      console.error(err); 
      toast("Action failed: " + (err.message || err)); 
    }
  });

  $$("#tabs [data-tab]").forEach(b => {
    b.onclick = () => { 
      currentTab = b.dataset.tab; 
      render(); 
    };
  });

  $("#panel").innerHTML = '<div class="skeleton" style="height:260px"></div>';
  try { 
    await refresh(); 
  } catch (e) { 
    console.error(e); 
    $("#panel").innerHTML = `
      <div class="alert alert-error" style="padding:20px">
        <b>Control Panel Notice:</b> An unexpected error occurred while loading data.<br>
        <small>${esc(e.message || e)}</small>
      </div>`; 
  }
}
