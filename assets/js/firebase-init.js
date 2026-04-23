// Firebase initialization + shared helpers for dashboard.html and index.html (project mode).
// Loaded via <script src> — exposes the Firebase namespace + helpers as globals.
//
// IMPORTANT: Replace FIREBASE_CONFIG_PLACEHOLDER below with the actual config object from
// Firebase Console → Project Settings → Your apps → web app. The config is public by design
// (security rules enforce access — see Firestore rules in the spec).

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBogV2vRpxD-Pw2XK5vJMOl-nEUywTgToE",
  authDomain: "smartpeak-roi.firebaseapp.com",
  projectId: "smartpeak-roi",
  storageBucket: "smartpeak-roi.firebasestorage.app",
  messagingSenderId: "1097741372897",
  appId: "1:1097741372897:web:b666db1329de5e03a296a0",
  measurementId: "G-CXYBY5503V"
};

// Whitelist of emails allowed to access projects. Must match the Firestore security rules
// in Firebase Console exactly. Replace RUBEN_EMAIL_PLACEHOLDER with Ruben's actual email.
const WHITELISTED_EMAILS = [
  'kevin@bloxit.be',
  'ledsrepair@gmail.com',
];

// ─── STATUS ENUM ─────────────────────────────────────────────────────────────
// 16 status values, free transitions allowed. Order = logical lifecycle order for the
// dropdown UI. Color hex values follow the spec's color column.
const PROJECT_STATUSES = [
  { key: 'nieuw_contact',         label: 'Nieuw contact',                 color: '#9aa3b2' }, // grijs
  { key: 'wachten_op_data',       label: 'Wachten op data',               color: '#9aa3b2' }, // grijs
  { key: 'klaar_voor_bezoek',     label: 'Klaar voor bezoek',             color: '#7eb6e8' }, // lichtblauw
  { key: 'bezoek_gepland',        label: 'Bezoek gepland',                color: '#2c7be5' }, // blauw
  { key: 'bezoek_gedaan',         label: 'Bezoek gedaan / link verstuurd',color: '#2c7be5' }, // blauw
  { key: 'klaar_voor_offerte',    label: 'Klaar voor offerte',            color: '#ffcf80' }, // lichtoranje
  { key: 'offerte_uit',           label: 'Offerte verzonden',             color: '#f6a623' }, // geel
  { key: 'wacht_op_beslissing',   label: 'Wacht op beslissing',           color: '#f6a623' }, // geel
  { key: 'akkoord',               label: 'Akkoord (go)',                  color: '#00b478' }, // groen
  { key: 'installatie_gepland',   label: 'Installatie gepland',           color: '#00b478' }, // groen
  { key: 'in_uitvoering',         label: 'In uitvoering',                 color: '#00b478' }, // groen
  { key: 'keuring_aangevraagd',   label: 'Keuring aangevraagd',           color: '#00b478' }, // groen
  { key: 'keuring_gepland',       label: 'Keuring gepland',               color: '#00b478' }, // groen
  { key: 'keuring_gedaan',        label: 'Keuring gedaan',                color: '#00b478' }, // groen
  { key: 'facturatie',            label: 'Facturatie',                    color: '#00b478' }, // groen
  { key: 'afgesloten',            label: 'Afgesloten',                    color: '#0a6e4a' }, // donkergroen
  { key: 'niet_akkoord',          label: 'Niet akkoord',                  color: '#e54545' }, // rood
];

const DEFAULT_STATUS = 'nieuw_contact';

// ─── PROJECT PHASES (Kanban-board grouping) ──────────────────────────────────
// 5 fasen die de 16 statussen groeperen. Drop op een bord-kolom zet de status
// naar `statuses[0]` van die fase. Kaart-chip blijft klikbaar voor fijnregeling.
const PROJECT_PHASES = [
  { key: 'nieuw',      label: 'Nieuw',       color: '#9aa3b2', statuses: ['nieuw_contact', 'wachten_op_data'] },
  { key: 'bezoek',     label: 'Bezoek',      color: '#7eb6e8', statuses: ['klaar_voor_bezoek', 'bezoek_gepland', 'bezoek_gedaan'] },
  { key: 'offerte',    label: 'Offerte',     color: '#f6a623', statuses: ['klaar_voor_offerte', 'offerte_uit', 'wacht_op_beslissing'] },
  { key: 'uitvoering', label: 'Uitvoering',  color: '#00b478', statuses: ['akkoord', 'installatie_gepland', 'in_uitvoering', 'keuring_aangevraagd', 'keuring_gepland', 'keuring_gedaan'] },
  { key: 'afgesloten', label: 'Afgesloten',  color: '#0a6e4a', statuses: ['facturatie', 'afgesloten', 'niet_akkoord'] },
];

