# Contributing to Petri Net Editor

Thank you for your interest in contributing to the Petri Net Editor! This document outlines the guidelines and best practices for contributing to the project.

## Table of Contents
- [Code Organization](#code-organization)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Pull Requests](#pull-requests)
- [Commit Guidelines](#commit-guidelines)
- [Environment Setup](#environment-setup)
- [Performance Guidelines](#performance-guidelines)

## Code Organization

### Project Structure
```
petri-net-app/
├── public/           # Static assets
├── src/
│   ├── components/   # React components
│   ├── utils/        # Utility functions
│   ├── App.jsx       # Main application component
│   └── main.jsx      # Entry point
├── tests/            # Test files
├── docs/             # Documentation
└── package.json      # Dependencies and scripts
```

### File Naming
- Use PascalCase for React component files (e.g., `PetriNetCanvas.jsx`)
- Use camelCase for utility files (e.g., `petriNetUtils.js`)
- Use kebab-case for test files (e.g., `petri-net-utils.test.js`)

## Development Workflow

1. **Branch Naming**
   - `feature/` - New features
   - `bugfix/` - Bug fixes
   - `refactor/` - Code refactoring
   - `docs/` - Documentation updates

2. **Development Server**
   ```bash
   cd petri-net-app
   npm run dev
   ```

3. **Running Tests**
   ```bash
   # Run all tests
   npm test
   
   # Run end-to-end tests
   npx playwright test
   ```

## Coding Standards

### General
- Keep files under 300 lines of code
- Avoid code duplication
- Follow the Single Responsibility Principle
- Use meaningful variable and function names
- Add JSDoc comments for complex functions

### React Components
- Use functional components with hooks
- Keep components small and focused
- Use prop-types for type checking
- Split large components into smaller, reusable ones

### State Management
- Use React's built-in state management for local state
- Lift state up when needed
- Keep state as local as possible

## Testing

### Unit Tests
- Write tests for all utility functions
- Test component rendering and interactions
- Use Jest as the test runner
- Place test files next to the code they test

### End-to-End Tests
- Use Playwright for end-to-end testing
- Test critical user flows
- Mock external dependencies
- Run E2E tests in CI

## Pull Requests

1. Keep PRs small and focused on a single feature/fix
2. Include tests for new features
3. Update documentation if needed
4. Ensure all tests pass
5. Get at least one code review before merging

## Commit Guidelines

Use the following commit message format:
```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Adding or modifying tests
- `chore`: Build process or auxiliary tool changes

**Example**:
```
feat(canvas): add grid snapping for elements

- Implemented 20x20 pixel grid snapping
- Added toggle in view options
- Updated tests
```

## Environment Setup

### Prerequisites
- Node.js (v18 or later)
- npm (comes with Node.js)
- Python 3.8+ (for Pyodide in Phase 2)

### Installation
```bash
# Install dependencies
cd petri-net-app
npm install

# Start development server
npm run dev
```

## Performance Guidelines

- Keep render methods clean and fast
- Use React.memo for expensive components
- Avoid unnecessary re-renders
- Profile performance regularly
- Keep the undo/redo stack limited to 50 states
- Follow the performance targets:
  - Editor actions: < 50ms
  - P/T transitions: < 100ms
  - Algebraic transitions: < 200ms

## Code Review Process

1. Ensure all tests pass
2. Check for code style consistency
3. Verify new functionality works as expected
4. Look for potential performance issues
5. Ensure proper error handling
6. Check for security vulnerabilities

## Getting Help

If you have questions or need help:
1. Check the documentation in `/docs`
2. Search the issue tracker
3. Open a new issue if your question hasn't been asked before
