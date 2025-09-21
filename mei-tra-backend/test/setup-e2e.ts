// E2E test setup file
// This file is executed before each test file

// Set test environment variables
process.env.NODE_ENV = 'test';

// Mock console methods to reduce noise in test output
const originalLog = console.log;
const originalWarn = console.warn;

beforeAll(() => {
  // Suppress console.log in tests unless specifically needed
  console.log = jest.fn();
  console.warn = jest.fn();
});

afterAll(() => {
  // Restore original console methods
  console.log = originalLog;
  console.warn = originalWarn;

  // Clean up any global resources
  if (global.gc) {
    global.gc();
  }
});

// Handle unhandled promise rejections in tests
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Promise Rejection:', reason);
  // Prevent the process from crashing during tests
});

// Clean up after each test
afterEach(() => {
  // Clear all timers
  jest.clearAllTimers();

  // Clear all mocks
  jest.clearAllMocks();
});
