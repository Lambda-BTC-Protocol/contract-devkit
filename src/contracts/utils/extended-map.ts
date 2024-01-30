/**
 * ExtendedMap is a Map with an update method that allows you to update a value without having to get it first.
 * just a nice helper method
 */
export class ExtendedMap<K, V> extends Map<K, V> {
  update(key: K, fallbackValue: V, updater: (value: V) => V): this {
    const existingValue = this.get(key) ?? fallbackValue;
    const newValue = updater(existingValue);
    this.set(key, newValue);

    return this;
  }
}
