import { initPage, isAdminRole, $, $$, esc, params, formatPrice, typeLabel, timeAgo, ICON, waLink, propertyCard, toast, favs, fallbackImg, isAJK, hydrateThumbs } from "../app.js?v=20261118_02";
import { getListing, getApprovedListings, addView, addInquiry, getUser, getPhotos, approveListing, rejectListing } from "../db.js?v=20261118_02";
import { SITE } from "../firebase-config.js";

await initPage();
const id = params().id;
const box = $("#detail");
const l = id ? await getListing(id).catch(() => null) : null;
const u = getUser();
const isAdmin = !!(u && isAdminRole(u.role));
const canSee = l && (l.status === "approved" || (u && (u.uid === l.ownerId || isAdmin)));

if (!canSee) {
  box.innerHTML = `<div style="padding:80px 0"><div class="empty"><b>Property not found</b>This ad may have been removed or is waiting for approval.<br><br><a class="btn btn-primary" href="listings.html">Browse Properties</a></div></div>`;
  $("#similar-wrap").remove();
} else {
  document.title = `${l.title} | Zameen Online`;
  if (l.status === "approved") addView(l.id);
  const photos = await getPhotos(l);
  const imgs = photos.length ? photos : [fallbackImg];
  const phone = l.phone || SITE.phone;
  const wa = l.whatsapp || phone;
  const url = location.href;
  const specs = [
    ["Price", formatPrice(l.price, l.purpose)], ["Type", typeLabel(l.type)], ["Purpose", l.purpose === "rent" ? "For Rent" : "For Sale"],
    ["Area", `${esc(l.area)} ${esc(l.areaUnit)}`], ["Bedrooms", l.beds || "—"], ["Bathrooms", l.baths || "—"],
    ["City", esc(l.city)], ["Added", timeAgo(l.createdAt)], ["Views", (l.views || 0) + (l.status === "approved" ? 1 : 0)]
  ];

  const statusBanner = l.status !== "approved"
    ? (isAdmin
        ? `<div class="alert alert-warning" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
            <div><b>Admin Review Mode:</b> This ad is currently <b>${esc(l.status)}</b> and hidden from public visitors.</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button class="btn btn-primary btn-sm" id="btn-inline-approve">✓ Approve &amp; Publish Live</button>
              ${l.status !== "rejected" ? '<button class="btn btn-danger btn-sm" id="btn-inline-reject">✕ Reject</button>' : ''}
              <a class="btn btn-outline btn-sm" href="admin.html">← Admin Panel</a>
            </div>
          </div>`
        : `<div class="alert alert-info">This ad is <b>${esc(l.status)}</b> — only you and the admin can see it until it is approved.</div>`)
    : "";

  box.innerHTML = `
  <div class="detail-layout">
    <div>
      <div class="crumbs" style="color:var(--muted);opacity:1;margin-bottom:14px"><a href="index.html">Home</a> › <a href="listings.html?city=${encodeURIComponent(l.city)}">${esc(l.city)}</a> › ${esc(typeLabel(l.type))}</div>
      ${statusBanner}
      <div class="gallery-main">
        <img id="main-img" src="${esc(imgs[0])}" alt="${esc(l.title)}" onerror="this.src='${fallbackImg}'">
        <div class="badges"><span class="badge badge-${l.purpose === "rent" ? "rent" : "sale"}">For ${l.purpose === "rent" ? "Rent" : "Sale"}</span>${l.featured ? '<span class="badge badge-featured">★ Featured</span>' : ""}${isAJK(l.city) ? '<span class="badge badge-ajk">AJK</span>' : ""}</div>
        <button class="fav-btn ${favs.has(l.id) ? "on" : ""}" data-fav="${esc(l.id)}" aria-label="Save">${ICON.heart}</button>
      </div>
      ${imgs.length > 1 ? `<div class="thumbs">${imgs.map((s, i) => `<img src="${esc(s)}" data-i="${i}" class="${i ? "" : "active"}" alt="Photo ${i + 1}">`).join("")}</div>` : ""}
      <div class="panel">
        <div class="detail-price">${formatPrice(l.price, l.purpose)}</div>
        <h1 class="detail-title">${esc(l.title)}</h1>
        <div class="prop-loc" style="margin-top:8px">${ICON.pin}${esc(l.location ? l.location + ", " : "")}${esc(l.city)}</div>
      </div>
      <div class="panel"><h2>Overview</h2><div class="spec-grid">${specs.map(([k, v]) => `<div class="spec"><small>${k}</small><b>${v}</b></div>`).join("")}</div></div>
      <div class="panel"><h2>Description</h2><div class="desc">${esc(l.description || "No description provided.")}</div></div>
      <div class="panel"><h2>Location</h2>
        <iframe title="Map" style="width:100%;height:300px;border:0;border-radius:12px" loading="lazy"
          src="https://maps.google.com/maps?q=${encodeURIComponent((l.location || "") + ", " + l.city + ", Pakistan")}&z=13&output=embed"></iframe></div>
    </div>
    <aside>
      <div class="side-card">
        <div class="agent"><span class="avatar">${esc((l.ownerName || "Z")[0].toUpperCase())}</span><div><b>${esc(l.ownerName || "Zameen Online")}</b><small>Posted ${timeAgo(l.createdAt)}</small></div></div>
        <a class="btn btn-primary btn-block btn-lg" href="tel:${esc(phone.replace(/\s/g, ""))}">${ICON.phone.replace("<svg", '<svg width="18" height="18"')} Call ${esc(phone)}</a>
        <a class="btn btn-green btn-block btn-lg" target="_blank" rel="noopener" href="${waLink(wa, `Assalam o Alaikum, I am interested in your property on Zameen Online: ${l.title} — ${url}`)}">${ICON.wa.replace("<svg", '<svg width="18" height="18"')} WhatsApp</a>
        <form id="inq" style="margin-top:14px;border-top:1px solid var(--border);padding-top:16px">
          <b style="display:block;margin-bottom:10px">Send a message</b>
          <div class="form-group"><input class="field" name="name" placeholder="Your name" required value="${esc(u?.name || "")}"></div>
          <div class="form-group"><input class="field" name="phone" placeholder="Your phone number" required value="${esc(u?.phone || "")}"></div>
          <div class="form-group"><textarea class="field" name="message" rows="3" style="min-height:90px">I am interested in this property. Please contact me.</textarea></div>
          <button class="btn btn-accent btn-block" type="submit">Send Inquiry</button>
        </form>
        <button class="btn btn-outline btn-block" id="share" style="margin-top:10px">Share this property</button>
      </div>
    </aside>
  </div>`;

  const btnInlineApprove = $("#btn-inline-approve");
  if (btnInlineApprove) {
    btnInlineApprove.onclick = async () => {
      btnInlineApprove.disabled = true;
      btnInlineApprove.textContent = "Approving…";
      try {
        await approveListing(l.id);
        toast("✓ Ad approved & published live!");
        setTimeout(() => location.reload(), 600);
      } catch (err) {
        toast("Failed: " + (err.message || err), 5000);
        btnInlineApprove.disabled = false;
        btnInlineApprove.textContent = "✓ Approve & Publish Live";
      }
    };
  }

  const btnInlineReject = $("#btn-inline-reject");
  if (btnInlineReject) {
    btnInlineReject.onclick = async () => {
      const reason = prompt("Reason for rejecting this ad (optional):", "");
      if (reason === null) return;
      btnInlineReject.disabled = true;
      try {
        await rejectListing(l.id, reason.trim() || "Rejected by moderator");
        toast("Ad rejected");
        setTimeout(() => location.reload(), 600);
      } catch (err) {
        toast("Failed: " + (err.message || err), 5000);
        btnInlineReject.disabled = false;
      }
    };
  }

  $$(".thumbs img").forEach(t => t.onclick = () => {
    $("#main-img").src = imgs[+t.dataset.i];
    $$(".thumbs img").forEach(x => x.classList.toggle("active", x === t));
  });
  $("#inq").onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(e.target), btn = e.target.querySelector("button");
    btn.disabled = true;
    try {
      await addInquiry({ listingId: l.id, listingTitle: l.title, ownerId: l.ownerId, name: f.get("name"), phone: f.get("phone"), message: f.get("message") });
      e.target.innerHTML = '<div class="alert alert-ok">Thank you! Your message has been sent. The advertiser will contact you soon.</div>';
    } catch (err) { console.error(err); toast("Could not send. Please call or WhatsApp instead."); btn.disabled = false; }
  };
  $("#share").onclick = async () => {
    try { if (navigator.share) await navigator.share({ title: l.title, url }); else { await navigator.clipboard.writeText(url); toast("Link copied"); } } catch {}
  };

  const others = (await getApprovedListings()).filter(x => x.id !== l.id);
  const sim = [...others.filter(x => x.city === l.city && x.type === l.type), ...others.filter(x => x.city === l.city && x.type !== l.type), ...others.filter(x => x.city !== l.city && x.type === l.type)].slice(0, 3);
  if (sim.length) { $("#similar").innerHTML = sim.map(propertyCard).join(""); hydrateThumbs($("#similar")); } else $("#similar-wrap").remove();
}
