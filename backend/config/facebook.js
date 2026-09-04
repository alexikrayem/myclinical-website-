/**
 * Facebook/Meta OAuth2 Configuration
 *
 * Both "Login with Facebook" and "Login with Instagram" are handled through the
 * Facebook Login product on the Meta Developer Platform. The frontend redirects
 * the user to the Meta authorization URL; the backend exchanges the returned
 * authorization code for an access token via the Graph API.
 *
 * Required env vars:
 *   FACEBOOK_APP_ID         — Meta App ID (public, exposed to frontend via /config endpoint)
 *   FACEBOOK_APP_SECRET     — Meta App Secret (NEVER exposed to frontend)
 *   FACEBOOK_REDIRECT_URI   — Must exactly match the URI registered in the Meta App Dashboard
 */

const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID;
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET;
const FACEBOOK_REDIRECT_URI = process.env.FACEBOOK_REDIRECT_URI || 'http://localhost:5173/auth/callback';

if (!FACEBOOK_APP_ID || !FACEBOOK_APP_SECRET) {
    console.warn(
        '[facebook.js] WARNING: FACEBOOK_APP_ID or FACEBOOK_APP_SECRET is not set. ' +
        'Social login will fail at runtime. Set these in backend/.env.'
    );
}

/**
 * Scopes required for each provider.
 * Facebook login: public_profile is sufficient for identity.
 * Instagram login: instagram_basic gives access to the IG user ID/username.
 */
export const PROVIDER_SCOPES = {
    facebook: 'public_profile',
    instagram: 'instagram_basic,public_profile',
};

/**
 * Builds the Meta OAuth authorization URL the frontend redirects the user to.
 * @param {string} provider  - 'facebook' | 'instagram'
 * @param {string} state     - CSRF state token (frontend-generated, opaque to backend)
 */
export const buildAuthUrl = (provider, state) => {
    const scope = PROVIDER_SCOPES[provider] || PROVIDER_SCOPES.facebook;
    const params = new URLSearchParams({
        client_id: FACEBOOK_APP_ID,
        redirect_uri: FACEBOOK_REDIRECT_URI,
        scope,
        response_type: 'code',
        state,
    });
    return `https://www.facebook.com/dialog/oauth?${params.toString()}`;
};

/**
 * Exchanges an authorization code for a short-lived user access token.
 * @param {string} code  - The auth code from the OAuth redirect callback
 * @returns {Promise<string>} access_token
 */
export const exchangeCodeForToken = async (code) => {
    const url = 'https://graph.facebook.com/v19.0/oauth/access_token';
    const params = new URLSearchParams({
        client_id: FACEBOOK_APP_ID,
        client_secret: FACEBOOK_APP_SECRET,
        redirect_uri: FACEBOOK_REDIRECT_URI,
        code,
    });

    const response = await fetch(`${url}?${params.toString()}`);
    const data = await response.json();

    if (!response.ok || data.error) {
        const msg = data.error?.message || 'Failed to exchange code for token';
        throw new Error(`Meta token exchange failed: ${msg}`);
    }

    return data.access_token;
};

/**
 * Fetches the user profile from the Graph API using an access token.
 * Returns a normalized profile object regardless of provider.
 * @param {string} accessToken
 * @param {string} provider   - 'facebook' | 'instagram'
 * @returns {Promise<{ id, name, username, profileUrl, avatarUrl }>}
 */
export const fetchUserProfile = async (accessToken, provider) => {
    // For Instagram via Facebook Login, the id returned is the Instagram-scoped user ID.
    // We fetch the same /me endpoint — the token scope determines what is returned.
    const fields = provider === 'instagram'
        ? 'id,name,username,profile_picture_url'
        : 'id,name,link,picture.type(large)';

    const response = await fetch(
        `https://graph.facebook.com/v19.0/me?fields=${fields}&access_token=${accessToken}`
    );
    const data = await response.json();

    if (!response.ok || data.error) {
        const msg = data.error?.message || 'Failed to fetch user profile';
        throw new Error(`Meta profile fetch failed: ${msg}`);
    }

    if (provider === 'instagram') {
        return {
            id: data.id,
            name: data.name || data.username || 'مستخدم',
            username: data.username || null,
            profileUrl: data.username ? `https://instagram.com/${data.username}` : null,
            avatarUrl: data.profile_picture_url || null,
        };
    }

    // Facebook
    return {
        id: data.id,
        name: data.name || 'مستخدم',
        username: data.name || null,
        profileUrl: data.link || `https://facebook.com/${data.id}`,
        avatarUrl: data.picture?.data?.url || null,
    };
};

export const FACEBOOK_APP_ID_PUBLIC = FACEBOOK_APP_ID;
export const FACEBOOK_REDIRECT_URI_PUBLIC = FACEBOOK_REDIRECT_URI;
