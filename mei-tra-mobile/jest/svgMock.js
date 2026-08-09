/**
 * react-native's jest-preset maps `.svg` to assetFileTransformer, which returns
 * `{ uri }` — not a component. Tests that touch the card registry need a real
 * component, so map `.svg` here instead.
 */
const React = require('react');

const SvgMock = React.forwardRef((props, ref) =>
  React.createElement('SvgMock', { ...props, ref }),
);
SvgMock.displayName = 'SvgMock';

module.exports = SvgMock;
module.exports.default = SvgMock;
module.exports.ReactComponent = SvgMock;
