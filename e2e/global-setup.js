// e2e/global-setup.js
import { chromium } from '@playwright/test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Global setup for Playwright E2E tests.
 * Creates a Firebase custom auth token via Admin SDK and signs in to save auth state.
 */
export default async function globalSetup() {
  const admin = require('firebase-admin');

  // 1. Initialize Firebase Admin SDK
  const serviceAccountPath = join(__dirname, 'service-account-key.json');
  const serviceAccount = require(serviceAccountPath);

  const app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  console.log('[global-setup] Firebase Admin SDK initialized');

  try {
    // 2. Look up the real user UID for kevin@bloxit.be
    // This ensures currentUser.email is populated after sign-in
    const email = 'kevin@bloxit.be';
    const userRecord = await admin.auth().getUserByEmail(email);
    const uid = userRecord.uid;

    console.log(`[global-setup] Fetched UID for ${email}: ${uid}`);

    // 3. Create custom auth token
    const customToken = await admin.auth().createCustomToken(uid);
    console.log('[global-setup] Custom token created');

    // 4. Launch browser
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log('[global-setup] Browser launched');

    // 5. Navigate to dashboard (triggers Firebase client SDK load)
    const baseURL = process.env.BASE_URL || 'http://localhost:8000';
    await page.goto(`${baseURL}/dashboard.html`);

    console.log(`[global-setup] Navigated to ${baseURL}/dashboard.html`);

    // 6. Wait for Firebase client SDK to load
    await page.waitForFunction(() => {
      return typeof window.firebase !== 'undefined' &&
             typeof window.firebase.auth === 'function';
    }, { timeout: 10000 });

    console.log('[global-setup] Firebase client SDK loaded');

    // 7. Inject custom token and sign in
    await page.evaluate(async (token) => {
      await window.firebase.auth().signInWithCustomToken(token);
    }, customToken);

    console.log('[global-setup] signInWithCustomToken() called');

    // 8. Wait for currentUser to be set
    await page.waitForFunction(() => {
      return window.firebase.auth().currentUser !== null &&
             window.firebase.auth().currentUser.email !== null;
    }, { timeout: 10000 });

    const signedInEmail = await page.evaluate(() => {
      return window.firebase.auth().currentUser.email;
    });

    console.log(`[global-setup] User signed in: ${signedInEmail}`);

    // 9. Save browser storage state
    const authStatePath = join(__dirname, 'auth-state.json');
    await context.storageState({ path: authStatePath });

    console.log(`[global-setup] Auth state saved to ${authStatePath}`);

    // 10. Cleanup
    await browser.close();
    console.log('[global-setup] Browser closed');

  } finally {
    // 11. Delete admin app
    await admin.app().delete();
    console.log('[global-setup] Firebase Admin app deleted');
  }
}
