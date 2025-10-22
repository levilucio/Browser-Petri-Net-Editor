export function collectVariables(ast, acc = new Set()) {
  if (!ast) return acc;
  if (ast.type === 'var') acc.add(ast.name);
  if (ast.type === 'pair') {
    collectVariables(ast.fst, acc);
    collectVariables(ast.snd, acc);
  }
  if (ast.type === 'binop') {
    collectVariables(ast.left, acc);
    collectVariables(ast.right, acc);
  }
  if (ast.type === 'funcall' && ast.args) {
    ast.args.forEach(arg => collectVariables(arg, acc));
  }
  return acc;
}

export function buildZ3Expr(ctx, ast, sym) {
  const { Int, String: Z3String } = ctx;
  switch (ast.type) {
    case 'int':
      return Int.val(ast.value);
    case 'string':
      return Z3String.val(ast.value);
    case 'pair':
      // Represent pair as concatenated string for now, sufficient for evaluation context
      const left = buildZ3Expr(ctx, ast.fst, sym);
      const right = buildZ3Expr(ctx, ast.snd, sym);
      return left.concat(Z3String.val(',')).concat(right);
    case 'var':
      return sym(ast.name);
    case 'funcall': {
      // Fast-path: length over a string literal without requiring String theory
      if (ast.name === 'length' && ast.args && ast.args.length === 1 && ast.args[0]?.type === 'string') {
        return Int.val((ast.args[0].value || '').length);
      }
      if (ast.name === 'concat' && ast.args && ast.args.length === 2) {
        const arg1 = buildZ3Expr(ctx, ast.args[0], sym);
        const arg2 = buildZ3Expr(ctx, ast.args[1], sym);
        return arg1.concat(arg2);
      }
      if (ast.name === 'substring' && ast.args && ast.args.length === 3) {
        const str = buildZ3Expr(ctx, ast.args[0], sym);
        const start = buildZ3Expr(ctx, ast.args[1], sym);
        const len = buildZ3Expr(ctx, ast.args[2], sym);
        return str.substr(start, len);
      }
      if (ast.name === 'length' && ast.args && ast.args.length === 1) {
        const str = buildZ3Expr(ctx, ast.args[0], sym);
        return str.length();
      }
      throw new Error(`Unknown function '${ast.name}'`);
    }
    case 'binop': {
      const l = buildZ3Expr(ctx, ast.left, sym);
      const r = buildZ3Expr(ctx, ast.right, sym);
      switch (ast.op) {
        case '+': return l.add(r);
        case '-': return l.sub(r);
        case '*': return l.mul(r);
        case '/': return l.div(r);
        default: throw new Error(`Unknown operator '${ast.op}'`);
      }
    }
    default:
      throw new Error(`Unknown AST node '${ast.type}'`);
  }
}


