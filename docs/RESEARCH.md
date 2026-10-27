# Research notes

Question: is there a JS library (browser + Node) that turns a Web Annotation
`TextQuoteSelector` into a URL Text Fragment directive URL? If not, build one.

## Prior art search (2026-10-27)

- A web search for an npm package doing selector -> text fragment found nothing.
  Results were only the spec, MDN, explainers and polyfills (e.g. `fragment-directives`
  by eligrey, which exposes the `fragmentDirective` API rather than converting selectors).
- [apache/incubator-annotator#60](https://github.com/apache/incubator-annotator/issues/60)
  ("Implement Chromium/WICG's Text Fragment specification", open, repo archived 2025-08-13):
  - Started as "implement a parser"; broadened after the 2020-11-05 team call.
  - Parsing alone has little value because fragment matching differs from the Web Annotation model.
  - Four options were listed: anchor a directive; **describe a selection as a directive**
    (adapt `describeTextQuote`, keep prefix/suffix on word boundaries, use `textStart,textEnd`
    across block elements); directive -> selector; selector -> directive without a document.
  - Treora's [text-fragments-ts](https://code.treora.com/gerben/text-fragments-ts) implements the
    *resolution* algorithm only.
  - A directive `start,end` maps to a `RangeSelector` of two `TextQuoteSelector`s; a `RangeSelector`
    end is exclusive, so the end text goes in a prefix with an empty exact (noted, not applied here).
  - Pitfalls: word-level granularity only; spec was unstable; converting without the document can
    anchor to the wrong text.
- Conclusion: the selector -> directive conversion was discussed but never shipped. Build it.

## i18n input

[BigBlueHat's gist](https://gist.github.com/BigBlueHat/22fac5551c6ad9a68978cbecd8eca07d) shows an
Arabic `TextQuoteSelector` (with `@language`/`@direction`) whose `@id` is a percent-encoded text
fragment URL. Concerns drawn from it:

- Non-ASCII text must be percent-encoded (UTF-8) and still round-trip.
- Matching is exact: Unicode normalization (NFC vs NFD), diacritics, tatweel and letter variants can
  break a match. We normalize to NFC by default and document that we do not fold the rest.
- Word boundaries cannot assume spaces (CJK, Thai), so use `Intl.Segmenter`.
- Bidi text mixes badly with LTR URLs in display; percent-encoding keeps the URL ASCII.

## Spec details that shaped the design

- Syntax: `#:~:text=[prefix-,]start[,end][,-suffix]`; multiple directives joined with `&`.
- `-`, `,` and `&` must be percent-encoded in terms. `encodeURIComponent` leaves `-` alone.
- A term cannot span block boundaries, so multi-block quotes use `start,end`.
- Existing fragments: directive goes after `:~:`; an existing directive gets `&text=` appended.
