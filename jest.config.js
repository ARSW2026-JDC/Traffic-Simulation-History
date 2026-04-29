module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  coverageReporters: ['text', 'json', 'html'],
  testEnvironment: 'node',
  preset: 'ts-jest',
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/$1',
  },
  globals: {
    'ts-jest': {
      isolatedModules: true,
    },
  },
};