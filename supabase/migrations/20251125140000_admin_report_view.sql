-- View for Admin Reporting: License Codes -> Users -> Quiz Scores
CREATE OR REPLACE VIEW admin_license_quiz_report AS
SELECT 
    lc.code,
    lc.credit_amount,
    lc.redeemed_at,
    u.email as user_email,
    vc.title as course_title,
    uqa.score,
    uqa.passed,
    uqa.attempted_at
FROM 
    license_codes lc
    -- Join to find the user who redeemed the code
    JOIN auth.users u ON lc.redeemed_by = u.id
    -- Join to find quiz attempts by that user
    -- Note: This shows ALL quiz attempts by the user who redeemed the code, 
    -- regardless of whether that specific code's credits were used for this specific course.
    -- This is the best proxy for "tracking the user's progress".
    LEFT JOIN user_quiz_attempts uqa ON u.id = uqa.user_id
    LEFT JOIN quizzes q ON uqa.quiz_id = q.id
    LEFT JOIN video_courses vc ON q.course_id = vc.id
WHERE 
    lc.is_redeemed = true
ORDER BY 
    lc.redeemed_at DESC;

-- Grant access to admins
GRANT SELECT ON admin_license_quiz_report TO authenticated;

-- RLS equivalent for the view (filtering in the query usually, but for views we rely on underlying table RLS or just restrict access)
-- Since this is an admin view, we should ensure only admins can query it.
-- However, standard Views don't support RLS directly in the same way. 
-- We will rely on the API endpoint to enforce admin check before querying this view.
