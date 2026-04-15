/** Single-value process-lifetime cache. */
export class Cached<T> {
  // eslint-disable-next-line functional/prefer-readonly-type -- intentionally mutable cache
  #value: T | undefined;

  get(): T | undefined {
    return this.#value;
  }

  store(value: T): void {
    this.#value = value;
  }
}

/** Key-value process-lifetime cache. */
export class CachedMap<K, V> {
  readonly #entries = new Map<K, V>();

  get(key: K): V | undefined {
    return this.#entries.get(key);
  }

  has(key: K): boolean {
    return this.#entries.has(key);
  }

  store(key: K, value: V): void {
    this.#entries.set(key, value);
  }
}
