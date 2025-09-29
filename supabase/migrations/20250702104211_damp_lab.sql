/*
  # Create Authors Management System

  1. New Tables
    - `authors`
      - `id` (uuid, primary key)
      - `name` (text, not null, unique)
      - `bio` (text, not null)
      - `image` (text, not null)
      - `specialization` (text, not null)
      - `experience_years` (integer, default 1)
      - `education` (text, not null)
      - `location` (text, not null)
      - `email` (text)
      - `website` (text)
      - `social_links` (jsonb)
      - `is_active` (boolean, default true)
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())

  2. Security
    - Enable RLS on authors table
    - Add policies for public read and admin write access

  3. Sample Data
    - Insert sample authors with professional information
*/

-- Create authors table
CREATE TABLE IF NOT EXISTS authors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  bio text NOT NULL,
  image text NOT NULL,
  specialization text NOT NULL,
  experience_years integer DEFAULT 1,
  education text NOT NULL,
  location text NOT NULL,
  email text,
  website text,
  social_links jsonb DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE authors ENABLE ROW LEVEL SECURITY;

-- Anyone can read active authors
CREATE POLICY "Anyone can read active authors"
  ON authors
  FOR SELECT
  TO PUBLIC
  USING (is_active = true);

-- Only admins can insert, update, delete authors
CREATE POLICY "Admins can insert authors"
  ON authors
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admins WHERE admins.id = auth.uid()
    )
  );

CREATE POLICY "Admins can update authors"
  ON authors
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins WHERE admins.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admins WHERE admins.id = auth.uid()
    )
  );

CREATE POLICY "Admins can delete authors"
  ON authors
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins WHERE admins.id = auth.uid()
    )
  );

-- Insert sample authors
INSERT INTO authors (name, bio, image, specialization, experience_years, education, location, email) VALUES
(
  'د. أحمد الشمري',
  'طبيب أسنان متخصص في زراعة الأسنان والتركيبات الثابتة، حاصل على الزمالة الأمريكية في زراعة الأسنان. يتمتع بخبرة واسعة في أحدث تقنيات زراعة الأسنان والعلاج التجميلي.',
  'https://images.pexels.com/photos/5327585/pexels-photo-5327585.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&dpr=2',
  'زراعة الأسنان والتركيبات',
  12,
  'بكالوريوس طب وجراحة الأسنان - جامعة الملك سعود، زمالة زراعة الأسنان - الولايات المتحدة',
  'الرياض، المملكة العربية السعودية',
  'dr.ahmed@example.com'
),
(
  'د. سارة العبدالله',
  'استشارية طب أسنان الأطفال مع تخصص في العلاج الوقائي والتثقيف الصحي. تهتم بتطوير برامج الوقاية من تسوس الأسنان عند الأطفال وتعزيز الوعي الصحي.',
  'https://images.pexels.com/photos/5327921/pexels-photo-5327921.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&dpr=2',
  'طب أسنان الأطفال',
  8,
  'بكالوريوس طب وجراحة الأسنان - جامعة الملك عبدالعزيز، ماجستير طب أسنان الأطفال',
  'جدة، المملكة العربية السعودية',
  'dr.sarah@example.com'
),
(
  'د. محمد القحطاني',
  'أخصائي تقويم الأسنان والوجه والفكين، متخصص في التقويم الشفاف والتقويم الجراحي. يستخدم أحدث التقنيات في تشخيص وعلاج مشاكل الإطباق.',
  'https://images.pexels.com/photos/6627613/pexels-photo-6627613.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&dpr=2',
  'تقويم الأسنان والوجه والفكين',
  10,
  'بكالوريوس طب وجراحة الأسنان، ماجستير تقويم الأسنان - جامعة الملك سعود',
  'الرياض، المملكة العربية السعودية',
  'dr.mohammed@example.com'
),
(
  'د. فاطمة الراشد',
  'استشارية أمراض اللثة والأنسجة المحيطة بالأسنان، متخصصة في العلاج الجراحي وغير الجراحي لأمراض اللثة. تركز على الطب الوقائي والعلاج المبكر.',
  'https://images.pexels.com/photos/5327656/pexels-photo-5327656.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&dpr=2',
  'أمراض اللثة والأنسجة المحيطة',
  9,
  'بكالوريوس طب وجراحة الأسنان، دكتوراه أمراض اللثة - جامعة الملك فيصل',
  'الدمام، المملكة العربية السعودية',
  'dr.fatima@example.com'
),
(
  'د. نورة العتيبي',
  'أخصائية طب الأسنان التجميلي والترميمي، خبيرة في تبييض الأسنان والقشور التجميلية والحشوات التجميلية. تهدف إلى تحقيق أفضل النتائج الجمالية والوظيفية.',
  'https://images.pexels.com/photos/5327580/pexels-photo-5327580.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&dpr=2',
  'طب الأسنان التجميلي والترميمي',
  7,
  'بكالوريوس طب وجراحة الأسنان، دبلوم طب الأسنان التجميلي',
  'الرياض، المملكة العربية السعودية',
  'dr.noura@example.com'
),
(
  'د. عبدالله المنصور',
  'استشاري جراحة الفم والوجه والفكين، متخصص في زراعة الأسنان المعقدة وجراحات الوجه والفكين. يستخدم أحدث تقنيات التصوير ثلاثي الأبعاد في التشخيص والعلاج.',
  'https://images.pexels.com/photos/6627544/pexels-photo-6627544.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&dpr=2',
  'جراحة الفم والوجه والفكين',
  15,
  'بكالوريوس طب وجراحة الأسنان، زمالة جراحة الفم والوجه والفكين - كندا',
  'الرياض، المملكة العربية السعودية',
  'dr.abdullah@example.com'
);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_authors_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER authors_updated_at_trigger
  BEFORE UPDATE ON authors
  FOR EACH ROW EXECUTE FUNCTION update_authors_updated_at();