function phaseForStatus(statusKey) {
  for (const p of PROJECT_PHASES) {
    if (p.statuses.includes(statusKey)) return p;
  }
  return PROJECT_PHASES[0];
}

// Status-keys that mark a project as "finished" (hidden by default in dashboard).
const FINISHED_STATUSES = ['afgesloten', 'niet_akkoord'];

// ─── CONNECTION TYPES ────────────────────────────────────────────────────────
const CONNECTION_TYPES = ['1x230', '3x230', '3x400+N'];

// ─── PROJECT METADATA HELPERS ────────────────────────────────────────────────
// Default-empty structure for the 6 metadata sections added in the 2026-04-20
// expansion. Readers merge a project's stored sections over this so pre-2026-04-20
// projects (without these fields) behave identically to empty-new ones.
function newEmptyProjectMetadata() {
  return {
    customer: {
      address: null,
      phone:   null,
      email:   null,
    },
    situation: null,
    notes:     null,
    site: {
      houseAgeOver10Years: null,
    },
    electrical: {
      connectionType: null,
      fuseRatingA:    null,
    },
    cabinet: {
      freeUnits:              null,
      hasRemAutomaat:         null,
      wiringDiameterMm2:      null,
      hasOutletNearFluvius:   null,
      hasWifiNearFluvius:     null,
      batteryPlacementRoom:   null,
      hasWifiNearCabinet:     null,
      lineGroundChecked:      null,
    },
    solar: {
      inverters: [],
    },
    supplier: {
      name:           null,
      isSingleTariff: false,
      priceDay:       null,
      priceNight:     null,
    },
    calcDefaults: {
      btw:     null,
      keuring: 'yes',
    },
    serialNumbers: [],
  };
}

// Merge a project doc's metadata sections over the default-empty shape. Returns
// a complete metadata object regardless of which sections the doc contains.
function mergeProjectMetadata(project) {
  const empty = newEmptyProjectMetadata();
  if (!project) return empty;
  const merged = {
    customer:     { ...empty.customer,     ...(project.customer || {}) },
    situation:    project.situation != null ? project.situation : empty.situation,
    notes:        project.notes     != null ? project.notes     : empty.notes,
    site:         { ...empty.site,         ...(project.site || {}) },
    electrical:   { ...empty.electrical,   ...(project.electrical || {}) },
    cabinet:      { ...empty.cabinet,      ...(project.cabinet || {}) },
    solar:        { ...empty.solar,        ...(project.solar || {}) },
    supplier:     { ...empty.supplier,     ...(project.supplier || {}) },
    calcDefaults: { ...empty.calcDefaults, ...(project.calcDefaults || {}) },
  };
  merged.offertes      = project.offertes || {};
  merged.serialNumbers = Array.isArray(project.serialNumbers) ? project.serialNumbers : [];
  return merged;
}

// BTW afleidingsregel (single source of truth).
//   houseAgeOver10Years === true  → 6
//   houseAgeOver10Years === false → 21
//   houseAgeOver10Years === null  → calcDefaults.btw (may be null)
function effectiveBtwFor(project) {
  const m = mergeProjectMetadata(project);
  if (m.site.houseAgeOver10Years === true)  return 6;
  if (m.site.houseAgeOver10Years === false) return 21;
  return m.calcDefaults.btw;
}

// Sum of powerKw over all solar.inverters entries. Returns 0 if no inverters.
function totalInverterPowerKw(project) {
  const m = mergeProjectMetadata(project);
  return m.solar.inverters.reduce((sum, inv) => sum + (Number(inv.powerKw) || 0), 0);
}

function getStatusMeta(key) {
  return PROJECT_STATUSES.find(s => s.key === key) || { key, label: key, color: '#9aa3b2' };
}

// Label helper: projectName has priority, else customerName, else placeholder.
// Used on dashboard (list/board/drawer), index.html project-banner, and project-edit page title.
function getProjectLabel(project) {
  const pn = (project && project.projectName || '').trim();
  if (pn) return pn;
  const cn = (project && project.customerName || '').trim();
  if (cn) return cn;
  return '(zonder naam)';
}

// ─── INIT ────────────────────────────────────────────────────────────────────
let _firebaseApp = null;
let _firebaseDb  = null;
let _firebaseAuth = null;

