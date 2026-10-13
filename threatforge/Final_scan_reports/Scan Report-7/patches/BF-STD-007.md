# BF-STD-007: Category query parameter is concatenated into SQL
File path: `main.py`

Function/route/component: `main.py / listservices route`

Root cause: The category query parameter is formatted into a SQL WHERE clause.

Proposed fix: Use a DB-API parameter placeholder and pass category as a bound parameter.

Potential side effect: External database backends need integration validation for placeholder style.

## Replacement 1

### Replace this

```python
        where = " WHERE {} = '{}'".format(param, category)
```

### With this

```python
        where = " WHERE {} = {}".format(param, sql_param)
```

## Replacement 2

### Replace this

```python
        cursor.execute(query_build('SELECT * from public_stuff{}'.format(where)))
```

### With this

```python
        query = query_build('SELECT * from public_stuff{}'.format(where))
        if category:
            cursor.execute(query, (category,))
        else:
            cursor.execute(query)
```

## Insert Helper

Insert near the existing helper functions before the affected route uses it.

### With this

```python
    if args.database_type == 'oracle':
        sql_param = ':1'
    else:
        sql_param = '?' if args.database_type == 'sqlite' else '%s'
```

## Equivalent Unified Diff

```diff
diff --git a/main.py b/main.py
--- a/main.py
+++ b/main.py
@@
-        where = " WHERE {} = '{}'".format(param, category)
+        where = " WHERE {} = {}".format(param, sql_param)
@@
-        cursor.execute(query_build('SELECT * from public_stuff{}'.format(where)))
+        query = query_build('SELECT * from public_stuff{}'.format(where))
+        if category:
+            cursor.execute(query, (category,))
+        else:
+            cursor.execute(query)
@@
+    if args.database_type == 'oracle':
+        sql_param = ':1'
+    else:
+        sql_param = '?' if args.database_type == 'sqlite' else '%s'
```

## Remediation Test

```python
def test_listservices_uses_bound_parameter(monkeypatch):
    fake_cursor = FakeCursor()
    monkeypatch.setattr(main, "cursor", fake_cursor, raising=False)
    monkeypatch.setattr(main, "query_build", lambda query: query, raising=False)
    monkeypatch.setattr(main, "sql_param", "?", raising=False)
    client = main.app.test_client()
    response = client.get("/listservices?category=' OR '1'='1")
    assert response.status_code == 200
    assert fake_cursor.query == "SELECT * from public_stuff WHERE category = ?"
    assert fake_cursor.params == ("' OR '1'='1",)

```
