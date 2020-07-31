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
import { assert } from 'chai';
import { FirebaseApp } from '@firebase/app-types';
import { StringFormat } from '../../src/implementation/string';
import { Headers } from '../../src/implementation/xhrio';
import { Metadata } from '../../src/metadata';
import {
  Reference,
  uploadString,
  uploadBytes,
  deleteObject,
  listAll,
  list,
  getMetadata,
  updateMetadata,
  getParent as parentReference,
  getDownloadURL
} from '../../src/reference';
import { StorageService, ref } from '../../src/service';
import * as testShared from './testshared';
import { SendHook, TestingXhrIo } from './xhrio';
import { DEFAULT_HOST } from '../../src/implementation/constants';
import { FirebaseAuthInternalName } from '@firebase/auth-interop-types';
import { Provider } from '@firebase/component';

/* eslint-disable @typescript-eslint/no-floating-promises */
function makeFakeService(
  app: FirebaseApp,
  authProvider: Provider<FirebaseAuthInternalName>,
  sendHook: SendHook
): StorageService {
  return new StorageService(app, authProvider, testShared.makePool(sendHook));
}

function makeStorage(url: string): Reference {
  const service = new StorageService(
    null,
    testShared.emptyAuthProvider,
    testShared.makePool(null)
  );
  return new Reference(service, url);
}

