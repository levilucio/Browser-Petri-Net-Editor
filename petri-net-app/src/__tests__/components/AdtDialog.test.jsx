import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import AdtDialog from '../../components/AdtDialog';

jest.mock('../../contexts/AdtContext', () => ({
  useAdtRegistry: jest.fn(),
}));

jest.mock('../../utils/arith-parser', () => ({
  parseArithmetic: jest.fn(),
}));

jest.mock('../../utils/z3-arith', () => ({
  evaluateArithmeticWithBindings: jest.fn(),
  solveEquation: jest.fn(),
  parseBooleanExpr: jest.fn(),
  evaluateBooleanWithBindings: jest.fn(),
}));

jest.mock('../../utils/token-format', () => ({
  formatToken: jest.fn((value) => String(value)),
}));

const { useAdtRegistry } = jest.requireMock('../../contexts/AdtContext');
const { parseArithmetic } = jest.requireMock('../../utils/arith-parser');
const {
  evaluateArithmeticWithBindings,
  solveEquation,
  parseBooleanExpr,
  evaluateBooleanWithBindings,
} = jest.requireMock('../../utils/z3-arith');
const { formatToken } = jest.requireMock('../../utils/token-format');

function createRegistry() {
  const types = [
    {
      name: 'Int',
      __readonly: true,
      operations: [
        { name: 'add', params: [{ type: 'Int' }, { type: 'Int' }], result: 'Int' },
        { name: 'negate', params: [{ type: 'Int' }], result: 'Int' },
      ],
      axioms: [
        { name: 'commutativity', equation: 'add(x, y) = add(y, x)' },
      ],
    },
    {
      name: 'Bool',
      __readonly: false,
      operations: [],
      axioms: [],
    },
  ];

  return {
    listTypes: jest.fn(() => types.map((t) => t.name)),
    getType: jest.fn((name) => types.find((t) => t.name === name)),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  useAdtRegistry.mockReturnValue(createRegistry());
  parseArithmetic.mockImplementation((expr) => ({ type: 'arith', expr }));
  evaluateArithmeticWithBindings.mockResolvedValue(0);
  solveEquation.mockResolvedValue({ solutions: [] });
  parseBooleanExpr.mockReturnValue('bool-ast');
  evaluateBooleanWithBindings.mockReturnValue(true);
  formatToken.mockImplementation((value) => (typeof value === 'object' ? JSON.stringify(value) : String(value)));
});

describe('AdtDialog', () => {
  test('renders nothing when closed', () => {
    render(<AdtDialog isOpen={false} onClose={jest.fn()} />);
    expect(screen.queryByText('ADT Manager - Available Types and Operations')).toBeNull();
  });

  test('displays registry preview when open', () => {
    render(<AdtDialog isOpen onClose={jest.fn()} />);
    expect(screen.getByText('ADT Manager - Available Types and Operations')).toBeInTheDocument();
    const intHeader = screen.getByText((content, element) => element?.tagName === 'DIV' && element.className.includes('font-semibold') && content === 'Int');
    const boolHeader = screen.getByText((content, element) => element?.tagName === 'DIV' && element.className.includes('font-semibold') && content === 'Bool');
    expect(intHeader).toBeInTheDocument();
    expect(boolHeader).toBeInTheDocument();
    expect(screen.getByText(/Built-in/)).toBeInTheDocument();
    expect(screen.getByText('commutativity:')).toBeInTheDocument();
    expect(screen.getByText('(no operations)')).toBeInTheDocument();
  });

  test('invokes onClose when close button is clicked', () => {
    const onClose = jest.fn();
    render(<AdtDialog isOpen onClose={onClose} />);
    fireEvent.click(screen.getByText('Close'));
    expect(onClose).toHaveBeenCalled();
  });

  test('verifies equations with bindings via sandbox', async () => {
    evaluateBooleanWithBindings.mockResolvedValueOnce(true);
    formatToken.mockReturnValueOnce('true');
    render(<AdtDialog isOpen onClose={jest.fn()} />);

    fireEvent.change(screen.getByTestId('sandbox-expr'), { target: { value: 'x + y = 7' } });
    fireEvent.change(screen.getByTestId('sandbox-bindings'), { target: { value: '{"x":3, "y":4}' } });

    await act(async () => {
      fireEvent.click(screen.getByTestId('sandbox-run'));
    });

    const result = await screen.findByTestId('sandbox-result');
    expect(result).toHaveTextContent('Result: true');
    expect(evaluateBooleanWithBindings).toHaveBeenCalled();
  });

  test('solves equations without bindings via sandbox', async () => {
    solveEquation.mockResolvedValue({ solutions: [{ x: 3, y: 4 }] });
    render(<AdtDialog isOpen onClose={jest.fn()} />);

    fireEvent.change(screen.getByTestId('sandbox-expr'), { target: { value: 'x + y = 7' } });
    fireEvent.change(screen.getByTestId('sandbox-bindings'), { target: { value: '' } }); // Empty bindings

    await act(async () => {
      fireEvent.click(screen.getByTestId('sandbox-run'));
    });

    const solutions = await screen.findByTestId('sandbox-solutions');
    expect(solutions).toHaveTextContent('{"x":3,"y":4}');
    expect(solveEquation).toHaveBeenCalled();
  });

  test('evaluates arithmetic expressions and formats result', async () => {
    evaluateArithmeticWithBindings.mockResolvedValueOnce(11);
    formatToken.mockReturnValueOnce('11');
    render(<AdtDialog isOpen onClose={jest.fn()} />);

    fireEvent.change(screen.getByTestId('sandbox-bindings'), { target: { value: 'x=3, y=4' } });

    await act(async () => {
      fireEvent.click(screen.getByTestId('sandbox-run'));
    });

    expect(evaluateArithmeticWithBindings).toHaveBeenCalledWith({ type: 'arith', expr: 'x + 2 * y' }, { x: 3, y: 4 });
    const result = await screen.findByTestId('sandbox-result');
    expect(result).toHaveTextContent('Result: 11');
  });

  test('falls back to boolean evaluation when arithmetic throws', async () => {
    evaluateArithmeticWithBindings.mockRejectedValueOnce(new Error('arith fail'));
    evaluateBooleanWithBindings.mockReturnValueOnce(false);
    formatToken.mockReturnValueOnce('false');
    render(<AdtDialog isOpen onClose={jest.fn()} />);

    fireEvent.change(screen.getByTestId('sandbox-expr'), { target: { value: 'x > 2' } });

    await act(async () => {
      fireEvent.click(screen.getByTestId('sandbox-run'));
    });

    expect(parseBooleanExpr).toHaveBeenCalledWith('x > 2', parseArithmetic);
    expect(evaluateBooleanWithBindings).toHaveBeenCalledWith('bool-ast', { x: 3, y: 4 }, parseArithmetic);
    const boolResult = await screen.findByTestId('sandbox-result');
    expect(boolResult).toHaveTextContent('Result: false');
  });

  test('shows error when sandbox input is empty', async () => {
    render(<AdtDialog isOpen onClose={jest.fn()} />);

    fireEvent.change(screen.getByTestId('sandbox-expr'), { target: { value: '   ' } });

    await act(async () => {
      fireEvent.click(screen.getByTestId('sandbox-run'));
    });

    expect(await screen.findByText(/Please enter an expression/)).toBeInTheDocument();
  });
});


