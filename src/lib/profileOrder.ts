/** Keep the first position of each ID, including IDs absent from the profile list. */
export const normalizeProfileOrder = (order: readonly string[]): string[] => [
  ...new Set(order),
];
