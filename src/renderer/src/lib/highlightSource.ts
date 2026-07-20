import {
  createHighlighterCore,
  createCssVariablesTheme,
  type HighlighterCore,
} from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import rust from "@shikijs/langs/rust";
import c from "@shikijs/langs/c";
import cpp from "@shikijs/langs/cpp";
import python from "@shikijs/langs/python";

const CSS_VARIABLES_THEME = createCssVariablesTheme({
  name: "css-variables",
  variablePrefix: "--shiki-",
  fontStyle: true,
});

// Fine-grained bundle: only the languages explicitly imported above get
// bundled. Using shiki's top-level `createHighlighter` instead pulls in its
// full ~200-language registry as reachable dynamic imports, which Vite then
// code-splits into hundreds of unused chunks. Add more `@shikijs/langs/*`
// imports here if this POC ever grows beyond Rust/lldb-dap.
const EXTENSION_TO_LANG: Record<string, string> = {
  rs: "rust",
  c: "c",
  cpp: "cpp",
  cc: "cpp",
  cxx: "cpp",
  h: "c",
  hpp: "cpp",
  py: "python",
};

function languageForPath(path: string): string | undefined {
  const ext = path.split(".").pop()?.toLowerCase();
  return ext ? EXTENSION_TO_LANG[ext] : undefined;
}

let highlighterPromise: Promise<HighlighterCore> | undefined;

function getHighlighter(): Promise<HighlighterCore> {
  highlighterPromise ??= createHighlighterCore({
    themes: [CSS_VARIABLES_THEME],
    langs: [rust, c, cpp, python],
    // WASM-free: avoids depending on WASM asset loading working correctly
    // inside Electron's sandboxed renderer, at a negligible accuracy cost
    // for highlighting a single small file.
    engine: createJavaScriptRegexEngine(),
  });
  return highlighterPromise;
}

/**
 * Highlights a whole file once and splits the result back into one HTML
 * string per line (Shiki wraps each source line in its own <span
 * class="line">), so SourcePanel can drop each line's markup straight into
 * its existing per-line gutter row. Falls back to plain escaped text for
 * unsupported languages (only Rust matters for this POC's lldb-dap target,
 * but this degrades gracefully rather than throwing for anything else).
 */
export async function highlightToLines(
  code: string,
  sourcePath: string,
): Promise<string[] | undefined> {
  const lang = languageForPath(sourcePath);
  if (!lang) return undefined;

  const highlighter = await getHighlighter();
  const html = highlighter.codeToHtml(code, { lang, theme: "css-variables" });

  const doc = new DOMParser().parseFromString(html, "text/html");
  const lineNodes = doc.querySelectorAll(".line");
  return Array.from(lineNodes, (node) => node.innerHTML);
}
