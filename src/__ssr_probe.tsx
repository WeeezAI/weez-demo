// TEMPORARY diagnostic probe — renders the landing page in Node to surface any
// module-init / render-time exception that shows up as a white screen.
// Deleted after use.
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import Landing from "./pages/Landing";

export function probe() {
  const html = renderToString(
    <MemoryRouter initialEntries={["/"]}>
      <Landing />
    </MemoryRouter>
  );
  return html.length;
}
