/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */

/* @flow */

import type { Realm } from "../realm.js";
import type { CallableObjectValue } from "../types.js";
import { ThrowCompletion, AbruptCompletion } from "../completions.js";
import {
  NumberValue,
  StringValue,
  ObjectValue,
  UndefinedValue,
  NativeFunctionValue,
  Value,
} from "../values/index.js";
import {
  GetMethod,
  Call,
  Get,
  ToBooleanPartial,
  Invoke,
  ObjectCreate,
} from "./index.js";
import invariant from "../invariant.js";
import type { IterationKind } from "../types.js";
import { SameValue } from "./abstract.js";
import { CreateMethodProperty, CreateIterResultObject } from "./create.js";

// ECMA262 7.4.1
export function GetIterator(realm: Realm, obj: Value = realm.intrinsics.undefined, method?: Value): ObjectValue {
  // 1. If method was not passed, then
  if (!method) {
    // a. Let method be ? GetMethod(obj, @@iterator).
    method = GetMethod(realm, obj, realm.intrinsics.SymbolIterator);
  }

  // 2. Let iterator be ? Call(method, obj).
  let iterator = Call(realm, method, obj);

  // 3. If Type(iterator) is not Object, throw a TypeError exception.
  if (!(iterator instanceof ObjectValue)) {
    throw realm.createErrorThrowCompletion(realm.intrinsics.TypeError);
  }

  // 4. Return iterator.
  return iterator;
}

// ECMA262 7.4.5
export function IteratorStep(realm: Realm, iterator: Value): false | ObjectValue {
  // 1. Let result be ? IteratorNext(iterator).
  let result = IteratorNext(realm, iterator);

  // 2. Let done be ? IteratorComplete(result).
  let done = IteratorComplete(realm, result);

  // 3. If done is true, return false.
  if (done) return false;

  // 4. Return result.
  return result;
}

// ECMA262 7.4.4
export function IteratorValue(realm: Realm, iterResult: ObjectValue): Value {
  // 1. Assert: Type(iterResult) is Object.
  invariant(iterResult instanceof ObjectValue, "expected obj");

  // 2. Return ? Get(iterResult, "value").
  return Get(realm, iterResult, "value");
}

// ECMA262 7.4.2
export function IteratorComplete(realm: Realm, iterResult: ObjectValue): boolean {
  // 1. Assert: Type(iterResult) is Object.
  invariant(iterResult instanceof ObjectValue, "expected obj");

  // 2. Return ToBoolean(? Get(iterResult, "done")).
  return ToBooleanPartial(realm, Get(realm, iterResult, "done"));
}

// ECMA262 7.4.2
export function IteratorNext(realm: Realm, iterator: Value, value?: Value): ObjectValue {
  // 1. If value was not passed, then
  let result;
  if (!value) {
    // a. Let result be ? Invoke(iterator, "next", « »).
    result = Invoke(realm, iterator, "next", []);
  } else {  // 2. Else,
    // a. Let result be ? Invoke(iterator, "next", « value »).
    result = Invoke(realm, iterator, "next", [value]);
  }

  // 3. If Type(result) is not Object, throw a TypeError exception.
  if (!(result instanceof ObjectValue)) {
    throw realm.createErrorThrowCompletion(realm.intrinsics.TypeError);
  }

  // 4. Return result.
  return result;
}

// ECMA262 7.4.8
export function CreateListIterator(realm: Realm, list: Array<Value>): ObjectValue {
  // 1. Let iterator be ObjectCreate(%IteratorPrototype%, « [[IteratorNext]], [[IteratedList]], [[ListIteratorNextIndex]] »).
  let iterator = ObjectCreate(realm, realm.intrinsics.IteratorPrototype, {
    $IteratorNext: undefined,
    $IteratedList: undefined,
    $ListIteratorNextIndex: undefined,
  });

  // 2. Set iterator's [[IteratedList]] internal slot to list.
  iterator.$IteratedList = list;

  // 3. Set iterator's [[ListIteratorNextIndex]] internal slot to 0.
  iterator.$ListIteratorNextIndex = 0;

  // 4. Let next be a new built-in function object as defined in ListIterator next (7.4.8.1).
  let next = ListIterator_next(realm);

  // 5. Set iterator's [[IteratorNext]] internal slot to next.
  iterator.$IteratorNext = next;

  // 6. Perform CreateMethodProperty(iterator, "next", next).
  CreateMethodProperty(realm, iterator, new StringValue(realm, 'next'), next);

  // 7. Return iterator.
  return iterator;
}

// ECMA262 7.4.8.1
function ListIterator_next(realm: Realm): NativeFunctionValue {
  let func = new NativeFunctionValue(realm, undefined, "next", 0, (context: ObjectValue) => {
    // 1. Let O be the this value.
    let O = context;

    // 2. Let f be the active function object.
    let f = func;

    // 3. If O does not have a [[IteratorNext]] internal slot, throw a TypeError exception.
    if (!O.$IteratorNext) {
      throw realm.createErrorThrowCompletion(realm.intrinsics.TypeError, "O does not have an [[IteratorNext]] internal slot");
    }

    // 4. Let next be the value of the [[IteratorNext]] internal slot of O.
    let next = O.$IteratorNext;

    // 5. If SameValue(f, next) is false, throw a TypeError exception.
    if (!SameValue(realm, f, next)) {
      throw realm.createErrorThrowCompletion(realm.intrinsics.TypeError);
    }

    // 6. If O does not have an [[IteratedList]] internal slot, throw a TypeError exception.
    if (!O.$IteratedList) {
      throw realm.createErrorThrowCompletion(realm.intrinsics.TypeError, "O does not have an [[IteratedList]] internal slot");
    }

    // 7. Let list be the value of the [[IteratedList]] internal slot of O.
    let list = O.$IteratedList;

    // 8. Let index be the value of the [[ListIteratorNextIndex]] internal slot of O.
    // Default to 0 for Flow.
    let index = O.$ListIteratorNextIndex || 0;

    // 9. Let len be the number of elements of list.
    let len = list.length;

    // 10. If index ≥ len, then
    if (index >= len) {
      // a. Return CreateIterResultObject(undefined, true).
      return CreateIterResultObject(realm, new UndefinedValue(realm), true);
    }

    // 11. Set the value of the [[ListIteratorNextIndex]] internal slot of O to index+1.
    O.$ListIteratorNextIndex = index + 1;

    // 12. Return CreateIterResultObject(list[index], false).
    return CreateIterResultObject(realm, list[index], false);
  });

  return func;
}

