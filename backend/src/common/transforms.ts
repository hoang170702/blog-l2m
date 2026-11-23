/** class-transformer helper: trims string input and leaves other values untouched. */
export const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
