# Video Courses Section with Credit System - Implementation Plan

## Overview

This document outlines the implementation plan for adding a video courses section to the Arabic Dental Research Platform. The section will follow the same design pattern as the existing articles section and include a credit system that allows users to purchase credits to access video content.

## Goals

- Create a video courses section with the same UI/UX design as the articles section
- Implement a credit system allowing users to purchase and consume credits for accessing video content 
- Ensure the video courses section integrates seamlessly with the existing platform
- Maintain consistency with the current design language and Arabic interface

## Features

### Video Courses Section
- Video course listing page with grid layout
- Video course detail page with description and video player
- Featured video courses section
- Search and filtering capabilities
- Category/tag system for organization
- Related video courses suggestions

### Credit System Architecture

#### Core Components
- **Credit Balance Management**: Track user credit balances in real-time
- **Credit Purchase System**: Enable users to buy credit packages via payment gateway
- **Access Control**: Verify sufficient credits before granting course access
- **Transaction Logging**: Record all credit transactions for audit and analytics
- **Credit Deduction Logic**: Automatically deduct credits when accessing protected content

#### Credit Packages
- Basic Package: 10 credits for X amount
- Standard Package: 25 credits for Y amount  
- Premium Package: 50 credits for Z amount
- Custom packages configurable by admin

#### Transaction Flow
1. User selects a video course requiring credits
2. System checks user's credit balance
3. If sufficient credits exist, access is granted and credits deducted
4. If insufficient credits, user is redirected to credit purchase page
5. All transactions are logged for audit purposes

#### Security Measures
- Implement transaction validation to prevent credit manipulation
- Use idempotency keys for payment processing
- Implement rate limiting on credit-related endpoints
- Secure payment gateway integration (Stripe, PayPal, etc.)
- Store encrypted payment information

#### Admin Controls
- Monitor user credit balances
- Adjust user credit balances (admin override)
- View transaction history
- Configure credit package prices
- Track credit usage analytics

## Architecture

### Frontend Components

### Video Courses Components

#### VideoCourseCard.tsx
Similar to `ArticleCard.tsx`, this component will display video course information in a card format:
- Course title and description
- Cover image with hover effects
- Author information
- Credit requirement indicator
- Duration information
- Tags/categories
- Access button (purchase access or view if already purchased)
- Consistent styling with existing article cards

#### VideoCourseList.tsx
Similar to `ArticleList.tsx`, this component will handle:
- Display of multiple video course cards in a responsive grid
- Search and filtering functionality
- Category/tag filtering
- Pagination
- Loading states and skeleton screens
- Empty states
- Consistent Arabic RTL styling

#### VideoCourseDetailPage.tsx
Similar to `ArticleDetailPage.tsx`, this page will include:
- Video player component
- Course title and description
- Author information
- Course metadata (duration, categories)
- Related video courses
- Access control (show video player if user has access, otherwise show purchase option)
- Credit purchase option if user lacks sufficient credits

#### VideoCoursesPage.tsx
The main landing page for video courses, similar to `ArticlesPage.tsx`:
- Page header with title and description
- Integration with VideoCourseList component
- Featured courses section
- Search and filtering UI
- Consistent layout and styling

### Credit System Components

#### CreditDisplay.tsx
A reusable component to show user's current credit balance:
- Shows numeric balance
- Visual indicator of credit amount
- Option to purchase more credits
- Real-time updates when credits change

#### CreditPurchaseModal.tsx
A modal component for purchasing credits:
- Different credit packages to choose from
- Payment form integration
- Package selection with pricing
- Secure payment processing
- Success/error feedback

#### PurchaseAccessButton.tsx
A component that handles the purchase flow:
- Checks user's credit balance
- Shows appropriate action (view, purchase, insufficient credits)
- Triggers purchase flow when needed
- Updates credit balance after purchase

### Implementation Details

#### New Files Structure
```
client/src/components/video/
├── VideoCourseCard.tsx
├── VideoCourseList.tsx
├── CreditDisplay.tsx
├── CreditPurchaseModal.tsx
├── PurchaseAccessButton.tsx
└── VideoPlayer.tsx

client/src/pages/
├── VideoCoursesPage.tsx
└── VideoCourseDetailPage.tsx

client/src/lib/
├── videoApi.ts
└── creditApi.ts
```

