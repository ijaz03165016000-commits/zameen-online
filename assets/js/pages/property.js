import { initPage, $, $$, esc, params, formatPrice, typeLabel, timeAgo, ICON, waLink, propertyCard, toast, favs, fallbackImg, isAJK, hydrateThumbs } from "../app.js";
import { getListing, getApprovedListings, addView, addInquiry, getUser, getPhotos } from "../db.js?v=20261118_01";
import { SITE } from "../firebase-config.js";

await initPage();
const id = params().id;
const box = $("#detail");
const l = id ? await getListing(id).catch(() => null) : null;
const u = getUser();
const canSee = l && (l.status === "approved" || (u && (u.uid === l.ownerId || u.role === "admin")));

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
    ["City", esc(l.city)], ["Added", timeAgo(l.createdAt)], ["Views", (l.views || 0) + 1]
  ];
  box.innerHTML = `
  <div class="detail-layout">
    <div>
      <div class="crumbs" style="color:var(--muted);opacity:1;margin-bottom:14px"><a href="index.html">Home</a> › <a href="listings.html?city=${encodeURIComponent(l.city)}">${esc(l.city)}</a> › ${esc(typeLabel(l.type))}</div>
      ${l.status !== "approved" ? `<div class="alert alert-info">This ad is <b>${esc(l.status)}</b> — only you and the admin can see it until it is approved.</div>` : ""}
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
