/**
 * @license
 * Copyright 2020 Google LLC
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

import { _registerComponent, registerVersion } from '@firebase/app-exp';
import { StringFormat } from '../src/implementation/string';
import { TaskEvent, TaskState } from '../src/implementation/taskenums';

import { XhrIoPool } from '../src/implementation/xhriopool';
import { Reference } from '../src/reference';
import { StorageService } from '../src/service';
import {
  Component,
  ComponentType,
  ComponentContainer
} from '@firebase/component';

import { name, version } from '../package.json';
import { FirebaseStorage } from '@firebase/storage-types/exp';

export { ref } from '../src/service';
export {
  uploadBytes,
  uploadString,
  getMetadata,
  updateMetadata,
  list,
  listAll,
  getDownloadURL,
  deleteObject
} from '../src/reference';

/**
 * Type constant for Firebase Storage.
 */
const STORAGE_TYPE = 'storage-exp';

function factory(container: ComponentContainer, url?: string): StorageService {
  // Dependencies
  const app = container.getProvider('app').getImmediate();
  const authProvider = container.getProvider('auth-internal');

  return (new StorageService(
    app,
    authProvider,
    new XhrIoPool(),
    url
  ) as unknown) as StorageService;
}

export function registerStorage(): void {
  const namespaceExports = {
    // no-inline
    TaskState,
    TaskEvent,
    StringFormat,
    Storage: StorageService,
    Reference
  };
  _registerComponent(
    new Component(STORAGE_TYPE, factory, ComponentType.PUBLIC)
      .setServiceProps(namespaceExports)
      .setMultipleInstances(true)
  );

  registerVersion(name, version);
}

registerStorage();

declare module '@firebase/component' {
  interface NameServiceMapping {
    'storage-exp': FirebaseStorage;
  }
}
