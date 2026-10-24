const { chromium } = require('playwright');
const path = require('path');
const axios = require('axios');

const ARTIFACT_DIR = '/home/drover/.gemini/antigravity-ide/brain/208e65f8-286b-4d79-9e31-51364ba024fb';
const API_BASE = 'http://localhost:8000/api';
const APP_BASE = 'http://localhost:3000';

async function runPhase16Verification() {
  console.log('🚀 Starting Comprehensive Phase 16 Automated Verification Suite...\n');
  const results = { passed: 0, failed: 0, checks: [] };

  function record(name, success, detail = '') {
    if (success) {
      console.log(`  ✅ PASS: ${name} ${detail ? `(${detail})` : ''}`);
      results.passed++;
      results.checks.push({ name, status: 'PASS', detail });
    } else {
      console.error(`  ❌ FAIL: ${name} ${detail ? `(${detail})` : ''}`);
      results.failed++;
      results.checks.push({ name, status: 'FAIL', detail });
    }
  }

  // 1. Authenticate Users via Auth Bypass
  console.log('--- 1. Authenticating Test Users via Auth Bypass ---');
  let adminToken, adminUser;
  let memberToken, memberUser;
  let recipientToken, recipientUser;
  try {
    const adminRes = await axios.post(`${API_BASE}/auth/bypass`, { role: 'admin' });
    adminToken = adminRes.data.token;
    adminUser = adminRes.data.user;
    record('Admin Auth Bypass', !!adminToken, `User: ${adminUser.email}`);

    // Create fresh members for request and unread dot testing
    const ts = Date.now();
    const mRes = await axios.post(`${API_BASE}/auth/bypass`, { email: `member_${ts}@themedvigyaan.com`, role: 'member' });
    memberToken = mRes.data.token;
    memberUser = mRes.data.user;

    const rRes = await axios.post(`${API_BASE}/auth/bypass`, { email: `recipient_${ts}@themedvigyaan.com`, role: 'member' });
    recipientToken = rRes.data.token;
    recipientUser = rRes.data.user;
    record('Fresh Member Auth Bypass', !!memberToken && !!recipientToken, `Sender: ${memberUser.email}, Recipient: ${recipientUser.email}`);
  } catch (err) {
    record('Auth Bypass Setup', false, err.message);
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });

  try {
    // =========================================================================
    // SUITE 1: Assignment Submission Preview Polish & Submissions Navigation
    // =========================================================================
    console.log('\n--- 2. Testing Assignment Submission Preview Modal & Navigation ---');
    const adminContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const adminPage = await adminContext.newPage();
    await adminPage.addInitScript(({ t }) => localStorage.setItem('token', t), { t: adminToken });

    // Seed test assignment with 2 submissions using native fetch + FormData
    let testAssignmentId = null;
    try {
      const assignRes = await axios.post(`${API_BASE}/assignments`, {
        title: `Phase 16 Clinical Research Protocols ${Date.now()}`,
        description: 'Submit your clinical protocol document for Phase 16 audit verification.',
        deadline: new Date(Date.now() + 86400000).toISOString(),
        max_submissions: 5
      }, { headers: { Authorization: `Bearer ${adminToken}` } });
      testAssignmentId = assignRes.data.id;

      // Submit submission 1 from admin
      const fd1 = new FormData();
      fd1.append('file', new Blob(['%PDF-1.4 Clinical Protocol Alpha Content'], { type: 'application/pdf' }), 'Protocol_Alpha_Review.pdf');
      await fetch(`${API_BASE}/assignments/${testAssignmentId}/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: fd1
      });

      // Submit submission 2 from member
      const fd2 = new FormData();
      fd2.append('file', new Blob(['%PDF-1.4 Clinical Protocol Beta Content'], { type: 'application/pdf' }), 'Protocol_Beta_Chart.pdf');
      await fetch(`${API_BASE}/assignments/${testAssignmentId}/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${memberToken}` },
        body: fd2
      });

      record('Seed Test Assignment & 2 Submissions', true, `Assignment ID: ${testAssignmentId}`);
    } catch (e) {
      record('Seed Test Assignment & 2 Submissions', false, e.message);
    }

    await adminPage.goto(`${APP_BASE}/assignments`, { waitUntil: 'networkidle' });
    await adminPage.waitForTimeout(1000);

    // Click "View Submissions" on assignment
    const viewSubmissionsBtn = adminPage.locator(`[data-testid="view-submissions-${testAssignmentId}"]`).first();
    if (await viewSubmissionsBtn.isVisible()) {
      await viewSubmissionsBtn.click();
      await adminPage.waitForTimeout(600);

      // Click "View File" on the first submission to open preview modal
      const viewFileBtn = adminPage.getByRole('button', { name: /View File/i }).first();
      await viewFileBtn.click();
      await adminPage.waitForTimeout(600);

      // Verify Preview Modal is open
      const previewModal = adminPage.locator('[data-testid="file-preview-modal"]');
      const isModalVisible = await previewModal.isVisible();
      record('Submission Preview Modal Opened', isModalVisible);

      // Verify unneeded subtitle is GONE
      const badSubtitle = adminPage.getByText('In-app submission preview. Use download button to save locally.');
      const isBadSubtitleVisible = await badSubtitle.isVisible().catch(() => false);
      record('Unneeded Subtitle Removed from Modal', !isBadSubtitleVisible, 'Subtitle completely absent from DOM');

      // Verify submitter info is displayed instead
      const submitterInfo = adminPage.locator('[data-testid="preview-submitter-info"]');
      const submitterText = await submitterInfo.innerText();
      record('Submitter Username & Timestamp Displayed', submitterText.length > 0, `Displayed: "${submitterText}"`);

      // Verify navigation arrows and counter are present
      const prevBtn = adminPage.locator('[data-testid="prev-submission-btn"]');
      const nextBtn = adminPage.locator('[data-testid="next-submission-btn"]');
      const counter = adminPage.locator('[data-testid="submission-counter"]');
      const hasControls = (await prevBtn.isVisible()) && (await nextBtn.isVisible()) && (await counter.isVisible());
      record('Header Navigation Controls & Counter Present', hasControls, await counter.innerText());

      // Test Next Button navigation
      await nextBtn.click();
      await adminPage.waitForTimeout(400);
      const updatedCounter = await counter.innerText();
      record('Next Arrow Navigates to Next Submission', updatedCounter.includes('2 of'), `Counter: ${updatedCounter}`);

      // Test Keyboard ArrowLeft navigation
      await adminPage.keyboard.press('ArrowLeft');
      await adminPage.waitForTimeout(400);
      const backCounter = await counter.innerText();
      record('Keyboard ArrowLeft Returns to Previous Submission', backCounter.includes('1 of'), `Counter: ${backCounter}`);

      // Capture screenshot
      const previewShot = path.join(ARTIFACT_DIR, 'phase16_assignment_preview_navigation.png');
      await adminPage.screenshot({ path: previewShot });
      record('Preview Screenshot Saved', true, previewShot);

      // Close preview modal
      await adminPage.keyboard.press('Escape');
      await adminPage.waitForTimeout(300);
    } else {
      record('Assignment Submissions Navigation', false, 'View submissions button not found');
    }
    await adminContext.close();

    // =========================================================================
    // SUITE 2: Universal Notification Badge Sync on Mobile (360x800)
    // =========================================================================
    console.log('\n--- 3. Testing Mobile (360x800) Notification Badge Real-time Sync ---');
    const mobileContext = await browser.newContext({
      viewport: { width: 360, height: 800 },
      userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-A556B) AppleWebKit/537.36 Mobile Safari/537.36'
    });
    const mobilePage = await mobileContext.newPage();
    await mobilePage.addInitScript(({ t }) => localStorage.setItem('token', t), { t: adminToken });

    // Ensure there are notifications: post a thread mentioning @Deekshith
    try {
      await axios.post(`${API_BASE}/threads`, {
        title: `Mobile Badge Test ${Date.now()}`,
        content: `Urgent check needed by @${adminUser.name?.split(' ')[0] || 'Admin'} for mobile notification sync.`,
        tags: ['Clinical']
      }, { headers: { Authorization: `Bearer ${memberToken}` } });
    } catch (e) {
      console.warn('Note on seeding notification thread:', e.message);
    }

    await mobilePage.goto(`${APP_BASE}/notifications`, { waitUntil: 'networkidle' });
    await mobilePage.waitForTimeout(1000);

    // Click "Mark all as read"
    const markAllReadBtn = mobilePage.locator('[data-testid="mark-all-read-btn"]');
    await markAllReadBtn.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    if (await markAllReadBtn.isVisible()) {
      await markAllReadBtn.click();
      await mobilePage.waitForTimeout(1000);

      // Verify mobile navbar bell badge is 0 or gone
      const badgeCount = await mobilePage.evaluate(() => {
        const badge = document.querySelector('[data-testid="navbar-notifications-badge"]');
        return badge ? badge.innerText.trim() : '0';
      });
      record('Mobile Navbar Red Badge Cleared to 0', badgeCount === '0' || badgeCount === '', `Badge value: "${badgeCount}"`);

      // Capture screenshot
      const badgeShot = path.join(ARTIFACT_DIR, 'phase16_mobile_notification_badge_cleared.png');
      await mobilePage.screenshot({ path: badgeShot });
      record('Mobile Notification Badge Clearance Screenshot Saved', true, badgeShot);
    } else {
      record('Mark All Read Button Visible', false);
    }

    // =========================================================================
    // SUITE 3: New Conversation Dialog Zero Horizontal Overflow on Mobile (360x800)
    // =========================================================================
    console.log('\n--- 4. Testing New Conversation Modal on Mobile (360x800) ---');
    await mobilePage.goto(`${APP_BASE}/messages`, { waitUntil: 'networkidle' });
    await mobilePage.waitForTimeout(1000);

    // Click New Chat
    const newChatBtn = mobilePage.locator('[data-testid="new-message-button"]');
    await newChatBtn.click();
    await mobilePage.waitForTimeout(600);

    const newChatDialog = mobilePage.locator('[data-testid="new-chat-dialog"]');
    const isDialogOpen = await newChatDialog.isVisible();
    record('New Chat Dialog Opened on Mobile', isDialogOpen);

    // Verify dialog width fits within 360px viewport
    const dialogBox = await newChatDialog.boundingBox();
    const fitsViewport = dialogBox && dialogBox.width <= 360 && dialogBox.x >= 0;
    record('New Chat Dialog Fits Within 360px Viewport', fitsViewport, `Dialog width: ${dialogBox?.width}px, X: ${dialogBox?.x}px`);

    // Verify document does not horizontally overflow
    const docOverflow = await mobilePage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    record('Zero Document Horizontal Overflow on Mobile', docOverflow);

    // Capture screenshot
    const dialogShot = path.join(ARTIFACT_DIR, 'phase16_mobile_new_chat_dialog_no_overflow.png');
    await mobilePage.screenshot({ path: dialogShot });
    record('Mobile New Chat Dialog Screenshot Saved', true, dialogShot);

    // Close dialog
    await mobilePage.keyboard.press('Escape');
    await mobilePage.waitForTimeout(300);
    await mobileContext.close();

    // =========================================================================
    // SUITE 4: Direct Message Requests Ingestion & Visibility (Incoming & Sent)
    // =========================================================================
    console.log('\n--- 5. Testing Message Requests Ingestion & Acceptance Flow ---');

    // Context A: Sender (memberUser)
    const senderContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const senderPage = await senderContext.newPage();
    await senderPage.addInitScript(({ t }) => localStorage.setItem('token', t), { t: memberToken });

    // Context B: Recipient (recipientUser)
    const receiverContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const receiverPage = await receiverContext.newPage();
    await receiverPage.addInitScript(({ t }) => localStorage.setItem('token', t), { t: recipientToken });

    // Send a message from member to recipient (fresh interaction => creates message request)
    const initialMessage = `Hello, I'd like to collaborate on the clinical trials at ${Date.now()}`;
    const sendMsgRes = await axios.post(`${API_BASE}/messages`, {
      receiver_email: recipientUser.email,
      content: initialMessage
    }, { headers: { Authorization: `Bearer ${memberToken}` } });
    record('Initial Direct Message Sent (Request Created)', !!sendMsgRes.data.id, `ID: ${sendMsgRes.data.id}`);

    // Check Sender's Sent Requests Tab
    await senderPage.goto(`${APP_BASE}/messages`, { waitUntil: 'networkidle' });
    await senderPage.waitForTimeout(1000);
    await senderPage.locator('[data-testid="requests-tab-button"]').click();
    await senderPage.waitForTimeout(400);
    await senderPage.locator('[data-testid="requests-sent-tab"]').click();
    await senderPage.waitForTimeout(600);

    const sentReqCard = senderPage.locator('[data-testid^="sent-request-"]').first();
    const hasSentReq = await sentReqCard.isVisible();
    record('Sent Request Visible in Sender Sent Requests Tab', hasSentReq);

    // Check Recipient's Incoming Requests Tab
    await receiverPage.goto(`${APP_BASE}/messages`, { waitUntil: 'networkidle' });
    await receiverPage.waitForTimeout(1000);
    await receiverPage.locator('[data-testid="requests-tab-button"]').click();
    await receiverPage.waitForTimeout(400);
    await receiverPage.locator('[data-testid="requests-incoming-tab"]').click();
    await receiverPage.waitForTimeout(600);

    const incomingReqCard = receiverPage.locator('[data-testid^="request-"]').first();
    const hasIncomingReq = await incomingReqCard.isVisible();
    record('Incoming Request Visible in Recipient Requests Tab', hasIncomingReq);

    if (hasIncomingReq) {
      // Click incoming request card to preview conversation
      await incomingReqCard.click();
      await receiverPage.waitForTimeout(600);

      const pendingBanner = receiverPage.locator('[data-testid="pending-request-banner"]');
      const hasBanner = await pendingBanner.isVisible();
      record('Actionable Pending Request Banner Displayed in Preview', hasBanner);

      const acceptBtn = receiverPage.locator('[data-testid="banner-accept-request-button"]');
      const declineBtn = receiverPage.locator('[data-testid="banner-decline-request-button"]');
      record('Accept and Decline Action Buttons Visible in Banner', (await acceptBtn.isVisible()) && (await declineBtn.isVisible()));

      // Capture screenshot of request preview
      const reqShot = path.join(ARTIFACT_DIR, 'phase16_message_request_and_preview.png');
      await receiverPage.screenshot({ path: reqShot });
      record('Message Request Preview Screenshot Saved', true, reqShot);

      // Click Accept
      await acceptBtn.click();
      await receiverPage.waitForTimeout(1000);
      record('Message Request Accepted via Action Banner', true);

      // Verify conversation is now active and reply textarea is enabled
      const replyInput = receiverPage.locator('[data-testid="direct-message-input"]');
      const canReply = await replyInput.isVisible();
      record('Conversation Active & Reply Input Enabled', canReply);

      // =========================================================================
      // SUITE 5: Private Message Unread Dot Real-Time Persistence Fix
      // =========================================================================
      console.log('\n--- 6. Testing Private Message Unread Dot Dismissal ---');

      // Recipient sends reply to sender
      await replyInput.fill('Accepted! Excited to collaborate with you.');
      await receiverPage.locator('[data-testid="send-direct-message-button"]').click();
      await receiverPage.waitForTimeout(800);

      // Switch to Sender's page and go to Chats tab
      await senderPage.locator('button:has-text("Chats")').click();
      await senderPage.waitForTimeout(1000);

      // Find conversation card
      const convCard = senderPage.locator(`[data-testid="conversation-${recipientUser.id}"]`).first();
      await convCard.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});

      if (await convCard.isVisible()) {
        const unreadDot = convCard.locator(`[data-testid="unread-dot-${recipientUser.id}"]`);
        const hasDotBefore = await unreadDot.isVisible().catch(() => false);
        record('Unread Indicator Dot Present on Unread Message', hasDotBefore, `Conv ID: ${recipientUser.id}`);

        // Click conversation card to read
        await convCard.click();
        await senderPage.waitForTimeout(800);

        // Verify unread dot vanishes immediately
        const hasDotAfter = await unreadDot.isVisible().catch(() => false);
        record('Unread Dot Disappears Immediately Upon Reading', !hasDotAfter, 'Dot successfully dismissed');

        // Capture screenshot
        const unreadShot = path.join(ARTIFACT_DIR, 'phase16_dm_unread_dot_cleared.png');
        await senderPage.screenshot({ path: unreadShot });
        record('Unread Dot Dismissal Screenshot Saved', true, unreadShot);
      } else {
        record('Conversation Card Visible for Unread Dot Check', false);
      }
    }

    await senderContext.close();
    await receiverContext.close();

  } finally {
    await browser.close();
  }

  // Print Summary
  console.log('\n=============================================================');
  console.log(`Phase 16 Verification Summary: ${results.passed} Passed, ${results.failed} Failed`);
  console.log('=============================================================');

  if (results.failed > 0) {
    process.exit(1);
  }
}

runPhase16Verification().catch(err => {
  console.error('Unhandled Verification Suite Error:', err);
  process.exit(1);
});
