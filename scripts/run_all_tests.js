/**
 * Consolidated Master Test Harness (scripts/run_all_tests.js)
 *
 * Orchestrates full end-to-end regression testing, security headers validation,
 * privacy leak audits, legal document integrity, and UI/accessibility verification.
 *
 * Runs:
 * 1. Security Headers & Privacy Leak Validation (10 checks)
 * 2. Legal Documents & Exclusive Footer Verification (7 checks)
 * 3. Phase 14 Button & Console Audit (scripts/simulate_all_buttons_console_audit.js)
 * 4. Phase 15 Responsive UI & Accessibility Audit (scripts/verify_responsive_ui_audit.js)
 * 5. Phase 16 Bugfix Verification (scripts/verify_phase16_fixes.js)
 */

const { execSync, spawn } = require('child_process');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const ROOT_DIR = path.resolve(__dirname, '..');

const testResults = [];
let suiteStartTime = Date.now();

function record(suite, name, passed, detail = '') {
  testResults.push({ suite, name, passed, detail });
  const icon = passed ? '  ✅ PASS' : '  ❌ FAIL';
  console.log(`${icon}: [${suite}] ${name}${detail ? ` (${detail})` : ''}`);
}

async function runChildScript(scriptName, suiteTitle) {
  console.log(`\n======================================================`);
  console.log(`🚀 Executing Suite: ${suiteTitle} (${scriptName})`);
  console.log(`======================================================\n`);

  const scriptPath = path.join(__dirname, scriptName);
  return new Promise((resolve) => {
    const nodeEnv = {
      ...process.env,
      NODE_PATH: `${process.env.NODE_PATH || ''}:/home/drover/.npm/_npx/420ff84f11983ee5/node_modules:${path.join(ROOT_DIR, 'frontend/node_modules')}`
    };

    const child = spawn('node', [scriptPath], {
      env: nodeEnv,
      cwd: ROOT_DIR,
      stdio: 'inherit'
    });

    child.on('close', (code) => {
      const passed = code === 0;
      record(suiteTitle, `Process Exit Code`, passed, `Exit code: ${code}`);
      resolve(passed);
    });

    child.on('error', (err) => {
      record(suiteTitle, `Execution Error`, false, err.message);
      resolve(false);
    });
  });
}

async function runSecurityAndPrivacyChecks() {
  console.log('\n======================================================');
  console.log('🔒 Suite 1: Security Headers, Privacy Leaks & Legal Documents');
  console.log('======================================================\n');

  // Check 1.1: Security Headers on Backend Response
  try {
    const res = await axios.get(`${BACKEND_URL}/api/users`, { validateStatus: () => true });
    const headers = res.headers;
    record('Security Headers', 'X-Content-Type-Options is nosniff', headers['x-content-type-options'] === 'nosniff', headers['x-content-type-options']);
    record('Security Headers', 'X-Frame-Options is DENY', headers['x-frame-options'] === 'DENY', headers['x-frame-options']);
    record('Security Headers', 'Referrer-Policy is strict-origin-when-cross-origin', headers['referrer-policy'] === 'strict-origin-when-cross-origin', headers['referrer-policy']);
  } catch (err) {
    record('Security Headers', 'Fetch Headers', false, err.message);
  }

  // Check 1.2: Privacy Leak Audit in Source Files
  const serverPy = fs.readFileSync(path.join(ROOT_DIR, 'backend/server.py'), 'utf8');
  const loginJsx = fs.readFileSync(path.join(ROOT_DIR, 'frontend/src/pages/LoginPage.jsx'), 'utf8');
  const gitignore = fs.readFileSync(path.join(ROOT_DIR, '.gitignore'), 'utf8');

  const leakedEmail = process.env.AUDIT_PERSONAL_EMAIL || ['deekshith', 'vodela', '@', 'gmail.com'].join('');
  record('Privacy Leak Audit', 'backend/server.py free of hardcoded personal email', !serverPy.includes(leakedEmail), '0 instances');
  record('Privacy Leak Audit', 'LoginPage.jsx bypass payload free of hardcoded email', !loginJsx.includes(`email: '${leakedEmail}'`), 'Clean payload');
  record('Privacy Leak Audit', '.gitignore contains instructions.md', gitignore.includes('instructions.md') && gitignore.includes('instructions'), 'Properly ignored');

  // Check 1.3: Legal Documents Presence and Integrity
  const licensePath = path.join(ROOT_DIR, 'LICENSE');
  const privacyPath = path.join(ROOT_DIR, 'PRIVACY_POLICY.md');
  const disclosurePath = path.join(ROOT_DIR, 'DISCLOSURE.md');

  const licenseExists = fs.existsSync(licensePath);
  const licenseContent = licenseExists ? fs.readFileSync(licensePath, 'utf8') : '';
  record('Legal Governance', 'LICENSE file exists and contains MIT + Deekshith Vodela copyright', licenseExists && licenseContent.includes('Copyright (c) 2026 Deekshith Vodela'), 'MIT License valid');
  record('Legal Governance', 'LICENSE file is free of LinkedIn URL', licenseExists && !licenseContent.includes('linkedin.com'), 'LinkedIn URL removed from LICENSE');

  const privacyExists = fs.existsSync(privacyPath);
  const privacyContent = privacyExists ? fs.readFileSync(privacyPath, 'utf8') : '';
  record('Legal Governance', 'PRIVACY_POLICY.md covers Google OAuth and 30-day retention', privacyExists && privacyContent.includes('Google OAuth') && /30-day/i.test(privacyContent), 'Privacy Policy verified');

  const disclosureExists = fs.existsSync(disclosurePath);
  const disclosureContent = disclosureExists ? fs.readFileSync(disclosurePath, 'utf8') : '';
  record('Legal Governance', 'DISCLOSURE.md covers Academic Education and Vulnerability Reporting', disclosureExists && disclosureContent.includes('Academic') && disclosureContent.includes('Responsible Security Disclosure'), 'Disclosures verified');

  // Check 1.4: Deployment Guide Appendix Check
  const deployGuide = fs.readFileSync(path.join(ROOT_DIR, 'DEPLOYMENT_GUIDE.md'), 'utf8');
  record('Deployment Guide', 'DEPLOYMENT_GUIDE.md contains updated environment variables appendix', deployGuide.includes('Additional & Updated Production Environment Variables') && deployGuide.includes('REACT_APP_GOOGLE_CLIENT_ID'), 'Appendix present');
}

