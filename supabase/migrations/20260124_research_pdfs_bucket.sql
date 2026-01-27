-- Create storage bucket for research PDFs
-- Note: Run this in Supabase SQL editor or via CLI

-- Create the bucket (if using SQL - usually done via Supabase Dashboard)
INSERT INTO storage.buckets (id, name, public)
VALUES ('research-pdfs', 'research-pdfs', false)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for research-pdfs bucket

-- Allow authenticated users to read PDFs (for viewing)
CREATE POLICY "Authenticated users can read research PDFs"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'research-pdfs');

-- Allow admins to upload PDFs
CREATE POLICY "Admins can upload research PDFs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'research-pdfs'
    AND EXISTS (
        SELECT 1 FROM admins WHERE id = auth.uid()
    )
);

-- Allow admins to update PDFs
CREATE POLICY "Admins can update research PDFs"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'research-pdfs'
    AND EXISTS (
        SELECT 1 FROM admins WHERE id = auth.uid()
    )
);

-- Allow admins to delete PDFs
CREATE POLICY "Admins can delete research PDFs"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'research-pdfs'
    AND EXISTS (
        SELECT 1 FROM admins WHERE id = auth.uid()
    )
);
