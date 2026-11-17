// =========================================================
//  Data layer — Firebase (live) or local demo storage.
//  Every page talks to the site only through these functions.
// =========================================================
import { firebaseConfig } from "./firebase-config.js";
import { SEED_LISTINGS, SEED_DEALERS, SEED_SERVICES } from "./seed.js";

export const LIVE = !!(firebaseConfig.apiKey && firebaseConfig.projectId);
const V = "10.12.2";
const FB = `https://www.gstatic.com/firebasejs/${V}`;

let fs, fa, app, db, auth, appMod;
let currentUser = null;          // { uid, name, email, phone, role }
const authListeners = [];
let authReady;

/* ---------------------------------------------------------
   DEMO backend (browser storage)
--------------------------------------------------------- */
const KEY = "zo_demo_v1";
const memory = {};
function store() {
  let s;
  try { s = JSON.parse(localStorage.getItem(KEY)); } catch { s = memory[KEY]; }
  if (!s) {
    s = {
      listings: SEED_LISTINGS, 
      dealers: SEED_DEALERS, 
      services: SEED_SERVICES, 
      inquiries: [],
      users: [
        { uid: "admin-1", name: "Ijaz Chaudhry", email: "admin@zameen.online", password: "admin", phone: "+92 344 0807888", role: "super_admin", plan: "Elite", createdAt: Date.now() - 30 * 86400000 },
        { uid: "dist-1", name: "Raja Farooq (Mirpur)", email: "mirpur@zameen.online", password: "admin", phone: "+92 345 1122334", role: "district_admin", assignedDistricts: ["Mirpur AJK", "Bhimber"], plan: "Basic", createdAt: Date.now() - 15 * 86400000 },
        { uid: "dealer-1", name: "Kashmir Estate Advisors", email: "dealer@zameen.online", password: "admin", phone: "+92 344 0807888", role: "dealer", plan: "Platinum", createdAt: Date.now() - 10 * 86400000 },
        { uid: "user-1", name: "Tariq Mehmood", email: "user@zameen.online", password: "user123", phone: "+92 300 9876543", role: "user", plan: "Basic", createdAt: Date.now() - 5 * 86400000 }
      ],
      session: null
    };
    save(s);
  }
  return s;
}
function save(s) {
  memory[KEY] = s;
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage full or blocked — keep in memory */ }
}
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const publicUser = u => u && ({
  uid: u.uid,
  name: u.name,
  email: u.email,
  phone: u.phone,
  role: u.role || "user",
  plan: u.plan || "Basic",
  assignedDistricts: Array.isArray(u.assignedDistricts) ? u.assignedDistricts : (u.district ? [u.district] : [])
});

export const OWNER_EMAILS = [
  "ijaz03165016000@gmail.com",
  "admin@zameen.online",
  "info@zameen.online"
];

/* ---------------------------------------------------------
   Init
--------------------------------------------------------- */
async function initLive() {
  const [aMod, fsMod, authMod] = await Promise.all([
    import(`${FB}/firebase-app.js`), import(`${FB}/firebase-firestore.js`), import(`${FB}/firebase-auth.js`)
  ]);
  appMod = aMod; fs = fsMod; fa = authMod;
  app = appMod.initializeApp(firebaseConfig);
  db = fs.getFirestore(app);
  auth = fa.getAuth(app);
  authReady = new Promise(resolve => {
    fa.onAuthStateChanged(auth, async fbUser => {
      if (fbUser) {
        const snap = await fs.getDoc(fs.doc(db, "users", fbUser.uid));
        const p = snap.exists() ? snap.data() : {};
        const emailLower = (fbUser.email || "").toLowerCase();
        const nameLower = (p.name || fbUser.displayName || "").toLowerCase();
        const isOwner = emailLower.includes("ijaz") || 
                        nameLower.includes("ijaz") || 
                        OWNER_EMAILS.includes(emailLower);
        const resolvedRole = isOwner ? "super_admin" : (p.role || "user");

        // Self-heal: If owner's role in Firestore document was accidentally changed, restore it automatically!
        if (isOwner && p.role !== "super_admin") {
          fs.setDoc(fs.doc(db, "users", fbUser.uid), { 
            role: "super_admin",
            plan: "Elite",
            assignedDistricts: [] 
          }, { merge: true }).catch(err => {
            console.warn("Auto-restore in Firestore blocked by security rules:", err);
          });
        }

        currentUser = { 
          uid: fbUser.uid, 
          email: fbUser.email, 
          name: p.name || fbUser.displayName || fbUser.email, 
          phone: p.phone || "", 
          role: resolvedRole, 
          plan: isOwner ? "Elite" : (p.plan || "Basic"),
          assignedDistricts: isOwner ? [] : (Array.isArray(p.assignedDistricts) ? p.assignedDistricts : (p.district ? [p.district] : []))
        };
      } else currentUser = null;
      authListeners.forEach(cb => cb(currentUser));
      resolve(currentUser);
    });
  });
}

