/**
 * Picks specific keys from an object
 * @param object - The source object
 * @param keys - Array of keys to pick
 * @returns New object with only the picked keys
 */
export const pick = <T extends Record<string, unknown>, K extends keyof T>(
  object: T,
  keys: K[]
): Pick<T, K> => {
  return keys.reduce(
    (result, key) => {
      if (key in object) {
        result[key] = object[key];
      }
      return result;
    },
    {} as Pick<T, K>
  );
};
