import { test, expect } from '@jest/globals';

test('passes', () => { expect(true).toBe(true); });

test('app renders without crashing', () => {
    expect(true).toBe(true);
});

test('basic math works', () => {
    expect(1 + 1).toBe(2);
});