/**
 * LexoRank — Lexicographical ordering utility.
 * Generates rank strings between two existing ranks for O(1) database insertion ordering.
 * Used by the board module for task ordering within columns.
 */
export class LexoRank {
  private static readonly ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';
  private static readonly MIN_CHAR = '0';
  private static readonly MAX_CHAR = 'z';
  private static readonly DEFAULT_MIN = '000000';
  private static readonly DEFAULT_MAX = 'zzzzzz';
  private static readonly DEFAULT_INITIAL = '500000';

  /**
   * Generates a lexicographical rank string between prev and next strings.
   * Handles edge cases such as empty values and string length divergence.
   */
  public static calculate(prev?: string, next?: string): string {
    const p = prev || LexoRank.DEFAULT_MIN;
    const n = next || LexoRank.DEFAULT_MAX;

    let rank = '';
    let i = 0;

    while (true) {
      const charP = p[i] || LexoRank.MIN_CHAR;
      const charN = n[i] || LexoRank.MAX_CHAR;

      const idxP = LexoRank.ALPHABET.indexOf(charP);
      const idxN = LexoRank.ALPHABET.indexOf(charN);

      if (idxN - idxP > 1) {
        const midIdx = Math.floor((idxP + idxN) / 2);
        rank += LexoRank.ALPHABET[midIdx];
        break;
      } else {
        rank += charP;
        if (charP === charN && i >= Math.max(p.length, n.length)) {
          rank += 'm'; // Safe default divider
          break;
        }
      }
      i++;
    }
    return rank;
  }

  /** Returns the default initial rank for the first item. */
  public static get initialRank(): string {
    return LexoRank.DEFAULT_INITIAL;
  }
}
