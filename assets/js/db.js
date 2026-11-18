// =========================================================
//  Data layer — Firebase (live) or local demo storage.
//  Real-time Firestore subscriptions + strict auth/role sync.
// =========================================================
import { firebaseConfig } from "./firebase-config.js";
import { SEED_LISTINGS, SEED_DEALERS, SEED_SERVICES } from "./seed.js";

export const LIVE = !!(firebaseConfig.apiKey && firebaseConfig.projectId);
const V = "10.12.2";
const FB = `https://www.gstatic.com/firebasejs/${V}`;

let fs, fa, app, db, auth, appMod;
let currentUser = null; // { uid, name, email, phone, role, firestoreRole, plan, assignedDistricts, isOwner }
const authListeners = [];
let sdkReady = null;
let authReady = null;
let pendingAuthWrite = null; // Prevents onAuthStateChanged from reading before signUp writes user doc

/* Exact owner email whitelist — never wildcard-match names or substrings */
export const OWNER_EMAILS = [
  "ijaz03165016000@gmail.com",
  "admin@zameen.online",
  "info@zameen.online"
];

export const isOwnerEmail = email => OWNER_EMAILS.includes(String(email || "").trim().toLowerCase());

/* ---------------------------------------------------------
   Error helpers
--------------------------------------------------------- */
export function isPermissionError(err) {
  if (!err) return false;
  const code = String(err.code || "").toLowerCase();
  const msg = String(err.message || "").toLowerCase();
  return code === "permission-denied" || msg.includes("missing or insufficient permissions") || msg.includes("permission-denied");
}

function wrapFirestoreError(err, action = "complete this action") {
  if (isPermissionError(err)) {
    const wrapped = new Error(`Firestore Permission Denied while trying to ${action}. Publish the latest firestore.rules in Firebase Console or verify your account permissions.`);
    wrapped.code = "permission-denied";
    wrapped.original = err;
    return wrapped;
  }
  return err;
}

/* ---------------------------------------------------------
   DEMO backend (browser storage + live subscriber bus)
--------------------------------------------------------- */
const KEY = "zo_demo_v1";
const memory = {};
const demoSubs = new Set();

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

function notifyDemoSubs(col) {
  demoSubs.forEach(sub => {
    if (!col || sub.col === col) {
      try { sub.emit(); } catch (e) { console.error(e); }
    }
  });
}

function save(s, changedCol = null) {
  memory[KEY] = s;
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage full or blocked */ }
  notifyDemoSubs(changedCol);
}

if (typeof window !== "undefined" && !LIVE) {
  window.addEventListener("storage", e => {
    if (e.key === KEY) notifyDemoSubs(null);
  });
}

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const publicUser = u => u && ({
  uid: u.uid,
  name: u.name,
  email: u.email,
  phone: u.phone,
  role: u.role || "user",
  firestoreRole: u.role || "user",
  plan: u.plan || "Basic",
  isOwner: isOwnerEmail(u.email),
  assignedDistricts: Array.isArray(u.assignedDistricts) ? u.assignedDistricts : (u.district ? [u.district] : [])
});