#### Video API Client (`client/src/lib/videoApi.ts`)

```typescript
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

const videoApi = axios.create({
  baseURL: `${API_BASE_URL}/api/video-courses`,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const videoCoursesApi = {
  // Get all video courses with optional filters
  getAll: async (params?: { category?: string; search?: string; limit?: number; page?: number; featured?: boolean }) => {
    try {
      const response = await videoApi.get('/', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching video courses:', error);
      throw error;
    }
  },

  // Get featured video courses
  getFeatured: async () => {
    try {
      const response = await videoApi.get('/featured');
      return response.data;
    } catch (error) {
      console.error('Error fetching featured video courses:', error);
      throw error;
    }
  },

  // Get single video course by ID
  getById: async (id: string) => {
    try {
      const response = await videoApi.get(`/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching video course:', error);
      throw error;
    }
  },

  // Get related video courses
  getRelated: async (id: string, limit = 3) => {
    try {
      const response = await videoApi.get(`/${id}/related`, { params: { limit } });
      return response.data;
    } catch (error) {
      console.error('Error fetching related video courses:', error);
      return [];
    }
  },

  // Request access to a video course
  requestAccess: async (id: string) => {
    try {
      const response = await videoApi.post(`/${id}/access`);
      return response.data;
    } catch (error) {
      console.error('Error requesting video course access:', error);
      throw error;
    }
  },

  // Get user's video courses
  getUserCourses: async () => {
    try {
      const response = await videoApi.get('/user-courses');
      return response.data;
    } catch (error) {
      console.error('Error fetching user video courses:', error);
      throw error;
    }
  },
};
```

#### Credit API Client (`client/src/lib/creditApi.ts`)

```typescript
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

const creditApi = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const creditsApi = {
  // Get user's credit balance
  getBalance: async () => {
    try {
      const response = await creditApi.get('/users/credits');
      return response.data;
    } catch (error) {
      console.error('Error fetching credit balance:', error);
      throw error;
    }
  },

  // Get user's credit transaction history
  getTransactions: async (params?: { limit?: number; page?: number; type?: string }) => {
    try {
      const response = await creditApi.get('/users/credit-transactions', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching credit transactions:', error);
      throw error;
    }
  },

  // Purchase credits
  purchase: async (packageId: string, paymentMethod: string) => {
    try {
      const response = await creditApi.post('/credits/purchase', {
        packageId,
        paymentMethod,
      });
      return response.data;
    } catch (error) {
      console.error('Error purchasing credits:', error);
      throw error;
    }
  },

  // Validate access to a specific course
  validateAccess: async (courseId: string) => {
    try {
      const response = await creditApi.post('/credits/validate-access', {
        courseId,
      });
      return response.data;
    } catch (error) {
      console.error('Error validating course access:', error);
      throw error;
    }
  },
};
```

#### Video Course Card Component Example (`VideoCourseCard.tsx`)

```tsx
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Clock, Tag, User, ArrowLeft, Play, Coins } from 'lucide-react';
import { formatDistance } from 'date-fns';
import { ar } from 'date-fns/locale';

interface VideoCourseCardProps {
  course: {
    id: string;
    title: string;
    description: string;
    cover_image: string;
    publication_date: string;
    author: string;
    categories: string[];
    credits_required: number;
    duration: number; // in seconds
    is_featured?: boolean;
    has_access?: boolean; // Whether user already has access
  };
  featured?: boolean;
}

