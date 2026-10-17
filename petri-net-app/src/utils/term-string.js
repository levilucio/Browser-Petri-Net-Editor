/** JSON-compatible quoting with visible escapes for nonprinting solver witnesses. */
export function quoteTermString(value) {
  return JSON.stringify(value).replace(/[\p{Cc}\p{Cf}\p{Co}\p{Cn}\u2028\u2029]/gu, character =>
    Array.from({ length: character.length }, (_, i) => `\\u${character.charCodeAt(i).toString(16).padStart(4, '0')}`).join(''));
}
