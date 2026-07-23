declare module 'react-test-renderer' {
  import type { ReactElement } from 'react';

  export interface ReactTestRenderer {
    unmount: () => void;
  }

  export const act: (callback: () => void | Promise<void>) => Promise<void>;
  export const create: (element: ReactElement) => ReactTestRenderer;

  const TestRenderer: {
    act: typeof act;
    create: typeof create;
  };

  export default TestRenderer;
}
