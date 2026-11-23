import slugify from 'slugify';

export function toSlug(input: string): string {
  return slugify(input, {
    lower: true,
    strict: true,
    locale: 'vi',
    trim: true,
  });
}

/** Appends -2, -3, ... until `isTaken` reports the slug as free. */
export async function uniqueSlug(
  base: string,
  isTaken: (slug: string) => Promise<boolean>,
): Promise<string> {
  const root = toSlug(base) || 'item';
  let candidate = root;
  for (let n = 2; await isTaken(candidate); n++) {
    candidate = `${root}-${n}`;
  }
  return candidate;
}
