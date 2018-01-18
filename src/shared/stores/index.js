import React, { Component } from 'react';
import ReactDOM from 'react-dom'
import 'store/configureStore'; //eslint-disable-line import/default

import { Provider } from 'mobx-react';
import createHistory from 'history/createBrowserHistory'
import { Route, Router } from 'react-router'

// actions
// Store
import { syncHistoryWithStore } from 'mobx-react-router';
import { inject, observer } from 'mobx-react';

import { rehydrate, hotRehydrate, store } from 'rfx-core';

import * as stores from './stores';
