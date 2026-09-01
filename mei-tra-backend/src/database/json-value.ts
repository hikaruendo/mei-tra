import type { Json } from '../types/database.generated.types';

export type JsonObject = { [key: string]: Json | undefined };

export const toJson = (value: unknown): Json => {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => toJson(item));
  }

  if (isPlainRecord(value)) {
    return toJsonObject(value);
  }

  throw new TypeError('Value is not JSON serializable');
};

export const toJsonObject = (value: Record<string, unknown>): JsonObject => {
  const result: JsonObject = {};
  for (const [key, item] of Object.entries(value)) {
    if (item !== undefined) {
      result[key] = toJson(item);
    }
  }
  return result;
};

const isPlainRecord = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value) as unknown;
  return prototype === Object.prototype || prototype === null;
};
