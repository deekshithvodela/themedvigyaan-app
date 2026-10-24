# Privacy Policy

**Effective Date:** October 25, 2026  
**Platform:** The MedVigyaan (Medical Education & Academic Collaboration Platform)  
**Maintainer:** Deekshith Vodela ([LinkedIn Profile](https://www.linkedin.com/in/deekshithvodela/))

---

## 1. Introduction

The MedVigyaan ("we", "our", or "the Platform") is committed to protecting the privacy, security, and confidentiality of its users. This Privacy Policy details our practices concerning the collection, use, retention, and protection of personal data when using The MedVigyaan web application.

---

## 2. Information We Collect

### A. Account & Authentication Data
- **Google OAuth Authentication:** When you sign in via Google OAuth, we receive your verified email address, full name, and avatar profile picture provided by Google. We **never** have access to your Google account password.
- **Whitelist Authorization:** Access to the platform is restricted to approved members. We store authorized email addresses in an administrative whitelist.

### B. User-Provided Profile Information
- Department / User Tag (e.g., Cardiology, Neurology, General Medicine).
- Contact telephone number (optional).
- Professional biography and academic background (optional).
- Email visibility preference (`show_email` toggle).

### C. Educational & Academic Activity Data
- Discussion threads, replies, and community question posts.
- Real-time messages sent within General Chat and Direct Message conversations.
- Assignment submissions, feedback, and certificate templates.
- Academic blog articles, task progress, and calendar events.

---

## 3. How We Use Your Information

We process personal data strictly to deliver platform functionality:
- **Authentication & Role-Based Access Control:** Validating credentials and granting appropriate permissions (`member`, `core`, `admin`).
- **Academic Collaboration:** Enabling peer discussions, group discussions, and direct mentorship messaging.
- **Privacy Enforcement:** Respecting your email visibility toggle (`show_email`) to prevent unsolicited exposure of your email address to non-administrative peers.
- **Platform Notifications:** Notifying users about assignment reviews, task delegations, and new message requests.

---

## 4. Data Sharing & Third-Party Services

We do **not** sell, rent, or monetize your personal data under any circumstances. Data is shared strictly with infrastructure providers essential to application runtime:
- **Database Hosting (MongoDB Atlas):** Encrypted storage of application state, profiles, and messages.
- **Application & WebSocket Hosting (Render / Railway / Vercel):** Running API services and client web assets.
- **Media Asset Storage (Cloudinary):** Secure storage for user-uploaded academic assignments, announcements, and certificates.
- **Google OAuth 2.0:** Secure identity verification.

---

## 5. Account Deletion & 30-Day Soft Retention

- **Deactivation:** When you select "Delete My Profile" in profile settings, your account is immediately deactivated and removed from active member directories.
- **Attribution Masking:** In existing public threads and group discussions, your name is masked as `[Deleted User]` to preserve community discussion context without revealing your identity.
- **Reactivation Grace Period:** For a period of 30 days following deletion, your account profile can be fully restored by signing in with your registered Google account.
- **Permanent Purge:** After 30 days, deactivated accounts that have not been reactivated are permanently purged.

---

## 6. Security Standards

We implement defense-in-depth security measures to protect your information:
- End-to-end transport encryption via HTTPS/TLS.
- HTTP security headers (`nosniff`, `DENY`, `HSTS`, `strict-origin`).
- Cryptographically signed JSON Web Tokens (JWT) for session management.
- Protocol enforcement on external links to prevent Stored Cross-Site Scripting (XSS).

---

## 7. Contact & Inquiries

For privacy questions, data deletion requests, or administrative inquiries, please contact:
- **Maintainer:** Deekshith Vodela
- **Professional Profile:** [https://www.linkedin.com/in/deekshithvodela/](https://www.linkedin.com/in/deekshithvodela/)
