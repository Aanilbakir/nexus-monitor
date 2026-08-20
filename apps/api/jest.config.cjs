module.exports = {
  moduleNameMapper: {
    '^@nexus-monitor/contracts$': '<rootDir>/../../packages/contracts/src/index.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }],
  },
};