export const ready = (async () => {
  if (LIVE) {
    try { await initLive(); await authReady; }
    catch (e) { console.error("Firebase failed to load", e); }
  } else {
    const s = store();
    currentUser = publicUser(s.users.find(u => u.uid === s.session));
  }
})();

/* ---------------------------------------------------------
   Auth
--------------------------------------------------------- */
export function getUser() { return currentUser; }
export function onAuth(cb) { authListeners.push(cb); }
const emit = () => authListeners.forEach(cb => cb(currentUser));

export async function signUp({ name, email, password, phone, role = "user" }) {
  role = role === "dealer" ? "dealer" : "user";         // nobody can sign up as admin
  if (LIVE) {
    const cred = await fa.createUserWithEmailAndPassword(auth, email, password);
    await fa.updateProfile(cred.user, { displayName: name });
    await fs.setDoc(fs.doc(db, "users", cred.user.uid), { name, email, phone, role, plan: "Basic", createdAt: fs.serverTimestamp() });
    if (role === "dealer") {
      await fs.setDoc(fs.doc(db, "dealers", cred.user.uid), { name, owner: name, city: "Mirpur AJK", phone, whatsapp: phone.replace(/\D/g, "").replace(/^0/, "92"), verified: false, plan: "Basic", listings: 0, about: "", createdAt: fs.serverTimestamp() }).catch(console.error);
    }
    currentUser = { uid: cred.user.uid, name, email, phone, role, plan: "Basic" };
    emit();
    return currentUser;
  }
  const s = store();
  if (s.users.some(u => u.email.toLowerCase() === email.toLowerCase())) throw new Error("An account with this email already exists.");
  const u = { uid: uid(), name, email, password, phone, role, plan: "Basic", createdAt: Date.now() };
  s.users.push(u); s.session = u.uid; save(s);
  if (role === "dealer") {
    s.dealers.unshift({ id: u.uid, name, owner: name, city: "Mirpur AJK", phone, whatsapp: phone.replace(/\D/g, "").replace(/^0/, "92"), verified: false, plan: "Basic", listings: 0, about: "", createdAt: Date.now() });
    save(s);
  }
  currentUser = publicUser(u); emit();
  return currentUser;
}

/* Super Admin / Admin creates a new user or dealer login account without being logged out */
export async function adminCreateAccount({ name, email, password, phone, role = "dealer", plan = "Basic", agencyName = "", city = "Mirpur AJK", verified = true, assignedDistricts = [] }) {
  if (LIVE) {
    if (!appMod || !fa) await initLive();
    const tempApp = appMod.initializeApp(firebaseConfig, "TempAdminCreateUserApp_" + Math.random().toString(36).slice(2, 9));
    const tempAuth = fa.getAuth(tempApp);

    try {
      const cred = await fa.createUserWithEmailAndPassword(tempAuth, email, password);
      if (name) {
        await fa.updateProfile(cred.user, { displayName: name }).catch(() => {});
      }
      const newUid = cred.user.uid;

      const userDoc = {
        name: name || "Member",
        email: email.toLowerCase(),
        phone: phone || "",
        role: role || "user",
        plan: plan || "Basic",
        city: city || "Mirpur AJK",
        assignedDistricts: role === "district_admin" ? (assignedDistricts?.length ? assignedDistricts : [city || "Mirpur AJK"]) : [],
        createdAt: fs.serverTimestamp(),
        createdByAdmin: currentUser?.uid || "admin"
      };
      await fs.setDoc(fs.doc(db, "users", newUid), userDoc);

      if (role === "dealer") {
        const dealerDoc = {
          name: agencyName || name || "Real Estate Agency",
          owner: name || "",
          city: city || "Mirpur AJK",
          phone: phone || "",
          whatsapp: phone ? String(phone).replace(/\D/g, "").replace(/^0/, "92") : "",
          verified: !!verified,
          plan: plan || "Basic",
          about: "Official registered real estate dealer on Zameen Online.",
          listings: 0,
          createdAt: fs.serverTimestamp()
        };
        await fs.setDoc(fs.doc(db, "dealers", newUid), dealerDoc);
      }

      await fa.signOut(tempAuth);
      return { uid: newUid, ...userDoc };
    } finally {
      try {
        await appMod.deleteApp(tempApp);
      } catch (err) {
        console.warn("Could not delete temporary app:", err);
      }
    }
  } else {
    const s = store();
    if (s.users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
      throw new Error("An account with this email already exists.");
    }
    const newUid = uid();
    const newUser = {
      uid: newUid,
      id: newUid,
      name: name || "Member",
      email: email.toLowerCase(),
      password,
      phone: phone || "",
      role: role || "user",
      plan: plan || "Basic",
      assignedDistricts: role === "district_admin" ? (assignedDistricts?.length ? assignedDistricts : [city || "Mirpur AJK"]) : [],
      createdAt: Date.now()
    };
    s.users.push(newUser);
    if (role === "dealer") {
      s.dealers.unshift({
        id: newUid,
        name: agencyName || name || "Real Estate Agency",
        owner: name || "",
        city: city || "Mirpur AJK",
        phone: phone || "",
        whatsapp: phone ? String(phone).replace(/\D/g, "").replace(/^0/, "92") : "",
        verified: !!verified,
        plan: plan || "Basic",
        listings: 0,
        about: "Official registered real estate dealer on Zameen Online.",
        createdAt: Date.now()
      });
    }
    save(s);
    return newUser;
  }
}

