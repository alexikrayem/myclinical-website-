export default {
    transform: {},
    testEnvironment: 'node',
    verbose: true,
    testMatch: ['**/__tests__/**/*.test.js'],
    setupFiles: ['<rootDir>/__tests__/setup.js'],
    moduleNameMapper: {
        '^pdf-parse$': '<rootDir>/__mocks__/pdf-parse.cjs'
    }
};
