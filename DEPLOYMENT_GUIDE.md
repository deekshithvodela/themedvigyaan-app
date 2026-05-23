# MedVigyaan - Free Deployment Guide

## Quick Overview
Deploy MedVigyaan for free using:
- **Frontend**: Vercel or Netlify (free tier)
- **Backend**: Render or Railway (free tier)
- **Database**: MongoDB Atlas (free tier - 512MB)

---

## Step 1: MongoDB Atlas (Free Database)

1. Go to [mongodb.com/atlas](https://www.mongodb.com/atlas) and create free account
2. Create a new cluster (M0 Free Tier)
3. Set up database user (username/password)
4. Whitelist IP: `0.0.0.0/0` (allow all - needed for serverless)
5. Get connection string: `mongodb+srv://<user>:<password>@cluster.xxxxx.mongodb.net/medvigyaan_db`

---

## Step 2: Backend Deployment (Render - Free)

### Option A: Render.com

1. Go to [render.com](https://render.com) and sign up (free)
2. Connect your GitHub repo
3. Create **New Web Service**:
   - **Root Directory**: `backend`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn server:app --host 0.0.0.0 --port $PORT`
   - **Instance Type**: Free

4. Add Environment Variables:
   ```
   MONGO_URL=mongodb+srv://<user>:<password>@cluster.xxxxx.mongodb.net/medvigyaan_db
   DB_NAME=medvigyaan_db
   CORS_ORIGINS=https://your-frontend-url.vercel.app
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   GOOGLE_REDIRECT_URI=https://your-backend.onrender.com/auth/callback
   CLOUDINARY_CLOUD_NAME=your_cloudinary_name
   CLOUDINARY_API_KEY=your_cloudinary_key
   CLOUDINARY_API_SECRET=your_cloudinary_secret
   GMAIL_USER=your_gmail@gmail.com
   GMAIL_APP_PASSWORD=your_app_password
   JWT_SECRET=your_secure_random_string
   JWT_ALGORITHM=HS256
   FIRST_ADMIN_EMAIL=your_admin@gmail.com
   ```

5. Deploy and note your backend URL (e.g., `https://medvigyaan-api.onrender.com`)

### Option B: Railway.app

1. Go to [railway.app](https://railway.app) and sign up
2. Create new project from GitHub
3. Add same environment variables as above
4. Railway auto-detects Python and deploys

---

## Step 3: Frontend Deployment (Vercel - Free)

1. Go to [vercel.com](https://vercel.com) and sign up (free with GitHub)
2. Import your GitHub repository
3. Configure:
   - **Framework Preset**: Create React App
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build` or `yarn build`
   - **Output Directory**: `build`

4. Add Environment Variable:
   ```
   REACT_APP_BACKEND_URL=https://your-backend.onrender.com
   ```

5. Deploy!

---

## Step 4: Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create new project
3. Enable **Google+ API** and **Google Identity**
4. Go to **Credentials** → Create **OAuth 2.0 Client ID**
5. Add authorized origins:
   - `https://your-frontend.vercel.app`
   - `http://localhost:3000` (for local dev)
6. Add authorized redirect URIs:
   - `https://your-backend.onrender.com/auth/callback`
7. Copy Client ID and Client Secret to backend env vars

---

## Step 5: Cloudinary Setup (Free - 25GB)

1. Go to [cloudinary.com](https://cloudinary.com) and sign up free
2. From Dashboard, copy:
   - Cloud Name
   - API Key
   - API Secret
3. Add to backend environment variables

---

## Free Tier Limits

| Service | Free Limit |
|---------|------------|
| MongoDB Atlas | 512MB storage |
| Render | 750 hours/month, sleeps after 15min inactivity |
| Vercel | 100GB bandwidth/month |
| Cloudinary | 25GB storage, 25GB bandwidth |

---

## Alternative Free Options

### Backend Alternatives:
- **Fly.io** - 3 shared VMs free
- **Cyclic.sh** - Serverless, always free
- **Deta.sh** - Unlimited apps

### Database Alternatives:
- **Supabase** - PostgreSQL, 500MB free
- **PlanetScale** - MySQL, 5GB free

### Frontend Alternatives:
- **Netlify** - 100GB bandwidth
- **Cloudflare Pages** - Unlimited bandwidth
- **GitHub Pages** - Free (static only)

---

## Local Development

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn server:app --reload --port 8001

# Frontend
cd frontend
npm install
npm start
```

---

## Troubleshooting

1. **Backend sleeps on Render free tier**: First request after 15min takes ~30s to wake up. Consider upgrading to paid ($7/mo) for always-on.

2. **CORS errors**: Ensure `CORS_ORIGINS` in backend matches your frontend URL exactly.

3. **Google OAuth not working**: Verify redirect URI matches exactly in both Google Console and backend env.

4. **MongoDB connection fails**: Check IP whitelist includes `0.0.0.0/0` for serverless platforms.

---

## Upgrading for Production

For production with better performance:
- **Render Starter**: $7/mo (always on)
- **MongoDB M2**: $9/mo (2GB)
- **Vercel Pro**: $20/mo (more bandwidth)

Total: ~$36/mo for production-ready deployment
