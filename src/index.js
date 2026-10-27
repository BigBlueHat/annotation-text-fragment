// Convert Web Annotation TextQuoteSelectors to URL Text Fragment directives
// (https://wicg.github.io/scroll-to-text-fragment/) and back.
//
// Works in browsers and Node (>= 18) with no dependencies. Word boundaries are
// found with Intl.Segmenter when available, so scripts written without spaces
// (Chinese, Japanese, Thai...) are handled; otherwise whitespace is used.

const DEFAULTS = {
  maxContext: 64, // max characters of prefix / suffix to keep
  maxLength: 300, // exact longer than this becomes textStart,textEnd
  edgeLength: 50, // approx. characters kept at each end of a long exact
  normalize: 'NFC', // Unicode normalization form, or false to leave as-is
  locale: undefined, // BCP 47 tag hint for word segmentation
};

// Percent-encode a directive term. The spec requires '-', ',' and '&' to be
// encoded because they are delimiters; encodeURIComponent misses '-'.
function encodeTerm(text) {
  const wellFormed = text.toWellFormed ? text.toWellFormed() : text;
  return encodeURIComponent(wellFormed).replace(/-/g, '%2D');
}

function segment(text, locale) {
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter(locale, { granularity: 'word' });
    return Array.from(segmenter.segment(text), (s) => ({
      start: s.index,
      end: s.index + s.segment.length,
      wordLike: Boolean(s.isWordLike),
    }));
  }
  const out = [];
  const re = /\S+|\s+/g;
  let m;
  while ((m = re.exec(text))) {
    out.push({ start: m.index, end: m.index + m[0].length, wordLike: /\S/.test(m[0]) });
  }
  return out;
}

// Leading part of `text` (about `n` chars) ending on a whole word.
function head(text, n, locale) {
  if (text.length <= n) return text;
  let end = -1;
  for (const s of segment(text, locale)) {
    if (!s.wordLike) continue;
    if (end === -1 || s.end <= n) end = s.end;
    if (s.end > n) break;
  }
  return text.slice(0, end).trim();
}

// Trailing part of `text` (about `n` chars) starting on a whole word.
function tail(text, n, locale) {
  if (text.length <= n) return text;
  let start = -1;
  const segs = segment(text, locale);
  for (let i = segs.length - 1; i >= 0; i--) {
    const s = segs[i];
    if (!s.wordLike) continue;
    if (start === -1 || s.start >= text.length - n) start = s.start;
    if (s.start < text.length - n) break;
  }
  return text.slice(start).trim();
}

function clean(text, form) {
  if (typeof text !== 'string') return '';
  return form ? text.normalize(form) : text;
}

const collapse = (s) => s.replace(/[^\S\n]+/g, ' ');

/**
 * Build the `text=` directive (without '#:~:' or '&') for a TextQuoteSelector.
 * Throws if the selector has no usable `exact` text.
 */
export function textQuoteToDirective(selector, options = {}) {
  const o = { ...DEFAULTS, ...options };
  if (!selector || selector.type !== 'TextQuoteSelector') {
    throw new TypeError('Expected a TextQuoteSelector');
  }

  // Newlines mark block boundaries, which a single term cannot span: use the
  // first and last block as textStart and textEnd instead.
  const blocks = collapse(clean(selector.exact, o.normalize))
    .split(/ ?\n\s*/)
    .map((b) => b.trim())
    .filter(Boolean);
  if (!blocks.length) throw new Error('TextQuoteSelector has no exact text');

  let start = blocks[0];
  let end = blocks.length > 1 ? blocks[blocks.length - 1] : undefined;
  if (!end && start.length > o.maxLength) {
    const whole = start;
    start = head(whole, o.edgeLength, o.locale);
    end = tail(whole, o.edgeLength, o.locale);
  } else if (end || start.length > o.maxLength) {
    start = head(start, o.maxLength, o.locale);
    if (end) end = tail(end, o.maxLength, o.locale);
  }

  // Context can't cross a block boundary either.
  const prefixText = collapse(clean(selector.prefix, o.normalize)).split('\n').pop().trim();
  const suffixText = collapse(clean(selector.suffix, o.normalize)).split('\n')[0].trim();
  const prefix = prefixText && tail(prefixText, o.maxContext, o.locale);
  const suffix = suffixText && head(suffixText, o.maxContext, o.locale);

  const terms = [];
  if (prefix) terms.push(encodeTerm(prefix) + '-');
  terms.push(encodeTerm(start));
  if (end) terms.push(encodeTerm(end));
  if (suffix) terms.push('-' + encodeTerm(suffix));
  return 'text=' + terms.join(',');
}

/**
 * Add text directive(s) for one or more TextQuoteSelectors to a URL.
 * Non-TextQuoteSelectors are ignored. Existing fragments and directives on the
 * URL are preserved.
 */
export function textQuoteToUrl(url, selectors, options = {}) {
  const list = [].concat(selectors).filter((s) => s && s.type === 'TextQuoteSelector');
  if (!list.length) return String(url);
  const directives = list.map((s) => textQuoteToDirective(s, options)).join('&');

  const str = String(url);
  const hashAt = str.indexOf('#');
  if (hashAt === -1) return `${str}#:~:${directives}`;
  const base = str.slice(0, hashAt);
  const hash = str.slice(hashAt);
  return hash.includes(':~:') ? `${base}${hash}&${directives}` : `${base}${hash}:~:${directives}`;
}

/**
 * Build a text fragment URL for an annotation's first target that has a
 * TextQuoteSelector. Returns null if there is none.
 */
export function annotationToUrl(annotation, options = {}) {
  for (const target of [].concat(annotation && annotation.target)) {
    if (!target || typeof target !== 'object') continue;
    const source = typeof target.source === 'string' ? target.source : target.source && target.source.id;
    const selectors = [].concat(target.selector).filter((s) => s && s.type === 'TextQuoteSelector');
    if (source && selectors.length) return textQuoteToUrl(source, selectors, options);
  }
  return null;
}

const decode = (s) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

/**
 * Parse the text directives of a URL (or bare fragment) into
 * { prefix?, start, end?, suffix? } objects.
 */
export function parseTextDirectives(url) {
  const str = String(url);
  const at = str.indexOf(':~:');
  if (at === -1) return [];
  return str
    .slice(at + 3)
    .split('&')
    .filter((d) => d.startsWith('text='))
    .map((d) => {
      const terms = d.slice(5).split(',');
      const out = {};
      if (terms.length > 1 && terms[0].endsWith('-')) out.prefix = decode(terms.shift().slice(0, -1));
      if (terms.length > 1 && terms[terms.length - 1].startsWith('-')) out.suffix = decode(terms.pop().slice(1));
      out.start = decode(terms[0] || '');
      if (terms.length > 1) out.end = decode(terms[1]);
      return out;
    });
}

/**
 * Convert the text directives of a URL into Web Annotation selectors. A
 * start-only directive becomes a TextQuoteSelector; start,end becomes a
 * RangeSelector of two TextQuoteSelectors (the end selector's exact text is
 * included in the range only if matched with the suffix, see issue #60).
 */
export function urlToSelectors(url) {
  return parseTextDirectives(url).map(({ prefix, start, end, suffix }) => {
    const quote = (exact, extra) => ({ type: 'TextQuoteSelector', exact, ...extra });
    if (end === undefined) {
      return quote(start, { ...(prefix && { prefix }), ...(suffix && { suffix }) });
    }
    return {
      type: 'RangeSelector',
      startSelector: quote(start, prefix ? { prefix } : {}),
      endSelector: quote(end, suffix ? { suffix } : {}),
    };
  });
}