export async function signIn(email, password) {
  if (LIVE) { await fa.signInWithEmailAndPassword(auth, email, password); await new Promise(r => setTimeout(r, 400)); return currentUser; }
  const s = store();
  const u = s.users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
  if (!u) throw new Error("Incorrect email or password.");
  s.session = u.uid; save(s);
  currentUser = publicUser(u); emit();
  return currentUser;
}

export async function resetPassword(email) {
  if (LIVE) return fa.sendPasswordResetEmail(auth, email);
  throw new Error("Password reset emails work once Firebase is connected.");
}

export async function signOut() {
  if (LIVE) await fa.signOut(auth);
  else { const s = store(); s.session = null; save(s); }
  currentUser = null; emit();
}

/* ---------------------------------------------------------
   Generic collection helpers
--------------------------------------------------------- */
const toMs = v => (v && typeof v.toMillis === "function") ? v.toMillis() : (v || 0);
const norm = (id, d) => ({ id, ...d, createdAt: toMs(d.createdAt) });

async function list(col, ...where) {
  if (LIVE) {
    const q = where.length ? fs.query(fs.collection(db, col), ...where.map(w => fs.where(...w))) : fs.collection(db, col);
    const snap = await fs.getDocs(q);
    return snap.docs.map(d => norm(d.id, d.data())).sort((a, b) => b.createdAt - a.createdAt);
  }
  let rows = store()[col] || [];
  for (const [f, op, v] of where) rows = rows.filter(r => op === "==" ? r[f] === v : true);
  return [...rows].sort((a, b) => b.createdAt - a.createdAt);
}
async function get(col, id) {
  if (LIVE) { const d = await fs.getDoc(fs.doc(db, col, id)); return d.exists() ? norm(d.id, d.data()) : null; }
  return (store()[col] || []).find(r => r.id === id) || null;
}
async function add(col, data) {
  if (LIVE) { const ref = await fs.addDoc(fs.collection(db, col), { ...data, createdAt: fs.serverTimestamp() }); return ref.id; }
  const s = store(); const id = uid(); s[col].unshift({ ...data, id, createdAt: Date.now() }); save(s); return id;
}
async function setDoc(col, id, data) {
  if (LIVE) return fs.setDoc(fs.doc(db, col, id), { ...data, createdAt: data.createdAt ? fs.Timestamp.fromMillis(data.createdAt) : fs.serverTimestamp() }, { merge: true });
  const s = store(); const i = s[col].findIndex(r => r.id === id);
  if (i >= 0) s[col][i] = { ...s[col][i], ...data }; else s[col].unshift({ ...data, id, createdAt: data.createdAt || Date.now() });
  save(s);
}
async function update(col, id, data) {
  if (LIVE) return fs.updateDoc(fs.doc(db, col, id), data);
  const s = store(); const r = s[col].find(r => r.id === id); if (r) Object.assign(r, data); save(s);
}
async function remove(col, id) {
  if (LIVE) return fs.deleteDoc(fs.doc(db, col, id));
  const s = store(); s[col] = s[col].filter(r => r.id !== id); save(s);
}

