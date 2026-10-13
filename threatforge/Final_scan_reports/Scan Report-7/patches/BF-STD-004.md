# BF-STD-004: XML parser enables DTD loading and network access
File path: `main.py`

Function/route/component: `main.py / xml route`

Root cause: The XML route parses untrusted XML with load_dtd=True, no_network=False, and huge_tree=True.

Proposed fix: Reject DOCTYPE and parse with entity resolution, DTD loading, network access, and huge_tree disabled.

Potential side effect: XML documents requiring DTDs are rejected.

## Replacement 1

### Replace this

```python
        parser = etree.XMLParser(no_network=False, dtd_validation=False, load_dtd=True, huge_tree=True)
        #try:
        doc = etree.fromstring(xml.encode(), parser)
        parsed_xml = etree.tostring(doc).decode('utf8')
```

### With this

```python
        try:
            parsed_xml = parse_xml(xml)
        except Exception:
            parsed_xml = 'Invalid XML'
```

## Insert Helper

Insert near the existing helper functions before the affected route uses it.

### With this

```python
def parse_xml(value):
    if '<!DOCTYPE' in value.upper():
        raise ValueError('Invalid XML')
    parser = etree.XMLParser(resolve_entities=False, no_network=True, dtd_validation=False, load_dtd=False, huge_tree=False)
    doc = etree.fromstring(value.encode(), parser)
    return etree.tostring(doc).decode('utf8')
```

## Equivalent Unified Diff

```diff
diff --git a/main.py b/main.py
--- a/main.py
+++ b/main.py
@@
+def parse_xml(value): ...
@@
-        parser = etree.XMLParser(no_network=False, dtd_validation=False, load_dtd=True, huge_tree=True)
-        doc = etree.fromstring(xml.encode(), parser)
-        parsed_xml = etree.tostring(doc).decode('utf8')
+        try:
+            parsed_xml = parse_xml(xml)
+        except Exception:
+            parsed_xml = 'Invalid XML'
```

## Remediation Test

```python
def test_xml_parser_rejects_external_entity_payload():
    payload = '<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><foo>&xxe;</foo>'
    with pytest.raises(Exception):
        main.parse_xml(payload)

```
