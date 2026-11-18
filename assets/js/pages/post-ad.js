import { requireUser, isAdminRole, $, $$, esc, cityOptions, typeOptions, formatPrice, compressImage, toast } from "../app.js?v=20261118_02";
import { createListing, updateListing, getListing, getPhotos, getMyListings, isGlobalAdmin, LIVE } from "../db.js?v=20261118_02";
import { PACKAGES } from "../seed.js";

// Make a smaller copy of an image data URL (used for thumbnails & safe Firestore fit)
const shrink = (src, max, q) => new Promise((res, rej) => {
  const img = new Image();
  img.onload = () => {
    const k = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement("canvas");
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    res(c.toDataURL("image/jpeg", q));
  };
  img.onerror = rej;
  img.src = src;
});

async function fitImagesForFirestore(imgs) {
  let out = [...imgs];
  const totalBytes = arr => arr.reduce((s, x) => s + x.length, 0);
  if (!LIVE || totalBytes(out) <= 820000) return out;

  // Progressively compress uploaded data URLs so they stay comfortably under Firestore's 1 MiB limit
  const steps = [
    [900, 0.55],
    [760, 0.48],
    [640, 0.42]
  ];
  for (const [maxDim, quality] of steps) {
    out = await Promise.all(out.map(src => src.startsWith("data:") ? shrink(src, maxDim, quality) : src));
    if (totalBytes(out) <= 820000) return out;
  }
  return out;
}