function initFirebase() {
  if (_firebaseApp) return _firebaseApp;
  if (typeof firebase === 'undefined') {
    throw new Error('Firebase SDK niet geladen. Controleer of de <script src="https://www.gstatic.com/firebasejs/...firebase-app-compat.js"> tags aanwezig zijn.');
  }
  _firebaseApp  = firebase.initializeApp(FIREBASE_CONFIG);
  _firebaseDb   = firebase.firestore();
  _firebaseAuth = firebase.auth();
  return _firebaseApp;
}

function getDb()   { initFirebase(); return _firebaseDb; }
function getAuth() { initFirebase(); return _firebaseAuth; }

// ─── AUTH ────────────────────────────────────────────────────────────────────
function signInWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  return getAuth().signInWithPopup(provider);
}

function signOut() {
  return getAuth().signOut();
}

function onAuthStateChanged(cb) {
  return getAuth().onAuthStateChanged(cb);
}

function isWhitelisted(user) {
  if (!user || !user.email) return false;
  return WHITELISTED_EMAILS.includes(user.email);
}

function currentUserEmail() {
  const u = getAuth().currentUser;
  return u && u.email ? u.email : null;
}

// ─── FIRESTORE: PROJECTS COLLECTION ──────────────────────────────────────────
// Document shape — see spec §Data model:
//   { projectName, customerName, status, createdBy, createdAt, updatedAt, deletedAt,
//     csvUpload: null | {...}, lastCalcRun: null | {...} }

function projectsCol() { return getDb().collection('projects'); }
function projectDoc(id) { return projectsCol().doc(id); }

// Create a project. csvData is the optional output of extractCsvForStorage(); pass null
// if no CSV was uploaded at creation. `metadata` is an optional object with any subset
// of { site, electrical, cabinet, solar, supplier, calcDefaults } — if omitted, the
// document is created without those sections (pre-2026-04-20 shape; readers fall back
// via mergeProjectMetadata). Returns the new document reference.
async function createProject({ projectName, customerName, status, csvData, metadata }) {
  const email = currentUserEmail();
  if (!email) throw new Error('Niet ingelogd');
  const now = firebase.firestore.FieldValue.serverTimestamp();
  const doc = {
    projectName,
    customerName,
    status:     status || DEFAULT_STATUS,
    createdBy:  email,
    createdAt:  now,
    updatedAt:  now,
    deletedAt:  null,
    csvUpload:  csvData ? {
      uploadedAt:  now,
      uploadedBy:  email,
      eanCode:     csvData.eanCode,
      meterNr:     csvData.meterNr,
      meterType:   csvData.meterType,
      dailyCompact: csvData.dailyCompact,
    } : null,
    lastCalcRun: null,
  };
  if (metadata) {
    if (metadata.site)         doc.site         = metadata.site;
    if (metadata.electrical)   doc.electrical   = metadata.electrical;
    if (metadata.cabinet)      doc.cabinet      = metadata.cabinet;
    if (metadata.solar)        doc.solar        = metadata.solar;
    if (metadata.supplier)     doc.supplier     = metadata.supplier;
    if (metadata.calcDefaults) doc.calcDefaults = metadata.calcDefaults;
    if (Array.isArray(metadata.serialNumbers)) doc.serialNumbers = metadata.serialNumbers;
  }
  return projectsCol().add(doc);
}

