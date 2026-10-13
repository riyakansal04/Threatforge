# BF-STD-003: Expression evaluation route executes user input with eval
File path: `main.py`

Function/route/component: `main.py / evaluate route`

Root cause: The /evaluate route passes request.form['expression'] directly to Python eval.

Proposed fix: Use an AST arithmetic evaluator that permits numeric constants and arithmetic operators only.

Potential side effect: Arbitrary Python expressions are no longer supported.

## Replacement 1

### Replace this

```python
import hmac
```

### With this

```python
import ast
import hmac
import operator
```

## Replacement 2

### Replace this

```python
       <body>""" + "Result: " + (str(eval(expression)).replace('\n', '\n<br>')  if expression else "") + """
```

### With this

```python
       <body>""" + "Result: " + html.escape(result).replace('\n', '\n<br>') + """
```

## Insert Helper

Insert near the existing helper functions before the affected route uses it.

### With this

```python
SAFE_OPERATORS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.FloorDiv: operator.floordiv,
    ast.Mod: operator.mod,
    ast.Pow: operator.pow,
    ast.USub: operator.neg,
    ast.UAdd: operator.pos,
}


def safe_eval_expression(expression):
    def eval_node(node):
        if isinstance(node, ast.Expression):
            return eval_node(node.body)
        if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
            return node.value
        if isinstance(node, ast.BinOp) and type(node.op) in SAFE_OPERATORS:
            return SAFE_OPERATORS[type(node.op)](eval_node(node.left), eval_node(node.right))
        if isinstance(node, ast.UnaryOp) and type(node.op) in SAFE_OPERATORS:
            return SAFE_OPERATORS[type(node.op)](eval_node(node.operand))
        raise ValueError('Unsupported expression')
    return eval_node(ast.parse(expression, mode='eval'))
```

## Equivalent Unified Diff

```diff
diff --git a/main.py b/main.py
--- a/main.py
+++ b/main.py
@@
+import ast
+import operator
@@
+def safe_eval_expression(expression): ...
@@
-       <body>""" + "Result: " + (str(eval(expression)).replace('\n', '\n<br>')  if expression else "") + """
+       <body>""" + "Result: " + html.escape(result).replace('\n', '\n<br>') + """
```

## Remediation Test

```python
def test_safe_eval_preserves_arithmetic_and_rejects_code_execution():
    assert main.safe_eval_expression("1 + 2 * 3") == 7
    with pytest.raises(ValueError):
        main.safe_eval_expression('__import__("os").system("id")')

```