const u = await requireUser();
if (u) {
  const form = $("#ad-form");
  const editId = new URLSearchParams(location.search).get("id");
  let existingListing = null;
  let purpose = "sale", images = [];
  let quotaBlocked = false;

  $("#type").innerHTML = typeOptions("", "Select type");
  $("#city").innerHTML = cityOptions("Mirpur AJK", "Select city");
  const nums = n => Array.from({ length: n }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join("");
  $("#beds").insertAdjacentHTML("beforeend", nums(10) + '<option value="11">10+</option>');
  $("#baths").insertAdjacentHTML("beforeend", nums(10));
  form.phone.value = u.phone || "";

  const setPurpose = p => {
    purpose = p;
    $$("[data-purpose]").forEach(b => b.classList.toggle("active", b.dataset.purpose === p));
    $("#price-label").textContent = p === "rent" ? "Monthly rent (PKR) *" : "Price (PKR) *";
    showWords();
  };
  $$("[data-purpose]").forEach(b => b.onclick = () => setPurpose(b.dataset.purpose));
  const showWords = () => $("#price-words").innerHTML = form.price.value ? formatPrice(form.price.value, purpose) : "";
  form.price.oninput = showWords;
  const roomsVisible = () => $("#rooms").style.display = ["plot", "land"].includes(form.type.value) ? "none" : "";
  form.type.onchange = roomsVisible;

  const renderPreviews = () => {
    $("#previews").innerHTML = images.map((s, i) => `<div><img src="${esc(s)}" alt=""><button type="button" data-rm="${i}" aria-label="Remove">✕</button></div>`).join("");
    $$("[data-rm]").forEach(b => b.onclick = () => { images.splice(+b.dataset.rm, 1); renderPreviews(); });
  };
  $("#photos").onchange = async e => {
    const files = [...e.target.files].slice(0, 6 - images.length);
    if (e.target.files.length > files.length) toast("Maximum 6 photos");
    for (const f of files) {
      try { images.push(await compressImage(f, 1100, 0.62)); } catch { toast("Could not read " + f.name); }
    }
    e.target.value = ""; renderPreviews();
  };

  const msg = (t, ok) => {
    form.querySelector(".msg").innerHTML = t ? `<div class="alert ${ok ? "alert-ok" : "alert-error"}">${t}</div>` : "";
    if (t) form.scrollIntoView({ behavior: "smooth" });
  };

  // Edit mode — allow ad owner OR any admin/staff role
  if (editId) {
    const l = await getListing(editId).catch(() => null);
    if (!l || (l.ownerId !== u.uid && !isAdminRole(u.role))) {
      location.href = "dashboard.html";
    } else {
      existingListing = l;
      $("#h").textContent = "Edit Your Ad";
      $("#submit").textContent = "Save Changes";
      for (const k of ["type", "city", "location", "title", "price", "area", "areaUnit", "beds", "baths", "description", "phone", "whatsapp"]) {
        if (form[k] && l[k] != null) form[k].value = l[k];
      }
      images = [...await getPhotos(l)];
      renderPreviews();
      setPurpose(l.purpose || "sale");
      roomsVisible();
    }
  }

  // Check quota limit for new property submissions
  const plan = PACKAGES.find(p => p.name === (u.plan || "Basic")) || PACKAGES[0];
  const maxAds = isAdminRole(u.role) ? 99999 : (plan.ads || 1);

  if (!editId && !isAdminRole(u.role)) {
    try {
      const ads = await getMyListings(u.uid);
      if (ads.length >= maxAds) {
        quotaBlocked = true;
        msg(`<b>⚠️ Ad Quota Reached (${ads.length}/${maxAds} Used):</b> You have reached your limit of ${maxAds} property ad(s) on the <b>${esc(plan.name)}</b> plan. <a href="packages.html" style="color:var(--primary);font-weight:700;text-decoration:underline">Upgrade your package to post more properties →</a>`);
        const submitBtn = $("#submit");
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = "Quota Full — Upgrade Package";
        }
      }
    } catch (err) {
      console.error("Quota check warning:", err);
    }
  }

  form.onsubmit = async e => {
    e.preventDefault();
    if (quotaBlocked) return;
    msg("");

    const f = new FormData(form);
    if (!images.length) return msg("Please add at least one photo — ads with photos get 10× more calls.");

    const btn = $("#submit");
    btn.disabled = true;
    btn.textContent = "Saving…";

    try {
      const fittedImages = await fitImagesForFirestore(images);
      const size = fittedImages.reduce((s, x) => s + x.length, 0);
      if (LIVE && size > 860000) {
        btn.disabled = false;
        btn.textContent = editId ? "Save Changes" : "Submit Ad";
        return msg("Photos are still too large together. Please remove one or two photos and try again.");
      }

      const data = {
        purpose,
        type: f.get("type"),
        city: f.get("city"),
        location: f.get("location").trim(),
        title: f.get("title").trim(),
        price: Number(f.get("price")),
        area: Number(f.get("area")),
        areaUnit: f.get("areaUnit"),
        beds: ["plot", "land"].includes(f.get("type")) ? 0 : Number(f.get("beds")),
        baths: ["plot", "land"].includes(f.get("type")) ? 0 : Number(f.get("baths")),
        description: f.get("description").trim(),
        phone: f.get("phone").trim(),
        whatsapp: (f.get("whatsapp") || f.get("phone")).replace(/\D/g, "").replace(/^0/, "92")
      };

      const firstUpload = fittedImages.find(s => s.startsWith("data:"));
      let media = null;
      if (firstUpload) {
        media = { images: fittedImages, thumb: await shrink(firstUpload, 480, 0.58) };
      } else {
        data.images = fittedImages;
        data.photoCount = 0;
      }

      if (editId) {
        const updatePayload = isAdminRole(u.role)
          ? data
          : {
              ...data,
              ownerId: existingListing?.ownerId || u.uid,
              featured: !!existingListing?.featured,
              status: "pending"
            };
        await updateListing(editId, updatePayload, media);
        location.href = isAdminRole(u.role) ? "admin.html" : "dashboard.html?saved=1";
      } else {
        await createListing(data, media);
        location.href = isGlobalAdmin(u) ? "dashboard.html?posted=live" : "dashboard.html?posted=1";
      }
    } catch (err) {
      console.error(err);
      msg("Could not save your ad: " + (err.message || err));
      btn.disabled = false;
      btn.textContent = editId ? "Save Changes" : "Submit Ad";
    }
  };
}
