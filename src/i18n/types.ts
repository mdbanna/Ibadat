import type { bn } from './locales/bn'

type DeepString<T> = { [K in keyof T]: T[K] extends string ? string : DeepString<T[K]> }
/** Shape every language must implement. Derived from the Bengali source file. */
export type Messages = DeepString<typeof bn>
