// e2e/helpers/auth-fixture.js
//
// Custom Playwright test fixture that auto-authenticates every page
// via Firebase signInWithCustomToken.
//
// Firebase auth persists in IndexedDB, so once authenticated in a browser
// context, subsequent navigations within the same context stay logged in.
//
// Usage: import { test, expect } from '../helpers/auth-fixture.js';

import { test as base, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOKEN_PATH = join(__dirname, '..', 'auth-token.json');

/** Read the custom token saved by global-setup.js */
function getCustomToken() {
  const data = JSON.parse(readFileSync(TOKEN_PATH, 'utf8'));
  return data.token;
}

/**
 * Sign in to Firebase on a Playwright page using the custom token.
 * The page must already be on a URL that loads the Firebase SDK.
 *
 * Safe to call multiple times — if already signed in, it's a no-op.
 */
export async function firebaseSignIn(page) {
  // Wait for Firebase client SDK to load
  await page.waitForFunction(
    () => typeof window.firebase !== 'undefined' &&
          typeof window.firebase.auth === 'function',
    { timeout: 15_000 },
  );

  // Check if already signed in
  const alreadySignedIn = await page.evaluate(() => {
    const u = window.firebase.auth().currentUser;
    return u !== null && u.email !== null;
  });

  if (alreadySignedIn) return;

  const token = getCustomToken();

  // Sign in with custom token
  await page.evaluate(async (t) => {
    await window.firebase.auth().signInWithCustomToken(t);
  }, token);

  // Wait for auth state to settle (currentUser + email)
  await page.waitForFunction(
    () => {
      const u = window.firebase.auth().currentUser;
      return u !== null && u.email !== null;
    },
    { timeout: 10_000 },
  );
}

/**
 * Extended test fixture: every test gets a page that is already signed in.
 *
 * The fixture navigates to dashboard.html (loads Firebase SDK), signs in,
 * then hands the page to the test. Firebase auth persists in IndexedDB,
 * so navigating to other pages within the same test keeps the session.
 */
export const test = base.extend({
  page: async ({ page, baseURL }, use) => {
    // Navigate to a page that loads the Firebase SDK
    await page.goto(`${baseURL}/dashboard.html`);

    // Authenticate
    await firebaseSignIn(page);

    // Wait for the auth-gated UI to appear (proves auth worked)
    await page.waitForSelector('#stateAuthorized', {
      state: 'visible',
      timeout: 15_000,
    });

    // Hand the authenticated page to the test
    await use(page);
  },
});

export { expect };
