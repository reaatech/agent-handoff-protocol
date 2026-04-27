export type DeepPartial<T> = T extends unknown[]
  ? T
  : T extends object
    ? {
        [P in keyof T]?: DeepPartial<T[P]>;
      }
    : T;
