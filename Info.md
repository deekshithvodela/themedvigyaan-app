# The MedVigyaan - Product Requirements Document

## Overview
The MedVigyaan is a Progressive Web App (PWA) for medical education and collaboration, featuring a Discord-style interface with real-time communication, task management, and content sharing capabilities.

## Core Requirements

### Authentication
- Google Sign-in only
- Registration restricted to pre-approved whitelisted Gmail addresses managed by admin
- First admin: `deekshithvodela@gmail.com`

### User Roles & Permissions
User roles and permissions are dynamically loaded from the database configuration. The system falls back to the following default permissions matrix:

| Feature | Member | Core | Admin |
|---------|--------|------|-------|
| View Feed | ✅ | ✅ | ✅ |
| Create Feed Posts | ❌ | ✅ | ✅ |
| View General Chat | ✅ | ✅ | ✅ |
| Send Messages | ✅ | ✅ | ✅ |
| View Threads | ✅ | ✅ | ✅ |
| Create Threads | ✅ | ✅ | ✅ |
| View Assignments | ✅ | ✅ | ✅ |
| Create Assignments | ❌ | ✅ | ✅ |
| View Blogs | ✅ | ✅ | ✅ |
| Create Blogs | ❌ | ✅ | ✅ |
| View Calendar | ✅ | ✅ | ✅ |
| Create Calendar Events | ❌ | ✅ | ✅ |
| View/Manage Tasks | ❌ | ✅ | ✅ |
| Admin Panel Access | ❌ | ❌ | ✅ |

### UI/UX
- Discord-style layout with collapsible sidebar
- Clean, functional theme inspired by KDE Plasma
- Optimized for mobile viewing
- Department shown as user tag/byline

### Core Pages
1. **Feed** - Admin/Core can post announcements (text, image, links)
2. **General Chat** - WhatsApp-style group chat with message reply support
3. **Threads** - Forum/thread-style discussions with Reddit-style nested replies
4. **Direct Messages** - Private messaging with reply-to-message feature (moved to header)
5. **Assignments** - File submissions for projects with admin submission viewer
6. **Blogs** - Substack-style blog page (Core/Admin can create)
7. **Tasks** - Task management dashboard (Core/Admin only)
8. **Calendar** - Native calendar with events + Google Calendar integration
9. **Admin Panel** - User management, whitelist, Blog CMS, Calendar config, Certificates, Integrations, External Links

### Admin Panel Features
- User role management (Member/Core/Admin)
- Email whitelist management
- Blog Content Management System (CMS)
- Google Calendar ID configuration
- Certificate generation and emailing
- Assignment submission viewer
- **Integrations Tab** - Manage all API keys and credentials
- **Links Tab** - Configure external redirect link in sidebar

### Key Features
- **Search** - Global search bar performing page-specific searches
- **Notifications** - User mentions and same-day calendar events
- **User Mentions** - Type `@username` in messages to mention users (notifications sent automatically)
- **Delete Functionality** - Admins can delete most content; users can delete own messages
- **Message Reply** - Reply to specific messages in all chat types
- **Nested Replies** - Reddit-style reply-to-reply in Threads
- **File Storage** - Cloudinary for assignment uploads
- **External Links** - Admin-editable redirect button in sidebar
- **Role Management** - Admin can configure page access and actions per role
- **PWA** - Offline mode and push notifications support

## Technical Stack
- **Frontend**: React, TailwindCSS, Shadcn UI
- **Backend**: FastAPI, Pydantic, Motor (async MongoDB)
- **Database**: MongoDB
- **Authentication**: Google OAuth 2.0 + JWT
- **File Storage**: Cloudinary
- **Real-time**: Socket.IO

## What's Been Implemented

### July 2026 - Latest Security & Permission Fixes
- [x] Implemented dynamic role permissions stored in MongoDB and fetched at login/session refresh.
- [x] Replaced hardcoded frontend route/navigation checks with dynamic permissions matrix enforcement.
- [x] Fixed MongoDB user registration serialization crash (`_id` ObjectId serialization exception).
- [x] Fixed identical Socket.IO event serialization exceptions in Thread, Reply, Direct Message, and Task creation endpoints.
- [x] Secured the backend bypass login endpoint to restrict bypass access outside of local mock testing environments.

### December 2025 - Latest Updates
- [x] Renamed "Team Lead" role to "Core"
- [x] Removed badges feature
- [x] Added Department display as user tag
- [x] Renamed "General Chat" to "Threads" with Reddit-style nested replies
- [x] Added new WhatsApp-style "General Chat" page
- [x] Implemented message reply feature in all chats (Group Chat, DMs)
- [x] Moved Direct Messages to header (beside notification)
- [x] Added "Integrations" tab in Admin Panel for managing API keys
- [x] Added "Links" tab for admin-editable external redirect
- [x] Updated role permissions (Members restricted from creating blogs, tasks access removed)
- [x] Core role can now create Feed posts and Calendar events
- [x] Added delete button to General Chat messages (sender/admin only)
- [x] Added red dot indicator on DM icon for unread messages
- [x] Browser push notifications for all features (DMs, threads, replies, tasks, announcements, mentions, calendar)
- [x] Fixed Admin Panel mobile view - tabs no longer overlap
- [x] Fixed DM seen/read status - messages marked as read when conversation is opened
- [x] Gmail SMTP configured for certificate emailing

### Previously Implemented
- [x] Google OAuth authentication with email whitelist
- [x] Discord-style layout with collapsible sidebar
- [x] All core pages (Feed, Chat, DMs, Assignments, Blogs, Tasks, Calendar)
- [x] Admin Panel with multiple management tabs
- [x] Real-time notifications via Socket.IO
- [x] Page-specific search functionality
- [x] Mobile-responsive design
- [x] Native calendar events system
- [x] Cloudinary file storage integration

## Backlog / Future Tasks
- [ ] Gmail SMTP testing for certificate emailing
- [ ] Google Calendar API integration (requires API key)
- [ ] Push notifications implementation
- [ ] Offline mode enhancement
- [ ] Backend refactoring (split server.py into routers)

## Environment Configuration
- Backend: `/app/backend/.env`
- Frontend: `/app/frontend/.env`
- Admin can manage integrations via Admin Panel → Integrations tab

## Key Files
- `/app/backend/server.py` - Backend API
- `/app/frontend/src/App.js` - React Router setup
- `/app/frontend/src/pages/Dashboard.jsx` - Main layout
- `/app/frontend/src/pages/AdminPanel.jsx` - Admin management
- `/app/frontend/src/pages/GroupChat.jsx` - WhatsApp-style chat
- `/app/frontend/src/pages/Threads.jsx` - Reddit-style discussions