const VideoCourseCard: React.FC<VideoCourseCardProps> = ({ course, featured = false }) => {
  const navigate = useNavigate();

  const formattedDate = formatDistance(
    new Date(course.publication_date),
    new Date(),
    { addSuffix: true, locale: ar }
  );

  // Convert duration from seconds to human-readable format
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours} س${minutes > 0 ? ` و ${minutes} د` : ''}`;
    }
    return `${minutes} د`;
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // Prevent navigation if clicking on a link or button
    if ((e.target as HTMLElement).closest('a, button')) {
      return;
    }

    // Navigate to course and scroll to top
    navigate(`/video-courses/${course.id}`);
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 100);
  };

  if (featured) {
    return (
      <div
        className="relative overflow-hidden rounded-3xl card-shadow-lg group cursor-pointer transition-modern hover:scale-[1.02]"
        onClick={handleCardClick}
      >
        <div className="relative h-[500px]">
          <img
            src={course.cover_image}
            alt={course.title}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent"></div>
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 to-purple-600/20"></div>

          <div className="absolute top-6 right-6">
            <div className="bg-blue-500/90 text-white text-sm px-3 py-1.5 rounded-full flex items-center">
              <Play size={14} className="ml-1" />
              فيديو
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 p-8 text-white">
            <h2 className="text-2xl lg:text-3xl font-bold mb-3 line-clamp-2 leading-tight">{course.title}</h2>
            <p className="mb-4 text-blue-100 line-clamp-2 text-lg leading-relaxed">{course.description}</p>

            <div className="flex items-center justify-between">
              <div className="flex items-center text-sm text-blue-200 space-x-4 space-x-reverse">
                <div className="flex items-center">
                  <User size={16} className="ml-1" />
                  <span className="font-medium">{course.author}</span>
                </div>
                <div className="flex items-center">
                  <Clock size={16} className="ml-1" />
                  <span>{formatDuration(course.duration)}</span>
                </div>
                <div className="flex items-center">
                  <Coins size={16} className="ml-1" />
                  <span>{course.credits_required} رصيد</span>
                </div>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/video-courses/${course.id}`);
                  setTimeout(() => {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }, 100);
                }}
                className="btn-primary inline-flex items-center bg-white/20 hover:bg-white/30 backdrop-blur-sm border border-white/30"
              >
                عرض التفاصيل
                <ArrowLeft size={18} className="mr-2" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="bg-white rounded-2xl overflow-hidden card-shadow group cursor-pointer transition-modern hover:scale-[1.02] animate-scaleIn"
      onClick={handleCardClick}
    >
      <div className="relative overflow-hidden">
        <img
          src={course.cover_image}
          alt={course.title}
          className="w-full h-56 object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

        <div className="absolute top-4 right-4">
          <div className="bg-blue-500/90 text-white text-xs px-2.5 py-1 rounded-full flex items-center">
            <Play size={12} className="ml-1" />
            فيديو
          </div>
        </div>
        
        <div className="absolute bottom-4 left-4 bg-black/70 text-white text-xs px-2.5 py-1 rounded-full flex items-center">
          <Clock size={12} className="ml-1" />
          {formatDuration(course.duration)}
        </div>
      </div>

      <div className="p-6">
        <div className="flex flex-wrap gap-2 mb-4">
          {course.categories.slice(0, 2).map((category, index) => (
            <Link
              key={index}
              to={`/video-courses?category=${encodeURIComponent(category)}`}
              className="tag-modern inline-flex items-center"
              onClick={(e) => e.stopPropagation()}
            >
              <Tag size={12} className="ml-1" />
              {category}
            </Link>
          ))}
          {course.categories.length > 2 && (
            <span className="text-xs text-gray-400 px-2 py-1">
              +{course.categories.length - 2} أخرى
            </span>
          )}
        </div>

        <div className="flex justify-between items-start mb-2">
          <h3 className="text-xl font-bold text-gray-900 mb-3 line-clamp-2 leading-tight group-hover:text-blue-600 transition-colors flex-grow">
            {course.title}
          </h3>
          <div className="flex items-center bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded mr-2">
            <Coins size={12} className="ml-1" />
            {course.credits_required}
          </div>
        </div>

        <p className="text-gray-600 mb-4 line-clamp-2 leading-relaxed">{course.description}</p>

        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          <div className="flex items-center text-sm text-gray-500">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center ml-3">
              <User size={14} className="text-white" />
            </div>
            <div>
              <div className="font-medium text-gray-700">{course.author}</div>
              <div className="text-xs text-gray-500">{formattedDate}</div>
            </div>
          </div>

          <div className="text-blue-600 group-hover:text-blue-700 transition-colors">
            <ArrowLeft size={20} className="transform group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoCourseCard;
