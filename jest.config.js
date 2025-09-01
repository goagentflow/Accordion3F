module.exports = {
  testEnvironment: 'jsdom',
  testMatch: [
    '**/__tests__/**/*.test.[jt]s?(x)',
    '**/__tests__/unit/**/*.[jt]s?(x)',
    '**/__tests__/components/**/*.[jt]s?(x)'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/src/__tests__/e2e/',  // Exclude E2E tests from Jest
    '\\.spec\\.[jt]sx?$'    // Exclude .spec files (Playwright)
  ],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  setupFilesAfterEnv: ['@testing-library/jest-dom'],
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest',
  },
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/__tests__/**',
    '!src/index.js',
    '!src/reportWebVitals.js'
  ]
};