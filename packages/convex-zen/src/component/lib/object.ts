type Simplify<T> = { [K in keyof T]: T[K] } & {};

export type OmitUndefinedValues<T extends Record<string, unknown>> = Simplify<
  {
    [K in keyof T as undefined extends T[K] ? never : K]: T[K];
  } & {
    [K in keyof T as undefined extends T[K] ? K : never]?: Exclude<T[K], undefined>;
  }
>;

export function omitUndefined<T extends Record<string, unknown>>(
  value: T
): OmitUndefinedValues<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined)
  ) as OmitUndefinedValues<T>;
}
