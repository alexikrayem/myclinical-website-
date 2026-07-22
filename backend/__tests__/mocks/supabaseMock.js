import { jest } from '@jest/globals';

const createBuilder = () => {
    const builder = {
        _results: { data: {}, error: null },
        _setResult: (data, error = null) => {
            builder._results = { data, error };
            return builder;
        },
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        ilike: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        gt: jest.fn().mockReturnThis(),
        lt: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        single: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockReturnThis(),
        csv: jest.fn().mockReturnThis(),
        rpc: jest.fn().mockReturnThis(),

        // Auth mock
        auth: {
            getUser: jest.fn().mockImplementation(() => Promise.resolve({ data: { user: null }, error: null })),
            signInWithPassword: jest.fn().mockImplementation(() => Promise.resolve({ data: { user: null, session: null }, error: null })),
            signOut: jest.fn().mockImplementation(() => Promise.resolve({ error: null })),
            onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } }))
        },

        // Storage mock
        storage: {
            from: jest.fn(() => ({
                upload: jest.fn().mockResolvedValue({ data: { path: 'mock/path' }, error: null }),
                getPublicUrl: jest.fn(() => ({ data: { publicUrl: 'http://example.com/mock.jpg' } })),
                remove: jest.fn().mockResolvedValue({ data: [], error: null }),
                createSignedUrl: jest.fn().mockResolvedValue({ data: { signedUrl: 'http://example.com/signed.jpg' }, error: null })
            }))
        },

        // Make the builder itself waitable
        then: function (resolve, reject) {
            resolve(this._results);
        }
    };
    return builder;
};

export const mockSupabase = createBuilder();

export const resetSupabaseMock = () => {
    mockSupabase._results = { data: {}, error: null };

    // Restore chaining for all methods
    const methods = [
        'from', 'select', 'insert', 'update', 'delete', 'eq', 'ilike', 'or', 'gt', 'lt',
        'order', 'limit', 'range', 'single', 'maybeSingle', 'csv', 'rpc'
    ];
    methods.forEach(method => {
        mockSupabase[method].mockReset();
        mockSupabase[method].mockImplementation(() => mockSupabase);
    });

    // Restore auth methods
    mockSupabase.auth.getUser.mockReset();
    mockSupabase.auth.getUser.mockImplementation(() => Promise.resolve({ data: { user: null }, error: null }));
    mockSupabase.auth.signInWithPassword.mockReset();
    mockSupabase.auth.signInWithPassword.mockImplementation(() => Promise.resolve({ data: { user: null, session: null }, error: null }));
    mockSupabase.auth.signOut.mockReset();
    mockSupabase.auth.signOut.mockImplementation(() => Promise.resolve({ error: null }));
};
