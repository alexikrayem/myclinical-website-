/**
 * requireCreator.js
 *
 * Middleware to gate content creation (articles with 'professional' audience,
 * courses) behind professional verification.
 *
 * The check is now `req.user.isVerified === true`, replacing the old coupled
 * `role === 'doctor' && verificationStatus === 'approved'` logic. This supports
 * the decoupled verification workflow where any user can submit documents and
 * become verified without needing to register as a doctor upfront.
 */
export const requireVerifiedDoctor = (req, res, next) => {
  if (req.user?.isVerified === true) return next();
  return res.status(403).json({
    error: 'يتطلب النشر المهني حساباً موثّقاً. يرجى تقديم طلب التوثيق أولاً',
    code: 'CREATOR_NOT_VERIFIED',
  });
};
