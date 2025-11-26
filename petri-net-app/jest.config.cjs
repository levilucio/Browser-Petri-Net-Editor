module.exports = {
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.(js|jsx)$': 'babel-jest',
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@components/(.*)$': '<rootDir>/src/components/$1',
    '\\.(css|less|scss|sass)$': '<rootDir>/src/__mocks__/styleMock.js',
    '^.+\\.worker\\.js$': '<rootDir>/src/__mocks__/workerMock.js'
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
  ],
  coverageReporters: ['html', 'text-summary'],
  coverageThreshold: {
    global: {
      lines: 60,
      branches: 50,
      functions: 55,
      statements: 60,
    },
  },
  forceExit: true, // Force Jest to exit after tests complete (helps with tool timeouts)
  detectOpenHandles: false, // Disable open handles detection for faster exit
};
