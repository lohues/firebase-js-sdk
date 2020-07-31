/**
 * @license
 * Copyright 2019 Google LLC
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

/**
 * @fileoverview Defines the Firebase Storage Reference class.
 */
import { FbsBlob } from './implementation/blob';
import * as errorsExports from './implementation/error';
import { Location } from './implementation/location';
import {
  metadataValidator,
  Mappings,
  getMappings
} from './implementation/metadata';
import * as path from './implementation/path';
import * as requests from './implementation/requests';
import {
  StringFormat,
  formatValidator,
  dataFromString
} from './implementation/string';
import * as type from './implementation/type';
import { Metadata } from './metadata';
import { StorageService } from './service';
import { UploadTask } from './task';
import { ListOptions, ListResult } from './list';
import { uploadDataSpec, listOptionSpec } from './implementation/args';

/**
 * Provides methods to interact with a bucket in the Firebase Storage service.
 * @param location - An fbs.location, or the URL at
 *     which to base this object, in one of the following forms:
 *         gs://<bucket>/<object-path>
 *         http[s]://firebasestorage.googleapis.com/
 *                     <api-version>/b/<bucket>/o/<object-path>
 *     Any query or fragment strings will be ignored in the http[s]
 *     format. If no value is passed, the storage object will use a URL based on
 *     the project ID of the base firebase.App instance.
 */
export class Reference {
  location: Location;

  constructor(public service: StorageService, location: string | Location) {
    if (location instanceof Location) {
      this.location = location;
    } else {
      this.location = Location.makeFromUrl(location);
    }
  }

  /**
   * @returns The URL for the bucket and path this object references,
   *     in the form gs://<bucket>/<object-path>
   * @override
   */
  toString(): string {
    return 'gs://' + this.location.bucket + '/' + this.location.path;
  }

  protected newRef(service: StorageService, location: Location): Reference {
    return new Reference(service, location);
  }

  /**
   * @internal
   */
  mappings(): Mappings {
    return getMappings();
  }

  /**
   * @returns An reference to the root of this
   *     object's bucket.
   */
  get root(): Reference {
    const location = new Location(this.location.bucket, '');
    return this.newRef(this.service, location);
  }

  get bucket(): string {
    return this.location.bucket;
  }

  get fullPath(): string {
    return this.location.path;
  }

  get name(): string {
    return path.lastComponent(this.location.path);
  }

  get storage(): StorageService {
    return this.service;
  }

  throwIfRoot_(name: string): void {
    if (this.location.path === '') {
      throw errorsExports.invalidRootOperation(name);
    }
  }
}

/**
 * Uploads a blob to this object's location.
 * @public
 * @param ref - Storage Reference where data should be uploaded.
 * @param data - The data to upload.
 * @param metadata - Metadata for the newly uploaded string.
 * @returns An UploadTask that lets you control and
 *     observe the upload.
 */
export function uploadBytes(
  ref: Reference,
  data: Blob | Uint8Array | ArrayBuffer,
  metadata: Metadata | null = null
): UploadTask {
  try {
    uploadDataSpec().validator(data);
  } catch (e) {
    throw errorsExports.invalidArgument(1, 'uploadBytes', e.message);
  }
  try {
    metadata && metadataValidator(metadata);
  } catch (e) {
    throw errorsExports.invalidArgument(2, 'uploadBytes', e.message);
  }
  ref.throwIfRoot_('uploadBytes');
  return new UploadTask(ref, new FbsBlob(data), metadata);
}

/**
 * Uploads a string to this object's location.
 * @public
 * @param ref - Storage Reference where string should be uploaded.
 * @param value - The string to upload.
 * @param format - The format of the string to upload.
 * @param metadata - Metadata for the newly uploaded object.
 * @returns An UploadTask that lets you control and
 *     observe the upload.
 */
export function uploadString(
  ref: Reference,
  value: string,
  format: StringFormat = StringFormat.RAW,
  metadata?: Metadata
): UploadTask {
  if (typeof value !== 'string') {
    throw errorsExports.invalidArgument(
      1,
      'uploadString',
      'Must provide a string to upload.'
    );
  }
  try {
    formatValidator(format);
  } catch (e) {
    throw errorsExports.invalidArgument(2, 'uploadString', e.message);
  }
  try {
    metadata && metadataValidator(metadata);
  } catch (e) {
    throw errorsExports.invalidArgument(3, 'uploadString', e.message);
  }
  ref.throwIfRoot_('putString');
  const data = dataFromString(format, value);
  const metadataClone = Object.assign({}, metadata);
  if (
    !type.isDef(metadataClone['contentType']) &&
    type.isDef(data.contentType)
  ) {
    metadataClone['contentType'] = data.contentType!;
  }
  return new UploadTask(ref, new FbsBlob(data.data, true), metadataClone);
}

/**
 * List all items (files) and prefixes (folders) under this storage reference.
 *
 * This is a helper method for calling list() repeatedly until there are
 * no more results. The default pagination size is 1000.
 *
 * Note: The results may not be consistent if objects are changed while this
 * operation is running.
 *
 * Warning: listAll may potentially consume too many resources if there are
 * too many results.
 * @public
 * @param ref - Storage Reference to get list from.
 *
 * @returns A Promise that resolves with all the items and prefixes under
 *      the current storage reference. `prefixes` contains references to
 *      sub-directories and `items` contains references to objects in this
 *      folder. `nextPageToken` is never returned.
 */
export function listAll(ref: Reference): Promise<ListResult> {
  const accumulator = {
    prefixes: [],
    items: []
  };
  return listAllHelper(ref, accumulator).then(() => accumulator);
}

