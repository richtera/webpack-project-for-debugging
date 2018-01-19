// modules
import { bootup } from 'stores';

import 'babel-polyfill';
import classnames from 'classnames';
import {Route, Redirect, Switch} from 'react-router';
import ReactDOM from 'react-dom';
import { Link } from 'react-router';
import PropTypes from 'prop-types';
import { Line, Circle } from 'rc-progress';
import moment from 'moment';
import _ from 'lodash';
// import { Sparklines, SparklinesLine } from 'react-sparklines';
//import ReactLoading from 'react-loading/lib/react-loading';
import { FormControl, Checkbox, FormGroup, Button, Navbar, Nav, NavItem , Header } from 'components/bootstrap';
import { Map, List, OrderedMap, Set, fromJS } from 'immutable';
import { SearchBox, RefinementListFilter, Hits, HitsStats, SearchkitComponent, SelectedFilters,
  MenuFilter, HierarchicalMenuFilter, Pagination, ResetFilters, ESTransport,
  SearchkitManager, SortingSelector, NoHits,
  RangeFilter, NumericRefinementListFilter,
  ViewSwitcherHits, ViewSwitcherToggle, DynamicRangeFilter,
  InputFilter, GroupedSelectedFilters,
  Layout, TopBar, LayoutBody, LayoutResults,
  ActionBar, ActionBarRow, SideBar, QueryString, SimpleQueryString, CheckboxFilter,
  FilteredQuery, MatchQuery, TermQuery, BoolMust, NestedQuery, QueryAccessor } from "searchkit";
import 'whatwg-fetch';
import { assign, extend } from 'lodash'
import { inject, observer } from 'mobx-react';

import '../shared';
import '../react-draft-wysiwyg/src/Editor';
import '../teach/index';
import styles from '../shared/styles-global/index';