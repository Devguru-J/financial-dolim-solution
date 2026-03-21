declare module "bun:test" {
  export function test(name: string, fn: () => void | Promise<void>): void;

  export type ExpectMatchers = {
    toBe(expected: unknown): void;
    toBeLessThanOrEqual(expected: number): void;
    toThrow(expected?: string | RegExp): void;
  };

  export function expect(actual: unknown, message?: string): ExpectMatchers;
}
