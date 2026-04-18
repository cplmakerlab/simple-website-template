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

function getStatusMeta(key) {
  return PROJECT_STATUSES.find(s => s.key === key) || { key, label: key, color: '#9aa3b2' };
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
// if no CSV was uploaded at creation. Returns the new document reference.
async function createProject({ projectName, customerName, status, csvData }) {
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
  await projectDoc(id).update({
    lastCalcRun: {
      calculatedAt:  firebase.firestore.FieldValue.serverTimestamp(),
      calculatedBy:  email,
      inputs,
      results,
    },
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}
