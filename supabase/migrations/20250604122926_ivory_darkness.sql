/*
  # Seed Data for Arabic Dental Research Platform

  This migration adds initial seed data for testing purposes:
  1. Sample articles with different tags and content
  2. Sample research papers from various journals
  3. Admin user for accessing the admin panel
*/

-- Insert sample articles
INSERT INTO articles (title, excerpt, content, cover_image, author, tags, is_featured, publication_date)
VALUES
  (
    'أحدث التقنيات في زراعة الأسنان',
    'استعراض لأحدث التقنيات المستخدمة في مجال زراعة الأسنان والتطورات التي طرأت عليها في السنوات الأخيرة.',
    'محتوى مفصل عن أحدث التقنيات في زراعة الأسنان والمواد المستخدمة وطرق العلاج الحديثة.',
    'https://images.pexels.com/photos/3845810/pexels-photo-3845810.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
    'د. أحمد الشمري',
    ARRAY['زراعة الأسنان', 'تقنيات حديثة'],
    true,
    NOW() - INTERVAL '2 days'
  ),
  (
    'علاج تسوس الأسنان عند الأطفال',
    'دليل شامل للوقاية من تسوس الأسنان عند الأطفال وطرق العلاج المناسبة والآمنة.',
    'محتوى مفصل عن أسباب تسوس الأسنان عند الأطفال وطرق الوقاية والعلاج المناسبة.',
    'https://images.pexels.com/photos/4269692/pexels-photo-4269692.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
    'د. سارة العبدالله',
    ARRAY['طب أسنان الأطفال', 'تسوس الأسنان', 'وقاية'],
    true,
    NOW() - INTERVAL '5 days'
  ),
  (
    'تقويم الأسنان الشفاف: مميزاته وعيوبه',
    'نظرة شاملة على تقنية تقويم الأسنان الشفاف ومقارنتها بالتقويم التقليدي من حيث الفعالية والتكلفة.',
    'محتوى مفصل عن تقويم الأسنان الشفاف وكيفية عمله ومميزاته وعيوبه مقارنة بالتقويم التقليدي.',
    'https://images.pexels.com/photos/3845675/pexels-photo-3845675.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
    'د. محمد القحطاني',
    ARRAY['تقويم الأسنان', 'تقنيات حديثة'],
    false,
    NOW() - INTERVAL '10 days'
  ),
  (
    'أمراض اللثة: الأسباب والعلاج',
    'استعراض شامل لأمراض اللثة الشائعة وأسبابها وطرق الوقاية والعلاج المناسبة.',
    'محتوى مفصل عن أمراض اللثة المختلفة وأسبابها وأعراضها وطرق الوقاية والعلاج.',
    'https://images.pexels.com/photos/7657903/pexels-photo-7657903.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
    'د. فاطمة الراشد',
    ARRAY['أمراض اللثة', 'صحة الفم'],
    false,
    NOW() - INTERVAL '15 days'
  ),
  (
    'تبييض الأسنان: الطرق المنزلية والطبية',
    'مقارنة بين طرق تبييض الأسنان المنزلية والطبية من حيث الفعالية والأمان والتكلفة.',
    'محتوى مفصل عن طرق تبييض الأسنان المختلفة والفرق بين الطرق المنزلية والطبية.',
    'https://images.pexels.com/photos/3762453/pexels-photo-3762453.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
    'د. نورة العتيبي',
    ARRAY['طب الأسنان التجميلي', 'تبييض الأسنان'],
    true,
    NOW() - INTERVAL '20 days'
  ),
  (
    'تقنيات التصوير ثلاثي الأبعاد في طب الأسنان',
    'استعراض لتقنيات التصوير ثلاثي الأبعاد المستخدمة في طب الأسنان وتطبيقاتها المختلفة.',
    'محتوى مفصل عن تقنيات التصوير ثلاثي الأبعاد في طب الأسنان وكيفية عملها وتطبيقاتها المختلفة.',
    'https://images.pexels.com/photos/4269373/pexels-photo-4269373.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
    'د. عبدالله المنصور',
    ARRAY['تقنيات حديثة', 'تصوير الأسنان'],
    false,
    NOW() - INTERVAL '25 days'
  );

-- Insert sample research papers
INSERT INTO researches (title, abstract, authors, journal, file_url, publication_date)
VALUES
  (
    'فعالية العلاج باستخدام الليزر في أمراض اللثة المزمنة',
    'دراسة سريرية مقارنة بين العلاج التقليدي والعلاج بالليزر في علاج أمراض اللثة المزمنة وتأثيرهما على صحة الأنسجة.',
    ARRAY['د. سعيد الغامدي', 'د. منى الحربي', 'د. خالد الدوسري'],
    'المجلة السعودية لطب الأسنان',
    'https://example.com/research1.pdf',
    NOW() - INTERVAL '3 months'
  ),
  (
    'تقييم نجاح زراعة الأسنان باستخدام تقنية التحميل الفوري',
    'دراسة على 100 حالة لتقييم معدل نجاح زراعة الأسنان باستخدام تقنية التحميل الفوري مقارنة بالطرق التقليدية.',
    ARRAY['د. طارق الزهراني', 'د. نور الهاشمي'],
    'مجلة طب الأسنان العربية',
    'https://example.com/research2.pdf',
    NOW() - INTERVAL '5 months'
  ),
  (
    'تأثير استخدام المضادات الحيوية قبل وبعد خلع ضرس العقل',
    'دراسة عشوائية على 200 مريض لتقييم فعالية استخدام المضادات الحيوية قبل وبعد خلع ضرس العقل في الوقاية من المضاعفات.',
    ARRAY['د. هشام العمري', 'د. سمية القرني', 'د. فيصل العجمي'],
    'المجلة المصرية لجراحة الفم والوجه والفكين',
    'https://example.com/research3.pdf',
    NOW() - INTERVAL '7 months'
  ),
  (
    'مقارنة بين أنواع مختلفة من حشوات الأسنان التجميلية',
    'دراسة مخبرية ومراجعة منهجية لمقارنة أنواع مختلفة من حشوات الأسنان التجميلية من حيث المتانة واللون والتكلفة.',
    ARRAY['د. ليلى الصالح', 'د. عمر البلوي'],
    'مجلة طب الأسنان التجميلي',
    'https://example.com/research4.pdf',
    NOW() - INTERVAL '9 months'
  );

-- Insert admin user (Note: In a real application, this would be done through authentication API)
-- Password should be hashed properly, this is just for demonstration
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, confirmation_sent_at, recovery_sent_at)
VALUES (
  gen_random_uuid(),
  'admin@arabdental.com',
  '$2a$10$U6EwF8e58IrpDcEbYeY6..pChJdSu0EfZdZj5mF.Z7w/D0r2dn2FK', -- Example hash for 'Admin123'
  NOW(),
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;

-- Link the admin user to the admins table
INSERT INTO admins (id, email, role)
SELECT 
  id,
  email,
  'admin'
FROM auth.users
WHERE email = 'admin@arabdental.com'
ON CONFLICT DO NOTHING;