async function runBrowserLegalFooterCheck() {
  console.log('\n======================================================');
  console.log('⚖️ Suite 2: Browser Verification of Legal Footer Exclusivity');
  console.log('======================================================\n');

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();

    // 2.1 Visit Login Page with fresh unauthenticated session on mobile 360x800 viewport
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(`${FRONTEND_URL}/login`);
    await page.evaluate(() => localStorage.clear());
    await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForSelector('[data-testid="login-legal-footer"]', { timeout: 10000 });

    const card = page.locator('.auth-card');
    const cardBox = await card.boundingBox();
    const footer = page.locator('[data-testid="login-legal-footer"]');
    const footerBox = await footer.boundingBox();

    // Verify Horizontal Symmetry & Center Alignment
    const cardLeftMargin = Math.round(cardBox.x);
    const cardRightMargin = Math.round(360 - (cardBox.x + cardBox.width));
    const isCardSymmetric = Math.abs(cardLeftMargin - cardRightMargin) <= 1;
    record('Auth Layout Symmetry', 'Auth card is horizontally symmetric on 360px viewport', isCardSymmetric, `Left: ${cardLeftMargin}px, Right: ${cardRightMargin}px`);

    const cardCenterX = Math.round(cardBox.x + cardBox.width / 2);
    record('Auth Layout Symmetry', 'Auth card center X matches screen center (180px)', Math.abs(cardCenterX - 180) <= 1, `Center: ${cardCenterX}px`);

    const footerCenterX = Math.round(footerBox.x + footerBox.width / 2);
    record('Auth Layout Symmetry', 'Footer center X matches screen center (180px)', Math.abs(footerCenterX - 180) <= 1, `Center: ${footerCenterX}px`);

    const noOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    record('Auth Layout Symmetry', 'Zero horizontal scroll/overflow on mobile 360px', noOverflow);

    const footerVisible = await footer.isVisible();
    record('Legal Footer UI', 'Legal footer is visible on /login', footerVisible);

    const copyrightLink = page.locator('[data-testid="legal-copyright-link"]');
    const href = await copyrightLink.getAttribute('href');
    const copyrightText = await copyrightLink.textContent();
    record('Legal Footer UI', 'Copyright points to Deekshith Vodela LinkedIn profile', href === 'https://www.linkedin.com/in/deekshithvodela/' && copyrightText.includes('Deekshith Vodela'), `href: ${href}`);

    // Check modal triggers
    const licenseBtn = page.locator('[data-testid="legal-btn-license"]');
    const privacyBtn = page.locator('[data-testid="legal-btn-privacy"]');
    const disclosureBtn = page.locator('[data-testid="legal-btn-disclosure"]');

    record('Legal Footer UI', 'License modal trigger button exists', await licenseBtn.isVisible());
    record('Legal Footer UI', 'Privacy policy modal trigger button exists', await privacyBtn.isVisible());
    record('Legal Footer UI', 'Disclosure modal trigger button exists', await disclosureBtn.isVisible());

    // Click MIT License and verify dialog opens without LinkedIn URL in modal content
    await licenseBtn.click();
    await page.waitForTimeout(500);
    const dialogTitle = page.locator('[data-testid="legal-dialog-title"]');
    const titleText = await dialogTitle.textContent();
    record('Legal Footer UI', 'MIT License modal dialog opens on click', titleText?.includes('MIT License'), `Title: ${titleText}`);

    const dialogContent = await page.locator('[role="dialog"]').textContent();
    const modalHasCopyright = dialogContent.includes('Copyright (c) 2026 Deekshith Vodela');
    const modalNoLinkedIn = !dialogContent.includes('https://www.linkedin.com/in/deekshithvodela/');
    record('Legal Governance', 'MIT License modal dialog contains copyright and no LinkedIn URL', modalHasCopyright && modalNoLinkedIn, 'Modal text clean');

    // Close dialog
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);

    // 2.2 Test Member Bypass Login
    const memberLoginBtn = page.locator('[data-testid="dev-login-member"]');
    record('Dev Auth Bypass', 'Member bypass login button is visible', await memberLoginBtn.isVisible());
    await memberLoginBtn.click();
    await page.waitForTimeout(1200);
    const memberAuthed = await page.evaluate(() => !!localStorage.getItem('token'));
    record('Dev Auth Bypass', 'Member bypass login successfully authenticates and mounts dashboard', memberAuthed && page.url().includes('/'));

    // Clear session and return to login for admin check
    await page.evaluate(() => localStorage.clear());
    await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle' });

    // 2.3 Authenticate as admin and verify legal footer is ABSENT on internal pages
    const devLoginBtn = page.locator('[data-testid="dev-login-admin-quick"], [data-testid="dev-login-deekshith"]').first();
    await devLoginBtn.click();
    await page.waitForTimeout(1500);

    // Now on Dashboard /
    const internalFooter = page.locator('[data-testid="login-legal-footer"]');
    const internalFooterCount = await internalFooter.count();
    record('Legal Footer Exclusivity', 'Legal footer is ABSENT from internal Dashboard page', internalFooterCount === 0, 'Clean internal UI');

  } catch (err) {
    record('Legal Footer UI', 'Browser UI verification exception', false, err.message);
  } finally {
    await browser.close();
  }
}

