# Deployment Guide: Live Chat App

Deploy your Private Chat app to the internet so users from different states/locations can chat in real-time.

**Estimated time:** 20-30 minutes  
**Cost:** Free tier (MongoDB Atlas, Vercel, Render all have free tiers)

---

## Step 1: Set Up MongoDB Atlas (Database)

MongoDB Atlas hosts your database in the cloud so messages persist and multiple users can access them.

### 1.1 Create MongoDB Atlas Account
1. Go to https://www.mongodb.com/cloud/atlas
2. Click **Sign Up** and create a free account
3. Verify your email

### 1.2 Create a Free Cluster
1. On the MongoDB Atlas dashboard, click **Create** (or **Build a Cluster**)
2. Choose **Shared** (free tier)
3. Select region closest to you (e.g., `us-east-1` or `us-west-1`)
4. Click **Create Cluster** (takes 2-3 minutes)

### 1.3 Create Database User
1. In the left menu, go to **Security** → **Database Access**
2. Click **Add New Database User**
   - Username: `chatapp` (or any name)
   - Password: Generate a strong password (copy it — you'll need it)
   - User Privileges: `Read and write to any database`
3. Click **Add User**

### 1.4 Allow Network Access
1. Go to **Security** → **Network Access**
2. Click **Add IP Address**
3. Select **Allow access from anywhere** (for development; lock down in production)
4. Click **Confirm**

### 1.5 Get Connection String
1. Go back to **Clusters** (main dashboard)
2. Click **Connect** on your cluster
3. Choose **Drivers** → **Node.js** → **version 5.9+**
4. Copy the connection string that looks like:
   ```
   mongodb+srv://chatapp:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
5. Replace `PASSWORD` with your database user password from step 1.3
6. Add `/chat` at the end before `?`:
   ```
   mongodb+srv://chatapp:PASSWORD@cluster0.xxxxx.mongodb.net/chat?retryWrites=true&w=majority
   ```
7. **Save this** — you'll need it in step 3

---

## Step 2: Push Code to GitHub

Render and Vercel both connect to GitHub repositories to deploy.

### 2.1 Create GitHub Repository
1. Go to https://github.com/new
2. Repository name: `private-chat-app` (or any name)
3. Description: `Secure private chat for small groups`
4. Choose **Public** or **Private**
5. Click **Create repository**

### 2.2 Push Your Code
On your machine, run these commands:

```powershell
# Navigate to your project root
cd 'C:\Users\pintu\Desktop\chat'

# Initialize git (if not already done)
git init
git config user.name "Your Name"
git config user.email "your.email@example.com"

# Add all files
git add .

# Commit
git commit -m "Initial commit: private chat app"

# Add GitHub remote (replace YOUR_USERNAME and REPO_NAME)
git remote add origin https://github.com/YOUR_USERNAME/private-chat-app.git

# Push to GitHub
git branch -M main
git push -u origin main
```

**Note:** GitHub may ask for credentials. Use a Personal Access Token:
1. Go to https://github.com/settings/tokens
2. Click **Generate new token** → **Generate new token (classic)**
3. Give it **repo** permissions
4. Copy the token and use it as your password when git asks

---

## Step 3: Deploy Backend to Render

### 3.1 Create Render Account
1. Go to https://render.com
2. Click **Sign Up** and create account (can use GitHub to sign up)
3. Verify email

### 3.2 Create New Web Service
1. On Render dashboard, click **New +** → **Web Service**
2. Click **Connect a repository** → select your GitHub repo
3. Fill in:
   - **Name:** `private-chat-backend`
   - **Environment:** `Node`
   - **Build Command:** `cd backend && npm install`
   - **Start Command:** `cd backend && npm start`
   - **Plan:** `Free` (if available; otherwise `Pro` trial)
4. Click **Advanced** and add environment variables:

### 3.3 Add Environment Variables
Click **Add Environment Variable** for each (copy/paste these):

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `PORT` | `10000` (Render's default; keep as-is) |
| `MONGODB_URI` | Paste the MongoDB connection string from Step 1.5 |
| `SESSION_SECRET` | Generate a random string (run command below) |
| `CHAT_PASSWORD_HASH` | Use the hash from your `.env` file (paste from `backend/.env` CHAT_PASSWORD_HASH) |
| `CORS_ORIGIN` | `https://private-chat-app.vercel.app` (you'll get Vercel URL in step 4; update after) |

**Generate SESSION_SECRET:**
Open PowerShell and run:
```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Copy the output and paste into Render's SESSION_SECRET field.

4. Click **Create Web Service**

**Wait 2-3 minutes.** You'll see a URL like `https://private-chat-backend-abc123.onrender.com` — **save this URL**.

### 3.4 Configure Backend Root Path
In Render dashboard for your backend service:
1. Go to **Settings** → **Build & Deploy**
2. Under **Root Directory**, enter: `backend`
3. Click **Save**

---

## Step 4: Deploy Frontend to Vercel

### 4.1 Create Vercel Account
1. Go to https://vercel.com
2. Click **Sign Up** and use GitHub to sign up (easier)

### 4.2 Import Project
1. On Vercel dashboard, click **Add New** → **Project**
2. Click **Import Git Repository** → select your GitHub repo
3. Fill in:
   - **Project Name:** `private-chat-app`
   - **Framework Preset:** `Vite`
   - **Root Directory:** `frontend`
4. Under **Environment Variables**, add:
   - Key: `VITE_BACKEND_URL`
   - Value: `https://private-chat-backend-abc123.onrender.com` (the Render URL from step 3.4)
5. Click **Deploy**

**Wait 1-2 minutes.** You'll get a URL like `https://private-chat-app.vercel.app`

### 4.3 Update Backend CORS_ORIGIN
Go back to Render backend service:
1. Go to **Environment** variables
2. Update `CORS_ORIGIN` to: `https://private-chat-app.vercel.app` (Vercel URL)
3. Click **Save Changes** (this triggers a redeploy)

---

## Step 5: Test Your Live App

1. Open your Vercel frontend URL: `https://private-chat-app.vercel.app`
2. Log in with password: `madamji`
3. Send a message — it should appear instantly
4. Try uploading an image or file — should work
5. **Open the same URL in an incognito window** (or on a phone) and log in as another user
6. Send messages between the two windows — you should see real-time updates

**Share with a friend in a different state:**
- Send them your Vercel frontend URL
- They log in with password: `madamji`
- You both can chat and share files in real-time!

---

## Troubleshooting

### Backend shows "Build failed" on Render
- Check the deploy logs (Render dashboard → Logs)
- Ensure `ROOT_DIRECTORY` is set to `backend`
- Make sure MongoDB connection string is correct (no typos)

### Frontend shows blank or "Cannot connect to backend"
- Check browser DevTools Console (F12) for errors
- Verify `VITE_BACKEND_URL` is set to your Render backend URL
- In `vite.config.js`, ensure the proxy/backend path is correct

### Uploads not working on live site
- Ensure file uploads are stored somewhere persistent (current code stores locally on server — works with Render)
- For production with scaled deployments, use S3/GCS (not covered here)

### Messages not persisting
- Check MongoDB connection string in Render env vars
- Verify database user password is correct
- Go to MongoDB Atlas and confirm cluster is running

### "Unauthorized" on login
- Password must match the `CHAT_PASSWORD_HASH` bcrypt hash
- If you changed the password locally, regenerate the hash:
  ```powershell
  node -e "(async()=>{const b=await import('bcrypt'); console.log(await b.hash('yourNewPassword',12))})().catch(console.error)"
  ```
  Then update `CHAT_PASSWORD_HASH` in Render env vars

---

## Next Steps

After deployment works:
1. **Add more users:** Share the frontend URL with friends; they can log in with the same password
2. **Change the password:** Regenerate bcrypt hash and update `CHAT_PASSWORD_HASH` env var if desired
3. **Add more features:** Typing indicators, file previews, user profiles (code is set up for these)
4. **Scale to production:** Use MongoDB free tier, custom domains, HTTPS auto-renewal (Vercel/Render handle this)

---

## Your Links After Deployment

- **Frontend (share this with friends!):** https://private-chat-app.vercel.app
- **Backend API:** https://private-chat-backend-abc123.onrender.com
- **Database Dashboard:** https://cloud.mongodb.com/v2

Enjoy your secure private chat! 🎉
