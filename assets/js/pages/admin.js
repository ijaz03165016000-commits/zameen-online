import { requireUser, $, $$, esc, formatPrice, timeAgo, toast, modal, cityOptions, typeLabel, coverImg, hydrateThumbs, waLink } from "../app.js?v=20261118_02";
import * as db from "../db.js?v=20261118_02";
import { SERVICE_CATEGORIES, PACKAGES, CITIES } from "../seed.js";

const FIREBASE_RULES_CONSOLE_URL = "https://console.firebase.google.com/project/zameen-online/firestore/rules";

const me = await requireUser(["super_admin", "admin", "district_admin"]);

if (me) {
  const isOwner = !!me.isOwner || db.isOwnerEmail(me.email);
  const isSuper = isOwner || me.role === "super_admin" || me.role === "admin";
  const isGlobal = isSuper;
  const isDistrict = !isGlobal && me.role === "district_admin";

  const ALL_CITIES = [...(CITIES["Azad Kashmir"] || []), ...(CITIES["Pakistan"] || [])];
  const normCity = s => String(s || "").trim().toLowerCase();

  const userDistricts = isDistrict
    ? (Array.isArray(me.assignedDistricts) && me.assignedDistricts.length ? me.assignedDistricts : ["Mirpur AJK"])
    : [];

  let activeDistrict = isDistrict ? userDistricts[0] : "ALL";

  // Render Admin User Pill in Hero
  const roleTitle = me.role === "super_admin" ? "Super Admin" : isDistrict ? "District Admin" : "Global Admin";
  const roleClass = me.role === "super_admin" ? "badge-super_admin" : isDistrict ? "badge-district_admin" : "badge-admin";
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
            ${isOwner && me.firestoreRole !== "admin" ? `<button id="btn-reclaim-super-admin" class="btn btn-sm" style="background:#f59e0b;color:#fff;border:none;padding:2px 8px;font-size:10px;font-weight:700;border-radius:6px;cursor:pointer">👑 Sync Admin Role</button>` : ""}
          </div>
        </div>
      </div>
    `;

    const btnReclaim = $("#btn-reclaim-super-admin");
    if (btnReclaim) {
      btnReclaim.onclick = async () => {
        btnReclaim.disabled = true;
        btnReclaim.textContent = "Syncing...";
        try {
          await db.claimSuperAdmin();
          toast("Admin role synced in Firestore!");
          startLiveSubscriptions();
        } catch (e) {
          toast("Sync blocked: " + (e.message || e), 5000);
          btnReclaim.disabled = false;
          btnReclaim.textContent = "👑 Sync Admin Role";
        }
      };
    }
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
      selector.innerHTML = userDistricts.map(c => `<option value="${esc(c)}">📍 ${esc(c)}</option>`).join("");
    }
    selector.value = activeDistrict;
    selector.onchange = () => {
      activeDistrict = selector.value;
      updateBadges();
      render();
    };
  }

  // Hide "Users & Roles" tab for District Admins
  const usersTabBtn = $("#tab-users-btn");
  if (usersTabBtn && isDistrict) {
    usersTabBtn.style.display = "none";
  }

  const cache = { listings: [], dealers: [], services: [], inquiries: [], users: [] };
  const liveState = { listings: "connecting", dealers: "connecting", services: "connecting", inquiries: "connecting", users: isGlobal ? "connecting" : "live" };
  const collectionErrors = {};
  let lastUpdated = Date.now();
  let initialListingsLoaded = false;
  let knownPendingIds = new Set();
  let unsubscribers = [];
  let currentTab = "overview";
  let adSearchQuery = "";
  let userSearchQuery = "";

  function stopSubscriptions() {
    unsubscribers.forEach(fn => { try { fn(); } catch {} });
    unsubscribers = [];
  }

  function inScope(city) {
    if (!isDistrict && activeDistrict === "ALL") return true;
    const c = normCity(city);
    if (!c) return false;
    if (isDistrict) {
      return activeDistrict === "ALL"
        ? userDistricts.map(normCity).includes(c)
        : c === normCity(activeDistrict);
    }
    return c === normCity(activeDistrict);
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

  function startLiveSubscriptions() {
    stopSubscriptions();
    Object.keys(collectionErrors).forEach(k => delete collectionErrors[k]);
    liveState.listings = "connecting";
    liveState.dealers = "connecting";
    liveState.services = "connecting";
    liveState.inquiries = "connecting";
    liveState.users = isGlobal ? "connecting" : "live";

    const scheduleRender = () => {
      lastUpdated = Date.now();
      updateBadges();
      render();
    };

    // 1. Real-time ALL listings (never silently fall back to approved-only!)
    unsubscribers.push(
      db.subscribeAllListings(
        rows => {
          delete collectionErrors.listings;
          liveState.listings = "live";
          cache.listings = rows || [];

          const scopedPending = getScopedListings().filter(l => l.status === "pending");
          const nextPendingIds = new Set(scopedPending.map(l => l.id));
          if (initialListingsLoaded) {
            const newlyArrived = scopedPending.filter(l => !knownPendingIds.has(l.id));
            if (newlyArrived.length === 1) {
              toast(`🔔 New ad waiting for approval: ${newlyArrived[0].title}`, 4500);
            } else if (newlyArrived.length > 1) {
              toast(`🔔 ${newlyArrived.length} new ads waiting for approval`, 4500);
            }
          }
          knownPendingIds = nextPendingIds;
          initialListingsLoaded = true;
          scheduleRender();
        },
        err => {
          console.error("Listings live listener error:", err);
          liveState.listings = "error";
          collectionErrors.listings = err.message || String(err);
          initialListingsLoaded = true;
          scheduleRender();
        }
      )
    );

    // 2. Real-time Dealers
    unsubscribers.push(
      db.subscribeDealers(
        rows => {
          delete collectionErrors.dealers;
          liveState.dealers = "live";
          cache.dealers = rows || [];
          scheduleRender();
        },
        err => {
          console.error("Dealers listener error:", err);
          liveState.dealers = "error";
          collectionErrors.dealers = err.message || String(err);
          scheduleRender();
        }
      )
    );

    // 3. Real-time Services
    unsubscribers.push(
      db.subscribeServices(
        rows => {
          delete collectionErrors.services;
          liveState.services = "live";
          cache.services = rows || [];
          scheduleRender();
        },
        err => {
          console.error("Services listener error:", err);
          liveState.services = "error";
          collectionErrors.services = err.message || String(err);
          scheduleRender();
        }
      )
    );

    // 4. Real-time Inquiries
    unsubscribers.push(
      db.subscribeInquiries(
        rows => {
          delete collectionErrors.inquiries;
          liveState.inquiries = "live";
          cache.inquiries = rows || [];
          scheduleRender();
        },
        err => {
          console.error("Inquiries listener error:", err);
          liveState.inquiries = "error";
          collectionErrors.inquiries = err.message || String(err);
          scheduleRender();
        }
      )
    );

    // 5. Real-time Users (Global / Super Admin only)
    if (isGlobal) {
      unsubscribers.push(
        db.subscribeUsers(
          rows => {
            delete collectionErrors.users;
            liveState.users = "live";
            cache.users = rows || [];
            scheduleRender();
          },
          err => {
            console.error("Users listener error:", err);
            liveState.users = "error";
            collectionErrors.users = err.message || String(err);
            scheduleRender();
          }
        )
      );
    }
  }

  window.addEventListener("beforeunload", stopSubscriptions);

  async function copyFirestoreRules() {
    try {
      const resp = await fetch("firestore.rules?v=" + Date.now());
      if (!resp.ok) throw new Error("Could not load firestore.rules");
      const text = await resp.text();
      await navigator.clipboard.writeText(text);
      toast("firestore.rules copied! Paste into Firebase Console → Firestore → Rules → Publish.", 5000);
    } catch (err) {
      console.error(err);
      toast("Open firestore.rules from your project folder and paste into Firebase Console → Rules.", 5000);
    }
  }

  function renderDiagnosticBanner() {
    const failedCols = Object.keys(collectionErrors);
    if (!failedCols.length) return "";
    const listingsBlocked = !!collectionErrors.listings;
    return `
      <div class="alert alert-error" style="margin-bottom:18px;padding:16px 18px">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap">
          <div style="flex:1;min-width:260px">
            <b style="font-size:15px">⚠️ Firestore Security Rules Action Required (${esc(failedCols.join(", "))} blocked)</b>
            <p style="margin:6px 0 8px;font-size:13px;line-height:1.5">
              ${listingsBlocked
                ? "Pending ads cannot be loaded because Firebase Firestore rejected this admin session under the currently published rules."
                : "Some admin collections were blocked by the currently published Firestore security rules."}
            </p>
            <div style="font-size:12px;background:rgba(255,255,255,.65);padding:8px 10px;border-radius:8px;margin-bottom:10px">
              <b>Signed in as:</b> ${esc(me.email)} &nbsp;|&nbsp;
              <b>Firestore Role:</b> <code>${esc(me.firestoreRole || "missing")}</code> &nbsp;|&nbsp;
              <b>UID:</b> <code>${esc(me.uid)}</code>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button class="btn btn-primary btn-sm" id="btn-copy-rules">📋 Copy Latest firestore.rules</button>
              <a class="btn btn-outline btn-sm" href="${FIREBASE_RULES_CONSOLE_URL}" target="_blank" rel="noopener">Open Firebase Console Rules ↗</a>
              <button class="btn btn-outline btn-sm" id="btn-retry-live">🔄 Retry Live Connection</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Row Renderer for Property Listings
  const adRows = (rows, emptyMsg = "All caught up for this district.") => rows.length
    ? `<div class="table-wrap"><table><thead><tr><th></th><th>Property</th><th>Price</th><th>Location</th><th>Posted By</th><th>Status</th><th>Actions</th></tr></thead><tbody>
      ${rows.map(a => {
        const modStamp = a.moderatedByName
          ? `<span class="mod-stamp">✓ By ${esc(a.moderatedByName)} (${timeAgo(a.moderatedAt)})</span>`
          : "";
        const reasonStamp = a.status === "rejected" && a.moderationNote
          ? `<span class="mod-stamp" style="color:#991b1b">Reason: ${esc(a.moderationNote)}</span>`
          : "";
        const sellerTag = a.ownerRole === "dealer"
          ? '<span class="tag-badge" style="background:#dcfce7;color:#166534">Dealer</span>'
          : (a.ownerRole === "admin" || a.ownerRole === "super_admin")
            ? '<span class="tag-badge" style="background:#e0ecff;color:#1e3a8a">Admin</span>'
            : '<span class="tag-badge">Private Seller</span>';
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
            <span class="tag-badge">📍 ${esc(a.city || "Unspecified")}</span><br>
            <small style="color:var(--muted)">${esc(a.location || "")}</small>
          </td>
          <td>
            <b>${esc(a.ownerName || "Owner")}</b> ${sellerTag}<br>
            <small style="color:var(--muted)">${esc(a.phone || "No phone")}</small>
            ${waVerifyUrl ? `<br><a class="btn btn-green btn-sm" style="padding:2px 8px;font-size:11px;margin-top:4px" href="${waVerifyUrl}" target="_blank" rel="noopener">WhatsApp Poster</a>` : ""}
          </td>
          <td>
            <span class="badge badge-${esc(a.status || "pending")}">${esc(a.status || "pending")}</span>
            ${a.featured ? ' <span class="badge badge-featured">★ Featured</span>' : ""}
            ${modStamp}
            ${reasonStamp}
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
    : `<div class="empty"><b>Nothing here.</b>${esc(emptyMsg)}</div>`;

  const tabs = {
    overview() {
      const L = getScopedListings();
      const D = getScopedDealers();
      const S = getScopedServices();
      const I = getScopedInquiries();
      const pendingCount = L.filter(l => l.status === "pending").length;
      const districtLabel = activeDistrict === "ALL" ? "All Districts" : activeDistrict;
      const isLiveOk = liveState.listings === "live";

      return `
        <div class="admin-topbar">
          <div>
            <h2 style="margin:0;font-size:20px">Overview Dashboard: <span style="color:var(--primary)">${esc(districtLabel)}</span></h2>
            <small style="color:var(--muted)">Real-time statistics scoped to ${esc(districtLabel)}</small>
          </div>
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
            <span class="live-pill ${isLiveOk ? "" : "offline"}">${isLiveOk ? "Live Sync Active" : liveState.listings === "connecting" ? "Connecting…" : "Sync Blocked"}</span>
            <span style="font-size:12px;font-weight:600;color:var(--muted)">Updated ${new Date(lastUpdated).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
            <button class="btn btn-outline btn-sm" id="btn-manual-refresh">↻ Refresh</button>
          </div>
        </div>

        ${pendingCount > 0 ? `
          <div class="alert alert-warning" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:20px">
            <div>
              <b>⏳ ${pendingCount} Property ${pendingCount === 1 ? "Ad" : "Ads"} Waiting for Admin Approval</b>
              <div style="font-size:13px;margin-top:2px">New seller submissions appear here in real time. Review and approve to publish live on Zameen Online.</div>
            </div>
            <button class="btn btn-primary btn-sm" id="btn-go-pending">Review Pending Ads (${pendingCount}) →</button>
          </div>
        ` : ""}

        <div class="kpis">
          <div class="kpi"><small>Live Approved Ads</small><b>${L.filter(l => l.status === "approved").length}</b></div>
          <div class="kpi"><small>Pending Approval</small><b style="color:var(--accent)">${pendingCount}</b></div>
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
      const title = activeDistrict === "ALL" ? "Ads Waiting for Approval (All Districts)" : `Ads Waiting for Approval (${activeDistrict})`;
      if (collectionErrors.listings) {
        return `
          <div class="results-bar"><h2>${esc(title)}</h2></div>
          <div class="empty">
            <b>Unable to load pending ads due to Firestore permissions.</b>
            Publish the updated <code>firestore.rules</code> in Firebase Console (use the red banner above), then click <b>Retry Live Connection</b>.
          </div>`;
      }
      if (liveState.listings === "connecting") {
        return `<div class="results-bar"><h2>${esc(title)}</h2></div><div class="skeleton" style="height:200px"></div>`;
      }
      const pending = getScopedListings().filter(l => l.status === "pending");
      return `
        <div class="results-bar">
          <h2>${esc(title)} (${pending.length})</h2>
          <span class="live-pill">Live Auto-Updating</span>
        </div>
        ${adRows(pending, "No pending ads waiting for approval right now. New submissions will appear here automatically.")}
      `;
    },

    ads() {
      const scoped = getScopedListings();
      const q = adSearchQuery.toLowerCase().trim();
      const filtered = q ? scoped.filter(l => `${l.title} ${l.city} ${l.location} ${l.ownerName} ${l.status}`.toLowerCase().includes(q)) : scoped;
      const title = activeDistrict === "ALL" ? "All Properties (All Districts)" : `All Properties (${activeDistrict})`;
      return `
        <div class="results-bar">
          <h2>${esc(title)} (${filtered.length})</h2>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <input class="field" id="ad-q" placeholder="Search title, city, status, or owner..." value="${esc(adSearchQuery)}" style="width:260px">
            <a class="btn btn-accent" href="post-ad.html">+ Add Property</a>
          </div>
        </div>
        <div id="ad-table">${adRows(filtered)}</div>
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
      const q = userSearchQuery.toLowerCase().trim();
      const filtered = q ? U.filter(u => `${u.name} ${u.email} ${u.role}`.toLowerCase().includes(q)) : U;
      return `
        <div class="results-bar">
          <h2>User Accounts &amp; RBAC (${filtered.length})</h2>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <input class="field" id="user-q" placeholder="Search name, email, or role..." value="${esc(userSearchQuery)}" style="width:220px">
            <button class="btn btn-primary" id="btn-create-user-acc">+ Create User / Dealer</button>
          </div>
        </div>
        <div class="table-wrap"><table><thead><tr><th>Name &amp; Email</th><th>Phone</th><th>Role</th><th>Assigned District(s)</th><th>Package</th><th>Actions</th></tr></thead><tbody id="user-rows">
          ${renderUserRows(filtered)}
        </tbody></table></div>
      `;
    }
  };

  function renderUserRows(userList) {
    return userList.map(x => {
      const displayRole = (x.role === "super_admin" || (x.role === "admin" && x.isSuperAdmin) || db.isOwnerEmail(x.email))
        ? "super_admin"
        : (x.role || "user");

      const roleBadge = displayRole === "super_admin"
        ? '<span class="badge badge-super_admin">Super Admin</span>'
        : displayRole === "admin"
          ? '<span class="badge badge-admin">Admin</span>'
          : displayRole === "district_admin"
            ? '<span class="badge badge-district_admin">District Admin</span>'
            : displayRole === "dealer"
              ? '<span class="badge badge-dealer">Dealer</span>'
              : '<span class="badge badge-user">Private Seller</span>';

      const districtsList = Array.isArray(x.assignedDistricts) && x.assignedDistricts.length
        ? x.assignedDistricts.map(d => `<span class="tag-badge">📍 ${esc(d)}</span>`).join(" ")
        : '<span style="color:var(--muted);font-size:12px">—</span>';

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

  // Rejection Reason Modal
  function showRejectModal(listing) {
    const m = modal(`
      <h3>Reject Property Ad</h3>
      <p style="color:var(--muted);font-size:13px;margin-bottom:14px"><b>${esc(listing?.title || "Listing")}</b></p>
      <form id="reject-form">
        <div class="form-group">
          <label>Reason for Rejection (shown to seller)</label>
          <textarea class="field" name="reason" rows="3" placeholder="e.g. Photos are blurry or price/location details are incomplete."></textarea>
        </div>
        <div style="display:flex;gap:10px;margin-top:16px">
          <button class="btn btn-danger" type="submit" id="btn-confirm-reject">Confirm Reject</button>
          <button type="button" class="btn btn-outline" data-close>Cancel</button>
        </div>
      </form>
    `);

    $("#reject-form", m).onsubmit = async e => {
      e.preventDefault();
      const btn = $("#btn-confirm-reject", m);
      btn.disabled = true;
      btn.textContent = "Rejecting...";
      const reason = new FormData(e.target).get("reason").trim();
      try {
        await db.rejectListing(listing.id, reason || "Rejected by moderator");
        toast("Ad rejected");
        m.remove();
      } catch (err) {
        console.error(err);
        toast("Failed to reject: " + (err.message || err), 5000);
        btn.disabled = false;
        btn.textContent = "Confirm Reject";
      }
    };
  }

  // Manage User Role & District Modal
  function showUserRoleModal(userId) {
    const target = cache.users.find(u => (u.id || u.uid) === userId);
    if (!target) return toast("User not found");

    const currentRole = (target.role === "admin" && target.isSuperAdmin) ? "super_admin" : (target.role || "user");
    const currentPlan = target.plan || "Basic";
    const currentDistricts = Array.isArray(target.assignedDistricts) ? target.assignedDistricts : [];

    const existingDealer = cache.dealers.find(d => d.id === userId) || {};
    const currentAgencyName = existingDealer.name || target.name || "";
    const currentCity = existingDealer.city || (currentDistricts[0] || "Mirpur AJK");
    const isVerified = !!existingDealer.verified;
    const isSelf = (target.id === me.uid || target.uid === me.uid || db.isOwnerEmail(target.email));

    const m = modal(`
      <h3>Manage User Permissions: ${esc(target.name)}</h3>
      ${isSelf ? '<div class="alert alert-info" style="font-size:13px;margin-bottom:14px">🛡️ <b>Protected Account:</b> Primary owner/self role cannot be demoted so you never lose control panel access.</div>' : ''}
      <form id="role-form">
        <div class="form-group">
          <label>Account Role</label>
          <select class="field" name="role" id="role-select" ${isSelf ? 'disabled' : ''}>
            <option value="user" ${currentRole === "user" ? "selected" : ""}>Private Seller / Buyer (Standard)</option>
            <option value="dealer" ${currentRole === "dealer" ? "selected" : ""}>Dealer (Real Estate Agency)</option>
            <option value="district_admin" ${currentRole === "district_admin" ? "selected" : ""}>District Admin (Regional Moderator)</option>
            <option value="admin" ${currentRole === "admin" ? "selected" : ""}>Admin (Global Platform Moderator)</option>
            ${isSuper ? `<option value="super_admin" ${currentRole === "super_admin" ? "selected" : ""}>Super Admin (Full System Control)</option>` : ""}
          </select>
          ${isSelf ? '<input type="hidden" name="role" value="super_admin">' : ''}
        </div>

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

    $("#sel-all-ajk", m).onclick = e => { e.preventDefault(); $$('#districts-checklist input[data-region="ajk"]', m).forEach(cb => cb.checked = true); };
    $("#sel-all-pak", m).onclick = e => { e.preventDefault(); $$('#districts-checklist input[data-region="pak"]', m).forEach(cb => cb.checked = true); };
    $("#clear-dist", m).onclick = e => { e.preventDefault(); $$('#districts-checklist input', m).forEach(cb => cb.checked = false); };

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
      } catch (err) {
        console.error(err);
        toast("Failed to update: " + err.message, 5000);
      }
    };
  }

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
            <label>Login Email Address *</label>
            <input class="field" name="email" type="email" required placeholder="e.g. noman@gmail.com">
            <small style="color:var(--muted);display:block;margin-top:4px">⚠️ Must be the new user's own email address.</small>
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
              <option value="user" ${defaultRole === "user" ? "selected" : ""}>Private Seller / Buyer (Standard)</option>
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
        await db.adminCreateAccount(data);
        toast(`Account created successfully for ${data.name}!`);
        m.remove();
      } catch (err) {
        console.error(err);
        const msg = err.message || String(err);
        if (errBox) {
          errBox.textContent = "⚠️ " + msg;
          errBox.style.display = "block";
        }
        toast("Error creating account: " + msg, 5000);
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
        m.remove();
        toast("Saved successfully");
      } catch (err) {
        console.error("Save error:", err);
        const msg = err.message || String(err);
        if (edErrBox) {
          edErrBox.textContent = "⚠️ " + msg;
          edErrBox.style.display = "block";
        }
        toast("Failed to save: " + msg, 5000);
        btn.disabled = false;
        btn.textContent = "Save Record";
      }
    };
  }

  function render() {
    // Preserve search input focus if user is currently typing
    const activeEl = document.activeElement;
    const activeId = activeEl && (activeEl.id === "ad-q" || activeEl.id === "user-q") ? activeEl.id : null;
    const selStart = activeId ? activeEl.selectionStart : null;
    const selEnd = activeId ? activeEl.selectionEnd : null;

    $$("#tabs [data-tab]").forEach(b => b.classList.toggle("active", b.dataset.tab === currentTab));
    $("#panel").innerHTML = renderDiagnosticBanner() + (tabs[currentTab] ? tabs[currentTab]() : tabs.overview());
    hydrateThumbs($("#panel"));

    // Restore focus if typing in search box
    if (activeId) {
      const restored = $("#" + activeId);
      if (restored) {
        restored.focus();
        if (selStart !== null && selEnd !== null) restored.setSelectionRange(selStart, selEnd);
      }
    }

    const btnCopyRules = $("#btn-copy-rules");
    if (btnCopyRules) btnCopyRules.onclick = copyFirestoreRules;

    const btnRetry = $("#btn-retry-live");
    if (btnRetry) btnRetry.onclick = () => {
      toast("Reconnecting to Firestore live feed...");
      startLiveSubscriptions();
    };

    const btnManualRefresh = $("#btn-manual-refresh");
    if (btnManualRefresh) btnManualRefresh.onclick = () => {
      toast("Refreshing live connection...");
      startLiveSubscriptions();
    };

    const btnGoPending = $("#btn-go-pending");
    if (btnGoPending) btnGoPending.onclick = () => {
      currentTab = "pending";
      render();
    };

    const aq = $("#ad-q");
    if (aq) {
      aq.oninput = () => {
        adSearchQuery = aq.value;
        const q = adSearchQuery.toLowerCase().trim();
        const scoped = getScopedListings();
        const filtered = q ? scoped.filter(l => `${l.title} ${l.city} ${l.location} ${l.ownerName} ${l.status}`.toLowerCase().includes(q)) : scoped;
        $("#ad-table").innerHTML = adRows(filtered);
        hydrateThumbs($("#ad-table"));
      };
    }

    const uq = $("#user-q");
    if (uq) {
      uq.oninput = () => {
        userSearchQuery = uq.value;
        const q = userSearchQuery.toLowerCase().trim();
        const filtered = q ? cache.users.filter(u => `${u.name} ${u.email} ${u.role}`.toLowerCase().includes(q)) : cache.users;
        $("#user-rows").innerHTML = renderUserRows(filtered);
      };
    }

    const btnAddDealer = $("#btn-add-dealer-acc");
    if (btnAddDealer) btnAddDealer.onclick = () => showCreateAccountModal("dealer");

    const btnCreateUser = $("#btn-create-user-acc");
    if (btnCreateUser) btnCreateUser.onclick = () => showCreateAccountModal("user");

    const seed = $("#seed");
    if (seed) seed.onclick = async () => {
      seed.disabled = true; seed.textContent = "Loading…";
      try { await db.loadSampleData(); toast("Sample data loaded"); }
      catch (e) { toast("Failed: " + e.message, 5000); seed.disabled = false; seed.textContent = "Load Sample Data"; }
    };

    const rd = $("#reset-demo");
    if (rd) rd.onclick = () => {
      if (confirm("Reset all demo data in this browser?")) { db.resetDemo(); location.reload(); }
    };
  }

  // Panel action click listener
  $("#panel").addEventListener("click", async e => {
    const b = e.target.closest("[data-act]");
    if (!b || b.disabled) return;

    const id = b.dataset.id;
    const act = b.dataset.act;
    const userId = b.dataset.userId;

    if (act === "manage-role") return showUserRoleModal(userId);
    if (act === "edit-dealer") return editor("dealer", id);
    if (act === "edit-service") return editor("service", id);

    const L = cache.listings.find(l => l.id === id);
    if (act === "reject") return showRejectModal(L || { id, title: "Listing" });

    const origText = b.textContent;
    b.disabled = true;

    try {
      if (act === "approve") {
        b.textContent = "Approving…";
        await db.approveListing(id);
        toast("✓ Ad approved & now LIVE on Zameen Online!", 3500);
      } else if (act === "feature") {
        await db.updateListing(id, { featured: !L?.featured });
        toast(L?.featured ? "Removed from featured" : "Marked as featured ★");
      } else if (act === "del-ad") {
        if (!confirm("Permanently delete this property ad?")) { b.disabled = false; return; }
        b.textContent = "Deleting…";
        await db.deleteListing(id);
        toast("Ad deleted");
      } else if (act === "del-dealer") {
        if (!confirm("Delete this dealer?")) { b.disabled = false; return; }
        await db.deleteDealer(id);
        toast("Dealer deleted");
      } else if (act === "del-service") {
        if (!confirm("Delete this service provider?")) { b.disabled = false; return; }
        await db.deleteService(id);
        toast("Provider deleted");
      } else if (act === "del-inq") {
        if (!confirm("Delete this inquiry?")) { b.disabled = false; return; }
        await db.deleteInquiry(id);
        toast("Inquiry deleted");
      }
    } catch (err) {
      console.error(err);
      toast("Action failed: " + (err.message || err), 5000);
      b.disabled = false;
      b.textContent = origText;
    }
  });

  $$("#tabs [data-tab]").forEach(b => {
    b.onclick = () => {
      currentTab = b.dataset.tab;
      render();
    };
  });

  $("#panel").innerHTML = '<div class="skeleton" style="height:260px"></div>';
  startLiveSubscriptions();
}
