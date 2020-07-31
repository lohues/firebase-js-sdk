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

!(function (e, t) {
  'object' == typeof exports && 'undefined' != typeof module
    ? t(exports, require('@firebase/firestore/lite'))
    : 'function' == typeof define && define.amd
    ? define(['exports', '@firebase/firestore/lite'], t)
    : t(
        (((e = e || self).firebase = e.firebase || {}),
        (e.firebase['firestore/lite'] = e.firebase['firestore/lite'] || {})),
        e.lite
      );
})(this, function (t, r) {
  'use strict';
  try {
    (function () {
      Object.keys(r).forEach(function (e) {
        'default' !== e &&
          Object.defineProperty(t, e, {
            enumerable: !0,
            get: function () {
              return r[e];
            }
          });
      }),
        Object.defineProperty(t, '__esModule', { value: !0 });
    }.apply(this, arguments));
  } catch (e) {
    throw (
      (console.error(e),
      new Error(
        'Cannot instantiate firebase-firestore/lite.js - be sure to load firebase-app.js first.'
      ))
    );
  }
});
//# sourceMappingURL=lite.js.map