```

### Styling and Design Consistency

#### CSS Classes to Maintain Consistency
- Use the same card-shadow, button, and form classes as the articles section
- Maintain the same responsive grid layout (grid-modern class)
- Use the same animation classes (animate-scaleIn, etc.)
- Keep the same Arabic typography and layout (RTL)
- Maintain color scheme and visual hierarchy
- Use the same form and input styling (input-modern, form-modern, etc.)

#### Navigation Integration
- Add "الدورات" (Video Courses) link to the main navigation
- Update mobile menu with the new section
- Ensure consistent breadcrumb navigation
- Update footer links if applicable
- `VideoCourseCard.tsx` - Similar to `ArticleCard.tsx` but for video courses
- `VideoCourseList.tsx` - Similar to `ArticleList.tsx` with course filtering
- `VideoCourseDetailPage.tsx` - Detail page with video player and description
- `CreditSystem.tsx` - Component for displaying and purchasing credits
- `VideoCoursesPage.tsx` - Main listing page
- `MyCoursesPage.tsx` - Page to show user's purchased/accessed courses

### Backend API Routes
- `GET /api/video-courses` - Get all video courses with filtering
- `GET /api/video-courses/:id` - Get single video course by ID
- `GET /api/video-courses/featured` - Get featured video courses
- `GET /api/video-courses/:id/related` - Get related video courses
- `POST /api/video-courses/purchase` - Endpoint to purchase video course access
- `POST /api/credits/purchase` - Endpoint to purchase credits
- `GET /api/users/credits` - Get user's credit balance
- Admin routes for managing video courses

### Database Schema
- `video_courses` table (similar structure to `articles`)
- `user_credits` table for tracking user credit balances
- `credit_transactions` table for purchase records
- `course_access` table for tracking user access to courses

## Technical Implementation Plan

### Phase 1: Database Schema
1. Create `video_courses` table with similar fields to `articles` table
2. Create `user_credits` table to track user credit balances
3. Create `credit_transactions` table to record credit purchases and usage
4. Create `course_access` table to track which users have access to which courses

### Phase 2: Backend API Development
1. Create API routes for video courses (CRUD operations)
2. Implement credit system endpoints
3. Add authentication and authorization for credit operations
4. Integrate with existing Supabase database

### Phase 3: Admin Panel Integration
1. Add video course management to admin panel
2. Create form for adding new video courses
3. Add credit management features for administrators

### Phase 4: Frontend Development
1. Create React components for video courses section
2. Implement video course listing page with search and filtering
3. Create video course detail page with video player
4. Integrate credit purchase functionality
5. Ensure responsive design and Arabic interface consistency

### Phase 5: Testing and Integration
1. Unit testing for new components
2. Integration testing for credit system
3. User acceptance testing
4. Performance optimization
5. Security testing for credit transactions

## Database Schema Details

### Video Courses Table (video_courses)
```sql
CREATE TABLE video_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  cover_image text NOT NULL,
  video_url text NOT NULL,
  author text NOT NULL,
  categories text[] NOT NULL, -- e.g., ['طب أسنان الأطفال', 'تقويم الأسنان']
  credits_required integer NOT NULL DEFAULT 1, -- Number of credits required to access
  is_featured boolean DEFAULT false,
  duration integer, -- Duration in seconds
  publication_date timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  search_vector tsvector -- For full-text search capability
);

