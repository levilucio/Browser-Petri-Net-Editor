/** @jest-environment node */
import { parseSymbolicSource, parseTerms } from '../../satel/core/SymbolicSource';
import { evaluateGroundTerm, foldGroundTerms } from '../../satel/core/GroundTerms';
import { symbolicToValue } from '../../utils/builtin-values';
import { evaluateMethodTerm, compileMethodTerm } from '../../features/simulation/MethodTerms';

const algebra = parseSymbolicSource('');
const term = text => parseTerms(text, algebra)[0];
test.each([
  ['concat("a", "b")', 'ab'], ['substring("abc", -2, 1)', 'b'], ['length("😀")', 2],
  ['isSubstringOf("b", "abc")', true], ['asInt(fst((3, "s"))) + 2', 5],
  ['append([1, 2], 3)', [1, 2, 3]], ['concat([1], [true, "x"])', [1, true, 'x']],
  ['sublist([1, 2, 3], -2, 1)', [2]], ['isSublistOf([2, 3], [1, 2, 3])', true],
  ['asInt(head(tail([1, 2])))', 2], ['length([true, (1, 2)])', 2],
  ['asBool(snd((1, false))) or true', true], ['false and asBool(head([]))', false],
])('ground equation evaluation and concrete execution agree: %s', (text, expected) => {
  expect(symbolicToValue(evaluateGroundTerm(term(text), algebra))).toEqual(expected);
  expect(evaluateMethodTerm(compileMethodTerm(text))).toEqual(expected);
});

test('undefined and ambiguous ground operations stay explicit; symbolic terms are not guessed', () => {
  expect(() => evaluateGroundTerm(term('head([])'), algebra)).toThrow('non-empty');
  expect(foldGroundTerms(term('head([])'), algebra)).toEqual(term('head([])'));
  const t = parseTerms('x + length("abc")', algebra, { x: 'Int' })[0];
  expect(foldGroundTerms(t, algebra)).toEqual({ op: '+', left: { var: 'x' }, right: 3 });
  const overlapping = parseSymbolicSource('operation f(Int): Int\nrule a(x: Int): f(x) = 1\nrule b(x: Int): f(x) = 2');
  expect(() => evaluateGroundTerm(parseTerms('f(0)', overlapping)[0], overlapping)).toThrow('matched 2');
  const recursive = parseSymbolicSource('operation f(Int): Int\nrule again(x: Int): f(x) = f(x)');
  expect(() => evaluateGroundTerm(parseTerms('f(0)', recursive)[0], recursive, 20)).toThrow('budget');
});
