import { createHighlighterCore, type HighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import rust from "@shikijs/langs/rust";
import c from "@shikijs/langs/c";
import cpp from "@shikijs/langs/cpp";
import python from "@shikijs/langs/python";
import darkPlus from "@shikijs/themes/dark-plus";

export interface HighlightToken {
  content: string;
  color: string;
}

// Fine-grained bundle (Rust, C, C++ + the real VS Code Dark+ theme, WASM-free
// JS regex engine) -- same reasoning as the renderer's highlightSource.ts:
// avoids pulling in Shiki's full ~200-language registry and avoids WASM
// asset loading entirely.
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
    themes: [darkPlus],
    langs: [rust, c, cpp, python],
    engine: createJavaScriptRegexEngine(),
  });
  return highlighterPromise;
}

/**
 * Highlights a whole file once and returns per-line color tokens, ready to
 * render as nested Ink <Text color="#hex"> spans. Falls back to undefined
 * for unsupported languages (only Rust matters for this POC's lldb-dap
 * target) so callers can render plain text instead.
 */
export async function highlightToTokenLines(
  code: string,
  sourcePath: string,
): Promise<HighlightToken[][] | undefined> {
  const lang = languageForPath(sourcePath);
  if (!lang) return undefined;

  const highlighter = await getHighlighter();
  return highlighter.codeToTokensBase(code, {
    lang,
    theme: "dark-plus",
  }) as HighlightToken[][];
}