/* ---------------------------------------------------------
   Firebase Initialization & Profile Hydration
--------------------------------------------------------- */
async function hydrateUser(fbUser) {
  if (!fbUser) {
    currentUser = null;
    return null;
  }

  let p = {};
  let docExists = false;
  try {
    const snap = await fs.getDoc(fs.doc(db, "users", fbUser.uid));
    docExists = snap.exists();
    if (docExists) p = snap.data() || {};
  } catch (err) {
    console.warn("Could not read user profile doc:", err);
  }

  const emailLower = (fbUser.email || "").trim().toLowerCase();
  const isOwner = isOwnerEmail(emailLower);

  // Determine UI role accurately:
  // - Exact whitelisted owner emails are always super_admin in UI
  // - Promoted super admins have { role: "admin", isSuperAdmin: true } in Firestore
  // - Everyone else gets their exact Firestore role (default "user")
  let resolvedRole = "user";
  if (isOwner) {
    resolvedRole = "super_admin";
  } else if (p.role === "super_admin" || (p.role === "admin" && p.isSuperAdmin === true)) {
    resolvedRole = "super_admin";
  } else if (p.role) {
    resolvedRole = p.role;
  }

  // Self-heal owner doc to role: 'admin' + isSuperAdmin: true (compatible with both legacy & updated rules)
  if (isOwner && (!docExists || p.role !== "admin" || !p.isSuperAdmin)) {
    fs.setDoc(fs.doc(db, "users", fbUser.uid), {
      name: p.name || fbUser.displayName || "Admin",
      email: emailLower,
      role: "admin",
      isSuperAdmin: true,
      plan: "Elite",
      assignedDistricts: []
    }, { merge: true }).then(() => {
      if (currentUser && currentUser.uid === fbUser.uid) {
        currentUser.firestoreRole = "admin";
      }
    }).catch(err => {
      console.warn("Owner Firestore doc sync skipped (publish latest firestore.rules):", err);
    });
  } else if (!isOwner && !docExists) {
    // Ensure non-owner authenticated users always have a user doc in Firestore
    fs.setDoc(fs.doc(db, "users", fbUser.uid), {
      name: fbUser.displayName || emailLower.split("@")[0] || "Member",
      email: emailLower,
      phone: "",
      role: "user",
      plan: "Basic",
      createdAt: fs.serverTimestamp()
    }, { merge: true }).catch(err => {
      console.warn("Could not auto-create missing user doc:", err);
    });
  }

  currentUser = {
    uid: fbUser.uid,
    email: fbUser.email || emailLower,
    name: p.name || fbUser.displayName || fbUser.email || "Member",
    phone: p.phone || "",
    role: resolvedRole,
    firestoreRole: docExists ? (p.role || null) : null,
    isOwner,
    plan: isOwner ? "Elite" : (p.plan || "Basic"),
    assignedDistricts: isOwner
      ? []
      : (Array.isArray(p.assignedDistricts) ? p.assignedDistricts : (p.district ? [p.district] : []))
  };
  return currentUser;
}

function initLive() {
  if (sdkReady) return sdkReady;
  sdkReady = (async () => {
    const [aMod, fsMod, authMod] = await Promise.all([
      import(`${FB}/firebase-app.js`),
      import(`${FB}/firebase-firestore.js`),
      import(`${FB}/firebase-auth.js`)
    ]);
    appMod = aMod; fs = fsMod; fa = authMod;
    app = appMod.initializeApp(firebaseConfig);
    db = fs.getFirestore(app);
    auth = fa.getAuth(app);

    let settled = false;
    authReady = new Promise(resolve => {
      fa.onAuthStateChanged(auth, async fbUser => {
        if (pendingAuthWrite) {
          try { await pendingAuthWrite; } catch {}
        }
        await hydrateUser(fbUser);
        emit();
        if (!settled) {
          settled = true;
          resolve(currentUser);
        }
      });
    });
  })();
  return sdkReady;
}

async function ensureDb() {
  if (!LIVE) return;
  await initLive();
}

