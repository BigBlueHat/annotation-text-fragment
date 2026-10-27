export interface TextQuoteSelector {
  type: 'TextQuoteSelector';
  exact: string;
  prefix?: string;
  suffix?: string;
}

export interface Options {
  /** Max characters of prefix/suffix kept (default 64). */
  maxContext?: number;
  /** `exact` longer than this becomes textStart,textEnd (default 300). */
  maxLength?: number;
  /** Approx. characters kept at each end of a long `exact` (default 50). */
  edgeLength?: number;
  /** Unicode normalization form, or false (default 'NFC'). */
  normalize?: 'NFC' | 'NFD' | 'NFKC' | 'NFKD' | false;
  /** BCP 47 language tag hint for word segmentation. */
  locale?: string;
}

export interface TextDirective {
  prefix?: string;
  start: string;
  end?: string;
  suffix?: string;
}

export function textQuoteToDirective(selector: TextQuoteSelector, options?: Options): string;
export function textQuoteToUrl(url: string | URL, selectors: unknown, options?: Options): string;
export function annotationToUrl(annotation: unknown, options?: Options): string | null;
export function parseTextDirectives(url: string | URL): TextDirective[];
export function urlToSelectors(url: string | URL): object[];