-- Add full-text search functionality similar to articles
ALTER TABLE video_courses ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE OR REPLACE FUNCTION update_video_courses_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('arabic', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('arabic', COALESCE(NEW.description, '')), 'B') ||
    setweight(to_tsvector('arabic', COALESCE(NEW.author, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER video_courses_search_vector_trigger
  BEFORE INSERT OR UPDATE ON video_courses
  FOR EACH ROW EXECUTE FUNCTION update_video_courses_search_vector();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS video_courses_search_vector_idx ON video_courses USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS video_courses_categories_idx ON video_courses USING GIN(categories);
CREATE INDEX IF NOT EXISTS video_courses_featured_idx ON video_courses(is_featured);
```

### User Credits Table (user_credits)
```sql
CREATE TABLE user_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  balance integer NOT NULL DEFAULT 0, -- Current credit balance
  total_earned integer NOT NULL DEFAULT 0, -- Total credits ever earned
  total_spent integer NOT NULL DEFAULT 0, -- Total credits ever spent
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS user_credits_user_id_idx ON user_credits(user_id);

-- Add row-level security
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;

-- Policies: Users can only access their own credit data
CREATE POLICY "Users can view own credit data" ON user_credits
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own credit data" ON user_credits
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all credit data" ON user_credits
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins WHERE admins.id = auth.uid()
    )
  );
```

### Credit Transactions Table (credit_transactions)
```sql
CREATE TABLE credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  transaction_type text NOT NULL, -- 'purchase', 'usage', 'refund', 'bonus'
  amount integer NOT NULL, -- Positive for credits added, negative for credits used
  description text, -- Description of the transaction
  balance_before integer NOT NULL, -- Balance before transaction
  balance_after integer NOT NULL, -- Balance after transaction
  related_entity_type text, -- Type of entity related to transaction ('course_access', 'package_purchase', etc.)
  related_entity_id uuid, -- ID of the related entity
  transaction_date timestamptz DEFAULT now(),
  payment_reference text, -- Payment gateway reference (for purchases)
  metadata jsonb DEFAULT '{}' -- Additional transaction data
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS credit_transactions_user_id_idx ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS credit_transactions_type_idx ON credit_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS credit_transactions_date_idx ON credit_transactions(transaction_date);

-- Add row-level security
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

-- Policies: Users can only access their own transaction data
CREATE POLICY "Users can view own transaction data" ON credit_transactions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all transaction data" ON credit_transactions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins WHERE admins.id = auth.uid()
    )
  );
```

### Course Access Table (course_access)
```sql
CREATE TABLE course_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  course_id uuid REFERENCES video_courses(id) NOT NULL,
  access_date timestamptz DEFAULT now(),
  expires_at timestamptz, -- Optional: for time-limited access
  access_count integer DEFAULT 0, -- Number of times accessed
  last_access_date timestamptz, -- Last time the course was accessed
  UNIQUE(user_id, course_id) -- Prevent duplicate access records
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS course_access_user_id_idx ON course_access(user_id);
CREATE INDEX IF NOT EXISTS course_access_course_id_idx ON course_access(course_id);
CREATE INDEX IF NOT EXISTS course_access_date_idx ON course_access(access_date);

-- Add row-level security
ALTER TABLE course_access ENABLE ROW LEVEL SECURITY;

-- Policies: Users can only access their own course access data
CREATE POLICY "Users can view own course access data" ON course_access
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all course access data" ON course_access
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins WHERE admins.id = auth.uid()
    )
  );
```

### Additional Database Functions
```sql
-- Function to check if user has access to a video course
CREATE OR REPLACE FUNCTION user_has_course_access(p_user_id uuid, p_course_id uuid)
RETURNS BOOLEAN AS $$
DECLARE
  has_access BOOLEAN;
  course_credits_required INTEGER;
  user_balance INTEGER;
BEGIN
  -- Get required credits for the course
  SELECT credits_required INTO course_credits_required
  FROM video_courses
  WHERE id = p_course_id;
  
  -- Get user's balance
  SELECT balance INTO user_balance
  FROM user_credits
  WHERE user_id = p_user_id;
  
  -- Check if user has already purchased access
  SELECT EXISTS(
    SELECT 1 FROM course_access
    WHERE user_id = p_user_id AND course_id = p_course_id
  ) INTO has_access;
  
  -- If user already has access, return true
  IF has_access THEN
    RETURN true;
  END IF;
  
  -- Otherwise check if user has enough credits
  RETURN COALESCE(user_balance, 0) >= COALESCE(course_credits_required, 0);
END;
$$ LANGUAGE plpgsql;

-- Function to purchase course access
CREATE OR REPLACE FUNCTION purchase_course_access(p_user_id uuid, p_course_id uuid)
RETURNS TABLE(success BOOLEAN, message TEXT, new_balance INTEGER) AS $$
DECLARE
  course_credits INTEGER;
  current_balance INTEGER;
  new_balance_value INTEGER;
  transaction_id uuid;
