/*
  # Initial Schema Setup for Arabic Dental Research Platform

  1. New Tables
    - `articles`
      - `id` (uuid, primary key)
      - `title` (text, not null)
      - `excerpt` (text, not null)
      - `content` (text, not null)
      - `cover_image` (text, not null)
      - `author` (text, not null)
      - `tags` (text[], not null)
      - `is_featured` (boolean, default false)
      - `publication_date` (timestamptz, default now())
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())
    
    - `researches`
      - `id` (uuid, primary key)
      - `title` (text, not null)
      - `abstract` (text, not null)
      - `authors` (text[], not null)
      - `journal` (text, not null)
      - `file_url` (text, not null)
      - `publication_date` (timestamptz, not null)
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())
    
    - `admins`
      - `id` (uuid, primary key, references auth.users.id)
      - `email` (text, not null, unique)
      - `role` (text, not null, default 'admin')
      - `created_at` (timestamptz, default now())
  
  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated and anon users
*/

-- Create articles table
CREATE TABLE IF NOT EXISTS articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  excerpt text NOT NULL,
  content text NOT NULL,
  cover_image text NOT NULL,
  author text NOT NULL,
  tags text[] NOT NULL,
  is_featured boolean DEFAULT false,
  publication_date timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create researches table
CREATE TABLE IF NOT EXISTS researches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  abstract text NOT NULL,
  authors text[] NOT NULL,
  journal text NOT NULL,
  file_url text NOT NULL,
  publication_date timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create admins table linked to auth.users
CREATE TABLE IF NOT EXISTS admins (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  email text NOT NULL UNIQUE,
  role text NOT NULL DEFAULT 'admin',
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE researches ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

-- Articles policies
-- Anyone can read articles
CREATE POLICY "Anyone can read articles"
  ON articles
  FOR SELECT
  TO PUBLIC
  USING (true);

-- Only admins can insert, update, delete articles
CREATE POLICY "Admins can insert articles"
  ON articles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admins WHERE admins.id = auth.uid()
    )
  );

CREATE POLICY "Admins can update articles"
  ON articles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins WHERE admins.id = auth.uid()
    )
  );

CREATE POLICY "Admins can delete articles"
  ON articles
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins WHERE admins.id = auth.uid()
    )
  );

-- Researches policies
-- Anyone can read researches
CREATE POLICY "Anyone can read researches"
  ON researches
  FOR SELECT
  TO PUBLIC
  USING (true);

-- Only admins can insert, update, delete researches
CREATE POLICY "Admins can insert researches"
  ON researches
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admins WHERE admins.id = auth.uid()
    )
  );

CREATE POLICY "Admins can update researches"
  ON researches
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins WHERE admins.id = auth.uid()
    )
  );

CREATE POLICY "Admins can delete researches"
  ON researches
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins WHERE admins.id = auth.uid()
    )
  );

-- Admins policies
-- Only the same admin can read their own data
CREATE POLICY "Admins can read own data"
  ON admins
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Admins cannot be modified through RLS