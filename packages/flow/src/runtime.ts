export type MaybePromise<Value> = Value | PromiseLike<Value>;

export type IterationResult<Value> =
  | MaybePromise<Value>
  | Iterable<Value>
  | AsyncIterable<Value>;

/**
 * Values accepted by the generic iteration primitive.
 *
 * @remarks
 * Unifies synchronous iterables (arrays, sets), asynchronous streams, and key-value records
 * under a single iteration protocol.
 */
export type IterationSource<Value> =
  | Iterable<Value>
  | AsyncIterable<Value>
  | Readonly<Record<string, Value>>;

/**
 * Callback invoked for each item in an iterable or entry in an object record.
 */
export type IterationCallback<Value, Result> = (
  value: Value,
  index: number | string,
) => IterationResult<Result>;

/**
 * Determines whether an unknown value implements synchronous or asynchronous iteration.
 */
export function isIterable<Value>(
  value: Value | IterationSource<Value>,
): value is Iterable<Value> | AsyncIterable<Value> {
  return (
    value !== null &&
    value !== undefined &&
    (Symbol.iterator in Object(value) || Symbol.asyncIterator in Object(value))
  );
}

const GeneratorFunction: new (...args: readonly string[]) => Generator =
  Object.getPrototypeOf(function* () {}).constructor;
const AsyncGeneratorFunction: new (...args: readonly string[]) => AsyncGenerator =
  Object.getPrototypeOf(async function* () {}).constructor;

function isGeneratorCallback<Value, Result>(
  callback: IterationCallback<Value, Result>,
): boolean {
  return (
    callback instanceof GeneratorFunction ||
    callback instanceof AsyncGeneratorFunction ||
    callback?.constructor?.name === "GeneratorFunction" ||
    callback?.constructor?.name === "AsyncGeneratorFunction" ||
    Object.prototype.toString.call(callback) === "[object GeneratorFunction]" ||
    Object.prototype.toString.call(callback) === "[object AsyncGeneratorFunction]"
  );
}

async function* normalizeResult<Result>(
  result: IterationResult<Result>,
  flattenIterable: boolean,
): AsyncGenerator<Result, void, undefined> {
  if (!flattenIterable) {
    yield (await result) as Result;
    return;
  }

  if (isIterable(result)) {
    for await (const value of result) {
      yield value;
    }
    return;
  }

  yield await result;
}

/**
 * Iterates values from a sync/async iterable or string-keyed record and yields callback results.
 */
export async function* iterate<Value, Result>(
  source: IterationSource<Value>,
  callback: IterationCallback<Value, Result>,
): AsyncGenerator<Result, void, undefined> {
  if (source === null || source === undefined) {
    throw new Error("Iteration source must be a non-null iterable or object.");
  }
  if (!callback || !(callback instanceof Function)) {
    throw new Error("Iteration callback must be a function.");
  }
  const flattenIterable = isGeneratorCallback(callback);

  if (isIterable(source)) {
    let index = 0;
    for await (const value of source) {
      yield* normalizeResult(callback(value, index), flattenIterable);
      index += 1;
    }
    return;
  }

  for (const [key, value] of Object.entries(source)) {
    yield* normalizeResult(callback(value, key), flattenIterable);
  }
}

/**
 * String wrapper tagged as trusted HTML for framework-owned rendering adapters.
 */
export class HTMLString extends String {
  get [Symbol.toStringTag](): string {
    return "HTMLString";
  }
}
