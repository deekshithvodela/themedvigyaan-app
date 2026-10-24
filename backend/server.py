from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import sys
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
import uuid
import re
import asyncio
from datetime import datetime, timezone, timedelta, date
import socketio
import jwt
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from googleapiclient.discovery import build
import cloudinary
import cloudinary.uploader
from PIL import Image, ImageDraw, ImageFont
import io
import base64
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders

ROOT_DIR = Path(__file__).resolve().parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from app.core.config import settings
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = settings.MONGO_URL or os.environ.get('MONGO_URL', '')
if mongo_url.startswith('mock') or not mongo_url:
    from mongomock_motor import AsyncMongoMockClient
    client = AsyncMongoMockClient()
    db = client[settings.DB_NAME]
    print("Using In-Memory Mock MongoDB client")
else:
    client = AsyncIOMotorClient(mongo_url)
    db = client[settings.DB_NAME]

# Cloudinary config with fallback guards
cloudinary_cloud_name = settings.CLOUDINARY_CLOUD_NAME
cloudinary_api_key = settings.CLOUDINARY_API_KEY
cloudinary_api_secret = settings.CLOUDINARY_API_SECRET
if cloudinary_cloud_name and cloudinary_api_key and cloudinary_api_secret:
    cloudinary.config(
        cloud_name=cloudinary_cloud_name,
        api_key=cloudinary_api_key,
        api_secret=cloudinary_api_secret
    )

# JWT config
JWT_SECRET = settings.JWT_SECRET
JWT_ALGORITHM = settings.JWT_ALGORITHM
FIRST_ADMIN_EMAIL = settings.FIRST_ADMIN_EMAIL
MAIN_ADMIN_EMAIL = getattr(settings, 'MAIN_ADMIN_EMAIL', settings.FIRST_ADMIN_EMAIL or "").strip().lower()

def is_main_admin(email: str) -> bool:
    if not email:
        return False
    norm = email.strip().lower()
    main_admin = os.environ.get("MAIN_ADMIN_EMAIL", MAIN_ADMIN_EMAIL or "").strip().lower()
    first_admin = (FIRST_ADMIN_EMAIL or "").strip().lower()
    fallback_admin = os.environ.get('FIRST_ADMIN_EMAIL', 'admin@example.com').strip().lower()
    return bool((main_admin and norm == main_admin) or (first_admin and norm == first_admin) or (not main_admin and not first_admin and norm == fallback_admin))

async def get_deleted_user_ids() -> set:
    try:
        deleted_docs = await db.users.find({"is_deleted": True}, {"id": 1}).to_list(1000)
        return {u["id"] for u in deleted_docs if "id" in u}
    except Exception:
        return set()

async def upload_file_or_fallback(file_content: bytes, content_type: Optional[str], folder: str) -> str:
    """Uploads file content to Cloudinary if configured; falls back to base64 data URI."""
    mime = content_type or "application/octet-stream"
    if cloudinary_cloud_name and cloudinary_api_key and cloudinary_api_secret:
        try:
            upload_result = cloudinary.uploader.upload(
                file_content,
                resource_type="auto",
                folder=folder
            )
            return upload_result.get('secure_url', '')
        except Exception as e:
            logger.warning(f"Cloudinary upload failed for {folder}, falling back to data URI: {e}")
    encoded = base64.b64encode(file_content).decode("ascii")
    return f"data:{mime};base64,{encoded}"

# Dynamic CORS setup
ALLOWED_ORIGINS = settings.cors_origins

# Socket.IO setup
sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins=ALLOWED_ORIGINS)
app = FastAPI()

@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    if settings.is_production:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

api_router = APIRouter(prefix="/api")
security = HTTPBearer()

ALLOWED_INTEGRATION_KEYS = {
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
    'GMAIL_USER',
    'GMAIL_APP_PASSWORD',
    'GOOGLE_CALENDAR_API_KEY'
}

