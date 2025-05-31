// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Mock Vite's import.meta.env for Jest tests
global.import = {
  meta: {
    env: {
      MODE: 'test',
      VITE_APP_TITLE: 'Petri Net Editor',
      // Add any other environment variables used in the app
    }
  }
};