describe('Firebase Storage > Reference', () => {
  const root = makeStorage('gs://test-bucket/');
  const child = makeStorage('gs://test-bucket/hello');
  describe('Path constructor', () => {
    it('root', () => {
      assert.equal(root.toString(), 'gs://test-bucket/');
    });
    it('keeps characters after ? on a gs:// string', () => {
      const s = makeStorage('gs://test-bucket/this/ismyobject?hello');
      assert.equal(s.toString(), 'gs://test-bucket/this/ismyobject?hello');
    });
    it("doesn't URL-decode on a gs:// string", () => {
      const s = makeStorage('gs://test-bucket/%3F');
      assert.equal(s.toString(), 'gs://test-bucket/%3F');
    });
    it('ignores URL params and fragments on an http URL', () => {
      const s = makeStorage(
        `http://${DEFAULT_HOST}/v0/b/test-bucket/o/my/object.txt` +
          '?ignoreme#please'
      );
      assert.equal(s.toString(), 'gs://test-bucket/my/object.txt');
    });
    it('URL-decodes and ignores fragment on an http URL', () => {
      const s = makeStorage(
        `http://${DEFAULT_HOST}/v0/b/test-bucket/o/%3F?ignore`
      );
      assert.equal(s.toString(), 'gs://test-bucket/?');
    });

    it('ignores URL params and fragments on an https URL', () => {
      const s = makeStorage(
        `https://${DEFAULT_HOST}/v0/b/test-bucket/o/my/object.txt` +
          '?ignoreme#please'
      );
      assert.equal(s.toString(), 'gs://test-bucket/my/object.txt');
    });

    it('URL-decodes and ignores fragment on an https URL', () => {
      const s = makeStorage(
        `https://${DEFAULT_HOST}/v0/b/test-bucket/o/%3F?ignore`
      );
      assert.equal(s.toString(), 'gs://test-bucket/?');
    });
  });

  describe('toString', () => {
    it("Doesn't add trailing slash", () => {
      const s = makeStorage('gs://test-bucket/foo');
      assert.equal(s.toString(), 'gs://test-bucket/foo');
    });
    it('Strips trailing slash', () => {
      const s = makeStorage('gs://test-bucket/foo/');
      assert.equal(s.toString(), 'gs://test-bucket/foo');
    });
  });

  describe('parentReference', () => {
    it('Returns null at root', () => {
      assert.isNull(parentReference(root));
    });
    it('Returns root one level down', () => {
      assert.equal(parentReference(child)!.toString(), 'gs://test-bucket/');
    });
    it('Works correctly with empty levels', () => {
      const s = makeStorage('gs://test-bucket/a///');
      assert.equal(parentReference(s)!.toString(), 'gs://test-bucket/a/');
    });
  });

  describe('root', () => {
    it('Returns self at root', () => {
      assert.equal(root.root.toString(), 'gs://test-bucket/');
    });

    it('Returns root multiple levels down', () => {
      const s = makeStorage('gs://test-bucket/a/b/c/d');
      assert.equal(s.root.toString(), 'gs://test-bucket/');
    });
  });

  describe('bucket', () => {
    it('Returns bucket name', () => {
      assert.equal(root.bucket, 'test-bucket');
    });
  });

  describe('fullPath', () => {
    it('Returns full path without leading slash', () => {
      const s = makeStorage('gs://test-bucket/full/path');
      assert.equal(s.fullPath, 'full/path');
    });
  });

  describe('name', () => {
    it('Works at top level', () => {
      const s = makeStorage('gs://test-bucket/toplevel.txt');
      assert.equal(s.name, 'toplevel.txt');
    });

    it('Works at not the top level', () => {
      const s = makeStorage('gs://test-bucket/not/toplevel.txt');
      assert.equal('toplevel.txt', s.name);
    });
  });

  describe('get child with ref()', () => {
    it('works with a simple string', () => {
      assert.equal(ref(root, 'a').toString(), 'gs://test-bucket/a');
    });
    it('drops a trailing slash', () => {
      assert.equal(ref(root, 'ab/').toString(), 'gs://test-bucket/ab');
    });
    it('compresses repeated slashes', () => {
      assert.equal(
        ref(root, '//a///b/////').toString(),
        'gs://test-bucket/a/b'
      );
    });
    it('works chained multiple times with leading slashes', () => {
      assert.equal(
        ref(ref(ref(ref(root, 'a'), '/b'), 'c'), 'd/e').toString(),
        'gs://test-bucket/a/b/c/d/e'
      );
    });
  });

  it("Doesn't send Authorization on null auth token", done => {
    function newSend(
      xhrio: TestingXhrIo,
      url: string,
      method: string,
      body?: ArrayBufferView | Blob | string | null,
      headers?: Headers
    ): void {
      assert.isDefined(headers);
      assert.isUndefined(headers!['Authorization']);
      done();
    }

    const service = makeFakeService(
      testShared.fakeApp,
      testShared.emptyAuthProvider,
      newSend
    );
    const reference = ref(service, 'gs://test-bucket');
    getMetadata(ref(reference, 'foo'));
  });

  it('Works if the user logs in before creating the storage reference', done => {
    // Regression test for b/27227221
    function newSend(
      xhrio: TestingXhrIo,
      url: string,
      method: string,
      body?: ArrayBufferView | Blob | string | null,
      headers?: Headers
    ): void {
      assert.isDefined(headers);
      assert.equal(
        headers!['Authorization'],
        'Firebase ' + testShared.authToken
      );
      done();
    }

    const service = makeFakeService(
      testShared.fakeApp,
      testShared.fakeAuthProvider,
      newSend
    );
    const reference = ref(service, 'gs://test-bucket');
    getMetadata(ref(reference, 'foo'));
  });

  describe('uploadString', () => {
    it('Uses metadata.contentType for RAW format', () => {
      // Regression test for b/30989476
      const task = uploadString(child, 'hello', StringFormat.RAW, {
        contentType: 'lol/wut'
      } as Metadata);
      assert.equal(task.snapshot.metadata!.contentType, 'lol/wut');
      task.cancel();
    });
    it('Uses embedded content type in DATA_URL format', () => {
      const task = uploadString(
        child,
        'data:lol/wat;base64,aaaa',
        StringFormat.DATA_URL
      );
      assert.equal(task.snapshot.metadata!.contentType, 'lol/wat');
      task.cancel();
    });
    it('Lets metadata.contentType override embedded content type in DATA_URL format', () => {
      const task = uploadString(
        child,
        'data:ignore/me;base64,aaaa',
        StringFormat.DATA_URL,
        { contentType: 'tomato/soup' } as Metadata
      );
      assert.equal(task.snapshot.metadata!.contentType, 'tomato/soup');
      task.cancel();
    });
  });

  describe('Argument verification', () => {
    describe('uploadBytes', () => {
      const blob = new Blob(['a']);
      it('throws on number instead of metadata', () => {
        testShared.assertThrows(
          testShared.bind(uploadBytes, child, new Blob([]), 3),
          'storage/invalid-argument'
        );
      });
      it('throws on number instead of data', () => {
        testShared.assertThrows(
          testShared.bind(uploadBytes, child, 3),
          'storage/invalid-argument'
        );
      });
      it('throws on null instead of data', () => {
        testShared.assertThrows(
          testShared.bind(uploadBytes, child, null),
          'storage/invalid-argument'
        );
      });
      it("doesn't throw on good metadata", () => {
        const goodMetadata = {
          md5Hash: 'a',
          cacheControl: 'done',
          contentDisposition: 'legit',
          contentEncoding: 'identity',
          contentLanguage: 'en',
          contentType: 'text/legit'
        };
        assert.doesNotThrow(() => {
          const task = uploadBytes(child, blob, goodMetadata as Metadata);
          task.cancel();
        });
      });
      it('throws when customMetadata is a string instead of an object', () => {
        const badCustomMetadata = {
          md5Hash: 'a',
          cacheControl: 'done',
          contentDisposition: 'legit',
          contentEncoding: 'identity',
          contentLanguage: 'en',
          contentType: 'text/legit',
          customMetadata: 'yo'
        };
        testShared.assertThrows(
          testShared.bind(uploadBytes, child, blob, badCustomMetadata),
          'storage/invalid-argument'
        );
      });
      it('throws when object is supplied instead of string', () => {
        const objectInsteadOfStringInMetadata = {
          md5Hash: { real: 'hash' },
          cacheControl: 'done',
          contentDisposition: 'legit',
          contentEncoding: 'identity',
          contentLanguage: 'en',
          contentType: 'text/legit'
        };
        testShared.assertThrows(
          testShared.bind(
            uploadBytes,
            child,
            blob,
            objectInsteadOfStringInMetadata
          ),
          'storage/invalid-argument'
        );
      });
    });

    describe('uploadString', () => {
      it('throws on no arguments', () => {
        testShared.assertThrows(
          testShared.bind(uploadString, child, child),
          'storage/invalid-argument'
        );
      });
      it('throws on invalid format', () => {
        testShared.assertThrows(
          testShared.bind(uploadString, child, child, 'raw', 'notaformat'),
          'storage/invalid-argument'
        );
      });
      it('throws on number instead of string', () => {
        testShared.assertThrows(
          testShared.bind(uploadString, child, child, 3, StringFormat.RAW),
          'storage/invalid-argument'
        );
      });
      it('throws on invalid metadata', () => {
        testShared.assertThrows(
          testShared.bind(
            uploadString,
            child,
            child,
            'raw',
            StringFormat.RAW,
            3
          ),
          'storage/invalid-argument'
        );
      });
    });

    describe('list', () => {
      it('throws on invalid option', () => {
        testShared.assertThrows(
          testShared.bind(list, child, child, 'invalid-option'),
          'storage/invalid-argument'
        );
      });
      it('throws on number arg', () => {
        testShared.assertThrows(
          testShared.bind(list, child, child, 1, 2),
          'storage/invalid-argument'
        );
      });
      it('throws on non-string pageToken', () => {
        testShared.assertThrows(
          testShared.bind(list, child, child, { pageToken: { x: 1 } }),
          'storage/invalid-argument'
        );
      });
      it('throws on non-int maxResults', () => {
        testShared.assertThrows(
          testShared.bind(list, child, child, { maxResults: '4' }),
          'storage/invalid-argument'
        );
        testShared.assertThrows(
          testShared.bind(list, child, child, { maxResults: 1.2 }),
          'storage/invalid-argument'
        );
      });
      it('throws on invalid maxResults', () => {
        testShared.assertThrows(
          testShared.bind(list, child, child, { maxResults: 0 }),
          'storage/invalid-argument'
        );
        testShared.assertThrows(
          testShared.bind(list, child, child, { maxResults: -4 }),
          'storage/invalid-argument'
        );
        testShared.assertThrows(
          testShared.bind(list, child, child, { maxResults: 1001 }),
          'storage/invalid-argument'
        );
      });
      it('throws on unknown option', () => {
        testShared.assertThrows(
          testShared.bind(list, child, child, { unknown: 'ok' }),
          'storage/invalid-argument'
        );
      });
    });

    describe('updateMetadata', () => {
      it('throws on no args', () => {
        testShared.assertThrows(
          testShared.bind(updateMetadata, child, child),
          'storage/invalid-argument'
        );
      });
      it('throws on number arg', () => {
        testShared.assertThrows(
          testShared.bind(updateMetadata, child, child, 3),
          'storage/invalid-argument'
        );
      });
      it('throws on null arg', () => {
        testShared.assertThrows(
          testShared.bind(updateMetadata, child, child, null),
          'storage/invalid-argument'
        );
      });
    });
  });

  describe('non-root operations', () => {
    it("put doesn't throw", () => {
      assert.doesNotThrow(() => {
        uploadBytes(child, new Blob(['a']));
        uploadBytes(child, new Uint8Array(10));
        uploadBytes(child, new ArrayBuffer(10));
      });
    });
    it("uploadString doesn't throw", () => {
      assert.doesNotThrow(() => {
        uploadString(child, 'raw', StringFormat.RAW);
        uploadString(child, 'aaaa', StringFormat.BASE64);
        uploadString(child, 'aaaa', StringFormat.BASE64URL);
        uploadString(
          child,
          'data:application/octet-stream;base64,aaaa',
          StringFormat.DATA_URL
        );
      });
    });
    it("delete doesn't throw", () => {
      assert.doesNotThrow(() => {
        deleteObject(child);
      });
    });
    it("getMetadata doesn't throw", () => {
      assert.doesNotThrow(() => {
        getMetadata(child);
      });
    });
    it("listAll doesn't throw", () => {
      assert.doesNotThrow(() => {
        listAll(child);
      });
    });
    it("list doesn't throw", () => {
      assert.doesNotThrow(() => {
        list(child);
      });
      assert.doesNotThrow(() => {
        list(child, { pageToken: 'xxx', maxResults: 4 });
      });
      assert.doesNotThrow(() => {
        list(child, { pageToken: 'xxx' });
      });
      assert.doesNotThrow(() => {
        list(child, { maxResults: 4 });
      });
      assert.doesNotThrow(() => {
        list(child, { maxResults: 4, pageToken: null });
      });
    });
    it("updateMetadata doesn't throw", () => {
      assert.doesNotThrow(() => {
        updateMetadata(child, {} as Metadata);
      });
    });
    it("getDownloadURL doesn't throw", () => {
      assert.doesNotThrow(() => {
        getDownloadURL(child);
      });
    });
  });

  describe('root operations', () => {
    it('uploadBytes throws', () => {
      testShared.assertThrows(
        uploadBytes.bind(root, root, new Blob(['a'])),
        'storage/invalid-root-operation'
      );
    });
    it('uploadString throws', () => {
      testShared.assertThrows(
        uploadString.bind(root, root, 'raw', StringFormat.RAW),
        'storage/invalid-root-operation'
      );
    });
    it('deleteObject throws', () => {
      testShared.assertThrows(
        deleteObject.bind(root, root),
        'storage/invalid-root-operation'
      );
    });
    it('getMetadata throws', () => {
      testShared.assertThrows(
        getMetadata.bind(root, root),
        'storage/invalid-root-operation'
      );
    });
    it("listAll doesn't throw", () => {
      assert.doesNotThrow(() => {
        listAll(root);
      });
    });
    it("list doesn't throw", () => {
      assert.doesNotThrow(() => {
        list(root);
      });
      assert.doesNotThrow(() => {
        list(root, { pageToken: 'xxx', maxResults: 4 });
      });
    });
    it('updateMetadata throws', () => {
      testShared.assertThrows(
        updateMetadata.bind(root, root, {} as Metadata),
        'storage/invalid-root-operation'
      );
    });
    it('getDownloadURL throws', () => {
      testShared.assertThrows(
        getDownloadURL.bind(root, root),
        'storage/invalid-root-operation'
      );
    });
  });
});