// ECMA262 23.1.5.1
export function CreateMapIterator(realm: Realm, map: Value, kind: IterationKind): ObjectValue {
  // 1. If Type(map) is not Object, throw a TypeError exception.
  if (!(map instanceof ObjectValue)) {
    throw realm.createErrorThrowCompletion(realm.intrinsics.TypeError);
  }

  // 2. If map does not have a [[MapData]] internal slot, throw a TypeError exception.
  if (!map.$MapData) {
    throw realm.createErrorThrowCompletion(realm.intrinsics.TypeError);
  }

  // 3. Let iterator be ObjectCreate(%MapIteratorPrototype%, « [[Map]], [[MapNextIndex]], [[MapIterationKind]] »).
  let iterator = ObjectCreate(realm, realm.intrinsics.MapIteratorPrototype, {
    $Map: undefined,
    $MapNextIndex: undefined,
    $MapIterationKind: undefined
  });

  // 4. Set iterator's [[Map]] internal slot to map.
  iterator.$Map = map;

  // 5. Set iterator's [[MapNextIndex]] internal slot to 0.
  iterator.$MapNextIndex = new NumberValue(realm, 0);

  // 6. Set iterator's [[MapIterationKind]] internal slot to kind.
  iterator.$MapIterationKind = kind;

  // 7. Return iterator.
  return iterator;
}

// ECMA262 23.2.5.1
export function CreateSetIterator(realm: Realm, set: Value, kind: IterationKind): ObjectValue {
  // 1. If Type(set) is not Object, throw a TypeError exception.
  if (!(set instanceof ObjectValue)) {
    throw realm.createErrorThrowCompletion(realm.intrinsics.TypeError);
  }

  // 2. If set does not have a [[SetData]] internal slot, throw a TypeError exception.
  if (!set.$SetData) {
    throw realm.createErrorThrowCompletion(realm.intrinsics.TypeError);
  }

  // 3. Let iterator be ObjectCreate(%SetIteratorPrototype%, « [[IteratedSet]], [[SetNextIndex]], [[SetIterationKind]] »).
  let iterator = ObjectCreate(realm, realm.intrinsics.SetIteratorPrototype, {
    $IteratedSet: undefined,
    $SetNextIndex: undefined,
    $SetIterationKind: undefined
  });

  // 4. Set iterator's [[IteratedSet]] internal slot to set.
  iterator.$IteratedSet = set;

  // 5. Set iterator's [[SetNextIndex]] internal slot to 0.
  iterator.$SetNextIndex = 0;

  // 6. Set iterator's [[SetIterationKind]] internal slot to kind.
  iterator.$SetIterationKind = kind;

  // 7. Return iterator.
  return iterator;
}

// ECMA262 7.4.6
export function IteratorClose(realm: Realm, iterator: ObjectValue, completion: AbruptCompletion): AbruptCompletion {
  // 1. Assert: Type(iterator) is Object.
  invariant(iterator instanceof ObjectValue, "expected object");

  // 2. Assert: completion is a Completion Record.
  invariant(completion instanceof AbruptCompletion, "expected completion record");

  // 3. Let return be ? GetMethod(iterator, "return").
  let ret = GetMethod(realm, iterator, "return");

  // 4. If return is undefined, return Completion(completion).
  if (ret instanceof UndefinedValue) return completion;

  // 5. Let innerResult be Call(return, iterator, « »).
  let innerResult;
  try {
    innerResult = Call(realm, ret.throwIfNotConcrete(), iterator, []);
  } catch (error) {
    innerResult = error;
  }

  // 6. If completion.[[Type]] is throw, return Completion(completion).
  if (completion instanceof ThrowCompletion) return completion;

  // 7. If innerResult.[[Type]] is throw, return Completion(innerResult).
  if (innerResult instanceof ThrowCompletion) return innerResult;

  // 8. If Type(innerResult.[[Value]]) is not Object, throw a TypeError exception.
  if (!(innerResult instanceof ObjectValue)) {
    throw realm.createErrorThrowCompletion(realm.intrinsics.TypeError);
  }

  // 9. Return Completion(completion).
  return completion;
}

// ECMA262 22.2.2.1.1
export function IterableToList(realm: Realm, items: Value, method: CallableObjectValue): Array<Value> {
  // 1. Let iterator be ? GetIterator(items, method).
  let iterator = GetIterator(realm, items, method);

  // 2. Let values be a new empty List.
  let values = [];

  // 3. Let next be true.
  let next = true;

  // 4. Repeat, while next is not false
  while (next !== false) {
    // a. Let next be ? IteratorStep(iterator).
    next = IteratorStep(realm, iterator);

    // b. If next is not false, then
    if (next !== false) {
      // i. Let nextValue be ? IteratorValue(next).
      let nextValue = IteratorValue(realm, next);

      // ii. Append nextValue to the end of the List values.
      values.push(nextValue);
    }
  }

  // 5. Return values.
  return values;
}
