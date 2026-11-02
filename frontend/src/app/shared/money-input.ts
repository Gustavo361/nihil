/**
 * Free-form BRL money typing (comma decimals, max 2 places).
 * Does not reformat to fixed "0,00" on every keystroke — keeps mid-value edits usable.
 */
export function parseMoneyTyping(raw: string): { text: string; value: number | null } {
  let s = raw.replace(/[^\d.,]/g, '').replace(/\./g, ',');
  const comma = s.indexOf(',');
  if (comma >= 0) {
    const intPart = s.slice(0, comma).replace(/,/g, '');
    const decPart = s.slice(comma + 1).replace(/,/g, '').slice(0, 2);
    s = `${intPart},${decPart}`;
  } else {
    s = s.replace(/,/g, '');
  }

  if (!s) return { text: '', value: null };

  let value: number | null;
  if (s === ',') {
    value = null;
  } else if (s.startsWith(',')) {
    value = Number(`0.${s.slice(1)}`);
  } else if (s.endsWith(',')) {
    value = Number(s.slice(0, -1) || '0');
  } else {
    value = Number(s.replace(',', '.'));
  }

  return {
    text: s,
    value: value == null || Number.isNaN(value) ? null : value,
  };
}

export function moneyToInputText(value: number): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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