/* ---------------------------------------------------------
   Listings
--------------------------------------------------------- */
export const getApprovedListings = () => list("listings", ["status", "==", "approved"]);
export const getListing = id => get("listings", id);
export const getMyListings = uid => list("listings", ["ownerId", "==", uid]);
export const getAllListings = () => list("listings");

/* Uploaded photos are kept out of the listing document so that
   browsing stays fast:  thumbs/{id} = { src }   (one small image)
                         photos/{id} = { images } (full-size photos)  */
async function rawSet(col, id, data) {
  if (LIVE) return fs.setDoc(fs.doc(db, col, id), data);
  const s = store(); s[col] = (s[col] || []).filter(r => r.id !== id); s[col].push({ id, ...data }); save(s);
}
async function rawGet(col, id) {
  if (LIVE) { const d = await fs.getDoc(fs.doc(db, col, id)); return d.exists() ? d.data() : null; }
  return (store()[col] || []).find(r => r.id === id) || null;
}
async function saveMedia(id, media) {
  if (!media) return;
  await rawSet("thumbs", id, { src: media.thumb || "" });
  await rawSet("photos", id, { images: media.images || [] });
}
const thumbCache = new Map();
export async function getThumbs(ids) {
  const need = ids.filter(id => !thumbCache.has(id));
  await Promise.all(need.map(async id => {
    try { const t = await rawGet("thumbs", id); thumbCache.set(id, t?.src || ""); } catch { thumbCache.set(id, ""); }
  }));
  return Object.fromEntries(ids.map(id => [id, thumbCache.get(id)]));
}
/* All photos for a listing: uploaded ones, else image URLs saved on the listing */
export async function getPhotos(l) {
  if (l.photoCount) { try { const p = await rawGet("photos", l.id); if (p?.images?.length) return p.images; } catch {} }
  return l.images || [];
}

export async function createListing(data, media) {
  const u = currentUser; if (!u) throw new Error("Please sign in first.");
  const status = u.role === "admin" ? "approved" : "pending";
  const id = await add("listings", { ...data, photoCount: media?.images?.length || 0, ownerId: u.uid, ownerName: u.name, status, featured: false, views: 0 });
  await saveMedia(id, media);
  return id;
}
export async function updateListing(id, data, media) {
  await update("listings", id, media ? { ...data, photoCount: media.images.length, images: [] } : data);
  if (media) { await saveMedia(id, media); thumbCache.delete(id); }
}
export async function deleteListing(id) {
  await remove("listings", id);
  for (const col of ["thumbs", "photos"]) {
    try { if (LIVE) await fs.deleteDoc(fs.doc(db, col, id)); else { const s = store(); s[col] = (s[col] || []).filter(r => r.id !== id); save(s); } } catch {}
  }
}
export async function addView(id) {
  try {
    if (LIVE) await fs.updateDoc(fs.doc(db, "listings", id), { views: fs.increment(1) });
    else { const l = await get("listings", id); if (l) await update("listings", id, { views: (l.views || 0) + 1 }); }
  } catch { /* views are best-effort */ }
}

/* ---------------------------------------------------------
   Dealers, services, inquiries, users
--------------------------------------------------------- */
export const getDealers = () => list("dealers");
export const getDealer = id => get("dealers", id);
export const saveDealer = (id, data) => (id && id !== "undefined") ? setDoc("dealers", id, data) : add("dealers", data);
export const deleteDealer = id => remove("dealers", id);

export const getServices = () => list("services");
export const saveService = (id, data) => (id && id !== "undefined") ? setDoc("services", id, data) : add("services", data);
export const deleteService = id => remove("services", id);

export const addInquiry = data => add("inquiries", { ...data, read: false });
export const getInquiries = () => list("inquiries");
export const getMyInquiries = uid => list("inquiries", ["ownerId", "==", uid]);
export const markInquiry = (id, read) => update("inquiries", id, { read });
export const deleteInquiry = id => remove("inquiries", id);

export async function getUsers() {
  if (LIVE) return list("users");
  return store().users.map(u => ({ id: u.uid, ...publicUser(u), createdAt: u.createdAt }));
}
export async function updateUser(id, data) {
  if (LIVE) return fs.setDoc(fs.doc(db, "users", id), data, { merge: true });
  const s = store(); const u = s.users.find(u => u.uid === id || u.id === id); if (u) Object.assign(u, data); save(s);
}