/**
 * Separated from listAll because async functions can't use "arguments".
 * @internal
 * @param ref
 * @param accumulator
 * @param pageToken
 */
async function listAllHelper(
  ref: Reference,
  accumulator: ListResult,
  pageToken?: string
): Promise<void> {
  const opt: ListOptions = {
    // maxResults is 1000 by default.
    pageToken
  };
  const nextPage = await list(ref, opt);
  accumulator.prefixes.push(...nextPage.prefixes);
  accumulator.items.push(...nextPage.items);
  if (nextPage.nextPageToken != null) {
    await listAllHelper(ref, accumulator, nextPage.nextPageToken);
  }
}

/**
 * List items (files) and prefixes (folders) under this storage reference.
 *
 * List API is only available for Firebase Rules Version 2.
 *
 * GCS is a key-blob store. Firebase Storage imposes the semantic of '/'
 * delimited folder structure.
 * Refer to GCS's List API if you want to learn more.
 *
 * To adhere to Firebase Rules's Semantics, Firebase Storage does not
 * support objects whose paths end with "/" or contain two consecutive
 * "/"s. Firebase Storage List API will filter these unsupported objects.
 * list() may fail if there are too many unsupported objects in the bucket.
 * @public
 *
 * @param ref - Storage Reference to get list from.
 * @param options - See ListOptions for details.
 * @returns A Promise that resolves with the items and prefixes.
 *      `prefixes` contains references to sub-folders and `items`
 *      contains references to objects in this folder. `nextPageToken`
 *      can be used to get the rest of the results.
 */
export function list(
  ref: Reference,
  options?: ListOptions | null
): Promise<ListResult> {
  try {
    options && listOptionSpec().validator(options);
  } catch (e) {
    throw errorsExports.invalidArgument(1, 'list', e.message);
  }
  return ref.service.getAuthToken().then(authToken => {
    const op = options || {};
    const requestInfo = requests.list(
      ref.service,
      ref.location,
      /*delimiter= */ '/',
      op.pageToken,
      op.maxResults
    );
    return ref.service.makeRequest(requestInfo, authToken).getPromise();
  });
}

/**
 * A promise that resolves with the metadata for this object. If this
 * object doesn't exist or metadata cannot be retreived, the promise is
 * rejected.
 * @public
 * @param ref - Storage Reference to get metadata from.
 */
export function getMetadata(ref: Reference): Promise<Metadata> {
  ref.throwIfRoot_('getMetadata');
  return ref.service.getAuthToken().then(authToken => {
    const requestInfo = requests.getMetadata(
      ref.service,
      ref.location,
      ref.mappings()
    );
    return ref.service.makeRequest(requestInfo, authToken).getPromise();
  });
}

/**
 * Updates the metadata for this object.
 * @public
 * @param ref - Storage Reference to update metadata for.
 * @param metadata - The new metadata for the object.
 *     Only values that have been explicitly set will be changed. Explicitly
 *     setting a value to null will remove the metadata.
 * @returns A promise that resolves
 *     with the new metadata for this object.
 *     @see firebaseStorage.Reference.prototype.getMetadata
 */
export function updateMetadata(
  ref: Reference,
  metadata: Metadata
): Promise<Metadata> {
  try {
    metadataValidator(metadata);
  } catch (e) {
    throw errorsExports.invalidArgument(1, 'uploadBytes', e.message);
  }
  ref.throwIfRoot_('updateMetadata');
  return ref.service.getAuthToken().then(authToken => {
    const requestInfo = requests.updateMetadata(
      ref.service,
      ref.location,
      metadata,
      ref.mappings()
    );
    return ref.service.makeRequest(requestInfo, authToken).getPromise();
  });
}

/**
 * @public
 * @returns A promise that resolves with the download
 *     URL for this object.
 */
export function getDownloadURL(ref: Reference): Promise<string> {
  ref.throwIfRoot_('getDownloadURL');
  return ref.service.getAuthToken().then(authToken => {
    const requestInfo = requests.getDownloadUrl(
      ref.service,
      ref.location,
      ref.mappings()
    );
    return ref.service
      .makeRequest(requestInfo, authToken)
      .getPromise()
      .then(url => {
        if (url === null) {
          throw errorsExports.noDownloadURL();
        }
        return url;
      });
  });
}

/**
 * Deletes the object at this location.
 * @public
 * @param ref - Storage Reference for object to delete.
 * @returns A promise that resolves if the deletion succeeds.
 */
export function deleteObject(ref: Reference): Promise<void> {
  ref.throwIfRoot_('deleteObject');
  return ref.service.getAuthToken().then(authToken => {
    const requestInfo = requests.deleteObject(ref.service, ref.location);
    return ref.service.makeRequest(requestInfo, authToken).getPromise();
  });
}

/**
 * Returns reference for object obtained by appending `childPath` to `ref`.
 * @internal
 *
 * @param ref - Storage Reference to get child of.
 * @param childPath - Child path from provided ref.
 * @returns A reference to the object obtained by
 * appending childPath, removing any duplicate, beginning, or trailing
 * slashes.
 */
export function getChild(ref: Reference, childPath: string): Reference {
  const newPath = path.child(ref.location.path, childPath);
  const location = new Location(ref.location.bucket, newPath);
  return new Reference(ref.service, location);
}
/**
 * @public
 * @param ref - Storage Reference to get parent of.
 * @returns A reference to the parent of the
 * current object, or null if the current object is the root.
 */
export function getParent(ref: Reference): Reference | null {
  const newPath = path.parent(ref.location.path);
  if (newPath === null) {
    return null;
  }
  const location = new Location(ref.location.bucket, newPath);
  return new Reference(ref.service, location);
}