// Fetch all non-deleted projects, ordered by updatedAt desc.
async function listActiveProjects() {
  const snap = await projectsCol().where('deletedAt', '==', null).orderBy('updatedAt', 'desc').get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Fetch all deleted projects, ordered by deletedAt desc.
async function listDeletedProjects() {
  const snap = await projectsCol().where('deletedAt', '!=', null).orderBy('deletedAt', 'desc').get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function getProject(id) {
  const snap = await projectDoc(id).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

async function updateProjectStatus(id, status) {
  await projectDoc(id).update({
    status,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

// Patch a subset of the metadata sections on a project doc. `patch` is an object
// with top-level keys among { site, electrical, cabinet, solar, supplier, calcDefaults,
// projectName, customerName, status }; each value is a partial object for that section.
// Written with {merge:true} so other keys on the same section are preserved.
// updatedAt is always refreshed.
async function updateProjectMetadata(id, patch) {
  const data = { ...patch, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
  await projectDoc(id).set(data, { merge: true });
}

async function softDeleteProject(id) {
  await projectDoc(id).update({
    deletedAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

async function restoreProject(id) {
  await projectDoc(id).update({
    deletedAt: null,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

// Permanent (hard) delete — cascades to photos (Storage bytes + Firestore docs),
// comments sub-collection, and the project doc itself. Kan niet ongedaan.
async function hardDeleteProject(id) {
  // Photos: delete bytes + Firestore doc per photo.
  try {
    const photosSnap = await projectDoc(id).collection('photos').get();
    for (const doc of photosSnap.docs) {
      const data = doc.data();
      if (data.storagePath) {
        try { await getStorage().ref(data.storagePath).delete(); }
        catch (e) { console.warn('Storage file delete failed for', data.storagePath, e); }
      }
      if (data.thumbStoragePath) {
        try { await getStorage().ref(data.thumbStoragePath).delete(); }
        catch (e) { console.warn('Thumb delete failed for', data.thumbStoragePath, e); }
      }
      await doc.ref.delete();
    }
  } catch (e) { console.warn('photos cascade failed', e); }

  // Comments.
  try {
    const commentsSnap = await projectDoc(id).collection('comments').get();
    for (const doc of commentsSnap.docs) {
      await doc.ref.delete();
    }
  } catch (e) { console.warn('comments cascade failed', e); }

  // Project doc itself.
  await projectDoc(id).delete();
}

// Replace the project's CSV (used both at first upload AND when replacing an existing CSV).
async function setProjectCsv(id, csvData) {
  const email = currentUserEmail();
  await projectDoc(id).update({
    csvUpload: {
      uploadedAt:  firebase.firestore.FieldValue.serverTimestamp(),
      uploadedBy:  email,
      eanCode:     csvData.eanCode,
      meterNr:     csvData.meterNr,
      meterType:   csvData.meterType,
      dailyCompact: csvData.dailyCompact,
    },
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

// Save the latest calculation result. `results` is the full r-object from _serializeState
// minus dailyCompact (which lives in csvUpload). Caller is responsible for stripping it.
async function saveLastCalcRun(id, { inputs, results }) {
  const email = currentUserEmail();
  const update = {
    lastCalcRun: {
      calculatedAt:  firebase.firestore.FieldValue.serverTimestamp(),
      calculatedBy:  email,
      inputs,
      results,
    },
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  };
  // Invariant: a type that's in selectedConfigTypes must NOT be in dismissedConfigs.
  // Whenever the calculator re-saves with a type that was previously dismissed, clear
  // the dismiss so the drawer/edit-page stops showing it as struck-through.
  const selected = (inputs && Array.isArray(inputs.selectedConfigTypes)) ? inputs.selectedConfigTypes : [];
  if (selected.length > 0) {
    update.dismissedConfigs = firebase.firestore.FieldValue.arrayRemove(...selected);
  }
  await projectDoc(id).update(update);
}

// ─── PRODUCT-SHEET CONFIG ────────────────────────────────────────────────────
// Reads the Firestore doc that holds the product sheet CSV URL. Requires the
// user to be authenticated + whitelisted (enforced by Firestore rules).
async function getProductsConfig() {
  const snap = await getDb().collection('config').doc('products').get();
  if (!snap.exists) {
    throw new Error('Product-configuratie niet gevonden in Firestore (config/products).');
  }
  return snap.data();
}

// ─── SHARES (customer-facing read-only snapshots) ────────────────────────────
// Each share doc holds a full v:5 state payload (inputs + results + dailyCompact).
// Firestore rules: read = public (customers have no login), write = isWhitelisted().
async function createShare(payload, projectId) {
  const email = currentUserEmail();
  if (!email) throw new Error('Niet ingelogd — alleen ingelogde gebruikers mogen deellinks maken.');
  const doc = {
    payload:    payload,
    projectId:  projectId || null,
    createdBy:  email,
    createdAt:  firebase.firestore.FieldValue.serverTimestamp(),
  };
  return getDb().collection('shares').add(doc);
}

async function getShare(id) {
  const snap = await getDb().collection('shares').doc(id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() };
}

// ─── COMMENTS (per-project thread Kevin ↔ Ruben) ─────────────────────────────
async function listComments(projectId) {
  const snap = await projectDoc(projectId).collection('comments').orderBy('createdAt', 'asc').get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function addComment(projectId, text) {
  const email = currentUserEmail();
  if (!email) throw new Error('Niet ingelogd');
  const trimmed = (text || '').trim();
  if (!trimmed) throw new Error('Lege opmerking.');
  if (trimmed.length > 4000) throw new Error('Opmerking te lang (max 4000 tekens).');
  const now = firebase.firestore.FieldValue.serverTimestamp();
  const batch = getDb().batch();
  const commentRef = projectDoc(projectId).collection('comments').doc();
  batch.set(commentRef, { author: email, text: trimmed, createdAt: now });
  // Bump lastCommentAt AND the poster's own readState — so the poster's own
  // post never shows as "unread" to themselves.
  batch.update(projectDoc(projectId), {
    lastCommentAt: now,
    [`readStates.${email}`]: now,
    updatedAt: now,
  });
  await batch.commit();
  return commentRef.id;
}

async function markCommentsRead(projectId) {
  const email = currentUserEmail();
  if (!email) return;
  await projectDoc(projectId).update({
    [`readStates.${email}`]: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

// True iff the project has any comments at all (regardless of read-state).
function hasAnyComments(project) {
  return !!(project && project.lastCommentAt);
}

// True iff the project has a lastCommentAt newer than the current user's readState.
function hasUnreadComments(project, email) {
  if (!project || !project.lastCommentAt) return false;
  if (!email) return false;
  const rs = (project.readStates || {})[email];
  if (!rs) return true;
  const lca = project.lastCommentAt.toMillis ? project.lastCommentAt.toMillis() : 0;
  const rsm = rs.toMillis ? rs.toMillis() : 0;
  return lca > rsm;
}

// ─── GROUND-FAULT WARNING PREDICATE ──────────────────────────────────────────
function isMarstekConfig(type) { return typeof type === 'string' && type.startsWith('MARVE'); }

function needsGroundFaultCheck(project) {
  const lcr = project && project.lastCalcRun;
  if (!lcr) return false;
  const types = (lcr.inputs && lcr.inputs.selectedConfigTypes) || [];
  if (types.length === 0) return false;
  const anyNonMarstek = types.some(t => !isMarstekConfig(t));
  if (!anyNonMarstek) return false;
  const m = mergeProjectMetadata(project);
  return m.cabinet.lineGroundChecked !== true;
}

// ─── PHOTOS (Firebase Storage + Firestore metadata) ──────────────────────────

// ─── Client-side thumbnail generation ──
// Accepts a File/Blob (new upload) or HTMLImageElement (backfill).
// Returns { blob: Blob, width: number, height: number } where width/height
// are the NATURAL dimensions of the source image.
async function makeThumbnail(source) {
  const MAX_SIDE = 400;
  const QUALITY  = 0.82;

  let img, cleanup = () => {};
  if (source instanceof HTMLImageElement) {
    img = source;
    if (!img.complete || img.naturalWidth === 0) {
      try { await img.decode(); }
      catch (e) { throw new Error('Afbeelding kon niet geladen worden: ' + (e && e.message ? e.message : e)); }
    }
  } else if (source instanceof Blob) {
    img = new Image();
    const url = URL.createObjectURL(source);
    cleanup = () => URL.revokeObjectURL(url);
    img.src = url;
    try { await img.decode(); }
    catch (e) { cleanup(); throw new Error('Kan afbeelding niet decoderen: ' + (e && e.message ? e.message : e)); }
  } else {
    throw new Error('makeThumbnail: source moet File/Blob of HTMLImageElement zijn');
  }

  const naturalWidth  = img.naturalWidth;
  const naturalHeight = img.naturalHeight;
  if (!naturalWidth || !naturalHeight) {
    cleanup();
    throw new Error('Afbeelding heeft geen geldige afmetingen');
  }

  const longest = Math.max(naturalWidth, naturalHeight);
  const scale   = longest > MAX_SIDE ? MAX_SIDE / longest : 1;
  const canvas  = document.createElement('canvas');
  canvas.width  = Math.max(1, Math.round(naturalWidth  * scale));
  canvas.height = Math.max(1, Math.round(naturalHeight * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) { cleanup(); throw new Error('Canvas 2D context niet beschikbaar'); }
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', QUALITY));
  cleanup();
  if (!blob) throw new Error('Thumbnail-aanmaak mislukt (canvas.toBlob)');
  return { blob, width: naturalWidth, height: naturalHeight };
}

function getStorage() {
  initFirebase();
  if (typeof firebase.storage !== 'function') {
    throw new Error('Firebase Storage SDK niet geladen.');
  }
  return firebase.storage();
}

// Uploads a full image + a generated thumbnail in parallel, then writes
// a single Firestore photo-doc.  Defaults tag='situatie' (user may change
// later via the tag-modal).
async function uploadProjectPhotoWithThumb(projectId, file, opts = {}) {
  const email = currentUserEmail();
  if (!email) throw new Error('Niet ingelogd');
  if (!file || !file.type.startsWith('image/')) throw new Error('Alleen afbeeldingen.');
  const MAX_BYTES = 15 * 1024 * 1024;
  if (file.size > MAX_BYTES) throw new Error('Te groot (max 15 MB).');
  const tag = opts.tag === 'serial' ? 'serial' : 'situatie';

  const safeName     = file.name.replace(/[^\w.\-]+/g, '_').slice(0, 80);
  const safeStripped = safeName.replace(/\.[^.]+$/, '') || 'photo';
  const ts           = Date.now();
  const fullPath     = `projects/${projectId}/${ts}_${safeName}`;
  const thumbPath    = `projects/${projectId}/${ts}_${safeStripped}_thumb.jpg`;

  // Step A — generate thumb
  let thumb;
  try { thumb = await makeThumbnail(file); }
  catch (e) { throw new Error('Thumbnail genereren mislukt: ' + (e && e.message ? e.message : e)); }

  // Step B — parallel storage upload
  const storage = getStorage();
  try {
    await Promise.all([
      storage.ref(fullPath).put(file,       { contentType: file.type }),
      storage.ref(thumbPath).put(thumb.blob, { contentType: 'image/jpeg' }),
    ]);
  } catch (e) {
    // best-effort cleanup of whichever blob(s) landed
    try { await storage.ref(fullPath).delete();  } catch {}
    try { await storage.ref(thumbPath).delete(); } catch {}
    throw new Error('Storage upload mislukt: ' + (e && e.message ? e.message : e));
  }

  // Step C — Firestore metadata
  let ref;
  try {
    ref = await projectDoc(projectId).collection('photos').add({
      storagePath:      fullPath,
      thumbStoragePath: thumbPath,
      name:             file.name,
      contentType:      file.type,
      sizeBytes:        file.size,
      width:            thumb.width,
      height:           thumb.height,
      tag,
      uploadedAt:       firebase.firestore.FieldValue.serverTimestamp(),
      uploadedBy:       email,
    });
  } catch (e) {
    try { await storage.ref(fullPath).delete();  } catch {}
    try { await storage.ref(thumbPath).delete(); } catch {}
    throw new Error('Firestore metadata schrijven mislukt: ' + (e && e.message ? e.message : e));
  }

  // updatedAt is cosmetic — don't roll back blobs if this fails
  try {
    await projectDoc(projectId).update({
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  } catch (e) {
    console.warn('updatedAt update mislukt (niet fataal):', e);
  }

  return ref.id;
}

// Lazily generates + uploads a thumbnail for a legacy photo that only has
// a full-resolution blob.  Returns the new thumbStoragePath or null on no-op.
// Throws on fatal errors so callers can decide how to surface them.
async function backfillThumbnail(projectId, photoDoc) {
  if (!photoDoc || !photoDoc.id || !photoDoc.storagePath) return null;
  if (photoDoc.thumbStoragePath) return null; // already done

  const storage = getStorage();
  const fullUrl = photoDoc.downloadUrl
    || await storage.ref(photoDoc.storagePath).getDownloadURL();

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = fullUrl;
  try { await img.decode(); }
  catch (e) { throw new Error('Backfill: image decode mislukt: ' + (e && e.message ? e.message : e)); }

  const { blob, width, height } = await makeThumbnail(img);

  // Derive thumb path from full path.
  // Full looks like: projects/<pid>/<ts>_<safeName>
  // Thumb target:    projects/<pid>/<ts>_<safeStripped>_thumb.jpg
  let thumbPath;
  const m = /^(.*\/)([^/]+)$/.exec(photoDoc.storagePath);
  if (m) {
    const dir  = m[1];
    const base = m[2];
    const stripped = base.replace(/\.[^.]+$/, '') || 'photo';
    thumbPath = `${dir}${stripped}_thumb.jpg`;
  } else {
    thumbPath = photoDoc.storagePath.replace(/\.[^.]+$/, '') + '_thumb.jpg';
  }

  await storage.ref(thumbPath).put(blob, { contentType: 'image/jpeg' });
  await projectDoc(projectId).collection('photos').doc(photoDoc.id).update({
    thumbStoragePath: thumbPath,
    width,
    height,
  });

  return thumbPath;
}

async function listProjectPhotos(projectId) {
  const snap = await projectDoc(projectId).collection('photos').orderBy('uploadedAt', 'desc').get();
  const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  await Promise.all(docs.map(async d => {
    // Full-size URL (always needed for lightbox)
    try { d.downloadUrl = await getStorage().ref(d.storagePath).getDownloadURL(); }
    catch (e) { d.downloadUrl = null; d.fetchError = e && e.message ? e.message : String(e); }
    // Thumb URL (may be absent on legacy docs)
    if (d.thumbStoragePath) {
      try { d.thumbUrl = await getStorage().ref(d.thumbStoragePath).getDownloadURL(); }
      catch (e) { d.thumbUrl = null; /* will fall back to downloadUrl in the UI */ }
    } else {
      d.thumbUrl = null;
    }
    // Defaults for legacy docs
    if (!d.tag) d.tag = 'situatie';
  }));
  return docs;
}

async function deleteProjectPhoto(projectId, photoId, storagePath, thumbStoragePath) {
  await projectDoc(projectId).collection('photos').doc(photoId).delete();
  try { await getStorage().ref(storagePath).delete(); }
  catch (e) { console.warn('Storage full-blob verwijderen mislukt', e); }
  if (thumbStoragePath) {
    try { await getStorage().ref(thumbStoragePath).delete(); }
    catch (e) { console.warn('Storage thumb-blob verwijderen mislukt', e); }
  }
}

// ─── OFFERTES (per-config PDF upload) ────────────────────────────────────────

async function uploadProjectOfferte(projectId, configType, file) {
  if (!file) throw new Error('Geen bestand opgegeven');
  if (file.type !== 'application/pdf') throw new Error('Enkel PDF-bestanden worden aanvaard');
  if (file.size > 10 * 1024 * 1024) throw new Error('PDF is groter dan 10 MB');

  const user = firebase.auth().currentUser;
  if (!user) throw new Error('Niet ingelogd');

  const ts = Date.now();
  const safeType = String(configType).replace(/[^a-zA-Z0-9_-]/g, '_');
  const storagePath = `projects/${projectId}/offertes/${safeType}_${ts}.pdf`;

  // Haal eventueel bestaande blob op om te deleten na succesvolle upload.
  const projRef = firebase.firestore().collection('projects').doc(projectId);
  const projSnap = await projRef.get();
  const existing = (projSnap.data() || {}).offertes || {};
  const oldEntry = existing[configType];

  // Upload nieuwe blob.
  const ref = firebase.storage().ref(storagePath);
  await ref.put(file, { contentType: 'application/pdf' });

  const metadata = {
    storagePath,
    filename:    file.name,
    sizeBytes:   file.size,
    contentType: 'application/pdf',
    uploadedAt:  firebase.firestore.FieldValue.serverTimestamp(),
    uploadedBy:  user.email || null
  };

  // Firestore swap — ook restore uit dismissedConfigs impliciet.
  await projRef.update({
    [`offertes.${configType}`]: metadata,
    dismissedConfigs: firebase.firestore.FieldValue.arrayRemove(configType),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  // Oude blob verwijderen (na succesvolle Firestore-swap zodat crash midden-in de nieuwe PDF niet weggooit).
  if (oldEntry && oldEntry.storagePath && oldEntry.storagePath !== storagePath) {
    try {
      await firebase.storage().ref(oldEntry.storagePath).delete();
    } catch (err) {
      console.warn('Vorige offerte blob niet gevonden of delete-fout:', err);
    }
  }

  return metadata;
}

async function deleteProjectOfferte(projectId, configType) {
  const projRef = firebase.firestore().collection('projects').doc(projectId);
  const projSnap = await projRef.get();
  const existing = (projSnap.data() || {}).offertes || {};
  const entry = existing[configType];
  if (!entry) return;

  try {
    if (entry.storagePath) await firebase.storage().ref(entry.storagePath).delete();
  } catch (err) {
    console.warn('Storage delete faalde (blob mogelijk al weg):', err);
  }

  await projRef.update({
    [`offertes.${configType}`]: firebase.firestore.FieldValue.delete(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}

// ─── Cascade-delete a config (NEW single source of truth) ───────────────────
// Removes the type from lastCalcRun.inputs.selectedConfigTypes, deletes the
// offertes[type] entry from the project doc, and deletes the Storage blob (if
// any).  Best-effort on the Storage delete — warn on failure, don't throw.
async function deleteProjectConfig(projectId, type) {
  if (!projectId || !type) throw new Error('deleteProjectConfig: projectId + type vereist');
  const ref  = projectDoc(projectId);
  const snap = await ref.get();
  const data = snap.data() || {};
  const types = (data.lastCalcRun && data.lastCalcRun.inputs && Array.isArray(data.lastCalcRun.inputs.selectedConfigTypes))
    ? data.lastCalcRun.inputs.selectedConfigTypes.filter(t => t !== type)
    : [];
  const pdfPath = data.offertes && data.offertes[type] && data.offertes[type].storagePath;

  await ref.update({
    'lastCalcRun.inputs.selectedConfigTypes': types,
    [`offertes.${type}`]: firebase.firestore.FieldValue.delete(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });

  if (pdfPath) {
    try { await firebase.storage().ref(pdfPath).delete(); }
    catch (e) { console.warn('Offerte blob verwijderen mislukt', e); }
  }
}

// ─── SERIAL NUMBERS (batterij/omvormer tracking) ─────────────────────────────
//
// project.serialNumbers is a top-level array of entries:
//   { id, value, photoStoragePath, photoDownloadUrl (runtime only), uploadedAt, uploadedBy }
// photoStoragePath/uploadedAt/uploadedBy are null if no photo attached.

function _genSerialId() {
  return 'sn_' + Math.random().toString(36).slice(2, 10);
}

async function addProjectSerial(projectId, value) {
  const email = currentUserEmail();
  if (!email) throw new Error('Niet ingelogd');
  const entry = {
    id:               _genSerialId(),
    value:            (value || '').trim(),
    photoStoragePath: null,
    uploadedAt:       null,
    uploadedBy:       null,
  };
  await projectDoc(projectId).update({
    serialNumbers: firebase.firestore.FieldValue.arrayUnion(entry),
    updatedAt:     firebase.firestore.FieldValue.serverTimestamp(),
  });
  return entry;
}

async function updateProjectSerial(projectId, serialId, patch) {
  // arrayUnion/arrayRemove can't mutate in place, so read-modify-write.
  const snap = await projectDoc(projectId).get();
  const list = Array.isArray(snap.data().serialNumbers) ? snap.data().serialNumbers : [];
  const updated = list.map(e => e.id === serialId ? { ...e, ...patch } : e);
  await projectDoc(projectId).update({
    serialNumbers: updated,
    updatedAt:     firebase.firestore.FieldValue.serverTimestamp(),
  });
}

async function deleteProjectSerial(projectId, serialId) {
  const snap = await projectDoc(projectId).get();
  const list = Array.isArray(snap.data().serialNumbers) ? snap.data().serialNumbers : [];
  const entry = list.find(e => e.id === serialId);
  const updated = list.filter(e => e.id !== serialId);
  await projectDoc(projectId).update({
    serialNumbers: updated,
    updatedAt:     firebase.firestore.FieldValue.serverTimestamp(),
  });
  if (entry && entry.photoStoragePath) {
    try { await getStorage().ref(entry.photoStoragePath).delete(); }
    catch (e) { console.warn('Serial photo verwijderen mislukt', e); }
  }
}

async function uploadProjectSerialPhoto(projectId, serialId, file) {
  const email = currentUserEmail();
  if (!email) throw new Error('Niet ingelogd');
  if (!file || !file.type.startsWith('image/')) throw new Error('Alleen afbeeldingen.');
  const MAX_BYTES = 15 * 1024 * 1024;
  if (file.size > MAX_BYTES) throw new Error('Te groot (max 15 MB).');

  const ts = Date.now();
  const storagePath = `projects/${projectId}/serials/${serialId}_${ts}.jpg`;

  // Read existing entry to replace its photo (delete old blob after success).
  const snap = await projectDoc(projectId).get();
  const list = Array.isArray(snap.data().serialNumbers) ? snap.data().serialNumbers : [];
  const oldEntry = list.find(e => e.id === serialId);

  await getStorage().ref(storagePath).put(file, { contentType: file.type });

  const patch = {
    photoStoragePath: storagePath,
    uploadedAt:       new Date(),
    uploadedBy:       email,
  };
  const updated = list.map(e => e.id === serialId ? { ...e, ...patch } : e);
  await projectDoc(projectId).update({
    serialNumbers: updated,
    updatedAt:     firebase.firestore.FieldValue.serverTimestamp(),
  });

  if (oldEntry && oldEntry.photoStoragePath && oldEntry.photoStoragePath !== storagePath) {
    try { await getStorage().ref(oldEntry.photoStoragePath).delete(); }
    catch (e) { console.warn('Oude serial photo verwijderen mislukt', e); }
  }
}

async function getSerialPhotoUrl(storagePath) {
  if (!storagePath) return null;
  try { return await getStorage().ref(storagePath).getDownloadURL(); }
  catch (e) { console.warn('Serial photo URL ophalen mislukt', e); return null; }
}

// ─── OFFERTE WARNING PREDICATE ────────────────────────────────────────────────
// True iff project is in offerte-fase AND minstens één config heeft geen PDF en
// is niet dismissed.
function needsOfferteWarning(project) {
  if (!project) return false;
  if (typeof phaseForStatus !== 'function') return false;
  if (phaseForStatus(project.status).key !== 'offerte') return false;

  const types = (project.lastCalcRun && project.lastCalcRun.inputs && Array.isArray(project.lastCalcRun.inputs.selectedConfigTypes))
    ? project.lastCalcRun.inputs.selectedConfigTypes
    : [];
  const offertes = project.offertes || {};
  const dismissed = new Set(Array.isArray(project.dismissedConfigs) ? project.dismissedConfigs : []);
  return types.some(t => !dismissed.has(t) && !offertes[t]);
}
