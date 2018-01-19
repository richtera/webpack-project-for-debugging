import 'babel-polyfill';
import {List, Map, Set, OrderedMap} from 'immutable';
//import ReactLoading from 'react-loading/lib/react-loading';

// Setup what we need of the rxjs system.
import { Observable } from 'rxjs/Observable';
import { mergeMap } from 'rxjs/operator/mergeMap';
import { take } from 'rxjs/operator/take';
import { map } from 'rxjs/operator/map';
import { mapTo } from 'rxjs/operator/mapTo';
import { takeUntil } from 'rxjs/operator/takeUntil';
import { race } from 'rxjs/operator/race';
import { filter } from 'rxjs/operator/filter';
import { of } from 'rxjs/observable/of';
import { race as Srace } from 'rxjs/observable/of';
import { inject, observer } from 'mobx-react';

Object.assign(ReactLoading.defaultProps, {
  type: 'bubbles',
  color: '#2196f3'
});

if (process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'test') {
  if (window.rg4js) {
    window.rg4js('apiKey', process.env.RAYGUN_API_KEY);
    window.rg4js('enableCrashReporting', true);
    window.rg4js('enablePulse', true);
    window.rg4js('setVersion', process.env.RELEASE_ENV);
    const beforeSend = function(payload) {
        const stacktrace = payload.Details.Error.StackTrace;

        const normalizeFilename = function(filename) {
            const indexOfJsRoot = filename.indexOf("js");
            return 'https://ss-admin.selfstudy.plus/assets/' + filename.substring(indexOfJsRoot);
        }

        for(var i = 0 ; i < stacktrace.length; i++) {
            var stackline = stacktrace[i];
            stackline.FileName = normalizeFilename(stackline.FileName);
        }
        return payload;
    }
    window.rg4js('onBeforeSend', beforeSend);
  }
}
