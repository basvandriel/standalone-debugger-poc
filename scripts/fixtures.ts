import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_ROOT = path.join(__dirname, '..', 'fixtures');

export interface FixtureConfig {
  name: string;
  cwd: string;
  program: string;
  source: string;
  breakpointLine: number;
  expectedSummary: string;
}

export const FIXTURE_CONFIGS: Record<string, FixtureConfig> = {
  'loop-demo': {
    name: 'loop-demo',
    cwd: path.join(FIXTURES_ROOT, 'loop-demo'),
    program: path.join(FIXTURES_ROOT, 'loop-demo', 'target', 'debug', 'loop-demo'),
    source: path.join(FIXTURES_ROOT, 'loop-demo', 'src', 'main.rs'),
    breakpointLine: 7,
    expectedSummary: 'items=[2, 4, 6, 8, 10] total=30'
  },
  'c-loop': {
    name: 'c-loop',
    cwd: path.join(FIXTURES_ROOT, 'c-loop'),
    program: path.join(FIXTURES_ROOT, 'c-loop', 'target', 'debug', 'c-loop'),
    source: path.join(FIXTURES_ROOT, 'c-loop', 'src', 'main.c'),
    breakpointLine: 32,
    expectedSummary: 'items=[2, 4, 6, 8, 10] total=30'
  },
  'cpp-loop': {
    name: 'cpp-loop',
    cwd: path.join(FIXTURES_ROOT, 'cpp-loop'),
    program: path.join(FIXTURES_ROOT, 'cpp-loop', 'target', 'debug', 'cpp-loop'),
    source: path.join(FIXTURES_ROOT, 'cpp-loop', 'src', 'main.cpp'),
    breakpointLine: 28,
    expectedSummary: 'items=[2, 4, 6, 8, 10] total=30'
  }
};

export function getFixtureConfig(fixtureName: string): FixtureConfig {
  const config = FIXTURE_CONFIGS[fixtureName];
  if (!config) {
    throw new Error(`Unknown fixture: ${fixtureName}. Supported fixtures: ${Object.keys(FIXTURE_CONFIGS).join(', ')}`);
  }
  return config;
}

export const fixtureNames = Object.keys(FIXTURE_CONFIGS);
