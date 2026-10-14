import { Page } from "./ViewProps.js";

export type HeadProps = {
  page: Page
};

export function Head(props: HeadProps): JSX.Element {
  return <head>
    <title>My test page</title>
  </head>;
}