export const ready = (async () => {
  if (LIVE) {
    try {
      await initLive();
      await authReady;
    } catch (e) {
      console.error("Firebase failed to load:", e);
    }
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
const emit = () => authListeners.forEach(cb => { try { cb(currentUser); } catch (e) { console.error(e); } });

export async function signUp({ name, email, password, phone, role = "user" }) {
  const cleanRole = role === "dealer" ? "dealer" : "user"; // nobody can self-signup as admin
  const cleanEmail = String(email || "").trim().toLowerCase();
  const cleanName = String(name || "").trim();
  const cleanPhone = String(phone || "").trim();

  if (LIVE) {
    await ensureDb();
    let releaseWrite;
    pendingAuthWrite = new Promise(r => { releaseWrite = r; });
    try {
      const cred = await fa.createUserWithEmailAndPassword(auth, cleanEmail, password);
      await fa.updateProfile(cred.user, { displayName: cleanName }).catch(() => {});
      await fs.setDoc(fs.doc(db, "users", cred.user.uid), {
        name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        role: cleanRole,
        plan: "Basic",
        createdAt: fs.serverTimestamp()
      });
      if (cleanRole === "dealer") {
        await fs.setDoc(fs.doc(db, "dealers", cred.user.uid), {
          name: cleanName,
          owner: cleanName,
          city: "Mirpur AJK",
          phone: cleanPhone,
          whatsapp: cleanPhone.replace(/\D/g, "").replace(/^0/, "92"),
          verified: false,
          plan: "Basic",
          listings: 0,
          about: "",
          createdAt: fs.serverTimestamp()
        }).catch(console.error);
      }
      await hydrateUser(cred.user);
      emit();
      return currentUser;
    } finally {
      releaseWrite();
      pendingAuthWrite = null;
    }
  }

  const s = store();
  if (s.users.some(u => u.email.toLowerCase() === cleanEmail)) throw new Error("An account with this email already exists.");
  const u = { uid: uid(), name: cleanName, email: cleanEmail, password, phone: cleanPhone, role: cleanRole, plan: "Basic", createdAt: Date.now() };
  s.users.push(u);
  s.session = u.uid;
  if (cleanRole === "dealer") {
    s.dealers.unshift({
      id: u.uid, name: cleanName, owner: cleanName, city: "Mirpur AJK", phone: cleanPhone,
      whatsapp: cleanPhone.replace(/\D/g, "").replace(/^0/, "92"), verified: false, plan: "Basic", listings: 0, about: "", createdAt: Date.now()
    });
  }
  save(s);
  currentUser = publicUser(u);
  emit();
  return currentUser;
}

/* Super Admin / Admin creates a new user, dealer, or staff account without logging out */
export async function adminCreateAccount({ name, email, password, phone, role = "dealer", plan = "Basic", agencyName = "", city = "Mirpur AJK", verified = true, assignedDistricts = [] }) {
  const cleanEmail = String(email || "").trim().toLowerCase();
  const cleanName = String(name || "").trim() || "Member";
  const cleanPhone = String(phone || "").trim();

  if (currentUser && currentUser.email && currentUser.email.toLowerCase() === cleanEmail) {
    throw new Error(`You entered your own admin email (${cleanEmail}). Please enter the new account's own email address.`);
  }

  if (LIVE) {
    await ensureDb();
    const tempApp = appMod.initializeApp(firebaseConfig, "TempAdminCreateUserApp_" + Math.random().toString(36).slice(2, 9));
    const tempAuth = fa.getAuth(tempApp);
    const tempDb = fs.getFirestore(tempApp);

    try {
      const cred = await fa.createUserWithEmailAndPassword(tempAuth, cleanEmail, password);
      if (cleanName) {
        await fa.updateProfile(cred.user, { displayName: cleanName }).catch(() => {});
      }
      const newUid = cred.user.uid;
      const initialRole = role === "dealer" ? "dealer" : "user";
      const targetDistricts = role === "district_admin"
        ? (assignedDistricts?.length ? assignedDistricts : [city || "Mirpur AJK"])
        : [];

      // 1. Create baseline user doc authenticated as newUid (satisfies self-create rule)
      const userDoc = {
        name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        role: initialRole,
        plan: "Basic",
        city: city || "Mirpur AJK",
        assignedDistricts: [],
        createdAt: fs.serverTimestamp(),
        createdByAdmin: currentUser?.uid || "admin"
      };
      await fs.setDoc(fs.doc(tempDb, "users", newUid), userDoc);

      // 2. Create baseline dealer doc if dealer role
      if (role === "dealer") {
        await fs.setDoc(fs.doc(tempDb, "dealers", newUid), {
          name: agencyName || cleanName || "Real Estate Agency",
          owner: cleanName,
          city: city || "Mirpur AJK",
          phone: cleanPhone,
          whatsapp: cleanPhone.replace(/\D/g, "").replace(/^0/, "92"),
          verified: false,
          plan: "Basic",
          about: "Official registered real estate dealer on Zameen Online.",
          listings: 0,
          createdAt: fs.serverTimestamp()
        });
      }

      await fa.signOut(tempAuth);

      // 3. Apply admin-level upgrades (role, plan, districts, verified) via primary admin connection
      const adminUserUpdates = {};
      if (role === "district_admin" || role === "admin" || role === "super_admin") {
        adminUserUpdates.role = role === "super_admin" ? "admin" : role;
        if (role === "super_admin") adminUserUpdates.isSuperAdmin = true;
        if (role === "district_admin") adminUserUpdates.assignedDistricts = targetDistricts;
      }
      if (plan && plan !== "Basic") adminUserUpdates.plan = plan;

      if (Object.keys(adminUserUpdates).length) {
        try {
          await fs.setDoc(fs.doc(db, "users", newUid), adminUserUpdates, { merge: true });
        } catch (upgradeErr) {
          console.warn("Could not apply elevated role/plan immediately:", upgradeErr);
          if (role === "district_admin" || role === "admin" || role === "super_admin") {
            throw wrapFirestoreError(upgradeErr, `assign the ${role} role to the new account`);
          }
        }
      }

      if (role === "dealer" && (plan !== "Basic" || verified)) {
        try {
          await fs.setDoc(fs.doc(db, "dealers", newUid), { plan: plan || "Basic", verified: !!verified }, { merge: true });
        } catch (mergeErr) {
          console.warn("Could not upgrade dealer package/verified badge immediately:", mergeErr);
        }
      }

      return { uid: newUid, ...userDoc, role, plan: plan || "Basic", verified: !!verified, assignedDistricts: targetDistricts };
    } catch (err) {
      if (err.code === "auth/email-already-in-use") {
        throw new Error(`The email "${cleanEmail}" is already registered. Find them in the "Users & Roles" tab and click "Manage Role".`);
      } else if (err.code === "auth/weak-password") {
        throw new Error("Password must be at least 6 characters.");
      } else if (err.code === "auth/invalid-email") {
        throw new Error("Invalid email address format.");
      }
      throw wrapFirestoreError(err, "create this account");
    } finally {
      try { await appMod.deleteApp(tempApp); } catch {}
    }
  }

  const s = store();
  if (s.users.some(u => u.email.toLowerCase() === cleanEmail)) {
    throw new Error("An account with this email already exists.");
  }
  const newUid = uid();
  const newUser = {
    uid: newUid,
    id: newUid,
    name: cleanName,
    email: cleanEmail,
    password,
    phone: cleanPhone,
    role: role || "user",
    plan: plan || "Basic",
    assignedDistricts: role === "district_admin" ? (assignedDistricts?.length ? assignedDistricts : [city || "Mirpur AJK"]) : [],
    createdAt: Date.now()
  };
  s.users.push(newUser);
  if (role === "dealer") {
    s.dealers.unshift({
      id: newUid,
      name: agencyName || cleanName || "Real Estate Agency",
      owner: cleanName,
      city: city || "Mirpur AJK",
      phone: cleanPhone,
      whatsapp: cleanPhone.replace(/\D/g, "").replace(/^0/, "92"),
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

export async function signIn(email, password) {
  const cleanEmail = String(email || "").trim().toLowerCase();
  if (LIVE) {
    await ensureDb();
    const cred = await fa.signInWithEmailAndPassword(auth, cleanEmail, password);
    await hydrateUser(cred.user);
    emit();
    return currentUser;
  }
  const s = store();
  const u = s.users.find(u => u.email.toLowerCase() === cleanEmail && u.password === password);
  if (!u) throw new Error("Incorrect email or password.");
  s.session = u.uid;
  save(s);
  currentUser = publicUser(u);
  emit();
  return currentUser;
}

export async function resetPassword(email) {
  if (LIVE) {
    await ensureDb();
    return fa.sendPasswordResetEmail(auth, String(email || "").trim());
  }
  throw new Error("Password reset emails work once Firebase is connected.");
}

export async function signOut() {
  if (LIVE) {
    await ensureDb();
    await fa.signOut(auth);
  } else {
    const s = store();
    s.session = null;
    save(s);
  }
  currentUser = null;
  emit();
}

/* ---------------------------------------------------------
   Generic collection helpers + real-time subscriptions
--------------------------------------------------------- */
const toMs = v => {
  if (!v) return 0;
  if (typeof v.toMillis === "function") return v.toMillis();
  if (typeof v === "number") return v;
  return 0;
};
const norm = (id, d) => {
  const data = d || {};
  const createdAt = toMs(data.createdAt) || toMs(data.createdAtMs) || Date.now();
  return { id, ...data, createdAt };
};

async function list(col, ...where) {
  if (LIVE) {
    await ensureDb();
    try {
      const q = where.length ? fs.query(fs.collection(db, col), ...where.map(w => fs.where(...w))) : fs.collection(db, col);
      const snap = await fs.getDocs(q);
      return snap.docs.map(d => norm(d.id, d.data())).sort((a, b) => b.createdAt - a.createdAt);
    } catch (err) {
      throw wrapFirestoreError(err, `load ${col}`);
    }
  }
  let rows = store()[col] || [];
  for (const [f, op, v] of where) rows = rows.filter(r => op === "==" ? r[f] === v : true);
  return [...rows].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

function subscribe(col, where, onData, onError) {
  if (LIVE) {
    let active = true;
    let unsub = null;
    ensureDb().then(() => {
      if (!active) return;
      const q = where.length
        ? fs.query(fs.collection(db, col), ...where.map(w => fs.where(...w)))
        : fs.collection(db, col);
      unsub = fs.onSnapshot(
        q,
        snap => {
          if (!active) return;
          const rows = snap.docs.map(d => norm(d.id, d.data())).sort((a, b) => b.createdAt - a.createdAt);
          onData(rows);
        },
        err => {
          if (!active) return;
          if (onError) onError(wrapFirestoreError(err, `watch ${col}`));
          else console.error(`Realtime ${col} error:`, err);
        }
      );
    }).catch(err => {
      if (active && onError) onError(err);
    });
    return () => {
      active = false;
      if (unsub) {
        try { unsub(); } catch {}
      }
    };
  }

  const emitNow = () => {
    let rows = col === "users"
      ? (store().users || []).map(u => ({ id: u.uid, ...publicUser(u), createdAt: u.createdAt || 0 }))
      : (store()[col] || []);
    for (const [f, op, v] of where) rows = rows.filter(r => op === "==" ? r[f] === v : true);
    onData([...rows].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
  };
  const entry = { col, emit: emitNow };
  demoSubs.add(entry);
  queueMicrotask(emitNow);
  return () => demoSubs.delete(entry);
}

async function get(col, id) {
  if (LIVE) {
    await ensureDb();
    try {
      const d = await fs.getDoc(fs.doc(db, col, id));
      return d.exists() ? norm(d.id, d.data()) : null;
    } catch (err) {
      throw wrapFirestoreError(err, `read ${col}/${id}`);
    }
  }
  return (store()[col] || []).find(r => r.id === id) || null;
}

async function add(col, data) {
  if (LIVE) {
    await ensureDb();
    try {
      const ref = await fs.addDoc(fs.collection(db, col), {
        ...data,
        createdAtMs: Date.now(),
        createdAt: fs.serverTimestamp()
      });
      return ref.id;
    } catch (err) {
      throw wrapFirestoreError(err, `create record in ${col}`);
    }
  }
  const s = store();
  const id = uid();
  s[col].unshift({ ...data, id, createdAt: Date.now() });
  save(s, col);
  return id;
}

async function setDoc(col, id, data) {
  if (LIVE) {
    await ensureDb();
    try {
      const payload = { ...data };
      if (!data.createdAt) payload.createdAt = fs.serverTimestamp();
      else if (typeof data.createdAt === "number") payload.createdAt = fs.Timestamp.fromMillis(data.createdAt);
      return await fs.setDoc(fs.doc(db, col, id), payload, { merge: true });
    } catch (err) {
      throw wrapFirestoreError(err, `save record in ${col}`);
    }
  }
  const s = store();
  const i = s[col].findIndex(r => r.id === id);
  if (i >= 0) s[col][i] = { ...s[col][i], ...data };
  else s[col].unshift({ ...data, id, createdAt: data.createdAt || Date.now() });
  save(s, col);
}

async function update(col, id, data) {
  if (LIVE) {
    await ensureDb();
    try {
      return await fs.updateDoc(fs.doc(db, col, id), data);
    } catch (err) {
      throw wrapFirestoreError(err, `update record in ${col}`);
    }
  }
  const s = store();
  const r = s[col].find(r => r.id === id);
  if (r) Object.assign(r, data);
  save(s, col);
}

async function remove(col, id) {
  if (LIVE) {
    await ensureDb();
    try {
      return await fs.deleteDoc(fs.doc(db, col, id));
    } catch (err) {
      throw wrapFirestoreError(err, `delete record from ${col}`);
    }
  }
  const s = store();
  s[col] = s[col].filter(r => r.id !== id);
  save(s, col);
}

/* ---------------------------------------------------------
   Role checks
--------------------------------------------------------- */
export const isSuperAdmin = u => ["super_admin", "admin"].includes((u || currentUser)?.role);
export const isGlobalAdmin = u => ["super_admin", "admin"].includes((u || currentUser)?.role);
export const isStaff = u => ["super_admin", "admin", "district_admin"].includes((u || currentUser)?.role);
export const isDistrictAdmin = (city, u) => {
  const user = u || currentUser;
  if (!user) return false;
  if (isGlobalAdmin(user)) return true;
  if (user.role === "district_admin") {
    const districts = (user.assignedDistricts || []).map(c => String(c).trim().toLowerCase());
    return districts.includes(String(city || "").trim().toLowerCase());
  }
  return false;
};

/* ---------------------------------------------------------
   Listings (queries + real-time subscriptions + media)
--------------------------------------------------------- */
export const getApprovedListings = () => list("listings", ["status", "==", "approved"]);
export const getListing = id => get("listings", id);
export const getMyListings = uid => list("listings", ["ownerId", "==", uid]);
export const getAllListings = () => list("listings");

export const subscribeApprovedListings = (onData, onError) => subscribe("listings", [["status", "==", "approved"]], onData, onError);
export const subscribeMyListings = (ownerUid, onData, onError) => subscribe("listings", [["ownerId", "==", ownerUid]], onData, onError);
export const subscribeAllListings = (onData, onError) => subscribe("listings", [], onData, onError);

async function rawSet(col, id, data) {
  if (LIVE) {
    await ensureDb();
    try {
      return await fs.setDoc(fs.doc(db, col, id), data);
    } catch (err) {
      throw wrapFirestoreError(err, `save media in ${col}`);
    }
  }
  const s = store();
  s[col] = (s[col] || []).filter(r => r.id !== id);
  s[col].push({ id, ...data });
  save(s, col);
}

async function rawGet(col, id) {
  if (LIVE) {
    await ensureDb();
    const d = await fs.getDoc(fs.doc(db, col, id));
    return d.exists() ? d.data() : null;
  }
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
    try {
      const t = await rawGet("thumbs", id);
      thumbCache.set(id, t?.src || "");
    } catch {
      thumbCache.set(id, "");
    }
  }));
  return Object.fromEntries(ids.map(id => [id, thumbCache.get(id)]));
}

export async function getPhotos(l) {
  if (l.photoCount) {
    try {
      const p = await rawGet("photos", l.id);
      if (p?.images?.length) return p.images;
    } catch {}
  }
  return l.images || [];
}

export async function createListing(data, media) {
  const u = currentUser;
  if (!u) throw new Error("Please sign in first.");
  // Only Global/Super Admins auto-approve; Private Sellers & Dealers ALWAYS submit as 'pending'
  const status = isGlobalAdmin(u) ? "approved" : "pending";
  const payload = {
    ...data,
    photoCount: media?.images?.length || 0,
    ownerId: u.uid,
    ownerName: u.name || u.email || "Owner",
    ownerEmail: u.email || "",
    ownerRole: u.role || "user",
    status,
    featured: false,
    views: 0
  };
  const id = await add("listings", payload);
  if (media) {
    try {
      await saveMedia(id, media);
      if (media.thumb) thumbCache.set(id, media.thumb);
    } catch (mediaErr) {
      // Roll back the listing if photo upload failed so no broken/duplicate ad remains
      try { await remove("listings", id); } catch {}
      throw mediaErr;
    }
  }
  return id;
}

export async function updateListing(id, data, media) {
  await update("listings", id, media ? { ...data, photoCount: media.images.length, images: [], updatedAt: Date.now() } : { ...data, updatedAt: Date.now() });
  if (media) {
    await saveMedia(id, media);
    thumbCache.delete(id);
  }
}

export async function deleteListing(id) {
  // Delete media FIRST while listings/{id} still exists so ownsListing(id) rule succeeds!
  for (const col of ["thumbs", "photos"]) {
    try {
      if (LIVE) {
        await ensureDb();
        await fs.deleteDoc(fs.doc(db, col, id));
      } else {
        const s = store();
        s[col] = (s[col] || []).filter(r => r.id !== id);
        save(s, col);
      }
    } catch {}
  }
  thumbCache.delete(id);
  await remove("listings", id);
}

export async function addView(id) {
  try {
    if (LIVE) {
      await ensureDb();
      await fs.updateDoc(fs.doc(db, "listings", id), { views: fs.increment(1) });
    } else {
      const l = await get("listings", id);
      if (l) await update("listings", id, { views: (l.views || 0) + 1 });
    }
  } catch { /* views are best-effort */ }
}

/* ---------------------------------------------------------
   Moderation (Approve / Reject)
--------------------------------------------------------- */
export async function approveListing(id, note = "") {
  const u = currentUser;
  if (!u || !isStaff(u)) throw new Error("Only administrators can approve listings.");
  return updateListing(id, {
    status: "approved",
    moderatedBy: u.uid,
    moderatedByName: u.name || "Admin",
    moderatedAt: Date.now(),
    moderationNote: note || "Approved"
  });
}

export async function rejectListing(id, reason = "") {
  const u = currentUser;
  if (!u || !isStaff(u)) throw new Error("Only administrators can reject listings.");
  return updateListing(id, {
    status: "rejected",
    moderatedBy: u.uid,
    moderatedByName: u.name || "Admin",
    moderatedAt: Date.now(),
    moderationNote: reason || "Rejected by moderator"
  });
}

/* ---------------------------------------------------------
   Dealers, services, inquiries, users
--------------------------------------------------------- */
export const getDealers = () => list("dealers");
export const subscribeDealers = (onData, onError) => subscribe("dealers", [], onData, onError);
export const getDealer = id => get("dealers", id);
export async function saveDealer(id, data) {
  const res = (id && id !== "undefined") ? await setDoc("dealers", id, data) : await add("dealers", data);
  if (id && id !== "undefined" && data.plan && isGlobalAdmin(currentUser)) {
    try {
      const u = await get("users", id);
      if (u) await updateUser(id, { plan: data.plan, city: data.city || u.city || "Mirpur AJK" });
    } catch {}
  }
  return res;
}
export const deleteDealer = id => remove("dealers", id);

export const getServices = () => list("services");
export const subscribeServices = (onData, onError) => subscribe("services", [], onData, onError);
export const saveService = (id, data) => (id && id !== "undefined") ? setDoc("services", id, data) : add("services", data);
export const deleteService = id => remove("services", id);

export const addInquiry = data => add("inquiries", { ...data, read: false });
export const getInquiries = () => list("inquiries");
export const subscribeInquiries = (onData, onError) => subscribe("inquiries", [], onData, onError);
export const getMyInquiries = ownerUid => list("inquiries", ["ownerId", "==", ownerUid]);
export const subscribeMyInquiries = (ownerUid, onData, onError) => subscribe("inquiries", [["ownerId", "==", ownerUid]], onData, onError);
export const markInquiry = (id, read) => update("inquiries", id, { read });
export const deleteInquiry = id => remove("inquiries", id);

export async function getUsers() {
  if (LIVE) return list("users");
  return store().users.map(u => ({ id: u.uid, ...publicUser(u), createdAt: u.createdAt || 0 }));
}
export const subscribeUsers = (onData, onError) => subscribe("users", [], onData, onError);

export async function updateUser(id, data) {
  if (LIVE) {
    await ensureDb();
    try {
      return await fs.setDoc(fs.doc(db, "users", id), data, { merge: true });
    } catch (err) {
      throw wrapFirestoreError(err, "update user account");
    }
  }
  const s = store();
  const u = s.users.find(u => u.uid === id || u.id === id);
  if (u) Object.assign(u, data);
  save(s, "users");
}

export async function setUserRole(targetUid, { role, assignedDistricts, plan, city, verified, agencyName }) {
  // Store 'admin' + isSuperAdmin: true in Firestore for super_admin (compatible with both legacy & updated rules)
  const firestoreRole = role === "super_admin" ? "admin" : (role || "user");
  const updates = {
    role: firestoreRole,
    isSuperAdmin: role === "super_admin",
    plan: plan || "Basic",
    updatedAt: Date.now()
  };
  if (assignedDistricts !== undefined) {
    updates.assignedDistricts = Array.isArray(assignedDistricts) ? assignedDistricts : [assignedDistricts];
  }
  if (city) updates.city = city;

  await updateUser(targetUid, updates);

  if (role === "dealer") {
    const userDoc = (await get("users", targetUid)) || {};
    const existingDealer = (await getDealer(targetUid)) || {};
    await saveDealer(targetUid, {
      name: agencyName || existingDealer.name || userDoc.name || "Dealer Agency",
      owner: existingDealer.owner || userDoc.name || "",
      city: city || existingDealer.city || (updates.assignedDistricts?.[0]) || "Mirpur AJK",
      phone: existingDealer.phone || userDoc.phone || "",
      whatsapp: existingDealer.whatsapp || (userDoc.phone ? String(userDoc.phone).replace(/\D/g, "").replace(/^0/, "92") : ""),
      verified: verified !== undefined ? !!verified : (existingDealer.verified || false),
      plan: plan || userDoc.plan || "Basic",
      about: existingDealer.about || "",
      listings: existingDealer.listings || 0
    });
  }
}

export async function claimSuperAdmin() {
  if (!currentUser) throw new Error("Please sign in first.");
  if (LIVE) {
    await ensureDb();
    try {
      await fs.setDoc(fs.doc(db, "users", currentUser.uid), {
        name: currentUser.name || "Admin",
        email: (currentUser.email || "").toLowerCase(),
        role: "admin",
        isSuperAdmin: true,
        plan: "Elite",
        assignedDistricts: []
      }, { merge: true });
      currentUser.role = "super_admin";
      currentUser.firestoreRole = "admin";
      currentUser.plan = "Elite";
      currentUser.assignedDistricts = [];
    } catch (err) {
      throw wrapFirestoreError(err, "restore Super Admin role");
    }
  } else {
    currentUser.role = "super_admin";
    currentUser.firestoreRole = "super_admin";
    currentUser.plan = "Elite";
    currentUser.assignedDistricts = [];
    const s = store();
    const u = s.users.find(x => x.uid === currentUser.uid || x.id === currentUser.uid);
    if (u) {
      u.role = "super_admin";
      u.plan = "Elite";
      u.assignedDistricts = [];
    }
    save(s, "users");
  }
  emit();
}

export async function updateProfile(data) {
  if (!currentUser) return;
  // Never allow client profile form to touch protected role/plan fields
  const safeData = {};
  if (data.name !== undefined) safeData.name = data.name;
  if (data.phone !== undefined) safeData.phone = data.phone;
  if (data.city !== undefined) safeData.city = data.city;

  if (LIVE) {
    await ensureDb();
    try {
      await fs.setDoc(fs.doc(db, "users", currentUser.uid), safeData, { merge: true });
    } catch (err) {
      throw wrapFirestoreError(err, "update your profile");
    }
  } else {
    const s = store();
    const u = s.users.find(u => u.uid === currentUser.uid);
    if (u) Object.assign(u, safeData);
    save(s, "users");
  }
  Object.assign(currentUser, safeData);
  emit();
}

/* Admin: copy the sample listings / dealers / services into Firestore */
export async function loadSampleData() {
  for (const d of SEED_DEALERS) await setDoc("dealers", d.id, d);
  for (const s of SEED_SERVICES) await setDoc("services", s.id, s);
  for (const l of SEED_LISTINGS) await setDoc("listings", l.id, { ...l, ownerId: currentUser.uid });
}
export function resetDemo() {
  try { localStorage.removeItem(KEY); } catch {}
  delete memory[KEY];
}