# Models
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    name: str
    picture: Optional[str] = None
    role: str = "member"  # member, core, admin
    badges: List[str] = []
    tags: List[str] = []
    department: Optional[str] = None
    phone: Optional[str] = None
    bio: Optional[str] = None
    show_email: bool = True
    is_deleted: bool = False
    deleted_at: Optional[str] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Thread(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    author_id: str
    author_name: str
    author_is_deleted: bool = False
    content: str
    replies_count: int = 0
    last_activity: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Reply(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    thread_id: str
    author_id: str
    author_name: str
    author_is_deleted: bool = False
    content: str
    parent_reply_id: Optional[str] = None  # For nested replies (Reddit-style)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class GroupMessage(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sender_id: str
    sender_name: str
    content: str
    reply_to_id: Optional[str] = None  # For reply to specific message
    deleted: bool = False
    deleted_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class LinkConfig(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    url: str = ""
    label: str = "External Link"
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DirectMessage(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sender_id: str
    sender_name: str
    receiver_email: str
    receiver_id: Optional[str] = None
    content: str
    reply_to_id: Optional[str] = None  # For reply to specific message
    read: bool = False
    deleted: bool = False
    deleted_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Assignment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    deadline: datetime
    created_by: str
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Submission(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    assignment_id: str
    user_id: str
    user_name: str
    user_is_deleted: bool = False
    file_url: str
    file_name: str
    submitted_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Blog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    content: str
    author_id: str
    author_name: str
    author_is_deleted: bool = False
    tags: List[str] = []
    published: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Task(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    assignees: List[Dict[str, str]] = []  # [{user_id, name, status}]
    deadline: datetime
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CertificateTemplate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    template_url: str
    text_positions: List[Dict[str, Any]] = []  # [{field, x, y, font_size}]
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CalendarConfig(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    calendar_ids: List[Dict[str, Any]] = []  # [{id, label, color, enabled}]
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class NativeCalendarEvent(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: Optional[str] = None
    start_date: datetime
    end_date: datetime
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Notification(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    type: str  # thread, reply, message, task, assignment, mention
    title: str
    message: str
    link: Optional[str] = None
    read: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class WhitelistedEmail(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    added_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Announcement(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    content: str
    link: Optional[str] = None
    image_url: Optional[str] = None
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Request Schemas for API Endpoints
class GoogleAuthRequest(BaseModel):
    token: str

class RegisterRequest(BaseModel):
    email: EmailStr
    name: str
    picture: Optional[str] = ""
    department: Optional[str] = ""
    phone: Optional[str] = ""
    bio: Optional[str] = ""

class ThreadCreateRequest(BaseModel):
    title: str = Field(..., min_length=1)
    content: str = Field(..., min_length=1)

class ReplyCreateRequest(BaseModel):
    content: str = Field(..., min_length=1)
    parent_reply_id: Optional[str] = None

class DirectMessageSendRequest(BaseModel):
    receiver_email: EmailStr
    content: str = Field(..., min_length=1)
    reply_to_id: Optional[str] = None

class MarkReadRequest(BaseModel):
    sender_id: str

class AssignmentCreateRequest(BaseModel):
    title: str = Field(..., min_length=1)
    description: str = Field(..., min_length=1)
    deadline: str

class TaskCreateRequest(BaseModel):
    title: str = Field(..., min_length=1)
    description: str = Field(..., min_length=1)
    deadline: str
    assignees: List[Dict[str, str]] = []

class GroupMessageSendRequest(BaseModel):
    content: str = Field(..., min_length=1)
    reply_to_id: Optional[str] = None

class WhitelistEmailRequest(BaseModel):
    email: EmailStr

class BlogCreateRequest(BaseModel):
    title: str = Field(..., min_length=1)
    content: str = Field(..., min_length=1)
    tags: List[str] = []

class NativeEventCreateRequest(BaseModel):
    title: str = Field(..., min_length=1)
    description: Optional[str] = None
    start_date: str
    end_date: str

# Auth helpers
def create_token(user_id: str, email: str) -> str:
    payload = {
        'user_id': user_id,
        'email': email,
        'exp': datetime.now(timezone.utc) + timedelta(days=30)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload['user_id']}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return User(**user)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid token")

async def check_admin(user: User = Depends(get_current_user)):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

async def check_admin_or_core(user: User = Depends(get_current_user)):
    if user.role not in ["admin", "core"]:
        raise HTTPException(status_code=403, detail="Admin or Core access required")
    return user

# Helper function to create notifications
async def create_notification(user_id: str, notif_type: str, title: str, message: str, link: Optional[str] = None):
    notification = Notification(
        user_id=user_id,
        type=notif_type,
        title=title,
        message=message,
        link=link
    )
    doc = notification.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.notifications.insert_one(doc)
    return notification

# Helper function to extract mentions from text
def extract_mentions(text: str) -> List[str]:
    import re
    # Match @username patterns
    mentions = re.findall(r'@(\w+)', text)
    return mentions

# Helper function to send mention notifications
async def send_mention_notifications(text: str, author_name: str, link: str):
    mentions = extract_mentions(text)
    if mentions:
        # Get users by name safely escaping regex
        for mention in mentions:
            escaped_mention = re.escape(mention)
            user = await db.users.find_one({"name": {"$regex": f"^{escaped_mention}", "$options": "i"}}, {"_id": 0})
            if user:
                await create_notification(
                    user['id'],
                    'mention',
                    f"{author_name} mentioned you",
                    f"@{mention} in a post",
                    link
                )

# Auth routes
@api_router.post("/auth/bypass")
async def auth_bypass(data: Dict[str, str] = None):
    # Hard-block bypass endpoint in production
    if settings.is_production:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Endpoint not found"
        )
        
    # Ensure bypass is only allowed when using mock DB or if explicitly allowed
    mongo_url = os.environ.get('MONGO_URL', '')
    allow_bypass = os.environ.get('ALLOW_AUTH_BYPASS', 'false').lower() == 'true'
    if not (mongo_url.startswith('mock') or not mongo_url) and not allow_bypass:
        raise HTTPException(
            status_code=403,
            detail="Bypass authentication is not allowed in this environment"
        )
        
    # Ensure MAIN_ADMIN_EMAIL / FIRST_ADMIN_EMAIL is whitelisted and exists
    admin_email = os.environ.get('MAIN_ADMIN_EMAIL', os.environ.get('FIRST_ADMIN_EMAIL', 'admin@example.com')).strip().lower()
    
    # Check if first admin exists
    admin = await db.users.find_one({"email": admin_email}, {"_id": 0})
    if not admin:
        admin = {
            "id": "admin-uuid-1234",
            "email": admin_email,
            "name": "MedVigyaan Admin",
            "picture": "https://lh3.googleusercontent.com/a/default-user=s96-c",
            "role": "admin",
            "department": "Cardiology",
            "phone": "+919876543210",
            "bio": "Administrator of MedVigyaan Club",
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(admin)
        await db.whitelisted_emails.insert_one({
            "id": str(uuid.uuid4()),
            "email": admin_email,
            "added_by": "system",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
    # Ensure sample mock users and initial data are seeded if not present
    if not await db.users.find_one({"email": "core@example.com"}):
        
        # Seed some dummy data
        # Whitelist a core member and register them
        core_email = "core@example.com"
        await db.whitelisted_emails.insert_one({
            "id": str(uuid.uuid4()),
            "email": core_email,
            "added_by": "admin-uuid-1234",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        await db.users.insert_one({
            "id": "core-uuid-1234",
            "email": core_email,
            "name": "Dr. Sarah Jenkins",
            "picture": "https://lh3.googleusercontent.com/a/default-user=s96-c",
            "role": "core",
            "department": "Neurology",
            "phone": "+919876543211",
            "bio": "Core team member",
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        # Whitelist a regular member and register them
        member_email = "member@example.com"
        await db.whitelisted_emails.insert_one({
            "id": str(uuid.uuid4()),
            "email": member_email,
            "added_by": "admin-uuid-1234",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        await db.users.insert_one({
            "id": "member-uuid-1234",
            "email": member_email,
            "name": "John Doe",
            "picture": "https://lh3.googleusercontent.com/a/default-user=s96-c",
            "role": "member",
            "department": "Pediatrics",
            "phone": "+919876543212",
            "bio": "Research Club Member",
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        # Seed Feed announcement
        await db.announcements.insert_one({
            "id": "ann-1",
            "title": "Welcome to MedVigyaan Research Club!",
            "content": "We are excited to launch our new collaboration hub. Explore General Chat, start discussion Threads, and view upcoming events on the Calendar.",
            "link": "https://github.com",
            "image_url": "/images/logo.jpg",
            "created_by": "admin-uuid-1234",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        # Seed Group Chat message
        await db.group_messages.insert_one({
            "id": "msg-1",
            "sender_id": "core-uuid-1234",
            "sender_name": "Dr. Sarah Jenkins",
            "content": "Hello everyone! Welcome to the general chat. Feel free to ask questions here.",
            "reply_to_id": None,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        # Seed Thread
        await db.threads.insert_one({
            "id": "thread-1",
            "title": "Discussion on AI in Modern Cardiology",
            "author_id": "admin-uuid-1234",
            "author_name": "MedVigyaan Admin",
            "content": "What are your thoughts on the use of deep learning models for detecting arrhythmias from ECG signals? Let's discuss!",
            "replies_count": 1,
            "last_activity": datetime.now(timezone.utc).isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        await db.replies.insert_one({
            "id": "reply-1",
            "thread_id": "thread-1",
            "author_id": "core-uuid-1234",
            "author_name": "Dr. Sarah Jenkins",
            "content": "It's highly promising! Recent models are matching cardiologist performance in many common arrhythmias.",
            "parent_reply_id": None,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        # Seed Sample Blog
        await db.blogs.insert_one({
            "id": "blog-1",
            "title": "Advances in Cardiovascular Research",
            "content": "Comprehensive exploration of AI and genomics in cardiovascular diagnostics.",
            "author_id": "admin-uuid-1234",
            "author_name": "MedVigyaan Admin",
            "tags": ["Cardiology", "AI", "Genomics"],
            "published": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        })

        # Seed Link Config
        await db.link_configs.insert_one({
            "id": "link-1",
            "url": os.environ.get("GITHUB_REPO_URL", "https://github.com/themedvigyaan/themedvigyaan-app"),
            "label": "MedVigyaan GitHub",
            "updated_at": datetime.now(timezone.utc).isoformat()
        })

    # Return JWT token for requested role or explicit email
    role = (data or {}).get('role', 'admin')
    requested_email = ((data or {}).get('email') or '').strip().lower()
    user = None
    if requested_email:
        user = await db.users.find_one({"email": requested_email}, {"_id": 0})
        if user and user.get("is_deleted"):
            del_at = user.get("deleted_at")
            restore = True
            if del_at:
                try:
                    dt = datetime.fromisoformat(del_at)
                    if (datetime.now(timezone.utc) - dt).days > 30:
                        restore = False
                except Exception:
                    pass
            if restore:
                await db.users.update_one(
                    {"email": requested_email},
                    {"$set": {"is_deleted": False, "deleted_at": None, "deletion_scheduled_at": None}}
                )
                user["is_deleted"] = False
        if not user:
            is_main = is_main_admin(requested_email)
            name_display = requested_email.split('@')[0].replace('.', ' ').title()
            user = {
                "id": str(uuid.uuid4()),
                "email": requested_email,
                "name": "MedVigyaan Administrator" if is_main else name_display,
                "picture": "https://lh3.googleusercontent.com/a/default-user=s96-c",
                "role": "admin" if is_main else role,
                "badges": [],
                "tags": [],
                "department": "Cardiology" if is_main else "General Medicine",
                "phone": "+91 1234567890",
                "bio": "Administrator" if is_main else "Medvigyaan Member",
                "is_active": True,
                "show_email": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.users.insert_one(user.copy())
            user.pop('_id', None)
    if not user:
        if role == 'admin':
            user = await db.users.find_one({"email": admin_email}, {"_id": 0})
        elif role == 'core':
            core_email = "core@example.com"
            user = await db.users.find_one({"email": core_email}, {"_id": 0})
            if not user:
                user = {
                    "id": "core-uuid-1234",
                    "email": core_email,
                    "name": "Dr. Sarah Jenkins",
                    "picture": "https://lh3.googleusercontent.com/a/default-user=s96-c",
                    "role": "core",
                    "badges": [],
                    "tags": [],
                    "department": "Neurology",
                    "phone": "+919876543211",
                    "bio": "Core team member",
                    "is_active": True,
                    "show_email": True,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db.users.insert_one(user.copy())
                user.pop('_id', None)
                if not await db.whitelisted_emails.find_one({"email": core_email}):
                    await db.whitelisted_emails.insert_one({
                        "id": str(uuid.uuid4()),
                        "email": core_email,
                        "added_by": "system",
                        "created_at": datetime.now(timezone.utc).isoformat()
                    })
        else:
            member_email = "member@example.com"
            user = await db.users.find_one({"email": member_email}, {"_id": 0})
            if not user:
                user = {
                    "id": "member-uuid-1234",
                    "email": member_email,
                    "name": "John Doe",
                    "picture": "https://lh3.googleusercontent.com/a/default-user=s96-c",
                    "role": "member",
                    "badges": [],
                    "tags": [],
                    "department": "Pediatrics",
                    "phone": "+919876543212",
                    "bio": "Research Club Member",
                    "is_active": True,
                    "show_email": True,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db.users.insert_one(user.copy())
                user.pop('_id', None)
                if not await db.whitelisted_emails.find_one({"email": member_email}):
                    await db.whitelisted_emails.insert_one({
                        "id": str(uuid.uuid4()),
                        "email": member_email,
                        "added_by": "system",
                        "created_at": datetime.now(timezone.utc).isoformat()
                    })
        
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User for role '{role}' could not be loaded or created"
        )
    user = dict(user)
    user["is_main_admin"] = is_main_admin(user.get("email", ""))
    jwt_token = create_token(user['id'], user['email'])
    return {
        "token": jwt_token,
        "access_token": jwt_token,
        "user": user
    }

DEFAULT_GOOGLE_CLIENT_ID = "946733501616-m6a2vmmg9l1ejs185d6a0hqr8ds0bi1m.apps.googleusercontent.com"

@api_router.post("/auth/google")
async def google_auth(data: GoogleAuthRequest):
    try:
        token = data.token
        client_id = os.environ.get('GOOGLE_CLIENT_ID', '').strip() or DEFAULT_GOOGLE_CLIENT_ID
        try:
            idinfo = id_token.verify_oauth2_token(
                token, 
                google_requests.Request(), 
                client_id
            )
        except ValueError as ve:
            # Fallback in local/dev environments when audience doesn't match client_id:
            # Verify cryptographic signature and issuer with Google without strict audience match
            logger.warning(f"Google token audience verification with {client_id} failed: {ve}. Attempting fallback Google signature verification.")
            idinfo = id_token.verify_oauth2_token(
                token, 
                google_requests.Request()
            )
        
        email = idinfo['email'].strip().lower()
        name = idinfo.get('name', '')
        picture = idinfo.get('picture', '')
        
        # Check if email is whitelisted or matches the configured first admin
        whitelisted = await db.whitelisted_emails.find_one({"email": email})
        is_admin_bootstrap = is_main_admin(email)
        if not whitelisted and not is_admin_bootstrap:
            raise HTTPException(status_code=403, detail="Email not authorized. Please contact admin.")
        
        # Check if user exists
        user = await db.users.find_one({"email": email}, {"_id": 0})
        
        if not user:
            raise HTTPException(status_code=403, detail="Email not registered. Please register first.")
        
        # Check if user was soft-deleted and can be restored (within 30 days)
        if user.get('is_deleted'):
            deleted_at_str = user.get('deleted_at')
            can_restore = True
            if deleted_at_str:
                try:
                    deleted_dt = datetime.fromisoformat(deleted_at_str)
                    if (datetime.now(timezone.utc) - deleted_dt).total_seconds() > 30 * 86400:
                        can_restore = False
                except Exception:
                    pass
            if can_restore:
                await db.users.update_one(
                    {"id": user['id']},
                    {"$set": {"is_deleted": False, "deleted_at": None}}
                )
                user['is_deleted'] = False
                user['deleted_at'] = None
                await sio.emit('user_profile_updated', {"user_id": user['id'], "user": user})
            else:
                raise HTTPException(status_code=403, detail="Account was permanently deleted after the 30-day grace period.")

        # Generate JWT
        jwt_token = create_token(user['id'], email)
        
        return {
            "token": jwt_token,
            "access_token": jwt_token,
            "user": user
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Google auth error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@api_router.post("/auth/register")
async def register(data: RegisterRequest):
    try:
        email = data.email.strip().lower()
        
        # Check if email is whitelisted or is configured first admin
        whitelisted = await db.whitelisted_emails.find_one({"email": email})
        is_admin_bootstrap = bool(FIRST_ADMIN_EMAIL and email == FIRST_ADMIN_EMAIL)
        if not whitelisted and not is_admin_bootstrap:
            raise HTTPException(status_code=403, detail="Email not authorized. Please contact admin to get access.")
        
        # Check if user already exists
        existing = await db.users.find_one({"email": email})
        if existing:
            if existing.get('is_deleted'):
                deleted_at_str = existing.get('deleted_at')
                can_restore = True
                if deleted_at_str:
                    try:
                        deleted_dt = datetime.fromisoformat(deleted_at_str)
                        if (datetime.now(timezone.utc) - deleted_dt).total_seconds() > 30 * 86400:
                            can_restore = False
                    except Exception:
                        pass
                if can_restore:
                    update_dict = {"is_deleted": False, "deleted_at": None}
                    if data.name: update_dict["name"] = data.name
                    if data.department: update_dict["department"] = data.department
                    if data.bio: update_dict["bio"] = data.bio
                    if data.picture: update_dict["picture"] = data.picture
                    await db.users.update_one({"id": existing["id"]}, {"$set": update_dict})
                    restored = await db.users.find_one({"id": existing["id"]}, {"_id": 0})
                    jwt_token = create_token(restored['id'], email)
                    await sio.emit('user_profile_updated', {"user_id": restored['id'], "user": restored})
                    return {
                        "token": jwt_token,
                        "access_token": jwt_token,
                        "user": restored,
                        "restored": True,
                        "message": "Welcome back! Your deleted profile has been restored."
                    }
                else:
                    await db.users.delete_one({"id": existing["id"]})
            else:
                raise HTTPException(status_code=400, detail="Email already registered")
        
        # Determine role
        role = "admin" if is_admin_bootstrap else "member"
        
        user_data = {
            "id": str(uuid.uuid4()),
            "email": email,
            "name": data.name,
            "picture": data.picture or '',
            "role": role,
            "badges": [],
            "tags": [],
            "department": data.department or '',
            "phone": data.phone or '',
            "bio": data.bio or '',
            "show_email": True,
            "is_deleted": False,
            "deleted_at": None,
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.users.insert_one(user_data)
        jwt_token = create_token(user_data['id'], email)
        user_data.pop('_id', None)
        
        return {
            "token": jwt_token,
            "user": user_data
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@api_router.get("/auth/me")
async def get_me(user: User = Depends(get_current_user)):
    user_data = user.model_dump()
    main_admin = os.environ.get("MAIN_ADMIN_EMAIL", FIRST_ADMIN_EMAIL or "").strip().lower()
    user_data['is_main_admin'] = bool(main_admin and user.email.lower() == main_admin)
    return user_data

# User routes
@api_router.get("/users")
async def get_users(limit: int = 500, skip: int = 0, include_deleted: bool = False, user: User = Depends(get_current_user)):
    safe_limit = min(max(limit, 1), 1000)
    query = {} if (include_deleted and user.role == "admin") else {"is_deleted": {"$ne": True}}
    users = await db.users.find(query, {"_id": 0}).skip(max(skip, 0)).to_list(safe_limit)
    for u in users:
        u['is_main_admin'] = is_main_admin(u.get('email', ''))
        if not u.get('show_email', True) and user.role != 'admin' and u.get('id') != user.id:
            u['email'] = ''  # Masked for privacy
    return users

@api_router.put("/users/{user_id}/badges")
async def update_badges(user_id: str, data: Dict[str, List[str]], admin: User = Depends(check_admin)):
    badges = data.get('badges', [])
    await db.users.update_one({"id": user_id}, {"$set": {"badges": badges}})
    updated = await db.users.find_one({"id": user_id}, {"_id": 0})
    if updated:
        await sio.emit('user_profile_updated', {"user_id": user_id, "user": updated})
    return {"message": "Badges updated"}

@api_router.put("/users/{user_id}/role")
async def update_role(user_id: str, data: Dict[str, str], admin: User = Depends(check_admin)):
    target_user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    role = data.get('role')
    if is_main_admin(target_user.get('email', '')) and role != 'admin':
        raise HTTPException(
            status_code=403, 
            detail="The main administrator role is protected by system configuration and cannot be modified."
        )

    if role not in ["member", "core", "admin"]:
        raise HTTPException(status_code=400, detail="Invalid role. Must be 'member', 'core', or 'admin'.")
    if user_id == admin.id and role != "admin":
        raise HTTPException(status_code=400, detail="Cannot demote yourself. Another admin must perform this action.")
    
    await db.users.update_one({"id": user_id}, {"$set": {"role": role}})
    updated = await db.users.find_one({"id": user_id}, {"_id": 0})
    if updated:
        await sio.emit('user_profile_updated', {"user_id": user_id, "user": updated})
    return {"message": "Role updated"}

# Thread routes
@api_router.get("/threads", response_model=List[Thread])
async def get_threads(limit: int = 100, skip: int = 0, user: User = Depends(get_current_user)):
    safe_limit = min(max(limit, 1), 200)
    threads = await db.threads.find({}, {"_id": 0}).sort("last_activity", -1).skip(max(skip, 0)).to_list(safe_limit)
    deleted_ids = await get_deleted_user_ids()
    for thread in threads:
        if thread.get('author_id') in deleted_ids:
            thread['author_name'] = '[Deleted User]'
            thread['author_is_deleted'] = True
        if isinstance(thread.get('last_activity'), str):
            thread['last_activity'] = datetime.fromisoformat(thread['last_activity'])
        if isinstance(thread.get('created_at'), str):
            thread['created_at'] = datetime.fromisoformat(thread['created_at'])
    return threads

@api_router.post("/threads", status_code=status.HTTP_201_CREATED)
async def create_thread(data: ThreadCreateRequest, user: User = Depends(get_current_user)):
    thread = Thread(
        title=data.title,
        content=data.content,
        author_id=user.id,
        author_name=user.name
    )
    doc = thread.model_dump()
    doc['last_activity'] = doc['last_activity'].isoformat()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.threads.insert_one(doc)
    
    # Send mention notifications safely
    await send_mention_notifications(data.content, user.name, f"/threads")
    
    doc.pop('_id', None)
    await sio.emit('new_thread', doc)
    return thread

@api_router.get("/threads/{thread_id}/replies", response_model=List[Reply])
async def get_replies(thread_id: str, user: User = Depends(get_current_user)):
    replies = await db.replies.find({"thread_id": thread_id}, {"_id": 0}).sort("created_at", 1).to_list(1000)
    deleted_ids = await get_deleted_user_ids()
    for reply in replies:
        if reply.get('author_id') in deleted_ids:
            reply['author_name'] = '[Deleted User]'
            reply['author_is_deleted'] = True
        if isinstance(reply.get('created_at'), str):
            reply['created_at'] = datetime.fromisoformat(reply['created_at'])
    return replies

@api_router.post("/threads/{thread_id}/replies", status_code=status.HTTP_201_CREATED)
async def create_reply(thread_id: str, data: ReplyCreateRequest, user: User = Depends(get_current_user)):
    reply = Reply(
        thread_id=thread_id,
        content=data.content,
        author_id=user.id,
        author_name=user.name,
        parent_reply_id=data.parent_reply_id  # Support nested replies
    )
    doc = reply.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.replies.insert_one(doc)
    
    # Update thread
    await db.threads.update_one(
        {"id": thread_id},
        {
            "$inc": {"replies_count": 1},
            "$set": {"last_activity": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    # Send mention notifications safely
    await send_mention_notifications(data.content, user.name, f"/threads")
    
    doc.pop('_id', None)
    await sio.emit('new_reply', doc)
    return reply

# Direct message routes
@api_router.get("/messages")
async def get_messages(limit: int = 200, skip: int = 0, user: User = Depends(get_current_user)):
    safe_limit = min(max(limit, 1), 500)
    messages = await db.direct_messages.find(
        {"$or": [{"sender_id": user.id}, {"receiver_email": user.email}]},
        {"_id": 0}
    ).sort("created_at", -1).skip(max(skip, 0)).to_list(safe_limit)
    
    deleted_user_ids = set()
    deleted_users = await db.users.find({"is_deleted": True}, {"id": 1}).to_list(1000)
    for du in deleted_users:
        deleted_user_ids.add(du['id'])

    for msg in messages:
        if msg.get('sender_id') in deleted_user_ids:
            msg['sender_name'] = '[Deleted User]'
            msg['sender_is_deleted'] = True
        if msg.get('receiver_id') in deleted_user_ids:
            msg['receiver_is_deleted'] = True
        if isinstance(msg.get('created_at'), str):
            msg['created_at'] = datetime.fromisoformat(msg['created_at'])
    return messages

@api_router.get("/messages/unread-count")
async def get_unread_dm_count(user: User = Depends(get_current_user)):
    count = await db.direct_messages.count_documents({
        "receiver_email": user.email,
        "read": False,
        "deleted": {"$ne": True}
    })
    return {"count": count}

@api_router.post("/messages/mark-read")
async def mark_messages_as_read(data: MarkReadRequest, user: User = Depends(get_current_user)):
    sender_id = data.sender_id
    if sender_id:
        await db.direct_messages.update_many(
            {
                "sender_id": sender_id,
                "$or": [{"receiver_email": user.email}, {"receiver_id": user.id}],
                "read": False
            },
            {"$set": {"read": True}}
        )
        await sio.emit('messages_marked_read', {"reader_id": user.id, "sender_id": sender_id}, room=user.id)
    return {"message": "Messages marked as read"}

@api_router.get("/messages/requests")
async def get_message_requests(user: User = Depends(get_current_user)):
    requests = await db.message_requests.find(
        {
            "$or": [
                {"receiver_id": user.id},
                {"receiver_email": user.email}
            ],
            "status": "pending"
        },
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    for r in requests:
        if isinstance(r.get('created_at'), str):
            try:
                r['created_at'] = datetime.fromisoformat(r['created_at'])
            except Exception:
                pass
    return requests

@api_router.get("/messages/requests/sent")
async def get_sent_message_requests(user: User = Depends(get_current_user)):
    requests = await db.message_requests.find(
        {"sender_id": user.id, "status": "pending"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    for r in requests:
        if isinstance(r.get('created_at'), str):
            try:
                r['created_at'] = datetime.fromisoformat(r['created_at'])
            except Exception:
                pass
    return requests

@api_router.get("/messages/accepted-contacts")
async def get_accepted_contacts(user: User = Depends(get_current_user)):
    accepted = await db.message_requests.find({
        "$or": [
            {"sender_id": user.id, "status": "accepted"},
            {"receiver_id": user.id, "status": "accepted"}
        ]
    }, {"_id": 0}).to_list(1000)
    
    accepted_ids = set()
    for a in accepted:
        if a.get('sender_id') != user.id:
            accepted_ids.add(a.get('sender_id'))
        if a.get('receiver_id') != user.id:
            accepted_ids.add(a.get('receiver_id'))
            
    sent_to = await db.direct_messages.distinct("receiver_id", {"sender_id": user.id})
    for r in sent_to:
        if r and r != user.id:
            accepted_ids.add(r)
            
    # Include all admins as automatically accepted contacts
    admins = await db.users.find({"role": "admin"}, {"id": 1}).to_list(50)
    for adm in admins:
        if adm.get('id') and adm.get('id') != user.id:
            accepted_ids.add(adm.get('id'))
            
    return {
        "accepted_contacts": list(accepted_ids),
        "accepted_user_ids": list(accepted_ids)
    }

@api_router.post("/messages/requests/{request_id}/accept")
async def accept_message_request(request_id: str, user: User = Depends(get_current_user)):
    req = await db.message_requests.find_one({
        "id": request_id,
        "$or": [{"receiver_id": user.id}, {"receiver_email": user.email}]
    }, {"_id": 0})
    if not req:
        raise HTTPException(status_code=404, detail="Message request not found")
    
    await db.message_requests.update_one(
        {"id": request_id},
        {"$set": {"status": "accepted", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Update pending messages between these users to accepted
    await db.direct_messages.update_many(
        {
            "sender_id": req['sender_id'],
            "$or": [{"receiver_id": user.id}, {"receiver_email": user.email}]
        },
        {"$set": {"is_accepted": True}}
    )
    
    # Notify sender that request was accepted
    await sio.emit("message_request_accepted", {"request_id": request_id, "user_id": user.id, "user_name": user.name}, room=req['sender_id'])
    return {"message": "Message request accepted", "request_id": request_id}

@api_router.post("/messages/requests/{request_id}/decline")
async def decline_message_request(request_id: str, user: User = Depends(get_current_user)):
    req = await db.message_requests.find_one({
        "id": request_id,
        "$or": [{"receiver_id": user.id}, {"receiver_email": user.email}]
    }, {"_id": 0})
    if not req:
        raise HTTPException(status_code=404, detail="Message request not found")
    
    await db.message_requests.update_one(
        {"id": request_id},
        {"$set": {"status": "declined", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "Message request declined", "request_id": request_id}

@api_router.post("/messages", status_code=status.HTTP_201_CREATED)
async def send_message(data: DirectMessageSendRequest, user: User = Depends(get_current_user)):
    receiver = await db.users.find_one({"email": data.receiver_email}, {"_id": 0})
    if not receiver:
        raise HTTPException(status_code=404, detail="Recipient user not found")
    
    receiver_id = receiver['id']
    
    # Check if a conversation or accepted request already exists
    has_accepted = await db.message_requests.find_one({
        "$or": [
            {"sender_id": user.id, "receiver_id": receiver_id, "status": "accepted"},
            {"sender_id": receiver_id, "receiver_id": user.id, "status": "accepted"}
        ]
    })
    
    # Check if there is already prior message exchange from receiver
    prior_reply = await db.direct_messages.find_one({
        "sender_id": receiver_id,
        "receiver_id": user.id
    })
    
    is_accepted = bool(has_accepted or prior_reply or user.role == "admin")
    if not is_accepted:
        existing_req = await db.message_requests.find_one({
            "sender_id": user.id,
            "receiver_id": receiver_id
        })
        if not existing_req:
            req_doc = {
                "id": str(uuid.uuid4()),
                "sender_id": user.id,
                "sender_name": user.name,
                "sender_email": user.email,
                "sender_picture": user.picture,
                "receiver_id": receiver_id,
                "receiver_email": receiver['email'],
                "receiver_name": receiver.get('name', ''),
                "receiver_picture": receiver.get('picture', ''),
                "initial_content": data.content,
                "status": "pending",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            await db.message_requests.insert_one(req_doc)
            req_doc.pop('_id', None)
            await sio.emit("new_message_request", req_doc, room=receiver_id)
            await sio.emit("new_message_request", req_doc, room=user.id)
        else:
            await db.message_requests.update_one(
                {"id": existing_req["id"]},
                {"$set": {
                    "initial_content": data.content,
                    "status": "pending",
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            req_doc = {**existing_req, "initial_content": data.content, "status": "pending"}
            req_doc.pop('_id', None)
            await sio.emit("new_message_request", req_doc, room=receiver_id)
            await sio.emit("new_message_request", req_doc, room=user.id)
    
    message = DirectMessage(
        sender_id=user.id,
        sender_name=user.name,
        receiver_email=data.receiver_email,
        receiver_id=receiver_id,
        content=data.content,
        reply_to_id=data.reply_to_id
    )
    
    doc = message.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.direct_messages.insert_one(doc)
    
    doc.pop('_id', None)
    await sio.emit('new_message', doc, room=receiver_id)
    
    return message

# Assignment routes
@api_router.get("/assignments", response_model=List[Assignment])
async def get_assignments(user: User = Depends(get_current_user)):
    assignments = await db.assignments.find({"is_active": True}, {"_id": 0}).to_list(100)
    for assign in assignments:
        if isinstance(assign.get('deadline'), str):
            assign['deadline'] = datetime.fromisoformat(assign['deadline'])
        if isinstance(assign.get('created_at'), str):
            assign['created_at'] = datetime.fromisoformat(assign['created_at'])
    return assignments

@api_router.post("/assignments", status_code=status.HTTP_201_CREATED)
async def create_assignment(data: AssignmentCreateRequest, admin: User = Depends(check_admin_or_core)):
    try:
        deadline_dt = datetime.fromisoformat(data.deadline)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid deadline format")
    assignment = Assignment(
        title=data.title,
        description=data.description,
        deadline=deadline_dt,
        created_by=admin.id
    )
    doc = assignment.model_dump()
    doc['deadline'] = doc['deadline'].isoformat()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.assignments.insert_one(doc)
    return assignment

@api_router.post("/assignments/{assignment_id}/submit")
async def submit_assignment(assignment_id: str, file: UploadFile = File(...), user: User = Depends(get_current_user)):
    file_content = await file.read()
    file_url = ""
    
    # Upload to Cloudinary if configured
    if cloudinary_cloud_name and cloudinary_api_key and cloudinary_api_secret:
        try:
            upload_result = cloudinary.uploader.upload(
                file_content,
                resource_type="auto",
                folder="medvigyaan/assignments"
            )
            file_url = upload_result.get('secure_url', '')
        except Exception as e:
            logger.error(f"Cloudinary upload failed for assignment submission: {e}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"External file upload service unavailable: {str(e)}"
            )
    else:
        # Resilient local/mock storage fallback when Cloudinary is not configured
        import base64
        encoded = base64.b64encode(file_content).decode("ascii")
        mime = file.content_type or "application/octet-stream"
        file_url = f"data:{mime};base64,{encoded}"
        logger.info(f"Local storage fallback used for assignment submission: {file.filename}")
    
    submission = Submission(
        assignment_id=assignment_id,
        user_id=user.id,
        user_name=user.name,
        file_url=file_url,
        file_name=file.filename
    )
    
    doc = submission.model_dump()
    doc['submitted_at'] = doc['submitted_at'].isoformat()
    await db.submissions.insert_one(doc)
    return submission

@api_router.get("/assignments/{assignment_id}/submissions")
async def get_submissions(assignment_id: str, user: User = Depends(get_current_user)):
    submissions = await db.submissions.find({"assignment_id": assignment_id}, {"_id": 0}).to_list(1000)
    deleted_ids = await get_deleted_user_ids()
    for sub in submissions:
        if sub.get('user_id') in deleted_ids:
            sub['user_name'] = '[Deleted User]'
            sub['user_is_deleted'] = True
        if isinstance(sub.get('submitted_at'), str):
            sub['submitted_at'] = datetime.fromisoformat(sub['submitted_at'])
    return submissions

# Whitelist management routes
@api_router.get("/admin/whitelist")
async def get_whitelisted_emails(admin: User = Depends(check_admin)):
    emails = await db.whitelisted_emails.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return emails

@api_router.post("/admin/whitelist", status_code=status.HTTP_201_CREATED)
async def add_whitelisted_email(data: WhitelistEmailRequest, admin: User = Depends(check_admin)):
    email = data.email.strip().lower()
    
    # Check if already exists
    existing = await db.whitelisted_emails.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already whitelisted")
    
    whitelist_entry = WhitelistedEmail(
        email=email,
        added_by=admin.id
    )
    
    doc = whitelist_entry.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.whitelisted_emails.insert_one(doc)
    return whitelist_entry

@api_router.delete("/admin/whitelist/{email}")
async def remove_whitelisted_email(email: str, admin: User = Depends(check_admin)):
    await db.whitelisted_emails.delete_one({"email": email.strip().lower()})
    return {"message": "Email removed from whitelist"}

# Blog routes
@api_router.get("/blogs", response_model=List[Blog])
async def get_blogs(user: User = Depends(get_current_user)):
    blogs = await db.blogs.find({"published": True}, {"_id": 0}).sort("created_at", -1).to_list(100)
    deleted_ids = await get_deleted_user_ids()
    for blog in blogs:
        if blog.get('author_id') in deleted_ids:
            blog['author_name'] = '[Deleted User]'
            blog['author_is_deleted'] = True
        if isinstance(blog.get('created_at'), str):
            blog['created_at'] = datetime.fromisoformat(blog['created_at'])
        if isinstance(blog.get('updated_at'), str):
            blog['updated_at'] = datetime.fromisoformat(blog['updated_at'])
    return blogs

@api_router.post("/blogs", status_code=status.HTTP_201_CREATED)
async def create_blog(data: BlogCreateRequest, user: User = Depends(get_current_user)):
    blog = Blog(
        title=data.title,
        content=data.content,
        author_id=user.id,
        author_name=user.name,
        tags=data.tags
    )
    doc = blog.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    await db.blogs.insert_one(doc)
    return blog

# Task routes
@api_router.get("/tasks", response_model=List[Task])
async def get_tasks(user: User = Depends(get_current_user)):
    tasks = await db.tasks.find({}, {"_id": 0}).to_list(1000)
    deleted_ids = await get_deleted_user_ids()
    for task in tasks:
        for assignee in task.get('assignees', []):
            if assignee.get('user_id') in deleted_ids:
                assignee['name'] = '[Deleted User]'
        if isinstance(task.get('deadline'), str):
            task['deadline'] = datetime.fromisoformat(task['deadline'])
        if isinstance(task.get('created_at'), str):
            task['created_at'] = datetime.fromisoformat(task['created_at'])
    return tasks

@api_router.post("/tasks", status_code=status.HTTP_201_CREATED)
async def create_task(data: TaskCreateRequest, user: User = Depends(check_admin_or_core)):
    try:
        deadline_dt = datetime.fromisoformat(data.deadline)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid deadline format")
    task = Task(
        title=data.title,
        description=data.description,
        assignees=data.assignees,
        deadline=deadline_dt,
        created_by=user.id
    )
    doc = task.model_dump()
    doc['deadline'] = doc['deadline'].isoformat()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.tasks.insert_one(doc)
    doc.pop('_id', None)
    await sio.emit('new_task', doc)
    return task

@api_router.put("/tasks/{task_id}")
async def update_task(task_id: str, data: Dict[str, Any], user: User = Depends(get_current_user)):
    # Check if user can edit
    task = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    assignees = task.get('assignees', [])
    if 'status' in data:
        # If user passed user_id or default to current user
        target_user_id = data.get('user_id') or user.id
        # Regular members can only update their own status
        if user.role not in ["admin", "core"] and target_user_id != user.id:
            raise HTTPException(status_code=403, detail="Not authorized to update other assignees")
            
        found = False
        for a in assignees:
            if a.get('user_id') == target_user_id:
                a['status'] = data['status']
                found = True
        if not found and user.role not in ["admin", "core"]:
            raise HTTPException(status_code=403, detail="Not an assignee of this task")
        update_data = {"assignees": assignees}
    elif user.role in ["admin", "core"]:
        update_data = data
    else:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.tasks.update_one({"id": task_id}, {"$set": update_data})
    await sio.emit('task_updated', {"task_id": task_id, "data": update_data})
    return {"message": "Task updated"}

# Certificate routes
@api_router.post("/certificates/templates")
async def create_certificate_template(
    name: str = Form(...),
    file: UploadFile = File(...),
    admin: User = Depends(check_admin)
):
    # Upload template to Cloudinary or fallback
    file_content = await file.read()
    template_url = await upload_file_or_fallback(
        file_content=file_content,
        content_type=file.content_type,
        folder="medvigyaan/certificate_templates"
    )
    
    template = CertificateTemplate(
        name=name,
        template_url=template_url
    )
    
    doc = template.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.certificate_templates.insert_one(doc)
    return template

@api_router.get("/certificates/templates")
async def get_certificate_templates(admin: User = Depends(check_admin)):
    templates = await db.certificate_templates.find({}, {"_id": 0}).to_list(100)
    return templates

@api_router.put("/certificates/templates/{template_id}")
async def update_template_positions(
    template_id: str,
    data: Dict[str, Any],
    admin: User = Depends(check_admin)
):
    positions = data.get('text_positions', [])
    await db.certificate_templates.update_one(
        {"id": template_id},
        {"$set": {"text_positions": positions}}
    )
    return {"message": "Template updated"}

@api_router.post("/certificates/generate")
async def generate_certificates(data: Dict[str, Any], admin: User = Depends(check_admin)):
    template_id = data['template_id']
    user_ids = data['user_ids']
    guest_emails = data.get('guest_emails', [])
    
    template = await db.certificate_templates.find_one({"id": template_id}, {"_id": 0})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Note: Gmail sending will be configured later
    generated = []
    
    for user_id in user_ids:
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if user:
            generated.append({"email": user['email'], "name": user['name']})
    
    for email in guest_emails:
        generated.append({"email": email, "name": email.split('@')[0]})
    
    return {
        "message": "Certificates will be generated and sent",
        "count": len(generated),
        "recipients": generated,
        "note": "Gmail SMTP needs to be configured in .env"
    }

# Profile routes
@api_router.put("/profile")
async def update_profile(data: Dict[str, Any], user: User = Depends(get_current_user)):
    update_data = {}
    allowed_fields = ['name', 'department', 'phone', 'bio', 'picture', 'show_email']
    for field in allowed_fields:
        if field in data and data[field] is not None:
            update_data[field] = data[field]
    
    if update_data:
        await db.users.update_one({"id": user.id}, {"$set": update_data})
        
        # Propagate name updates across denormalized collections
        if 'name' in update_data:
            new_name = update_data['name']
            try:
                await db.tasks.update_many(
                    {"assignees.user_id": user.id},
                    {"$set": {"assignees.$[elem].name": new_name}},
                    array_filters=[{"elem.user_id": user.id}]
                )
            except Exception:
                # mongomock fallback: update assignees in memory
                tasks = await db.tasks.find({"assignees.user_id": user.id}).to_list(200)
                for t in tasks:
                    new_assignees = [
                        {**a, "name": new_name} if a.get("user_id") == user.id else a
                        for a in t.get("assignees", [])
                    ]
                    await db.tasks.update_one({"id": t["id"]}, {"$set": {"assignees": new_assignees}})
            await db.threads.update_many({"author_id": user.id}, {"$set": {"author_name": new_name}})
            await db.replies.update_many({"author_id": user.id}, {"$set": {"author_name": new_name}})
            await db.blogs.update_many({"author_id": user.id}, {"$set": {"author_name": new_name}})
            await db.submissions.update_many({"user_id": user.id}, {"$set": {"user_name": new_name}})
        
        updated_user = await db.users.find_one({"id": user.id}, {"_id": 0})
        if updated_user:
            await sio.emit('user_profile_updated', {
                "user_id": user.id,
                "user": updated_user
            })
            return {"message": "Profile updated", "user": updated_user}
            
    return {"message": "Profile updated", "user": user.model_dump()}

@api_router.delete("/profile")
async def delete_profile(user: User = Depends(get_current_user)):
    main_admin = os.environ.get("MAIN_ADMIN_EMAIL", FIRST_ADMIN_EMAIL or "").strip().lower()
    if user.email.lower() == main_admin:
        raise HTTPException(
            status_code=403, 
            detail="The main administrator profile is protected by system configuration and cannot be deleted."
        )

    now = datetime.now(timezone.utc)
    await db.users.update_one(
        {"id": user.id},
        {"$set": {
            "is_deleted": True,
            "deleted_at": now.isoformat(),
            "deletion_scheduled_at": (now + timedelta(days=30)).isoformat()
        }}
    )
    await sio.emit('user_profile_updated', {"user_id": user.id, "user": {"id": user.id, "is_deleted": True}})
    return {
        "status": "deactivated",
        "message": "Profile deactivated. Your data will be preserved for 30 days before permanent deletion. Logging in within 30 days will restore your account."
    }

@api_router.put("/users/{user_id}/profile")
async def admin_update_user_profile(user_id: str, data: Dict[str, Any], admin: User = Depends(check_admin)):
    target_user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    update_data = {}
    allowed_fields = ['name', 'department', 'phone', 'bio', 'role', 'badges', 'tags', 'show_email', 'is_active']
    for field in allowed_fields:
        if field in data and data[field] is not None:
            update_data[field] = data[field]
            
    if 'role' in update_data:
        if is_main_admin(target_user.get('email', '')) and update_data['role'] != 'admin':
            raise HTTPException(
                status_code=403, 
                detail="The main administrator role is protected by system configuration and cannot be modified."
            )
        if update_data['role'] not in ["member", "core", "admin"]:
            raise HTTPException(status_code=400, detail="Invalid role. Must be 'member', 'core', or 'admin'.")
        if user_id == admin.id and update_data['role'] != "admin":
            raise HTTPException(status_code=400, detail="Cannot demote yourself. Another admin must perform this action.")
            
    if update_data:
        await db.users.update_one({"id": user_id}, {"$set": update_data})
        if 'name' in update_data:
            new_name = update_data['name']
            try:
                await db.tasks.update_many(
                    {"assignees.user_id": user_id},
                    {"$set": {"assignees.$[elem].name": new_name}},
                    array_filters=[{"elem.user_id": user_id}]
                )
            except Exception:
                # mongomock fallback
                tasks = await db.tasks.find({"assignees.user_id": user_id}).to_list(200)
                for t in tasks:
                    new_assignees = [
                        {**a, "name": new_name} if a.get("user_id") == user_id else a
                        for a in t.get("assignees", [])
                    ]
                    await db.tasks.update_one({"id": t["id"]}, {"$set": {"assignees": new_assignees}})
            await db.threads.update_many({"author_id": user_id}, {"$set": {"author_name": new_name}})
            await db.replies.update_many({"author_id": user_id}, {"$set": {"author_name": new_name}})
            await db.blogs.update_many({"author_id": user_id}, {"$set": {"author_name": new_name}})
            await db.submissions.update_many({"user_id": user_id}, {"$set": {"user_name": new_name}})
            
        updated = await db.users.find_one({"id": user_id}, {"_id": 0})
        await sio.emit('user_profile_updated', {
            "user_id": user_id,
            "user": updated
        })
        return {"message": "User profile updated", "user": updated}
        
    return {"message": "No changes", "user": target_user}

# Notification routes
@api_router.get("/notifications")
async def get_notifications(user: User = Depends(get_current_user)):
    notifications = await db.notifications.find(
        {"user_id": user.id},
        {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    
    for notif in notifications:
        if isinstance(notif.get('created_at'), str):
            notif['created_at'] = datetime.fromisoformat(notif['created_at'])
    
    return notifications

@api_router.put("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, user: User = Depends(get_current_user)):
    await db.notifications.update_one(
        {"id": notification_id, "user_id": user.id},
        {"$set": {"read": True}}
    )
    await sio.emit("notifications_updated", {"user_id": user.id}, room=user.id)
    return {"message": "Notification marked as read"}

@api_router.post("/notifications/mark-all-read")
async def mark_all_notifications_read(user: User = Depends(get_current_user)):
    await db.notifications.update_many(
        {"user_id": user.id},
        {"$set": {"read": True}}
    )
    await sio.emit("notifications_updated", {"user_id": user.id}, room=user.id)
    return {"message": "All notifications marked as read"}

# Delete routes
@api_router.delete("/threads/{thread_id}")
async def delete_thread(thread_id: str, admin: User = Depends(check_admin)):
    thread = await db.threads.find_one({"id": thread_id}, {"_id": 0})
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    
    await db.threads.delete_one({"id": thread_id})
    await db.replies.delete_many({"thread_id": thread_id})
    return {"message": "Thread deleted"}

@api_router.delete("/replies/{reply_id}")
async def delete_reply(reply_id: str, user: User = Depends(get_current_user)):
    reply = await db.replies.find_one({"id": reply_id}, {"_id": 0})
    if not reply:
        raise HTTPException(status_code=404, detail="Reply not found")
    
    if reply['author_id'] != user.id and user.role != 'admin':
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.replies.delete_one({"id": reply_id})
    
    # Update thread reply count
    thread_id = reply['thread_id']
    await db.threads.update_one(
        {"id": thread_id},
        {"$inc": {"replies_count": -1}}
    )
    
    return {"message": "Reply deleted"}

@api_router.delete("/messages/{message_id}")
async def delete_message(message_id: str, user: User = Depends(get_current_user)):
    message = await db.direct_messages.find_one({"id": message_id}, {"_id": 0})
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    if message['sender_id'] != user.id and user.role not in ['admin', 'core']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if message['sender_id'] != user.id:
        if user.role == 'admin':
            deleted_by = 'admin'
            deleted_content = 'This message was deleted by Admin'
        elif user.role == 'core':
            deleted_by = 'core'
            deleted_content = 'This message was deleted by Core Team'
        else:
            deleted_by = 'moderator'
            deleted_content = 'This message was deleted by Moderator'
    else:
        deleted_by = 'user'
        deleted_content = 'This message was deleted'

    # Mark as deleted with attribution
    await db.direct_messages.update_one(
        {"id": message_id},
        {"$set": {"deleted": True, "deleted_by": deleted_by, "content": deleted_content}}
    )
    event_data = {"message_id": message_id, "deleted_by": deleted_by, "content": deleted_content}
    receiver_id = message.get('receiver_id')
    sender_id = message.get('sender_id')
    if receiver_id:
        await sio.emit('message_deleted', event_data, room=receiver_id)
    if sender_id:
        await sio.emit('message_deleted', event_data, room=sender_id)
    return {"message": "Message deleted", "deleted_by": deleted_by, "content": deleted_content}

@api_router.delete("/blogs/{blog_id}")
async def delete_blog(blog_id: str, admin: User = Depends(check_admin)):
    blog = await db.blogs.find_one({"id": blog_id}, {"_id": 0})
    if not blog:
        raise HTTPException(status_code=404, detail="Blog not found")
    
    await db.blogs.delete_one({"id": blog_id})
    return {"message": "Blog deleted"}

@api_router.delete("/assignments/{assignment_id}")
async def delete_assignment(assignment_id: str, admin: User = Depends(check_admin_or_core)):
    await db.assignments.delete_one({"id": assignment_id})
    await db.submissions.delete_many({"assignment_id": assignment_id})
    return {"message": "Assignment deleted"}

@api_router.delete("/tasks/{task_id}")
async def delete_task(task_id: str, admin: User = Depends(check_admin_or_core)):
    await db.tasks.delete_one({"id": task_id})
    return {"message": "Task deleted"}

# Blog CMS routes (admin only)
@api_router.get("/admin/blogs", response_model=List[Blog])
async def admin_get_all_blogs(admin: User = Depends(check_admin)):
    blogs = await db.blogs.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    deleted_ids = await get_deleted_user_ids()
    for blog in blogs:
        if blog.get('author_id') in deleted_ids:
            blog['author_name'] = '[Deleted User]'
            blog['author_is_deleted'] = True
        if isinstance(blog.get('created_at'), str):
            blog['created_at'] = datetime.fromisoformat(blog['created_at'])
        if isinstance(blog.get('updated_at'), str):
            blog['updated_at'] = datetime.fromisoformat(blog['updated_at'])
    return blogs

@api_router.put("/admin/blogs/{blog_id}")
async def admin_update_blog(blog_id: str, data: Dict[str, Any], admin: User = Depends(check_admin)):
    update_data = {**data, "updated_at": datetime.now(timezone.utc).isoformat()}
    await db.blogs.update_one({"id": blog_id}, {"$set": update_data})
    return {"message": "Blog updated"}

@api_router.put("/admin/blogs/{blog_id}/publish")
async def admin_toggle_blog_publish(blog_id: str, data: Dict[str, bool], admin: User = Depends(check_admin)):
    published = data.get('published', True)
    await db.blogs.update_one({"id": blog_id}, {"$set": {"published": published}})
    return {"message": f"Blog {'published' if published else 'unpublished'}"}

# Calendar routes
@api_router.get("/calendar/config")
async def get_calendar_config(user: User = Depends(get_current_user)):
    config = await db.calendar_config.find_one({}, {"_id": 0})
    if not config:
        # Default config
        default_calendars = [{
            "id": "516138e98f9c938ed0a96b923fb87ecd72da97c6d896466938174db352f2e793",
            "label": "Main Calendar",
            "color": "#2e7d96",
            "enabled": True
        }]
        config = {
            "id": str(uuid.uuid4()),
            "calendar_ids": default_calendars,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.calendar_config.insert_one(config)
    config.pop('_id', None)
    return config

@api_router.put("/calendar/config")
async def update_calendar_config(data: Dict[str, Any], admin: User = Depends(check_admin)):
    calendar_ids = data.get('calendar_ids', [])
    if len(calendar_ids) > 3:
        raise HTTPException(status_code=400, detail="Maximum 3 calendars allowed")
    
    await db.calendar_config.update_one(
        {},
        {"$set": {
            "calendar_ids": calendar_ids,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    return {"message": "Calendar config updated"}

@api_router.get("/calendar/events")
async def get_calendar_events(user: User = Depends(get_current_user)):
    try:
        all_events = []
        
        # Fetch native events first
        native_events = await db.native_calendar_events.find({}, {"_id": 0}).to_list(1000)
        for event in native_events:
            all_events.append({
                "id": event['id'],
                "title": event['title'],
                "description": event.get('description', ''),
                "start": event['start_date'] if isinstance(event['start_date'], str) else event['start_date'].isoformat(),
                "end": event['end_date'] if isinstance(event['end_date'], str) else event['end_date'].isoformat(),
                "calendar_label": "Event",
                "calendar_color": "#2e7d96",
                "source": "native"
            })
        
        # Try to fetch Google Calendar events (may fail if not configured)
        try:
            config = await db.calendar_config.find_one({}, {"_id": 0})
            google_api_key = os.environ.get('GOOGLE_CALENDAR_API_KEY', '')
            
            if config and google_api_key:
                service = build('calendar', 'v3', developerKey=google_api_key)
                
                for cal in config.get('calendar_ids', []):
                    if not cal.get('enabled', True) or not cal.get('id'):
                        continue
                    
                    try:
                        now = datetime.now(timezone.utc).isoformat()
                        events_result = service.events().list(
                            calendarId=cal['id'],
                            timeMin=now,
                            maxResults=50,
                            singleEvents=True,
                            orderBy='startTime'
                        ).execute()
                        
                        events = events_result.get('items', [])
                        for event in events:
                            all_events.append({
                                "id": event['id'],
                                "title": event.get('summary', 'No title'),
                                "description": event.get('description', ''),
                                "start": event['start'].get('dateTime', event['start'].get('date')),
                                "end": event['end'].get('dateTime', event['end'].get('date')),
                                "calendar_label": cal['label'],
                                "calendar_color": cal['color'],
                                "source": "google"
                            })
                    except Exception as e:
                        print(f"Error fetching Google calendar {cal['id']}: {e}")
                        continue
            elif config and not google_api_key:
                print("GOOGLE_CALENDAR_API_KEY not configured - skipping Google Calendar fetch")
        except Exception as e:
            print(f"Google Calendar not configured or error: {e}")
        
        return all_events
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch events: {str(e)}")

# Native Calendar routes
@api_router.get("/calendar/native-events")
async def get_native_events(user: User = Depends(get_current_user)):
    events = await db.native_calendar_events.find({}, {"_id": 0}).sort("start_date", 1).to_list(1000)
    for event in events:
        if isinstance(event.get('start_date'), str):
            event['start_date'] = datetime.fromisoformat(event['start_date'])
        if isinstance(event.get('end_date'), str):
            event['end_date'] = datetime.fromisoformat(event['end_date'])
        if isinstance(event.get('created_at'), str):
            event['created_at'] = datetime.fromisoformat(event['created_at'])
    return events

@api_router.post("/calendar/native-events", status_code=status.HTTP_201_CREATED)
async def create_native_event(data: NativeEventCreateRequest, user: User = Depends(check_admin_or_core)):
    try:
        start_dt = datetime.fromisoformat(data.start_date)
        end_dt = datetime.fromisoformat(data.end_date)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid date format")
    event = NativeCalendarEvent(
        title=data.title,
        description=data.description,
        start_date=start_dt,
        end_date=end_dt,
        created_by=user.id
    )
    
    doc = event.model_dump()
    doc['start_date'] = doc['start_date'].isoformat()
    doc['end_date'] = doc['end_date'].isoformat()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.native_calendar_events.insert_one(doc)
    
    # Check if event is today and send notifications
    today = date.today()
    event_date = start_dt.date()
    if event_date == today:
        users = await db.users.find({}, {"_id": 0}).to_list(1000)
        for u in users:
            await create_notification(
                u['id'],
                'calendar',
                f"Today: {data.title}",
                "Event happening today",
                '/calendar'
            )
    
    return event

@api_router.put("/calendar/native-events/{event_id}")
async def update_native_event(event_id: str, data: Dict[str, Any], user: User = Depends(check_admin_or_core)):
    update_data = {}
    if 'title' in data:
        update_data['title'] = data['title']
    if 'description' in data:
        update_data['description'] = data['description']
    if 'start_date' in data:
        update_data['start_date'] = datetime.fromisoformat(data['start_date']).isoformat()
    if 'end_date' in data:
        update_data['end_date'] = datetime.fromisoformat(data['end_date']).isoformat()
    
    await db.native_calendar_events.update_one({"id": event_id}, {"$set": update_data})
    return {"message": "Event updated"}

@api_router.delete("/calendar/native-events/{event_id}")
async def delete_native_event(event_id: str, user: User = Depends(check_admin_or_core)):
    await db.native_calendar_events.delete_one({"id": event_id})
    return {"message": "Event deleted"}

# Announcement routes
@api_router.get("/announcements")
async def get_announcements(user: User = Depends(get_current_user)):
    announcements = await db.announcements.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    for ann in announcements:
        if isinstance(ann.get('created_at'), str):
            ann['created_at'] = datetime.fromisoformat(ann['created_at'])
    return announcements

@api_router.post("/announcements")
async def create_announcement(
    title: str = Form(...),
    content: str = Form(...),
    link: Optional[str] = Form(None),
    image: Optional[UploadFile] = File(None),
    user: User = Depends(check_admin_or_core)
):
    image_url = None
    if image:
        file_content = await image.read()
        image_url = await upload_file_or_fallback(
            file_content=file_content,
            content_type=image.content_type,
            folder="medvigyaan/announcements"
        )
    
    announcement = Announcement(
        title=title,
        content=content,
        link=link,
        image_url=image_url,
        created_by=user.id
    )
    
    doc = announcement.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.announcements.insert_one(doc)
    
    # Send notification to all users
    users = await db.users.find({}, {"_id": 0}).to_list(1000)
    for u in users:
        if u['id'] != user.id:
            await create_notification(
                u['id'],
                'announcement',
                'New Announcement',
                title,
                '/feed'
            )
    
    return announcement

@api_router.delete("/announcements/{announcement_id}")
async def delete_announcement(announcement_id: str, admin: User = Depends(check_admin_or_core)):
    await db.announcements.delete_one({"id": announcement_id})
    return {"message": "Announcement deleted"}

# Group Chat routes
@api_router.get("/group-chat")
async def get_group_messages(limit: int = 200, skip: int = 0, user: User = Depends(get_current_user)):
    safe_limit = min(max(limit, 1), 500)
    messages = await db.group_messages.find({}, {"_id": 0}).sort("created_at", 1).skip(max(skip, 0)).to_list(safe_limit)
    
    deleted_user_ids = set()
    deleted_users = await db.users.find({"is_deleted": True}, {"id": 1}).to_list(1000)
    for du in deleted_users:
        deleted_user_ids.add(du['id'])

    for msg in messages:
        if msg.get('sender_id') in deleted_user_ids:
            msg['sender_name'] = '[Deleted User]'
            msg['sender_is_deleted'] = True
        if isinstance(msg.get('created_at'), str):
            msg['created_at'] = datetime.fromisoformat(msg['created_at'])
    return messages

@api_router.post("/group-chat", status_code=status.HTTP_201_CREATED)
async def send_group_message(data: GroupMessageSendRequest, user: User = Depends(get_current_user)):
    message = GroupMessage(
        sender_id=user.id,
        sender_name=user.name,
        content=data.content,
        reply_to_id=data.reply_to_id
    )
    
    doc = message.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.group_messages.insert_one(doc)
    
    # Emit full socket event for real-time sync
    doc.pop('_id', None)
    await sio.emit('new_group_message', doc)
    
    return message

@api_router.delete("/group-chat/{message_id}")
async def delete_group_message(message_id: str, user: User = Depends(get_current_user)):
    # Check if message exists and user has permission
    msg = await db.group_messages.find_one({"id": message_id}, {"_id": 0})
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    
    # Only sender, core, or admin can delete
    if msg['sender_id'] != user.id and user.role not in ['admin', 'core']:
        raise HTTPException(status_code=403, detail="Permission denied")
    
    if msg['sender_id'] != user.id:
        if user.role == 'admin':
            deleted_by = 'admin'
            deleted_content = 'This message was deleted by Admin'
        elif user.role == 'core':
            deleted_by = 'core'
            deleted_content = 'This message was deleted by Core Team'
        else:
            deleted_by = 'moderator'
            deleted_content = 'This message was deleted by Moderator'
    else:
        deleted_by = 'user'
        deleted_content = 'This message was deleted'

    await db.group_messages.update_one(
        {"id": message_id},
        {"$set": {"content": deleted_content, "deleted": True, "deleted_by": deleted_by}}
    )
    await sio.emit('group_message_deleted', {"message_id": message_id, "deleted_by": deleted_by, "content": deleted_content})
    
    return {"message": "Message deleted", "deleted_by": deleted_by, "content": deleted_content}

# Link Config routes
@api_router.get("/link-config")
async def get_link_config(user: User = Depends(get_current_user)):
    config = await db.link_config.find_one({}, {"_id": 0})
    if not config:
        config = {"url": "", "label": "External Link"}
    return config

@api_router.put("/link-config")
async def update_link_config(data: Dict[str, Any], admin: User = Depends(check_admin)):
    url = (data.get('url') or '').strip()
    if url and not (url.startswith('http://') or url.startswith('https://')):
        raise HTTPException(status_code=400, detail="External link URL must begin with http:// or https://")
        
    await db.link_config.update_one(
        {},
        {"$set": {
            "url": url,
            "label": data.get('label', 'External Link'),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    return {"message": "Link config updated"}

# Role Permissions routes
@api_router.get("/admin/role-permissions")
async def get_role_permissions(user: User = Depends(get_current_user)):
    config = await db.role_permissions.find_one({}, {"_id": 0})
    return config or {}

@api_router.put("/admin/role-permissions")
async def update_role_permissions(data: Dict[str, Any], admin: User = Depends(check_admin)):
    # Guard: Ensure admin role ALWAYS retains 'admin' page access to prevent lockout
    sanitized_permissions = dict(data)
    if 'admin' in sanitized_permissions and isinstance(sanitized_permissions['admin'], dict):
        admin_pages = sanitized_permissions['admin'].get('pages', [])
        if 'admin' not in admin_pages:
            admin_pages.append('admin')
        sanitized_permissions['admin']['pages'] = admin_pages

    await db.role_permissions.update_one(
        {},
        {"$set": {
            **sanitized_permissions,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    return {"message": "Role permissions updated"}

# Admin Integrations routes
@api_router.get("/admin/integrations")
async def get_integrations(admin: User = Depends(check_admin)):
    # Fetch database overrides if any
    db_settings = await db.integration_settings.find_one({}, {"_id": 0}) or {}
    
    def get_val(key: str) -> str:
        return db_settings.get(key) or os.environ.get(key, '')
        
    return {
        "GOOGLE_CLIENT_ID": get_val('GOOGLE_CLIENT_ID'),
        "GOOGLE_CLIENT_SECRET": "••••••••" if get_val('GOOGLE_CLIENT_SECRET') else '',
        "CLOUDINARY_CLOUD_NAME": get_val('CLOUDINARY_CLOUD_NAME'),
        "CLOUDINARY_API_KEY": get_val('CLOUDINARY_API_KEY'),
        "CLOUDINARY_API_SECRET": "••••••••" if get_val('CLOUDINARY_API_SECRET') else '',
        "GMAIL_USER": get_val('GMAIL_USER'),
        "GMAIL_APP_PASSWORD": "••••••••" if get_val('GMAIL_APP_PASSWORD') else '',
        "GOOGLE_CALENDAR_API_KEY": get_val('GOOGLE_CALENDAR_API_KEY')
    }

@api_router.put("/admin/integrations")
async def update_integrations(data: Dict[str, Any], admin: User = Depends(check_admin)):
    # Filter out masked and empty values, and enforce strict allowlist
    sanitized_data = {
        k: str(v).strip() for k, v in data.items()
        if k in ALLOWED_INTEGRATION_KEYS and v and not str(v).startswith('••••')
    }
    
    if sanitized_data:
        # Store integration settings in database for persistence
        await db.integration_settings.update_one(
            {},
            {"$set": {
                **sanitized_data,
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "updated_by": admin.id
            }},
            upsert=True
        )
        
        # Update running process environment in-memory
        for k, v in sanitized_data.items():
            os.environ[k] = str(v)
    
    # Safely attempt to persist to local .env if file exists (dev environment)
    try:
        env_path = ROOT_DIR / '.env'
        if env_path.exists() and sanitized_data:
            env_content = env_path.read_text()
            for key, value in sanitized_data.items():
                pattern = rf'^{key}=.*$'
                replacement = f'{key}="{value}"'
                if re.search(pattern, env_content, re.MULTILINE):
                    env_content = re.sub(pattern, replacement, env_content, flags=re.MULTILINE)
                else:
                    env_content += f'\n{replacement}'
            env_path.write_text(env_content)
    except Exception as e:
        logger.warning(f"Could not persist to local .env file (non-fatal): {e}")
    
    return {"message": "Integrations updated successfully."}

# Socket.IO events
@sio.event
async def connect(sid, environ):
    print(f"Client connected: {sid}")

@sio.event
async def disconnect(sid):
    print(f"Client disconnected: {sid}")

@sio.event
async def join_room(sid, data):
    user_id = data.get('user_id')
    await sio.enter_room(sid, user_id)

# Background task for calendar notifications
async def check_calendar_events():
    while True:
        try:
            # Check every hour
            await asyncio.sleep(3600)
            
            # Google Calendar requires an API key
            google_api_key = os.environ.get('GOOGLE_CALENDAR_API_KEY')
            if not google_api_key:
                continue

            # Get today's events
            config = await db.calendar_config.find_one({}, {"_id": 0})
            if not config:
                continue
            
            today = date.today().isoformat()
            
            for cal in config.get('calendar_ids', []):
                if not cal.get('enabled', True):
                    continue
                
                try:
                    service = build('calendar', 'v3', developerKey=google_api_key)
                    events_result = service.events().list(
                        calendarId=cal['id'],
                        timeMin=f"{today}T00:00:00Z",
                        timeMax=f"{today}T23:59:59Z",
                        singleEvents=True,
                        orderBy='startTime'
                    ).execute()
                    
                    events = events_result.get('items', [])
                    
                    # Send notifications for today's events
                    users = await db.users.find({}, {"_id": 0}).to_list(1000)
                    for event in events:
                        event_title = event.get('summary', 'Event')
                        for u in users:
                            # Check if notification already sent
                            existing = await db.notifications.find_one({
                                "user_id": u['id'],
                                "type": "calendar",
                                "title": f"Today: {event_title}"
                            })
                            
                            if not existing:
                                await create_notification(
                                    u['id'],
                                    'calendar',
                                    f"Today: {event_title}",
                                    f"Event happening today",
                                    '/calendar'
                                )
                except Exception as e:
                    logger.warning(f"Error checking calendar {cal.get('id')}: {e}")
                    continue
                    
        except Exception as e:
            logger.error(f"Calendar check error: {e}")

# Include router
app.include_router(api_router)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Socket.IO ASGI app
socket_app = socketio.ASGIApp(sio, app)

# Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

async def init_db_indexes(database):
    try:
        await database.users.create_index("email", unique=True)
        await database.whitelisted_emails.create_index("email", unique=True)
        await database.threads.create_index([("last_activity", -1)])
        await database.replies.create_index([("thread_id", 1), ("created_at", 1)])
        await database.direct_messages.create_index([("receiver_email", 1), ("read", 1)])
        await database.direct_messages.create_index([("sender_id", 1), ("receiver_email", 1)])
        await database.notifications.create_index([("user_id", 1), ("created_at", -1)])
        logger.info("MongoDB indexes successfully initialized")
    except Exception as e:
        logger.warning(f"Index initialization note: {e}")

@app.on_event("startup")
async def startup_event():
    # Security diagnostic for production bootstrapping
    if settings.is_production and not FIRST_ADMIN_EMAIL:
        logger.warning(
            "SECURITY WARNING: FIRST_ADMIN_EMAIL environment variable is not configured. "
            "Set FIRST_ADMIN_EMAIL to your administrator email address to allow admin account provisioning."
        )
    # Initialize DB indexes
    await init_db_indexes(db)
    # Start calendar event checker
    asyncio.create_task(check_calendar_events())

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

# Unified ASGI application export for universal PaaS deployment compatibility (uvicorn server:app)
app = socket_app