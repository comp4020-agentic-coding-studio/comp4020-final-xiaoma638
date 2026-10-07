import { readFileSync } from "node:fs";
import { Marked } from "marked";
import type { PageServerLoad } from "./$types";

// README.md rendered in full on the server, so /readme/ reads the same with
// or without scripts. Relative image links (docs/x.png) resolve under
// /readme/, where the sibling route serves them.
const marked = new Marked();

export const trailingSlash = "always";

export const load: PageServerLoad = () => ({
  html: marked.parse(readFileSync("README.md", "utf8"), { async: false }),
});
