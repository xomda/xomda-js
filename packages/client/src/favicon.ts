import { type Ref, ref } from 'vue'

/**
 * Default favicon — material-symbols-light `wand-stars` glyph, inlined as a
 * data-URI SVG so the icon is self-contained (no extra HTTP fetch) and the
 * color can drift with the rest of the brand without touching a binary
 * asset. Matches the placeholder `PluginXomdaIcon` until a real brand mark
 * lands.
 *
 * Encoded as a `data:image/svg+xml;utf8,…` URI with reserved characters
 * percent-escaped (`#`, `<`, `>`, `"`); leaving them raw works in most
 * browsers but Firefox is occasionally pedantic about it.
 */
const DEFAULT_FAVICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#1867c0">' +
  '<path d="M4.708 20L4 19.292l7.736-7.742l-4.217-1.029L11.7 7.927L11.333 3l3.763 3.179l4.554-1.854l-1.829 4.56L21 12.641l-4.927-.342l-2.6 4.18l-1.048-4.216zm.58-13.192L4 5.519l1.289-1.288l1.288 1.288zM18.482 20l-1.289-1.288l1.289-1.289l1.288 1.289z"/>' +
  '</svg>'

function svgToDataUri(svg: string): string {
  return `data:image/svg+xml;utf8,${svg.replace(/#/g, '%23').replace(/"/g, "'")}`
}

/**
 * Reactive favicon href. AppMeta renders this as `<link rel="icon">` and
 * keeps the document head in sync — assigning a new value (a data URI or
 * URL) updates the browser tab icon live, no DOM surgery from the caller.
 */
export const favicon: Ref<string> = ref(svgToDataUri(DEFAULT_FAVICON_SVG))

/**
 * Convenience: set the favicon from a raw SVG string (will be wrapped into
 * a data URI). For URLs or already-data-URIs, assign `favicon.value`
 * directly.
 */
export function setFaviconSvg(svg: string): void {
  favicon.value = svgToDataUri(svg)
}