async function main() {
  console.log(`\n======================================================`);
  console.log(`🏁 THE MEDVIGYAAN - CONSOLIDATED MASTER TEST HARNESS 🏁`);
  console.log(`======================================================`);

  try {
    // Suite 1: Security Headers & Privacy Leaks
    await runSecurityAndPrivacyChecks();

    // Suite 2: Browser Verification of Legal Footer
    await runBrowserLegalFooterCheck();

    // Suite 3: Button Click & Console Error Audit
    await runChildScript('simulate_all_buttons_console_audit.js', 'Phase 14 Button & Console Audit');

    // Suite 4: Responsive UI & Accessibility Audit
    await runChildScript('verify_responsive_ui_audit.js', 'Phase 15 Responsive UI & A11y Audit');

    // Suite 5: Phase 16 Comprehensive Fixes
    await runChildScript('verify_phase16_fixes.js', 'Phase 16 Fixes & Notifications Audit');

  } catch (error) {
    console.error('Fatal test harness execution error:', error);
  }

  // --- FINAL SUMMARY REPORT ---
  const elapsedSec = ((Date.now() - suiteStartTime) / 1000).toFixed(2);
  const total = testResults.length;
  const passed = testResults.filter(r => r.passed).length;
  const failed = testResults.filter(r => !r.passed).length;

  console.log(`\n======================================================`);
  console.log(`📊 MASTER TEST HARNESS EXECUTION SUMMARY`);
  console.log(`======================================================`);
  console.log(`  Total Checks Executed : ${total}`);
  console.log(`  Checks Passed         : ${passed} ✅`);
  console.log(`  Checks Failed         : ${failed} ${failed > 0 ? '❌' : '🎉'}`);
  console.log(`  Total Suite Duration  : ${elapsedSec}s`);
  console.log(`======================================================\n`);

  if (failed > 0) {
    console.log('🚨 Failures Encountered:');
    testResults.filter(r => !r.passed).forEach(r => {
      console.log(`  - [${r.suite}] ${r.name}: ${r.detail}`);
    });
    process.exit(1);
  } else {
    console.log('🌟 ALL TEST SUITES PASSED WITH 100% SUCCESS RATE! 🌟\n');
    process.exit(0);
  }
}

main();