BEGIN
  -- Get course credits required and user's current balance
  SELECT vc.credits_required, uc.balance 
  INTO course_credits, current_balance
  FROM video_courses vc
  JOIN user_credits uc ON uc.user_id = p_user_id
  WHERE vc.id = p_course_id;
  
  -- Check if user has enough credits
  IF current_balance < course_credits THEN
    RETURN QUERY SELECT false, 'رصيدك غير كافي لشراء هذا المقرر', current_balance;
  END IF;
  
  -- Update user credits (deduct course credits)
  UPDATE user_credits 
  SET balance = balance - course_credits,
      updated_at = now()
  WHERE user_id = p_user_id
  RETURNING balance INTO new_balance_value;
  
  -- Add transaction record
  INSERT INTO credit_transactions (user_id, transaction_type, amount, description, 
                                  balance_before, balance_after, related_entity_type, related_entity_id)
  VALUES (p_user_id, 'usage', -course_credits, 'شراء وصول لمقرر فيديو', 
          current_balance, new_balance_value, 'course_access', p_course_id);
  
  -- Add course access record
  INSERT INTO course_access (user_id, course_id)
  VALUES (p_user_id, p_course_id)
  ON CONFLICT (user_id, course_id) DO UPDATE
  SET access_date = now(), access_count = course_access.access_count + 1;
  
  -- Return success with new balance
  RETURN QUERY SELECT true, 'تم شراء الوصول إلى المقرر بنجاح', new_balance_value;
END;
$$ LANGUAGE plpgsql;
```

## API Endpoints

### Video Courses Endpoints

#### Public Endpoints (No Authentication Required)
- `GET /api/video-courses` - Get all video courses with search and filtering options
  - Query params: `category`, `search`, `limit`, `page`, `featured`
  - Response: Paginated list of video courses with metadata (excluding access-restricted fields)

- `GET /api/video-courses/featured` - Get featured video courses
  - Response: List of featured video courses

- `GET /api/video-courses/:id` - Get single video course by ID
  - Response: Video course details (with access status for authenticated users)

- `GET /api/video-courses/:id/related` - Get related video courses
  - Query params: `limit` (default: 3)
  - Response: List of related video courses based on categories

#### Authenticated Endpoints (Require User Authentication)
- `GET /api/users/video-courses` - Get user's purchased/accessed video courses
  - Response: List of video courses user has access to

- `POST /api/video-courses/:id/access` - Request access to a video course
  - Body: `{}` (empty object, logic handles credit deduction)
  - Response: `{success: boolean, message: string, hasAccess: boolean, newBalance: number}`

- `GET /api/video-courses/search/advanced` - Advanced search with full-text search
  - Query params: `q` (search query), `limit`, `page`
  - Response: List of video courses with search relevance ranking

### Credit System Endpoints

#### Authenticated Endpoints (Require User Authentication)
- `GET /api/users/credits` - Get user's current credit balance
  - Response: `{balance: number, totalEarned: number, totalSpent: number}`

- `GET /api/users/credit-transactions` - Get user's credit transaction history
  - Query params: `limit`, `page`, `type` (filter by transaction type)
  - Response: Paginated list of credit transactions

- `POST /api/credits/purchase` - Purchase credits via payment gateway
  - Body: `{packageId: string, paymentMethod: string, currency: string}`
  - Response: `{success: boolean, transactionId: string, newBalance: number, paymentIntent: object}`

- `POST /api/credits/validate-access` - Validate if user has access to a specific course
  - Body: `{courseId: string}`
  - Response: `{hasAccess: boolean, requiresCredits: number, userBalance: number}`

### Admin Endpoints (Require Admin Authentication)
- `POST /api/admin/video-courses` - Create new video course
- `PUT /api/admin/video-courses/:id` - Update video course
- `DELETE /api/admin/video-courses/:id` - Delete video course
- `GET /api/admin/credit-transactions` - Get all credit transactions (for reporting)
- `POST /api/admin/credits/adjust` - Manually adjust user's credit balance
  - Body: `{userId: string, amount: number, reason: string}`
  - Response: `{success: boolean, newBalance: number, transactionId: string}`
- `GET /api/admin/users/credits` - Get credit balances for all users
- `GET /api/admin/course-access` - Get all course access records (for analytics)

### Implementation Details

#### Video Courses Routes File (`/backend/routes/videoCourses.js`)

```javascript
import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { authLimiter, videoAccessLimiter, searchLimiter } from '../middleware/rateLimiter.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Rate limiting for different types of requests
router.get('/', searchLimiter, async (req, res) => {
  // Implementation for getting all video courses with search/filter
});

