import { toSlug, uniqueSlug } from './slug.js';

describe('toSlug', () => {
  it('lowercases, strips accents and punctuation', () => {
    expect(toSlug('Xin chào Thế Giới!')).toBe('xin-chao-the-gioi');
  });
});

describe('uniqueSlug', () => {
  it('appends a counter until the slug is free', async () => {
    const taken = new Set(['hello', 'hello-2']);
    await expect(uniqueSlug('Hello', async (s) => taken.has(s))).resolves.toBe(
      'hello-3',
    );
  });

  it('falls back to "item" when nothing sluggable remains', async () => {
    await expect(uniqueSlug('!!!', async () => false)).resolves.toBe('item');
  });
});
