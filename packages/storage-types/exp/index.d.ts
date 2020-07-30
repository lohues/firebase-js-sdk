/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { FirebaseApp } from '@firebase/app-types-exp';
import { Observer, Unsubscribe } from '@firebase/util';

export interface FullMetadata extends UploadMetadata {
  bucket: string;
  fullPath: string;
  generation: string;
  metageneration: string;
  name: string;
  size: number;
  timeCreated: string;
  updated: string;
}

export interface Reference {
  bucket: string;
  fullPath: string;
  name: string;
  root: Reference;
  storage: Storage;
  toString(): string;
}

export interface ListResult {
  prefixes: Reference[];
  items: Reference[];
  nextPageToken: string | null;
}

export interface ListOptions {
  maxResults?: number | null;
  pageToken?: string | null;
}

export interface SettableMetadata {
  cacheControl?: string | null;
  contentDisposition?: string | null;
  contentEncoding?: string | null;
  contentLanguage?: string | null;
  contentType?: string | null;
  customMetadata?: {
    [/* warning: coerced from ? */ key: string]: string;
  } | null;
}

export type StringFormat = string;
export type TaskEvent = string;
export type TaskState = string;

export interface UploadMetadata extends SettableMetadata {
  md5Hash?: string | null;
}

export interface UploadTask {
  cancel(): boolean;
  catch(onRejected: (a: Error) => unknown): Promise<unknown>;
  on(
    event: TaskEvent,
    nextOrObserver?:
      | Partial<Observer<UploadTaskSnapshot>>
      | null
      | ((a: UploadTaskSnapshot) => unknown),
    error?: ((a: Error) => unknown) | null,
    complete?: Unsubscribe | null
  ): Function;
  pause(): boolean;
  resume(): boolean;
  snapshot: UploadTaskSnapshot;
  then(
    onFulfilled?: ((a: UploadTaskSnapshot) => unknown) | null,
    onRejected?: ((a: Error) => unknown) | null
  ): Promise<unknown>;
}

export interface UploadTaskSnapshot {
  bytesTransferred: number;
  metadata: FullMetadata;
  ref: Reference;
  state: TaskState;
  task: UploadTask;
  totalBytes: number;
}

export class FirebaseStorage {
  private constructor();

  app: FirebaseApp | null;
  maxOperationRetryTime: number;
  maxUploadRetryTime: number;
}
