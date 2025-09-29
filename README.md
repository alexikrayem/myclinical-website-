# Arabic Dental Research Platform

A comprehensive platform for Arabic dental research articles and papers, built with React, Node.js, and Supabase.

## 🏗️ Project Structure

This project consists of three separate applications:

### 1. Frontend (Public Website)
- **Location**: Root directory
- **Technology**: React + TypeScript + Vite
- **Purpose**: Public-facing website for browsing articles and research

### 2. Backend (API Server)
- **Location**: `/backend` directory
- **Technology**: Node.js + Express
- **Purpose**: REST API server with authentication and file handling

### 3. Admin Panel
- **Location**: `/admin` directory
- **Technology**: React + TypeScript + Vite
- **Purpose**: Administrative interface for content management

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Supabase account

### 1. Database Setup (Supabase)

1. Create a new Supabase project
2. Run the migrations in order:
   ```sql
   -- Run these in your Supabase SQL editor
   -- 1. supabase/migrations/20250604122911_gentle_desert.sql
   -- 2. supabase/migrations/20250604122926_ivory_darkness.sql
   -- 3. supabase/migrations/20250604123000_add_search_functions.sql
   -- 4. supabase/migrations/20250604123001_fix_admin_setup.sql
   ```

### 2. Backend Setup

```bash
cd backend
npm install
cp .env.example .env
```

Edit `.env` with your Supabase credentials:
```env
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
PORT=5000
NODE_ENV=development
JWT_SECRET=your_jwt_secret_here
MAX_FILE_SIZE=5242880
```

**Generate JWT Secret:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Start the backend:
```bash
npm run dev
```

### 3. Frontend Setup

```bash
# In root directory
npm install
cp .env.example .env
```

Edit `.env`:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_API_URL=http://localhost:5000
```

Start the frontend:
```bash
npm run dev
```

### 4. Admin Panel Setup

```bash
cd admin
npm install
cp .env.example .env
```

Edit `.env`:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_API_URL=http://localhost:5000
```

Start the admin panel:
```bash
npm run dev
```

## 🔐 Admin Access

**Default Admin Credentials:**
- Email: `admin@arabdental.com`
- Password: `Admin123!`

## 🔍 Search Features

The platform includes advanced search capabilities:

### Full Text Search (FTS)
- Arabic language support
- Weighted search results (title > excerpt > content > author)
- Automatic search vector updates

### Trigram Search
- Similarity-based matching
- Handles typos and partial matches
- Optimized with GIN indexes

### Search Endpoints
- `/api/articles/search/advanced?q=search_term`
- `/api/research/search/advanced?q=search_term`

## 📁 Deployment

### Backend Deployment (Railway/Heroku)
1. Set environment variables
2. Deploy the `/backend` folder
3. Start command: `npm start`

### Frontend Deployment (Netlify/Vercel)
1. Set `VITE_API_URL` to your deployed backend URL
2. Build command: `npm run build`
3. Publish directory: `dist`

### Admin Panel Deployment
1. Set `VITE_API_URL` to your deployed backend URL
2. Deploy to a separate domain/subdomain
3. Build command: `npm run build`
4. Publish directory: `dist`

## 🛠️ API Endpoints

### Articles
- `GET /api/articles` - Get all articles (with search/filter)
- `GET /api/articles/featured` - Get featured articles
- `GET /api/articles/:id` - Get single article
- `GET /api/articles/:id/related` - Get related articles

### Research
- `GET /api/research` - Get all research papers
- `GET /api/research/:id` - Get single research paper
- `GET /api/research/journals/list` - Get available journals

### Admin (Protected)
- `POST /api/admin/login` - Admin login
- `GET /api/admin/profile` - Get admin profile
- `POST /api/admin/articles` - Create article
- `PUT /api/admin/articles/:id` - Update article
- `DELETE /api/admin/articles/:id` - Delete article

## 🔧 Environment Variables

### Frontend
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_API_URL=your_backend_url
```

### Backend
```env
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
PORT=5000
NODE_ENV=development
JWT_SECRET=your_jwt_secret
MAX_FILE_SIZE=5242880
```

### Admin Panel
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_API_URL=your_backend_url
```

## 🐛 Troubleshooting

### Admin Login Issues
1. Verify Supabase credentials in backend `.env`
2. Check if admin user exists in database
3. Ensure JWT_SECRET is set
4. Check browser console for detailed errors

### Search Not Working
1. Verify database migrations are applied
2. Check if search extensions are enabled
3. Ensure search vectors are populated

### CORS Issues
1. Update CORS origins in `backend/server.js`
2. Ensure frontend URL is whitelisted

## 📝 License

This project is licensed under the MIT License.