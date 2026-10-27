import test from 'node:test';
import assert from 'node:assert/strict';
import {
  textQuoteToDirective,
  textQuoteToUrl,
  annotationToUrl,
  parseTextDirectives,
  urlToSelectors,
} from '../src/index.js';

const tq = (exact, extra) => ({ type: 'TextQuoteSelector', exact, ...extra });

test('exact only', () => {
  assert.equal(textQuoteToDirective(tq('hello world')), 'text=hello%20world');
});

test('prefix and suffix', () => {
  assert.equal(
    textQuoteToDirective(tq('b', { prefix: 'a ', suffix: ' c' })),
    'text=a-,b,-c',
  );
});

test('encodes delimiters - , &', () => {
  assert.equal(textQuoteToDirective(tq('a-b,c&d')), 'text=a%2Db%2Cc%26d');
});

test('Arabic is percent-encoded and normalized', () => {
  const d = textQuoteToDirective(tq('مرحبا بالعالم', { prefix: 'قال ' }));
  assert.equal(decodeURIComponent(d), 'text=قال-,مرحبا بالعالم');
  assert.ok(/^[\x20-\x7e]+$/.test(d));
});

test('NFC normalization', () => {
  assert.equal(textQuoteToDirective(tq('é')), 'text=%C3%A9');
  assert.equal(textQuoteToDirective(tq('é'), { normalize: false }), 'text=e%CC%81');
});

test('newline in exact splits across blocks', () => {
  assert.equal(textQuoteToDirective(tq('one two\n\nthree four')), 'text=one%20two,three%20four');
});

test('context is cut at block boundaries', () => {
  assert.equal(textQuoteToDirective(tq('x', { prefix: 'foo\nbar ', suffix: ' baz\nqux' })), 'text=bar-,x,-baz');
});

test('long exact becomes start,end on word boundaries', () => {
  const words = Array.from({ length: 100 }, (_, i) => `word${i}`).join(' ');
  const { start: s, end: e } = parseTextDirectives('#:~:' + textQuoteToDirective(tq(words)))[0];
  assert.ok(words.startsWith(s) && words.endsWith(e));
  assert.match(s, /word\d+$/);
  assert.match(e, /^word\d+/);
});

test('CJK long text is segmented without whitespace', () => {
  const text = '今天天气很好我们一起去公园散步吧。'.repeat(30);
  const d = parseTextDirectives('#:~:' + textQuoteToDirective(tq(text), { locale: 'zh' }))[0];
  assert.ok(d.end && text.startsWith(d.start) && text.endsWith(d.end));
});

test('empty exact throws', () => {
  assert.throws(() => textQuoteToDirective(tq('  ')));
  assert.throws(() => textQuoteToDirective({ type: 'CssSelector', value: 'p' }));
});

test('URL handling', () => {
  const s = tq('hi');
  assert.equal(textQuoteToUrl('https://e.com/a', s), 'https://e.com/a#:~:text=hi');
  assert.equal(textQuoteToUrl('https://e.com/a#sec', s), 'https://e.com/a#sec:~:text=hi');
  assert.equal(textQuoteToUrl('https://e.com/a#:~:text=x', s), 'https://e.com/a#:~:text=x&text=hi');
  assert.equal(textQuoteToUrl('https://e.com/', [s, tq('yo')]), 'https://e.com/#:~:text=hi&text=yo');
  assert.equal(textQuoteToUrl('https://e.com/', []), 'https://e.com/');
});

test('annotationToUrl', () => {
  const anno = {
    target: { source: 'https://example.com/article', selector: [{ type: 'CssSelector', value: 'p' }, tq('x', { prefix: 'w ' })] },
  };
  assert.equal(annotationToUrl(anno), 'https://example.com/article#:~:text=w-,x');
  assert.equal(annotationToUrl({ target: 'https://example.com' }), null);
});

test('round trip', () => {
  const sel = tq('b-c, d', { prefix: 'a', suffix: 'e' });
  const url = textQuoteToUrl('https://e.com/', sel);
  assert.deepEqual(urlToSelectors(url), [sel]);
  assert.deepEqual(urlToSelectors('https://e.com/#:~:text=a-,s,t,-z'), [
    { type: 'RangeSelector', startSelector: tq('s', { prefix: 'a' }), endSelector: tq('t', { suffix: 'z' }) },
  ]);
});
