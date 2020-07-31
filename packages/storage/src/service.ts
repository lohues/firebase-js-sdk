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

import { FirebaseApp } from '@firebase/app-types';
import { Location } from './implementation/location';
import { FailRequest } from './implementation/failrequest';
import { Request, makeRequest } from './implementation/request';
import { RequestInfo } from './implementation/requestinfo';
import { XhrIoPool } from './implementation/xhriopool';
import { Reference, getChild } from './reference';
import { Provider } from '@firebase/component';
import { FirebaseAuthInternalName } from '@firebase/auth-interop-types';
import { FirebaseOptions } from '@firebase/app-types-exp';
import * as constants from '../src/implementation/constants';
import * as errorsExports from './implementation/error';

export function isUrl(path?: string): boolean {
  return /^[A-Za-z]+:\/\//.test(path as string);
}

/**
 * Returns a firebaseStorage.Reference for the given url.
 */
function refFromURL(service: StorageService, url: string): Reference {
  return new Reference(service, url);
}

/**
 * Returns a firebaseStorage.Reference for the given path in the default
 * bucket.
 */
function refFromPath(
  ref: StorageService | Reference,
  path?: string
): Reference | null {
  if (ref instanceof StorageService) {
    const service = ref;
    if (service.bucket_ == null) {
      throw errorsExports.noDefaultBucket();
    }
    const reference = new Reference(service, service.bucket_!);
    if (path != null) {
      return refFromPath(reference, path);
    } else {
      return reference;
    }
  } else {
    // ref is a Reference
    if (typeof path === 'string') {
      if (path.includes('..')) {
        throw errorsExports.invalidArgument(
          1,
          'ref',
          '`path` param cannot contain ".."'
        );
      }
      return getChild(ref, path);
    } else {
      return ref;
    }
  }
}

export function ref(storage: StorageService, url?: string): Reference;
export function ref(
  storageOrRef: StorageService | Reference,
  path?: string
): Reference;
/**
 * Returns a storage Reference for the given url, or given path in the
 * default bucket.
 * @param serviceOrRef - `Storage` instance or storage `Reference`.
 * @param pathOrUrlStorage - path, or URL. If empty, returns root reference (if Storage
 * instance provided) or returns same reference (if Reference provided).
 */
export function ref(
  serviceOrRef: StorageService | Reference,
  pathOrUrl?: string
): Reference | null {
  if (pathOrUrl && isUrl(pathOrUrl)) {
    if (serviceOrRef instanceof StorageService) {
      return refFromURL(serviceOrRef, pathOrUrl);
    } else {
      throw errorsExports.invalidArgument(
        0,
        'ref',
        'To use ref(service, url), the first argument must be a Storage instance.'
      );
    }
  } else if (pathOrUrl !== null) {
    if (
      serviceOrRef instanceof StorageService ||
      serviceOrRef instanceof Reference
    ) {
      return refFromPath(serviceOrRef, pathOrUrl);
    } else {
      throw errorsExports.invalidArgument(
        0,
        'ref',
        'To use ref(serviceOrRef, path), the first argument must be a Storage' +
          ' instance or Reference.'
      );
    }
  } else {
    // pathOrUrl param not provided
    if (serviceOrRef instanceof StorageService) {
      return refFromPath(serviceOrRef);
    } else {
      throw errorsExports.invalidArgument(
        0,
        'ref',
        'To get the root reference, a Storage instance must be provided as' +
          ' the param. Example: ref(storageInstance);'
      );
    }
  }
}

/**
 * A service that provides Firebase Storage Reference instances.
 * @param opt_url gs:// url to a custom Storage Bucket
 *
 * @struct
 */
export class StorageService {
  /**
   * @internal
   */
  app_: FirebaseApp | null;
  /**
   * @internal
   */
  readonly bucket_: Location | null = null;
  private readonly authProvider_: Provider<FirebaseAuthInternalName>;
  private readonly appId_: string | null = null;
  private readonly pool_: XhrIoPool;
  private readonly requests_: Set<Request<unknown>>;
  /**
   * @internal
   */
  deleted_: boolean = false;
  protected maxOperationRetryTime_: number;
  protected maxUploadRetryTime_: number;

  constructor(
    app: FirebaseApp | null,
    authProvider: Provider<FirebaseAuthInternalName>,
    pool: XhrIoPool,
    url?: string
  ) {
    this.app_ = app;
    this.authProvider_ = authProvider;
    this.maxOperationRetryTime_ = constants.DEFAULT_MAX_OPERATION_RETRY_TIME;
    this.maxUploadRetryTime_ = constants.DEFAULT_MAX_UPLOAD_RETRY_TIME;
    this.requests_ = new Set();
    this.pool_ = pool;
    if (url != null) {
      this.bucket_ = Location.makeFromBucketSpec(url);
    } else {
      this.bucket_ = StorageService.extractBucket_(this.app_?.options);
    }
  }

  private static extractBucket_(config?: FirebaseOptions): Location | null {
    const bucketString = config?.[constants.CONFIG_STORAGE_BUCKET_KEY];
    if (bucketString == null) {
      return null;
    }
    return Location.makeFromBucketSpec(bucketString);
  }

  async getAuthToken(): Promise<string | null> {
    const auth = this.authProvider_.getImmediate({ optional: true });
    if (auth) {
      const tokenData = await auth.getToken();
      if (tokenData !== null) {
        return tokenData.accessToken;
      }
    }
    return null;
  }

  /**
   * Stop running requests and prevent more from being created.
   * @internal
   */
  deleteApp(): void {
    this.deleted_ = true;
    this.app_ = null;
    this.requests_.forEach(request => request.cancel());
    this.requests_.clear();
  }

  /**
   * Returns a new firebaseStorage.Reference object referencing this StorageService
   * at the given Location.
   * @internal
   * @param loc - The Location.
   * @return A firebaseStorage.Reference.
   */
  makeStorageReference(loc: Location): Reference {
    return new Reference(this, loc);
  }

  /**
   * @internal
   * @param requestInfo
   * @param authToken
   */
  makeRequest<T>(
    requestInfo: RequestInfo<T>,
    authToken: string | null
  ): Request<T> {
    if (!this.deleted_) {
      const request = makeRequest(
        requestInfo,
        this.appId_,
        authToken,
        this.pool_
      );
      this.requests_.add(request);
      // Request removes itself from set when complete.
      request.getPromise().then(
        () => this.requests_.delete(request),
        () => this.requests_.delete(request)
      );
      return request;
    } else {
      return new FailRequest(errorsExports.appDeleted());
    }
  }

  get maxUploadRetryTime(): number {
    return this.maxUploadRetryTime_;
  }

  set maxUploadRetryTime(time: number) {
    this.maxUploadRetryTime_ = time;
  }

  get maxOperationRetryTime(): number {
    return this.maxOperationRetryTime_;
  }

  set maxOperationRetryTime(time: number) {
    this.maxOperationRetryTime_ = time;
  }

  get app(): FirebaseApp | null {
    return this.app_;
  }
}
