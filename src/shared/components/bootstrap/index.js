
import React, {Component} from 'react';
import {Checkbox as OldCheckbox, Radio as OldRadio} from 'react-bootstrap';

export * from 'react-bootstrap';

export class Checkbox extends Component {
  constructor(props, context) {
    super(props, context);
  }
  render() {
    const props = Object.assign({}, this.props);
    const children = props.children;
    delete props.children;
    return (
      <OldCheckbox {...props}><span></span> {children}</OldCheckbox>
    );
  }
}

export class Radio extends Component {
  constructor(props, context) {
    super(props, context);
  }
  render() {
    const props = Object.assign({}, this.props);
    const children = props.children;
    delete props.children;
    return (
      <OldRadio {...props}><span></span> {children}</OldRadio>
    );
  }
}
