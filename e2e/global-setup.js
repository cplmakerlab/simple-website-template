// e2e/global-setup.js
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { writeFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Global setup for Playwright E2E tests.
 *
 * Creates a Firebase custom auth token via Admin SDK and saves it to a file.
 * Each test then injects the token via signInWithCustomToken() on the client
 * (Firebase auth uses IndexedDB, so Playwright's storageState doesn't help).
 */
export default async function globalSetup() {
  const admin = require('firebase-admin');

  // 1. Initialize Firebase Admin SDK
  const serviceAccountPath = join(__dirname, 'service-account-key.json');
  const serviceAccount = require(serviceAccountPath);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  console.log('[global-setup] Firebase Admin SDK initialized');

  try {
    // 2. Look up the real user UID for kevin@bloxit.be
    const email = 'kevin@bloxit.be';
    const userRecord = await admin.auth().getUserByEmail(email);
    const uid = userRecord.uid;

    console.log(`[global-setup] Fetched UID for ${email}: ${uid}`);

    // 3. Create custom auth token (valid for 1 hour)
    const customToken = await admin.auth().createCustomToken(uid);
    console.log('[global-setup] Custom token created');

    // 4. Save token to file so tests can read it
    const tokenPath = join(__dirname, 'auth-token.json');
    writeFileSync(tokenPath, JSON.stringify({ token: customToken }));
    console.log(`[global-setup] Token saved to ${tokenPath}`);

  } finally {
    await admin.app().delete();
    console.log('[global-setup] Firebase Admin app deleted');
  }
}
