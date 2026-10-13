# BF-STD-001: Client-controlled cookie is deserialized with pickle
File path: `main.py`

Function/route/component: `main.py / cookie route`

Root cause: The /cookie route stores browser-controlled state as pickle data and passes the returned value cookie to pickle.loads.

Proposed fix: Use JSON cookie serialization/deserialization for string values, reject malformed values, and HTML-escape displayed cookie content.

Potential side effect: Existing pickle-formatted cookies become invalid.

## Replacement 1

### Replace this

```python
import pickle
```

### With this

```python
# pickle removed: client-side cookies use JSON serialization
```

## Replacement 2

### Replace this

```python
    elif 'value' in request.cookies:
        cookieValue = pickle.loads(b64decode(request.cookies['value'])) 
```

### With this

```python
    elif 'value' in request.cookies:
        try:
            cookieValue = decode_cookie_value(request.cookies['value'])
        except Exception:
            cookieValue = 'Invalid cookie value'
```

## Replacement 3

### Replace this

```python
        resp.set_cookie('value', b64encode(pickle.dumps(value)))
```

### With this

```python
        resp.set_cookie('value', encode_cookie_value(value))
```

## Insert Helper

Insert near the existing helper functions before the affected route uses it.

### With this

```python
def encode_cookie_value(value):
    return b64encode(json.dumps(value).encode())


def decode_cookie_value(value):
    decoded = b64decode(value).decode()
    loaded = json.loads(decoded)
    if not isinstance(loaded, str):
        raise ValueError('Invalid cookie value')
    return loaded
```

## Equivalent Unified Diff

```diff
diff --git a/main.py b/main.py
--- a/main.py
+++ b/main.py
@@
-import pickle
@@
+def encode_cookie_value(value):
+    return b64encode(json.dumps(value).encode())
+
+def decode_cookie_value(value):
+    decoded = b64decode(value).decode()
+    loaded = json.loads(decoded)
+    if not isinstance(loaded, str):
+        raise ValueError('Invalid cookie value')
+    return loaded
@@
-    elif 'value' in request.cookies:
-        cookieValue = pickle.loads(b64decode(request.cookies['value']))
+    elif 'value' in request.cookies:
+        try:
+            cookieValue = decode_cookie_value(request.cookies['value'])
+        except Exception:
+            cookieValue = 'Invalid cookie value'
@@
-       <body>Cookie value: """ + str(cookieValue) +"""
+       <body>Cookie value: """ + html.escape(str(cookieValue)) +"""
@@
-        resp.set_cookie('value', b64encode(pickle.dumps(value)))
+        resp.set_cookie('value', encode_cookie_value(value))
```

## Remediation Test

```python
def test_cookie_uses_json_not_pickle_and_rejects_invalid_cookie():
    encoded = main.encode_cookie_value("hello")
    assert main.decode_cookie_value(encoded) == "hello"
    with pytest.raises(Exception):
        main.decode_cookie_value(b64encode(b"not-json"))

```
