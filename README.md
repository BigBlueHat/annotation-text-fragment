# annotation-text-fragment

Convert [Web Annotation](https://www.w3.org/TR/annotation-model/) `TextQuoteSelector`s into
[Text Fragment](https://wicg.github.io/scroll-to-text-fragment/) URLs (`#:~:text=prefix-,start,end,-suffix`), and parse them back.
Zero dependencies; ESM; browser and Node >= 18.

No existing library did this (see apache/incubator-annotator#60, which describes the idea without shipping it).

```js
import { textQuoteToUrl, annotationToUrl, urlToSelectors } from 'annotation-text-fragment';

textQuoteToUrl('https://example.com/a', { type: 'TextQuoteSelector', exact: 'brown fox', prefix: 'quick ', suffix: ' jumps' });
// https://example.com/a#:~:text=quick-,brown%20fox,-jumps

annotationToUrl(annotation);   // first target with a TextQuoteSelector, or null
urlToSelectors(url);           // text directives -> TextQuoteSelector / RangeSelector
```

Also exported: `textQuoteToDirective(selector)` (just the `text=...` term) and `parseTextDirectives(url)`.
Existing `#fragment` and `:~:` directives on the URL are preserved; multiple selectors become `&text=` terms.

## Behaviour

- `-`, `,` and `&` are percent-encoded as the spec requires (`encodeURIComponent` misses `-`).
- Text is NFC-normalized by default (`normalize: false` to disable). Lone surrogates are made well-formed.
- A newline in `exact`/`prefix`/`suffix` marks a block boundary, which one term cannot span: `exact` becomes `textStart,textEnd`; context is cut at the boundary.
- `exact` longer than `maxLength` (300) becomes `start,end` using ~`edgeLength` (50) characters at each end; `prefix`/`suffix` are trimmed to `maxContext` (64).
- Cuts fall on word boundaries via `Intl.Segmenter` (so CJK/Thai work), with a whitespace fallback. Pass `locale` as a hint.

## Limits worth knowing

- Text fragments match on word boundaries and are browser-defined; they can't express arbitrary character ranges.
- Matching is the browser's: this library doesn't fold diacritics, tatweel, or Arabic letter variants (see the Arabic example in the
  [i18n gist](https://gist.github.com/BigBlueHat/22fac5551c6ad9a68978cbecd8eca07d)), so the quote must match the page's text.
- `start,end` matches the first `end` after the first `start`; keep `prefix` to disambiguate.
- Without the document, a RangeSelector from `urlToSelectors` is only an approximation of how the browser would anchor it.
- Browser support for text fragments varies; detect with `'fragmentDirective' in document`.

`npm test` runs the tests.
