import { Head } from "./_includes/head.tsx";
import { Page, ViewProps } from "./_includes/viewprops.tsx";


export type IndexProps = {
  children?: JSX.Element;
  page: Page
};

export function Index(props: IndexProps): JSX.Element {
  return <html>
    <Head page={props.page} />
    <body>
      <p>Hello World</p>
    </body>
  </html>;
}

export function render(props: ViewProps): JSX.Element {
  return <Index page={props.page} />;
}
