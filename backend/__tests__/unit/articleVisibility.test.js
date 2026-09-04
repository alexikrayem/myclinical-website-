import { jest } from '@jest/globals';
import { applyPublicArticleFilter, PUBLIC_LISTED } from '../../utils/articleVisibility.js';
import { requireVerifiedDoctor } from '../../middleware/requireCreator.js';

describe('creator content visibility guards', () => {
  it('pins public queries to approved, listed articles', () => {
    const query = { eq: jest.fn().mockReturnThis() };
    expect(applyPublicArticleFilter(query)).toBe(query);
    expect(query.eq).toHaveBeenNthCalledWith(1, 'status', 'approved');
    expect(query.eq).toHaveBeenNthCalledWith(2, 'visibility', 'listed');
    expect(PUBLIC_LISTED).toEqual({ status: 'approved', visibility: 'listed' });
  });

  it('rejects professional submission from an unverified creator', () => {
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    requireVerifiedDoctor({ user: { role: 'doctor', verificationStatus: 'pending' } }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'CREATOR_NOT_VERIFIED' }));
  });
});
