module.exports = {
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.(js|jsx)$': 'babel-jest',
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@components/(.*)$': '<rootDir>/src/components/$1',
    '\\.(css|less|scss|sass)$': '<rootDir>/src/__mocks__/styleMock.js'
  },
  setupFilesAfterEnv: [
    '<rootDir>/src/setupTests.js'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/tests/'  // Exclude Playwright tests in the tests directory
  ],
  transformIgnorePatterns: [
    '/node_modules/(?!react-konva|konva)'
  ]
};
