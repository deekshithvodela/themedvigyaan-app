from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
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

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', '')
if mongo_url.startswith('mock') or not mongo_url:
    from mongomock_motor import AsyncMongoMockClient
    client = AsyncMongoMockClient()
    db = client[os.environ.get('DB_NAME', 'medvigyaan_db')]
    print("Using In-Memory Mock MongoDB client")
else:
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ['DB_NAME']]

# Cloudinary config
cloudinary.config(
    cloud_name=os.environ['CLOUDINARY_CLOUD_NAME'],
    api_key=os.environ['CLOUDINARY_API_KEY'],
    api_secret=os.environ['CLOUDINARY_API_SECRET']
)

# JWT config
JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = os.environ['JWT_ALGORITHM']
FIRST_ADMIN_EMAIL = os.environ['FIRST_ADMIN_EMAIL']

# Socket.IO setup
sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins=[
    "https://themedvigyaan.vercel.app",
    "http://localhost:3000"
])
app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# Models
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    name: str
    picture: Optional[str] = None
    role: str = "member"  # member, core, admin
    department: Optional[str] = None
    phone: Optional[str] = None
    bio: Optional[str] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Thread(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    author_id: str
    author_name: str
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
        # Get users by name
        for mention in mentions:
            user = await db.users.find_one({"name": {"$regex": f"^{mention}", "$options": "i"}}, {"_id": 0})
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
    # Ensure bypass is only allowed when using mock DB or if explicitly allowed
    mongo_url = os.environ.get('MONGO_URL', '')
    allow_bypass = os.environ.get('ALLOW_AUTH_BYPASS', 'false').lower() == 'true'
    if not (mongo_url.startswith('mock') or not mongo_url) and not allow_bypass:
        raise HTTPException(
            status_code=403,
            detail="Bypass authentication is not allowed in this environment"
        )
        
    # Ensure FIRST_ADMIN_EMAIL is whitelisted and exists
    admin_email = os.environ.get('FIRST_ADMIN_EMAIL', 'admin@example.com')
    
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
            "image_url": "https://customer-assets.emergentagent.com/job_teamchat-portal/artifacts/r1igb56v_logoo.jpg",
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
        
        # Seed Link Config
        await db.link_configs.insert_one({
            "id": "link-1",
            "url": "https://github.com/deekshithvodela/themedvigyaan-app",
            "label": "MedVigyaan GitHub",
            "updated_at": datetime.now(timezone.utc).isoformat()
        })

    # Return JWT token for requested role
    role = (data or {}).get('role', 'admin')
    user = None
    if role == 'admin':
        user = await db.users.find_one({"email": admin_email}, {"_id": 0})
    elif role == 'core':
        user = await db.users.find_one({"email": "core@example.com"}, {"_id": 0})
    else:
        user = await db.users.find_one({"email": "member@example.com"}, {"_id": 0})
        
    jwt_token = create_token(user['id'], user['email'])
    return {
        "token": jwt_token,
        "user": user
    }

@api_router.post("/auth/google")
async def google_auth(data: Dict[str, str]):
    try:
        token = data.get('token')
        idinfo = id_token.verify_oauth2_token(
            token, 
            google_requests.Request(), 
            os.environ['GOOGLE_CLIENT_ID']
        )
        
        email = idinfo['email']
        name = idinfo.get('name', '')
        picture = idinfo.get('picture', '')
        
        # Check if email is whitelisted
        whitelisted = await db.whitelisted_emails.find_one({"email": email})
        if not whitelisted and email != FIRST_ADMIN_EMAIL:
            raise HTTPException(status_code=403, detail="Email not authorized. Please contact admin.")
        
        # Check if user exists
        user = await db.users.find_one({"email": email}, {"_id": 0})
        
        if not user:
            raise HTTPException(status_code=403, detail="Email not registered. Please register first.")
        
        # Generate JWT
        jwt_token = create_token(user['id'], email)
        
        return {
            "token": jwt_token,
            "user": user
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@api_router.post("/auth/register")
async def register(data: Dict[str, Any]):
    try:
        email = data.get('email')
        
        # Check if email is whitelisted or is first admin
        whitelisted = await db.whitelisted_emails.find_one({"email": email})
        if not whitelisted and email != FIRST_ADMIN_EMAIL:
            raise HTTPException(status_code=403, detail="Email not authorized. Please contact admin to get access.")
        
        # Check if user already exists
        existing = await db.users.find_one({"email": email})
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")
        
        # Determine role
        role = "admin" if email == FIRST_ADMIN_EMAIL else "member"
        
        user_data = {
            "id": str(uuid.uuid4()),
            "email": email,
            "name": data.get('name', ''),
            "picture": data.get('picture', ''),
            "role": role,
            "badges": [],
            "department": data.get('department', ''),
            "phone": data.get('phone', ''),
            "bio": data.get('bio', ''),
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
    return user

# User routes
@api_router.get("/users", response_model=List[User])
async def get_users(user: User = Depends(get_current_user)):
    users = await db.users.find({}, {"_id": 0}).to_list(1000)
    return users

@api_router.put("/users/{user_id}/badges")
async def update_badges(user_id: str, data: Dict[str, List[str]], admin: User = Depends(check_admin)):
    badges = data.get('badges', [])
    await db.users.update_one({"id": user_id}, {"$set": {"badges": badges}})
    return {"message": "Badges updated"}

@api_router.put("/users/{user_id}/role")
async def update_role(user_id: str, data: Dict[str, str], admin: User = Depends(check_admin)):
    role = data.get('role')
    await db.users.update_one({"id": user_id}, {"$set": {"role": role}})
    return {"message": "Role updated"}

# Thread routes
@api_router.get("/threads", response_model=List[Thread])
async def get_threads(user: User = Depends(get_current_user)):
    threads = await db.threads.find({}, {"_id": 0}).sort("last_activity", -1).to_list(100)
    for thread in threads:
        if isinstance(thread.get('last_activity'), str):
            thread['last_activity'] = datetime.fromisoformat(thread['last_activity'])
        if isinstance(thread.get('created_at'), str):
            thread['created_at'] = datetime.fromisoformat(thread['created_at'])
    return threads

@api_router.post("/threads")
async def create_thread(data: Dict[str, str], user: User = Depends(get_current_user)):
    thread = Thread(
        title=data['title'],
        content=data['content'],
        author_id=user.id,
        author_name=user.name
    )
    doc = thread.model_dump()
    doc['last_activity'] = doc['last_activity'].isoformat()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.threads.insert_one(doc)
    
    # Send mention notifications
    await send_mention_notifications(data['content'], user.name, f"/")
    
    doc.pop('_id', None)
    await sio.emit('new_thread', doc)
    return thread

@api_router.get("/threads/{thread_id}/replies", response_model=List[Reply])
async def get_replies(thread_id: str, user: User = Depends(get_current_user)):
    replies = await db.replies.find({"thread_id": thread_id}, {"_id": 0}).sort("created_at", 1).to_list(1000)
    for reply in replies:
        if isinstance(reply.get('created_at'), str):
            reply['created_at'] = datetime.fromisoformat(reply['created_at'])
    return replies

@api_router.post("/threads/{thread_id}/replies")
async def create_reply(thread_id: str, data: Dict[str, Any], user: User = Depends(get_current_user)):
    reply = Reply(
        thread_id=thread_id,
        content=data['content'],
        author_id=user.id,
        author_name=user.name,
        parent_reply_id=data.get('parent_reply_id')  # Support nested replies
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
    
    # Send mention notifications
    await send_mention_notifications(data['content'], user.name, f"/")
    
    doc.pop('_id', None)
    await sio.emit('new_reply', doc)
    return reply

# Direct message routes
@api_router.get("/messages")
async def get_messages(user: User = Depends(get_current_user)):
    messages = await db.direct_messages.find(
        {"$or": [{"sender_id": user.id}, {"receiver_email": user.email}]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    
    for msg in messages:
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
async def mark_messages_as_read(data: Dict[str, Any], user: User = Depends(get_current_user)):
    sender_id = data.get('sender_id')
    if sender_id:
        await db.direct_messages.update_many(
            {
                "sender_id": sender_id,
                "receiver_email": user.email,
                "read": False
            },
            {"$set": {"read": True}}
        )
    return {"message": "Messages marked as read"}

@api_router.post("/messages")
async def send_message(data: Dict[str, Any], user: User = Depends(get_current_user)):
    receiver = await db.users.find_one({"email": data['receiver_email']}, {"_id": 0})
    
    message = DirectMessage(
        sender_id=user.id,
        sender_name=user.name,
        receiver_email=data['receiver_email'],
        receiver_id=receiver['id'] if receiver else None,
        content=data['content'],
        reply_to_id=data.get('reply_to_id')
    )
    
    doc = message.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.direct_messages.insert_one(doc)
    
    if receiver:
        doc.pop('_id', None)
        await sio.emit('new_message', doc, room=receiver['id'])
    
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

@api_router.post("/assignments")
async def create_assignment(data: Dict[str, Any], admin: User = Depends(check_admin_or_core)):
    assignment = Assignment(
        title=data['title'],
        description=data['description'],
        deadline=datetime.fromisoformat(data['deadline']),
        created_by=admin.id
    )
    doc = assignment.model_dump()
    doc['deadline'] = doc['deadline'].isoformat()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.assignments.insert_one(doc)
    return assignment

@api_router.post("/assignments/{assignment_id}/submit")
async def submit_assignment(assignment_id: str, file: UploadFile = File(...), user: User = Depends(get_current_user)):
    # Upload to Cloudinary
    file_content = await file.read()
    upload_result = cloudinary.uploader.upload(
        file_content,
        resource_type="auto",
        folder="medvigyaan/assignments"
    )
    
    submission = Submission(
        assignment_id=assignment_id,
        user_id=user.id,
        user_name=user.name,
        file_url=upload_result['secure_url'],
        file_name=file.filename
    )
    
    doc = submission.model_dump()
    doc['submitted_at'] = doc['submitted_at'].isoformat()
    await db.submissions.insert_one(doc)
    return submission

@api_router.get("/assignments/{assignment_id}/submissions")
async def get_submissions(assignment_id: str, user: User = Depends(get_current_user)):
    submissions = await db.submissions.find({"assignment_id": assignment_id}, {"_id": 0}).to_list(1000)
    for sub in submissions:
        if isinstance(sub.get('submitted_at'), str):
            sub['submitted_at'] = datetime.fromisoformat(sub['submitted_at'])
    return submissions

# Whitelist management routes
@api_router.get("/admin/whitelist")
async def get_whitelisted_emails(admin: User = Depends(check_admin)):
    emails = await db.whitelisted_emails.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return emails

@api_router.post("/admin/whitelist")
async def add_whitelisted_email(data: Dict[str, str], admin: User = Depends(check_admin)):
    email = data.get('email')
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")
    
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
    await db.whitelisted_emails.delete_one({"email": email})
    return {"message": "Email removed from whitelist"}

# Blog routes
@api_router.get("/blogs", response_model=List[Blog])
async def get_blogs(user: User = Depends(get_current_user)):
    blogs = await db.blogs.find({"published": True}, {"_id": 0}).sort("created_at", -1).to_list(100)
    for blog in blogs:
        if isinstance(blog.get('created_at'), str):
            blog['created_at'] = datetime.fromisoformat(blog['created_at'])
        if isinstance(blog.get('updated_at'), str):
            blog['updated_at'] = datetime.fromisoformat(blog['updated_at'])
    return blogs

@api_router.post("/blogs")
async def create_blog(data: Dict[str, Any], user: User = Depends(get_current_user)):
    blog = Blog(
        title=data['title'],
        content=data['content'],
        author_id=user.id,
        author_name=user.name,
        tags=data.get('tags', [])
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
    for task in tasks:
        if isinstance(task.get('deadline'), str):
            task['deadline'] = datetime.fromisoformat(task['deadline'])
        if isinstance(task.get('created_at'), str):
            task['created_at'] = datetime.fromisoformat(task['created_at'])
    return tasks

@api_router.post("/tasks")
async def create_task(data: Dict[str, Any], user: User = Depends(check_admin_or_core)):
    task = Task(
        title=data['title'],
        description=data['description'],
        assignees=data.get('assignees', []),
        deadline=datetime.fromisoformat(data['deadline']),
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
    
    # Admins and team leads can edit everything
    if user.role in ["admin", "core"]:
        update_data = data
    else:
        # Regular users can only update their own status
        assignees = task['assignees']
        user_assignee = next((a for a in assignees if a['user_id'] == user.id), None)
        if not user_assignee:
            raise HTTPException(status_code=403, detail="Not authorized")
        
        # Update only status
        for a in assignees:
            if a['user_id'] == user.id:
                a['status'] = data.get('status', a['status'])
        update_data = {"assignees": assignees}
    
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
    # Upload template to Cloudinary
    file_content = await file.read()
    upload_result = cloudinary.uploader.upload(
        file_content,
        folder="medvigyaan/certificate_templates"
    )
    
    template = CertificateTemplate(
        name=name,
        template_url=upload_result['secure_url']
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
    allowed_fields = ['name', 'department', 'phone', 'bio', 'picture']
    for field in allowed_fields:
        if field in data:
            update_data[field] = data[field]
    
    if update_data:
        await db.users.update_one({"id": user.id}, {"$set": update_data})
    
    return {"message": "Profile updated"}

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
    return {"message": "Notification marked as read"}

@api_router.post("/notifications/mark-all-read")
async def mark_all_notifications_read(user: User = Depends(get_current_user)):
    await db.notifications.update_many(
        {"user_id": user.id, "read": False},
        {"$set": {"read": True}}
    )
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
    
    if message['sender_id'] != user.id and user.role != 'admin':
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Mark as deleted instead of removing
    await db.direct_messages.update_one(
        {"id": message_id},
        {"$set": {"deleted": True, "content": "This message was deleted"}}
    )
    return {"message": "Message deleted"}

@api_router.delete("/blogs/{blog_id}")
async def delete_blog(blog_id: str, admin: User = Depends(check_admin)):
    blog = await db.blogs.find_one({"id": blog_id}, {"_id": 0})
    if not blog:
        raise HTTPException(status_code=404, detail="Blog not found")
    
    await db.blogs.delete_one({"id": blog_id})
    return {"message": "Blog deleted"}

@api_router.delete("/assignments/{assignment_id}")
async def delete_assignment(assignment_id: str, admin: User = Depends(check_admin)):
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
    for blog in blogs:
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

@api_router.post("/calendar/native-events")
async def create_native_event(data: Dict[str, Any], user: User = Depends(check_admin_or_core)):
    event = NativeCalendarEvent(
        title=data['title'],
        description=data.get('description'),
        start_date=datetime.fromisoformat(data['start_date']),
        end_date=datetime.fromisoformat(data['end_date']),
        created_by=user.id
    )
    
    doc = event.model_dump()
    doc['start_date'] = doc['start_date'].isoformat()
    doc['end_date'] = doc['end_date'].isoformat()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.native_calendar_events.insert_one(doc)
    
    # Check if event is today and send notifications
    today = date.today()
    event_date = datetime.fromisoformat(data['start_date']).date()
    if event_date == today:
        users = await db.users.find({}, {"_id": 0}).to_list(1000)
        for u in users:
            await create_notification(
                u['id'],
                'calendar',
                f"Today: {data['title']}",
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
        upload_result = cloudinary.uploader.upload(
            file_content,
            folder="medvigyaan/announcements"
        )
        image_url = upload_result['secure_url']
    
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
async def get_group_messages(user: User = Depends(get_current_user)):
    messages = await db.group_messages.find({}, {"_id": 0}).sort("created_at", 1).to_list(500)
    for msg in messages:
        if isinstance(msg.get('created_at'), str):
            msg['created_at'] = datetime.fromisoformat(msg['created_at'])
    return messages

@api_router.post("/group-chat")
async def send_group_message(data: Dict[str, Any], user: User = Depends(get_current_user)):
    message = GroupMessage(
        sender_id=user.id,
        sender_name=user.name,
        content=data['content'],
        reply_to_id=data.get('reply_to_id')
    )
    
    doc = message.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.group_messages.insert_one(doc)
    
    # Emit socket event
    await sio.emit('new_group_message', {
        "id": message.id,
        "sender_id": user.id,
        "sender_name": user.name,
        "content": data['content'][:50]
    })
    
    return message

@api_router.delete("/group-chat/{message_id}")
async def delete_group_message(message_id: str, user: User = Depends(get_current_user)):
    # Check if message exists and user has permission
    msg = await db.group_messages.find_one({"id": message_id}, {"_id": 0})
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    
    # Only sender or admin can delete
    if msg['sender_id'] != user.id and user.role != 'admin':
        raise HTTPException(status_code=403, detail="Permission denied")
    
    await db.group_messages.update_one(
        {"id": message_id},
        {"$set": {"content": "This message was deleted", "deleted": True}}
    )
    
    return {"message": "Message deleted"}

# Link Config routes
@api_router.get("/link-config")
async def get_link_config(user: User = Depends(get_current_user)):
    config = await db.link_config.find_one({}, {"_id": 0})
    if not config:
        config = {"url": "", "label": "External Link"}
    return config

@api_router.put("/link-config")
async def update_link_config(data: Dict[str, Any], admin: User = Depends(check_admin)):
    await db.link_config.update_one(
        {},
        {"$set": {
            "url": data.get('url', ''),
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
    await db.role_permissions.update_one(
        {},
        {"$set": {
            **data,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    return {"message": "Role permissions updated"}

# Admin Integrations routes
@api_router.get("/admin/integrations")
async def get_integrations(admin: User = Depends(check_admin)):
    # Return current integration settings (masked for security)
    return {
        "GOOGLE_CLIENT_ID": os.environ.get('GOOGLE_CLIENT_ID', ''),
        "GOOGLE_CLIENT_SECRET": "••••••••" if os.environ.get('GOOGLE_CLIENT_SECRET') else '',
        "CLOUDINARY_CLOUD_NAME": os.environ.get('CLOUDINARY_CLOUD_NAME', ''),
        "CLOUDINARY_API_KEY": os.environ.get('CLOUDINARY_API_KEY', ''),
        "CLOUDINARY_API_SECRET": "••••••••" if os.environ.get('CLOUDINARY_API_SECRET') else '',
        "GMAIL_USER": os.environ.get('GMAIL_USER', ''),
        "GMAIL_APP_PASSWORD": "••••••••" if os.environ.get('GMAIL_APP_PASSWORD') else '',
        "GOOGLE_CALENDAR_API_KEY": os.environ.get('GOOGLE_CALENDAR_API_KEY', '')
    }

@api_router.put("/admin/integrations")
async def update_integrations(data: Dict[str, Any], admin: User = Depends(check_admin)):
    # Store integration settings in database for persistence
    # Note: For actual env changes, server restart would be needed
    await db.integration_settings.update_one(
        {},
        {"$set": {
            **data,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "updated_by": admin.id
        }},
        upsert=True
    )
    
    # Update .env file
    env_path = ROOT_DIR / '.env'
    env_content = env_path.read_text()
    
    env_updates = {
        'GOOGLE_CLIENT_ID': data.get('GOOGLE_CLIENT_ID'),
        'GOOGLE_CLIENT_SECRET': data.get('GOOGLE_CLIENT_SECRET'),
        'CLOUDINARY_CLOUD_NAME': data.get('CLOUDINARY_CLOUD_NAME'),
        'CLOUDINARY_API_KEY': data.get('CLOUDINARY_API_KEY'),
        'CLOUDINARY_API_SECRET': data.get('CLOUDINARY_API_SECRET'),
        'GMAIL_USER': data.get('GMAIL_USER'),
        'GMAIL_APP_PASSWORD': data.get('GMAIL_APP_PASSWORD'),
        'GOOGLE_CALENDAR_API_KEY': data.get('GOOGLE_CALENDAR_API_KEY')
    }
    
    for key, value in env_updates.items():
        if value and not value.startswith('••••'):  # Don't overwrite with masked values
            import re
            pattern = rf'^{key}=.*$'
            replacement = f'{key}="{value}"'
            if re.search(pattern, env_content, re.MULTILINE):
                env_content = re.sub(pattern, replacement, env_content, flags=re.MULTILINE)
            else:
                env_content += f'\n{replacement}'
    
    env_path.write_text(env_content)
    
    return {"message": "Integrations updated. Some changes may require server restart."}

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
import asyncio
from datetime import date

async def check_calendar_events():
    while True:
        try:
            # Check every hour
            await asyncio.sleep(3600)
            
            # Get today's events
            config = await db.calendar_config.find_one({}, {"_id": 0})
            if not config:
                continue
            
            today = date.today().isoformat()
            
            for cal in config.get('calendar_ids', []):
                if not cal.get('enabled', True):
                    continue
                
                try:
                    service = build('calendar', 'v3', developerKey=None)
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
                    print(f"Error checking calendar {cal['id']}: {e}")
                    continue
                    
        except Exception as e:
            print(f"Calendar check error: {e}")

# Include router
app.include_router(api_router)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://themedvigyaan.vercel.app",
        "http://localhost:3000"
    ],
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

@app.on_event("startup")
async def startup_event():
    # Start calendar event checker
    asyncio.create_task(check_calendar_events())

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()