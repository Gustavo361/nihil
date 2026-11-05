/**
 * Free-form BRL money typing (comma decimals, max 2 places).
 * Does not reformat to fixed "0,00" on every keystroke — keeps mid-value edits usable.
 * Accepts already-formatted pt-BR strings (e.g. 1.234,56).
 */
export function parseMoneyTyping(raw: string): { text: string; value: number | null } {
  const value = parseMoneyValue(raw);
  let s = raw.replace(/[^\d.,]/g, '');

  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  const decimalSep = lastComma > lastDot ? ',' : lastDot > lastComma ? '.' : ',';

  if (decimalSep === ',') {
    // pt-BR: dots are thousands
    s = s.replace(/\./g, '');
    const comma = s.indexOf(',');
    if (comma >= 0) {
      const intPart = s.slice(0, comma).replace(/,/g, '');
      const decPart = s.slice(comma + 1).replace(/,/g, '').slice(0, 2);
      s = `${intPart},${decPart}`;
    } else {
      s = s.replace(/,/g, '');
    }
  } else {
    // Dot used as decimal (rare while typing) — strip commas as thousands
    s = s.replace(/,/g, '');
    const dot = s.indexOf('.');
    if (dot >= 0) {
      const intPart = s.slice(0, dot).replace(/\./g, '');
      const decPart = s.slice(dot + 1).replace(/\./g, '').slice(0, 2);
      s = `${intPart},${decPart}`;
    }
  }

  if (!s) return { text: '', value: null };

  const comma = s.indexOf(',');
  if (comma >= 0) {
    s = `${groupThousands(s.slice(0, comma))},${s.slice(comma + 1)}`;
  } else {
    s = groupThousands(s);
  }

  return {
    text: s,
    value,
  };
}

function groupThousands(value: string): string {
  return value.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Parse BRL-ish input into a number (supports 1.234,56 / 1234,56 / 1234.56). */
export function parseMoneyValue(raw: string): number | null {
  let s = raw.replace(/[^\d.,]/g, '').trim();
  if (!s || s === ',' || s === '.') return null;

  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');

  if (lastComma >= 0 && lastDot >= 0) {
    if (lastComma > lastDot) {
      // 1.234,56
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      // 1,234.56
      s = s.replace(/,/g, '');
    }
  } else if (lastComma >= 0) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (lastDot >= 0) {
    const decimals = s.length - lastDot - 1;
    // One dot with 3 digits and no other punctuation often means thousands (1.500)
    if (decimals === 3 && s.indexOf('.') === lastDot) {
      s = s.replace(/\./g, '');
    }
  }

  if (s.startsWith('.')) s = `0${s}`;
  if (s.endsWith('.')) s = s.slice(0, -1);

  const value = Number(s);
  return Number.isNaN(value) ? null : value;
}

export function moneyToInputText(value: number): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Format for display after blur / leave field. */
export function formatMoneyInput(raw: string): { text: string; value: number | null } {
  const value = parseMoneyValue(raw);
  if (value == null) return { text: '', value: null };
  return { text: moneyToInputText(value), value };
}

/** Map caret so it stays on the same digit index after sanitizing the money string. */
export function restoreMoneyCaret(
  input: HTMLInputElement | null | undefined,
  raw: string,
  nextText: string,
  caret: number | null | undefined,
): void {
  if (!input || caret == null) return;
  const digitsBefore = raw.slice(0, caret).replace(/\D/g, '').length;
  queueMicrotask(() => {
    let pos: number;
    if (digitsBefore <= 0) {
      pos = 0;
    } else {
      let seen = 0;
      pos = nextText.length;
      for (let i = 0; i < nextText.length; i++) {
        if (/\d/.test(nextText[i]!)) {
          seen += 1;
          if (seen === digitsBefore) {
            pos = i + 1;
            break;
          }
        }
      }
    }
    input.setSelectionRange(pos, pos);
  });
}
