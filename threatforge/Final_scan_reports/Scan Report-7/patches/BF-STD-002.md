# BF-STD-002: DNS lookup route concatenates form input into an OS command
File path: `main.py`

Function/route/component: `main.py / lookup route and rp helper`

Root cause: The /lookup route concatenates address into a shell command executed by os.popen.

Proposed fix: Remove shell execution and use validated hostname/IP input with socket.getaddrinfo.

Potential side effect: Lookup output changes from raw nslookup text to resolved address lines.

## Replacement 1

### Replace this

```python
from os import popen
```

### With this

```python
import ipaddress
import re
import socket
```

## Replacement 2

### Replace this

```python
def rp(command):
    return popen(command).read()
```

### With this

```python
HOSTNAME_RE = re.compile(r'^(?=.{1,253}$)([A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)(\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*\.?$')


def validate_lookup_address(address):
    try:
        ipaddress.ip_address(address)
        return address
    except ValueError:
        pass
    if not HOSTNAME_RE.match(address):
        raise ValueError('Invalid lookup address')
    return address.rstrip('.')


def lookup_address(address):
    validated = validate_lookup_address(address)
    records = socket.getaddrinfo(validated, None)
    values = sorted({record[4][0] for record in records})
    return '\n'.join(values)
```

## Replacement 3

### Replace this

```python
def lookup():
    address = None
    if request.method == 'POST':
        address = request.form['address']
    return """
    <html>
       <body>""" + "Result:\n<br>\n" + (rp("nslookup " + address).replace('\n', '\n<br>')  if address else "") + """
```

### With this

```python
def lookup():
    address = None
    lookup_result = ''
    if request.method == 'POST':
        address = request.form['address']
        try:
            lookup_result = lookup_address(address)
        except Exception as e:
            lookup_result = str(e)
    return """
    <html>
       <body>""" + "Result:\n<br>\n" + html.escape(lookup_result).replace('\n', '\n<br>') + """
```

## Equivalent Unified Diff

```diff
diff --git a/main.py b/main.py
--- a/main.py
+++ b/main.py
@@
-from os import popen
+import ipaddress
+import re
+import socket
@@
-def rp(command):
-    return popen(command).read()
+HOSTNAME_RE = re.compile(r'...')
+def validate_lookup_address(address): ...
+def lookup_address(address): ...
@@
-       <body>""" + "Result:\n<br>\n" + (rp("nslookup " + address).replace('\n', '\n<br>')  if address else "") + """
+       <body>""" + "Result:\n<br>\n" + html.escape(lookup_result).replace('\n', '\n<br>') + """
```

## Remediation Test

```python
def test_lookup_rejects_command_metacharacters():
    with pytest.raises(ValueError):
        main.validate_lookup_address("example.com;id")


def test_lookup_uses_resolver_without_shell(monkeypatch):
    def fake_getaddrinfo(address, port):
        assert address == "example.com"
        return [(None, None, None, None, ("203.0.113.10", 0))]
    monkeypatch.setattr(main.socket, "getaddrinfo", fake_getaddrinfo)
    assert main.lookup_address("example.com") == "203.0.113.10"

```
