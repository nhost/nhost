import '@testing-library/jest-dom/extend-expect';
import matchers from '@testing-library/jest-dom/matchers';
import fetch from 'node-fetch';
import { expect } from 'vitest';

// @ts-ignore
global.fetch = fetch;

expect.extend(matchers);