/* Multi-Tier Role checks & Moderation */
export const isSuperAdmin = u => ["super_admin", "admin"].includes((u || currentUser)?.role);
export const isGlobalAdmin = u => ["super_admin", "admin"].includes((u || currentUser)?.role);
export const isDistrictAdmin = (city, u) => {
  const user = u || currentUser;
  if (!user) return false;
  if (isGlobalAdmin(user)) return true;
  if (user.role === "district_admin") {
    const list = user.assignedDistricts || [];
    return list.includes(city);
  }
  return false;
};

export async function approveListing(id, note = "") {
  const u = currentUser;
  const modData = {
    status: "approved",
    moderatedBy: u?.uid || "admin",
    moderatedByName: u?.name || "Admin",
    moderatedAt: Date.now(),
    moderationNote: note || "Approved"
  };
  return updateListing(id, modData);
}

export async function rejectListing(id, reason = "") {
  const u = currentUser;
  const modData = {
    status: "rejected",
    moderatedBy: u?.uid || "admin",
    moderatedByName: u?.name || "Admin",
    moderatedAt: Date.now(),
    moderationNote: reason || "Rejected by moderator"
  };
  return updateListing(id, modData);
}

export async function setUserRole(uid, { role, assignedDistricts, plan, city, verified, agencyName }) {
  const updates = {
    role: role || "user",
    plan: plan || "Basic",
    updatedAt: Date.now()
  };
  if (assignedDistricts !== undefined) {
    updates.assignedDistricts = Array.isArray(assignedDistricts) ? assignedDistricts : [assignedDistricts];
  }
  if (city) updates.city = city;

  // 1. Update/merge user document in users collection
  await updateUser(uid, updates);

  // 2. If assigning dealer role, ensure document in 'dealers' collection exists and is synced!
  if (role === "dealer") {
    const userDoc = (await get("users", uid)) || {};
    const existingDealer = (await getDealer(uid)) || {};
    
    const dealerPayload = {
      name: agencyName || existingDealer.name || userDoc.name || "Dealer Agency",
      owner: existingDealer.owner || userDoc.name || "",
      city: city || existingDealer.city || (updates.assignedDistricts?.[0]) || "Mirpur AJK",
      phone: existingDealer.phone || userDoc.phone || "",
      whatsapp: existingDealer.whatsapp || (userDoc.phone ? String(userDoc.phone).replace(/\D/g, "").replace(/^0/, "92") : ""),
      verified: verified !== undefined ? !!verified : (existingDealer.verified || false),
      plan: plan || userDoc.plan || "Basic",
      about: existingDealer.about || "",
      listings: existingDealer.listings || 0
    };
    await saveDealer(uid, dealerPayload);
  }
}

export async function claimSuperAdmin() {
  if (currentUser) {
    currentUser.role = "super_admin";
    currentUser.plan = "Elite";
    currentUser.assignedDistricts = [];
    if (LIVE) {
      await fs.setDoc(fs.doc(db, "users", currentUser.uid), { 
        role: "super_admin", 
        plan: "Elite",
        assignedDistricts: [] 
      }, { merge: true });
    } else {
      const s = store();
      const u = s.users.find(x => x.uid === currentUser.uid || x.id === currentUser.uid);
      if (u) {
        u.role = "super_admin";
        u.plan = "Elite";
        u.assignedDistricts = [];
      }
      save(s);
    }
    emit();
  }
}
export async function updateProfile(data) {
  if (!currentUser) return;
  if (LIVE) await fs.updateDoc(fs.doc(db, "users", currentUser.uid), data);
  else { const s = store(); Object.assign(s.users.find(u => u.uid === currentUser.uid), data); save(s); }
  Object.assign(currentUser, data); emit();
}

/* Admin: copy the sample listings / dealers / services into Firestore */
export async function loadSampleData() {
  for (const d of SEED_DEALERS) await setDoc("dealers", d.id, d);
  for (const s of SEED_SERVICES) await setDoc("services", s.id, s);
  for (const l of SEED_LISTINGS) await setDoc("listings", l.id, { ...l, ownerId: currentUser.uid });
}
export function resetDemo() { try { localStorage.removeItem(KEY); } catch {} delete memory[KEY]; }
