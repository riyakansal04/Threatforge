# BF-STD-006: Greeting route renders user input as Jinja template source
File path: `main.py`

Function/route/component: `main.py / sayhi route`

Root cause: The route inserts name into template source and calls render_template_string.

Proposed fix: Escape name and return fixed HTML directly without rendering user-controlled template source.

Potential side effect: Jinja syntax submitted as a name is displayed as text.

## Replacement 1

### Replace this

```python
      name = '<br>Hello %s!<br><br>' %(request.form['name'])
```

### With this

```python
      name = '<br>Hello {}!<br><br>'.format(html.escape(request.form['name']))
```

## Replacement 2

### Replace this

```python
   return render_template_string(template)
```

### With this

```python
   return template
```

## Equivalent Unified Diff

```diff
diff --git a/main.py b/main.py
--- a/main.py
+++ b/main.py
@@
-      name = '<br>Hello %s!<br><br>' %(request.form['name'])
+      name = '<br>Hello {}!<br><br>'.format(html.escape(request.form['name']))
@@
-   return render_template_string(template)
+   return template
```

## Remediation Test

```python
def test_sayhi_renders_template_payload_as_text():
    client = main.app.test_client()
    response = client.post("/sayhi", data={"name": "{{7*7}}"})
    assert response.status_code == 200
    assert b"{{7*7}}" in response.data
    assert b"49" not in response.data

```
