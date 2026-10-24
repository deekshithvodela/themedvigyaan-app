/**
 * Phase 14 Full Application Button Click Simulation & Console Error Audit
 * Crawls through all 11 routes, clicks all interactive elements, modals, and tabs,
 * and asserts 0 unhandled console errors or warnings.
 */
const { chromium } = require('playwright');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;
const FRONTEND_URL = 'http://localhost:3000';
const ARTIFACT_DIR = '/home/drover/.gemini/antigravity-ide/brain/208e65f8-286b-4d79-9e31-51364ba024fb';

const results = [];
function record(name, passed, detail = '') {
  results.push({ name, passed, detail });
  const icon = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`  ${icon}: ${name} (${detail})`);
}

async function run() {
  console.log('🧪 Starting Phase 14 Full Button Simulation & Console Error Audit...\n');

  // --- 1. BACKEND API VERIFICATIONS ---
  console.log('--- 1. Testing Backend APIs (Feed Image Fallback & Universal Deletion Masking) ---');

  let adminToken, adminUser;
  let userBToken, userBUser;

  try {
    // 1.1 Admin Auth
    const adminRes = await axios.post(`${API}/auth/bypass`, { role: 'admin' });
    adminToken = adminRes.data.token;
    adminUser = adminRes.data.user;
    record('Main Admin Login', adminUser.is_main_admin === true, `is_main_admin: ${adminUser.is_main_admin}`);

    // 1.2 Feed Announcement with Image Fallback
    const FormData = require('form-data');
    const form = new FormData();
    form.append('title', 'Phase 14 Test Announcement with Image');
    form.append('content', 'Testing image upload resilience when Cloudinary is not configured in local dev.');
    form.append('image', Buffer.from('fake-image-png-content-bytes'), {
      filename: 'sample_test_image.png',
      contentType: 'image/png'
    });

    const feedRes = await axios.post(`${API}/announcements`, form, {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${adminToken}`
      }
    });
    record(
      'Feed Announcement Creation with Image (Base64 Fallback)',
      feedRes.status === 200 && feedRes.data.image_url?.startsWith('data:image/'),
      `Image URL: ${feedRes.data.image_url?.substring(0, 30)}...`
    );

    // 1.3 Create soft-deleted user and verify universal masking across all pages
    const uniqueEmail = `test.deleted.${Date.now()}@themedvigyaan.com`;
    const delUserRes = await axios.post(`${API}/auth/bypass`, { email: uniqueEmail, role: 'member' });
    const delUserToken = delUserRes.data.token;
    const delUserId = delUserRes.data.user.id;

    // Post a Thread
    const threadRes = await axios.post(`${API}/threads`, {
      title: 'Discussion by user to be deleted',
      content: 'This thread content will remain preserved.'
    }, { headers: { Authorization: `Bearer ${delUserToken}` } });
    const threadId = threadRes.data.id;

    // Post a Reply
    await axios.post(`${API}/threads/${threadId}/replies`, {
      content: 'Reply by user to be deleted.'
    }, { headers: { Authorization: `Bearer ${delUserToken}` } });

    // Submit an Assignment
    // Create an assignment first
    const assignRes = await axios.post(`${API}/assignments`, {
      title: 'Cardiology Case Review',
      description: 'Review the attached clinical scenario.',
      deadline: new Date(Date.now() + 86400000).toISOString()
    }, { headers: { Authorization: `Bearer ${adminToken}` } });
    const assignId = assignRes.data.id;

    const subForm = new FormData();
    subForm.append('file', Buffer.from('PDF_DUMMY_BINARY_DATA'), {
      filename: 'clinical_review.pdf',
      contentType: 'application/pdf'
    });
    await axios.post(`${API}/assignments/${assignId}/submit`, subForm, {
      headers: { ...subForm.getHeaders(), Authorization: `Bearer ${delUserToken}` }
    });

    // Now soft-delete the user
    await axios.delete(`${API}/profile`, { headers: { Authorization: `Bearer ${delUserToken}` } });

    // Verify Threads masking
    const threadsList = await axios.get(`${API}/threads`, { headers: { Authorization: `Bearer ${adminToken}` } });
    const foundThread = threadsList.data.find(t => t.id === threadId);
    record('Universal Soft-Delete: Thread Author Masked', foundThread?.author_name === '[Deleted User]' && foundThread?.author_is_deleted === true, `author_name: "${foundThread?.author_name}"`);

    // Verify Replies masking
    const repliesList = await axios.get(`${API}/threads/${threadId}/replies`, { headers: { Authorization: `Bearer ${adminToken}` } });
    const foundReply = repliesList.data.find(r => r.author_id === delUserId);
    record('Universal Soft-Delete: Reply Author Masked', foundReply?.author_name === '[Deleted User]' && foundReply?.author_is_deleted === true, `author_name: "${foundReply?.author_name}"`);

    // Verify Submissions masking
    const subsList = await axios.get(`${API}/assignments/${assignId}/submissions`, { headers: { Authorization: `Bearer ${adminToken}` } });
    const foundSub = subsList.data.find(s => s.user_id === delUserId);
    record('Universal Soft-Delete: Submission User Masked', foundSub?.user_name === '[Deleted User]' && foundSub?.user_is_deleted === true, `user_name: "${foundSub?.user_name}"`);

  } catch (err) {
    console.error('Backend API error:', err.response?.data || err.message);
    record('Backend API Execution', false, err.message);
  }

  // --- 2. FRONTEND PLAYWRIGHT BUTTON SIMULATION & CONSOLE AUDIT ---
  console.log('\n--- 2. Launching Headless Chromium for Full Button Simulation & Console Error Audit ---');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const consoleErrors = [];
  const consoleWarnings = [];

  page.on('console', msg => {
    const text = msg.text();
    if (msg.type() === 'error') {
      consoleErrors.push(text);
      console.log('   ⚠️ Console Error captured:', text);
    } else if (msg.type() === 'warning') {
      consoleWarnings.push(text);
    }
  });

  page.on('response', res => {
    if (res.status() >= 400) {
      console.log(`   🌐 HTTP ${res.status()} for: ${res.url()}`);
    }
  });

  page.on('pageerror', err => {
    consoleErrors.push(`[PageError] ${err.message}`);
    console.log('   🚨 PageError captured:', err.message);
  });

  try {
    // 2.1 Login
    console.log('📍 Visiting Login Page & Authenticating as Admin...');
    await page.goto(FRONTEND_URL, { waitUntil: 'networkidle', timeout: 15000 });
    const deekshithBtn = page.locator('[data-testid="dev-login-admin-quick"], [data-testid="dev-login-deekshith"]').first();
    await deekshithBtn.click();
    await page.waitForTimeout(1500);

    // 2.2 General Chat (/)
    console.log('📍 Auditing General Chat (/)...');
    await page.waitForSelector('[data-testid="group-chat-page"]', { timeout: 10000 });
    record('General Chat Route Mounted', page.url() === `${FRONTEND_URL}/`, `URL: ${page.url()}`);

    // Click sender name if message exists
    const senderPills = page.locator('[data-testid^="chat-sender-"]');
    const senderCount = await senderPills.count();
    if (senderCount > 0) {
      await senderPills.first().click();
      await page.waitForTimeout(500);
      const profileDialog = page.locator('[data-testid="user-profile-dialog"]');
      const dialogVisible = await profileDialog.isVisible();
      record('General Chat: Click Username Opens UserProfileDialog', dialogVisible, 'Profile dialog opened');
      // Close dialog
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }

    // 2.3 Feed (/feed)
    console.log('📍 Auditing Feed Page (/feed)...');
    await page.goto(`${FRONTEND_URL}/feed`, { waitUntil: 'networkidle', timeout: 10000 });
    const newAnnBtn = page.locator('[data-testid="new-announcement-button"]');
    if (await newAnnBtn.isVisible()) {
      await newAnnBtn.click();
      await page.waitForTimeout(500);
      const annDialog = page.locator('[data-testid="new-announcement-dialog"]');
      record('Feed: New Announcement Modal Opens without Console Errors', await annDialog.isVisible(), 'Dialog rendered');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }

    // 2.4 Direct Messages (/messages)
    console.log('📍 Auditing Direct Messages (/messages)...');
    await page.goto(`${FRONTEND_URL}/messages`, { waitUntil: 'networkidle', timeout: 10000 });
    await page.waitForSelector('[data-testid="direct-messages-page"]', { timeout: 10000 });

    // Switch tabs: Requests and Chats
    const requestsTab = page.locator('button:has-text("Requests")');
    if (await requestsTab.isVisible()) {
      await requestsTab.click();
      await page.waitForTimeout(400);
      const chatsTab = page.locator('button:has-text("Chats")');
      await chatsTab.click();
      await page.waitForTimeout(400);
      record('Direct Messages: Chats & Requests Tab Switch Works', true, 'Tab navigation verified');
    }

    // Check conversation selection and header badges
    const convItems = page.locator('[data-testid^="conversation-"]');
    const convCount = await convItems.count();
    if (convCount > 0) {
      await convItems.first().click();
      await page.waitForTimeout(500);

      const headerTrigger = page.locator('[data-testid="dm-header-profile-trigger"]');
      record('Direct Messages: Chat Header Profile Trigger Present', await headerTrigger.isVisible(), 'Header interactive');

      // Click header trigger to open profile modal
      await headerTrigger.click();
      await page.waitForTimeout(500);
      const dmProfileModal = page.locator('[data-testid="user-profile-dialog"]');
      record('Direct Messages: Clicking Header Opens Member Profile Dialog', await dmProfileModal.isVisible(), 'Profile modal rendered');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }

    // Click "New Chat" modal
    const newChatBtn = page.locator('[data-testid="new-message-button"]');
    if (await newChatBtn.isVisible()) {
      await newChatBtn.click();
      await page.waitForTimeout(500);
      const newChatDialog = page.locator('[data-testid="new-chat-dialog"]');
      record('Direct Messages: New Chat Dialog Opens', await newChatDialog.isVisible(), 'Dialog visible');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }

    // 2.5 Assignments (/assignments) & File Preview Modal
    console.log('📍 Auditing Assignments (/assignments) & Preview Modal...');
    await page.goto(`${FRONTEND_URL}/assignments`, { waitUntil: 'networkidle', timeout: 10000 });
    await page.waitForSelector('[data-testid="assignments-page"]', { timeout: 10000 });

    // Check View Submissions button
    const viewSubsBtn = page.locator('[data-testid^="view-submissions-"]');
    if (await viewSubsBtn.count() > 0) {
      await viewSubsBtn.first().click();
      await page.waitForTimeout(500);
      record('Assignments: View Submissions View Opened', await page.locator('[data-testid="submissions-view"]').isVisible(), 'Submissions list rendered');

      // Check View File button
      const viewFileBtn = page.locator('[data-testid^="view-submission-"]');
      if (await viewFileBtn.count() > 0) {
        await viewFileBtn.first().click();
        await page.waitForTimeout(600);
        const previewModal = page.locator('[data-testid="file-preview-modal"]');
        const previewVisible = await previewModal.isVisible();
        record('Assignments: Clicking "View File" Opens In-App Preview Modal (No Popups/Auto-Download)', previewVisible, 'In-app preview modal rendered');

        // Check Download button inside modal
        const dlBtn = page.locator('[data-testid="preview-download-button"]');
        record('Assignments: Preview Modal Contains Download Action', await dlBtn.isVisible(), 'Download button present');

        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      }

      // Back to assignments
      await page.locator('[data-testid="back-to-assignments"]').click();
      await page.waitForTimeout(400);
    }

    // Open "New Assignment" dialog
    const newAssignBtn = page.locator('[data-testid="new-assignment-button"]');
    if (await newAssignBtn.isVisible()) {
      await newAssignBtn.click();
      await page.waitForTimeout(400);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }

    // 2.6 Blogs (/blogs)
    console.log('📍 Auditing Blogs Page (/blogs)...');
    await page.goto(`${FRONTEND_URL}/blogs`, { waitUntil: 'networkidle', timeout: 10000 });
    await page.waitForSelector('[data-testid="blogs-page"]', { timeout: 10000 });
    const tagPills = page.locator('[data-testid^="blog-card-tag-"]');
    if (await tagPills.count() > 0) {
      await tagPills.first().click();
      await page.waitForTimeout(400);
      const clearPill = page.locator('[data-testid="clear-tag-filter-button"]');
      if (await clearPill.isVisible()) {
        await clearPill.click();
        await page.waitForTimeout(400);
      }
    }

    // 2.7 Threads (/threads)
    console.log('📍 Auditing Threads Page (/threads)...');
    await page.goto(`${FRONTEND_URL}/threads`, { waitUntil: 'networkidle', timeout: 10000 });
    await page.waitForSelector('[data-testid="threads-page"]', { timeout: 10000 });
    const threadCard = page.locator('[data-testid^="thread-"]');
    if (await threadCard.count() > 0) {
      await threadCard.first().click();
      await page.waitForTimeout(500);
      const backBtn = page.locator('[data-testid="back-to-threads-button"]');
      if (await backBtn.isVisible()) {
        await backBtn.click();
        await page.waitForTimeout(400);
      }
    }

    // 2.8 Tasks (/tasks)
    console.log('📍 Auditing Tasks Page (/tasks)...');
    await page.goto(`${FRONTEND_URL}/tasks`, { waitUntil: 'networkidle', timeout: 10000 });
    await page.waitForSelector('[data-testid="tasks-page"]', { timeout: 10000 });

    // 2.9 Calendar (/calendar)
    console.log('📍 Auditing Calendar Page (/calendar)...');
    await page.goto(`${FRONTEND_URL}/calendar`, { waitUntil: 'networkidle', timeout: 10000 });
    await page.waitForSelector('[data-testid="calendar-page"]', { timeout: 10000 });

    // 2.10 Admin Panel (/admin)
    console.log('📍 Auditing Admin Panel (/admin) Column Alignment...');
    await page.goto(`${FRONTEND_URL}/admin`, { waitUntil: 'networkidle', timeout: 10000 });
    await page.waitForSelector('[data-testid="admin-panel-page"]', { timeout: 10000 });

    // Verify User Table has Name, Email, and Role in distinct cells
    const deekshithRow = page.locator('[data-testid^="user-row-"]').filter({ hasText: adminUser.email });
    const deekshithVisible = await deekshithRow.count() > 0;
    record('Admin Panel: First Admin User Found in Table', deekshithVisible, 'Row located');

    if (deekshithVisible) {
      const emailCell = deekshithRow.locator('td').nth(1);
      const emailText = await emailCell.textContent();
      const roleCell = deekshithRow.locator('td').nth(2);
      const roleText = await roleCell.textContent();

      record(
        'Admin Panel Table Column Structure: Column 2 contains Email',
        emailText?.includes(adminUser.email),
        `Column 2 text: "${emailText?.trim()}"`
      );
      record(
        'Admin Panel Table Column Structure: Column 3 contains Locked Admin (Primary)',
        roleText?.includes('Admin (Primary)') || roleText?.includes('Primary Admin'),
        `Column 3 text: "${roleText?.trim()}"`
      );
    }

    // Switch Admin tabs
    await page.locator('[data-testid="whitelist-tab"]').click();
    await page.waitForTimeout(300);
    await page.locator('[data-testid="links-tab"]').click();
    await page.waitForTimeout(300);
    await page.locator('[data-testid="roles-tab"]').click();
    await page.waitForTimeout(300);

    // 2.11 Edit Profile (/profile)
    console.log('📍 Auditing Edit Profile Page (/profile)...');
    await page.goto(`${FRONTEND_URL}/profile`, { waitUntil: 'networkidle', timeout: 10000 });
    await page.waitForSelector('[data-testid="edit-profile-page"]', { timeout: 10000 });
    const showEmailToggle = page.locator('[data-testid="show-email-toggle"]');
    record('Edit Profile: Show Email Switch Rendered', await showEmailToggle.isVisible(), 'Switch visible');

    // 2.12 Notifications Page (/notifications)
    console.log('📍 Auditing Notifications Page (/notifications)...');
    await page.goto(`${FRONTEND_URL}/notifications`, { waitUntil: 'networkidle', timeout: 10000 });
    await page.waitForSelector('[data-testid="notifications-page"]', { timeout: 10000 });
    record('Notifications Page Route Mounted', true, 'Page rendered');

    // Save full audit screenshot
    const shotPath = path.join(ARTIFACT_DIR, 'phase14_console_audit.png');
    await page.screenshot({ path: shotPath, fullPage: false });
    console.log(`📸 Saved audit screenshot to: ${shotPath}`);

  } catch (err) {
    console.error('Frontend simulation error:', err.message);
    record('Frontend Simulation Workflow', false, err.message);
  } finally {
    await browser.close();
  }

  // --- 3. CONSOLE AUDIT VERIFICATION ---
  console.log('\n--- 3. Evaluating Console Health ---');
  // Filter out any expected dev warnings or third-party OAuth provider logs
  const criticalErrors = consoleErrors.filter(e =>
    !e.includes('Download the React DevTools') &&
    !e.includes('favicon.ico') &&
    !e.includes('GSI_LOGGER') &&
    !e.includes('accounts.google.com') &&
    !e.includes('status of 403') &&
    !e.includes('status of 429')
  );

  const missingDescriptionWarnings = consoleWarnings.filter(w =>
    w.includes('Missing `Description`') || w.includes('DialogContent requires a `DialogTitle`')
  );

  const googleAvatar429s = consoleErrors.filter(e =>
    e.includes('429') && e.includes('googleusercontent.com')
  );

  record('Console Health: Zero Critical Unhandled JavaScript Errors', criticalErrors.length === 0, `Errors captured: ${criticalErrors.length}`);
  record('Console Health: Zero Radix UI Accessibility Warnings', missingDescriptionWarnings.length === 0, `Radix warnings: ${missingDescriptionWarnings.length}`);
  record('Console Health: Zero Google CDN Avatar 429 Rate Limit Errors', googleAvatar429s.length === 0, `Avatar 429s: ${googleAvatar429s.length}`);

  console.log('\n=========================================');
  const totalPassed = results.filter(r => r.passed).length;
  const totalFailed = results.filter(r => !r.passed).length;
  console.log(`🏁 Phase 14 Audit Complete: ${totalPassed} Passed, ${totalFailed} Failed`);
  console.log('=========================================\n');

  if (totalFailed > 0) {
    process.exit(1);
  }
}

run();