router.get('/featured', async (req, res) => {
  // Implementation for getting featured video courses
});

router.get('/:id', searchLimiter, async (req, res) => {
  // Implementation for getting single video course, with access info for authenticated users
});

router.get('/:id/related', async (req, res) => {
  // Implementation for getting related video courses
});

// Authenticated routes
router.use(requireAuth); // Middleware to require authentication

router.get('/user-courses', async (req, res) => {
  // Implementation for getting user's purchased/accessed courses
});

router.post('/:id/access', videoAccessLimiter, async (req, res) => {
  // Implementation for requesting access to a video course (handles credit deduction)
});

router.get('/search/advanced', searchLimiter, async (req, res) => {
  // Implementation for advanced search functionality
});

// Export the router
export default router;
```

#### Credit System Routes File (`/backend/routes/credits.js`)

```javascript
import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { purchaseLimiter, infoLimiter } from '../middleware/rateLimiter.js';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/adminAuth.js';

const router = express.Router();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Authenticated routes (require user authentication)
router.use(requireAuth);

router.get('/balance', infoLimiter, async (req, res) => {
  // Implementation for getting user's credit balance
});

router.get('/transactions', infoLimiter, async (req, res) => {
  // Implementation for getting user's transaction history
});

router.post('/purchase', purchaseLimiter, async (req, res) => {
  // Implementation for purchasing credits via payment gateway
});

router.post('/validate-access', infoLimiter, async (req, res) => {
  // Implementation for validating course access
});

// Admin routes (require admin authentication)
router.use('/admin', requireAdmin);

router.get('/admin/transactions', async (req, res) => {
  // Implementation for admin to view all transactions
});

router.post('/admin/adjust', async (req, res) => {
  // Implementation for admin to adjust user credit balance
});

router.get('/admin/users', async (req, res) => {
  // Implementation for admin to view all users' credit balances
});

export default router;
```

## Design Consistency

### UI/UX Principles to Maintain
- Same card design as `ArticleCard.tsx`
- Consistent Arabic typography and RTL layout
- Same search and filtering interface as articles section
- Similar color scheme and styling classes
- Consistent navigation and breadcrumbs
- Same responsive design principles

### Components to Mirror
- VideoCourseCard similar to ArticleCard
- VideoCourseList similar to ArticleList
- VideoCoursesPage similar to ArticlesPage
- VideoCourseDetailPage similar to ArticleDetailPage

## Security Considerations

1. Implement proper authentication for credit purchases
2. Prevent credit duplication or manipulation
3. Secure video URLs to prevent unauthorized access
4. Implement proper rate limiting for credit-related endpoints
5. Ensure user data privacy compliance
6. Secure payment processing integration

## Performance Considerations

1. Implement caching for video course metadata
2. Optimize database queries for video course fetching
3. Use CDN for serving video content
4. Implement lazy loading for video course lists
5. Optimize image loading with proper sizing and formats

## Future Enhancements

1. Video course progress tracking
2. User reviews and ratings for courses
3. Video course certificates upon completion
4. Video course recommendations based on user behavior
5. Video course bundles and subscriptions
6. User-generated video content (with proper moderation)

## Timeline

- Phase 1 (Database): 1-2 days
- Phase 2 (Backend API): 3-4 days
- Phase 3 (Admin Panel): 2-3 days
- Phase 4 (Frontend): 4-5 days
- Phase 5 (Testing): 2-3 days

**Total estimated time: 12-17 days**