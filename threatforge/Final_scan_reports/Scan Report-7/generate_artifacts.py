import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PATCH_DIR = ROOT / "patches"
TEST_DIR = ROOT / "tests"


def write(path, content):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


findings = [
    {
        "id": "BF-STD-001",
        "title": "Client-controlled cookie is deserialized with pickle",
        "component": "main.py / cookie route",
        "root": "The /cookie route stores browser-controlled state as pickle data and passes the returned value cookie to pickle.loads.",
        "fix": "Use JSON cookie serialization/deserialization for string values, reject malformed values, and HTML-escape displayed cookie content.",
        "side": "Existing pickle-formatted cookies become invalid.",
        "replace": """import pickle""",
        "with": """# pickle removed: client-side cookies use JSON serialization""",
        "replace2": """    elif 'value' in request.cookies:
        cookieValue = pickle.loads(b64decode(request.cookies['value'])) """,
        "with2": """    elif 'value' in request.cookies:
        try:
            cookieValue = decode_cookie_value(request.cookies['value'])
        except Exception:
            cookieValue = 'Invalid cookie value'""",
        "replace3": """        resp.set_cookie('value', b64encode(pickle.dumps(value)))""",
        "with3": """        resp.set_cookie('value', encode_cookie_value(value))""",
        "helper": """def encode_cookie_value(value):
    return b64encode(json.dumps(value).encode())


def decode_cookie_value(value):
    decoded = b64decode(value).decode()
    loaded = json.loads(decoded)
    if not isinstance(loaded, str):
        raise ValueError('Invalid cookie value')
    return loaded""",
        "diff": """diff --git a/main.py b/main.py
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
-       <body>Cookie value: \"\"\" + str(cookieValue) +\"\"\"
+       <body>Cookie value: \"\"\" + html.escape(str(cookieValue)) +\"\"\"
@@
-        resp.set_cookie('value', b64encode(pickle.dumps(value)))
+        resp.set_cookie('value', encode_cookie_value(value))
""",
        "test": """def test_cookie_uses_json_not_pickle_and_rejects_invalid_cookie():
    encoded = main.encode_cookie_value("hello")
    assert main.decode_cookie_value(encoded) == "hello"
    with pytest.raises(Exception):
        main.decode_cookie_value(b64encode(b"not-json"))
""",
    },
    {
        "id": "BF-STD-002",
        "title": "DNS lookup route concatenates form input into an OS command",
        "component": "main.py / lookup route and rp helper",
        "root": "The /lookup route concatenates address into a shell command executed by os.popen.",
        "fix": "Remove shell execution and use validated hostname/IP input with socket.getaddrinfo.",
        "side": "Lookup output changes from raw nslookup text to resolved address lines.",
        "replace": """from os import popen""",
        "with": """import ipaddress
import re
import socket""",
        "replace2": """def rp(command):
    return popen(command).read()""",
        "with2": """HOSTNAME_RE = re.compile(r'^(?=.{1,253}$)([A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)(\\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*\\.?$')


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
    return '\\n'.join(values)""",
        "replace3": """def lookup():
    address = None
    if request.method == 'POST':
        address = request.form['address']
    return \"\"\"
    <html>
       <body>\"\"\" + \"Result:\\n<br>\\n\" + (rp(\"nslookup \" + address).replace('\\n', '\\n<br>')  if address else \"\") + \"\"\"""",
        "with3": """def lookup():
    address = None
    lookup_result = ''
    if request.method == 'POST':
        address = request.form['address']
        try:
            lookup_result = lookup_address(address)
        except Exception as e:
            lookup_result = str(e)
    return \"\"\"
    <html>
       <body>\"\"\" + \"Result:\\n<br>\\n\" + html.escape(lookup_result).replace('\\n', '\\n<br>') + \"\"\"""",
        "diff": """diff --git a/main.py b/main.py
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
-       <body>\"\"\" + \"Result:\\n<br>\\n\" + (rp(\"nslookup \" + address).replace('\\n', '\\n<br>')  if address else \"\") + \"\"\"
+       <body>\"\"\" + \"Result:\\n<br>\\n\" + html.escape(lookup_result).replace('\\n', '\\n<br>') + \"\"\"
""",
        "test": """def test_lookup_rejects_command_metacharacters():
    with pytest.raises(ValueError):
        main.validate_lookup_address("example.com;id")


def test_lookup_uses_resolver_without_shell(monkeypatch):
    def fake_getaddrinfo(address, port):
        assert address == "example.com"
        return [(None, None, None, None, ("203.0.113.10", 0))]
    monkeypatch.setattr(main.socket, "getaddrinfo", fake_getaddrinfo)
    assert main.lookup_address("example.com") == "203.0.113.10"
""",
    },
    {
        "id": "BF-STD-003",
        "title": "Expression evaluation route executes user input with eval",
        "component": "main.py / evaluate route",
        "root": "The /evaluate route passes request.form['expression'] directly to Python eval.",
        "fix": "Use an AST arithmetic evaluator that permits numeric constants and arithmetic operators only.",
        "side": "Arbitrary Python expressions are no longer supported.",
        "replace": """import hmac""",
        "with": """import ast
import hmac
import operator""",
        "replace2": """       <body>\"\"\" + \"Result: \" + (str(eval(expression)).replace('\\n', '\\n<br>')  if expression else \"\") + \"\"\"""",
        "with2": """       <body>\"\"\" + \"Result: \" + html.escape(result).replace('\\n', '\\n<br>') + \"\"\"""",
        "helper": """SAFE_OPERATORS = {
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
    return eval_node(ast.parse(expression, mode='eval'))""",
        "diff": """diff --git a/main.py b/main.py
--- a/main.py
+++ b/main.py
@@
+import ast
+import operator
@@
+def safe_eval_expression(expression): ...
@@
-       <body>\"\"\" + \"Result: \" + (str(eval(expression)).replace('\\n', '\\n<br>')  if expression else \"\") + \"\"\"
+       <body>\"\"\" + \"Result: \" + html.escape(result).replace('\\n', '\\n<br>') + \"\"\"
""",
        "test": """def test_safe_eval_preserves_arithmetic_and_rejects_code_execution():
    assert main.safe_eval_expression("1 + 2 * 3") == 7
    with pytest.raises(ValueError):
        main.safe_eval_expression('__import__("os").system("id")')
""",
    },
    {
        "id": "BF-STD-004",
        "title": "XML parser enables DTD loading and network access",
        "component": "main.py / xml route",
        "root": "The XML route parses untrusted XML with load_dtd=True, no_network=False, and huge_tree=True.",
        "fix": "Reject DOCTYPE and parse with entity resolution, DTD loading, network access, and huge_tree disabled.",
        "side": "XML documents requiring DTDs are rejected.",
        "replace": """        parser = etree.XMLParser(no_network=False, dtd_validation=False, load_dtd=True, huge_tree=True)
        #try:
        doc = etree.fromstring(xml.encode(), parser)
        parsed_xml = etree.tostring(doc).decode('utf8')""",
        "with": """        try:
            parsed_xml = parse_xml(xml)
        except Exception:
            parsed_xml = 'Invalid XML'""",
        "helper": """def parse_xml(value):
    if '<!DOCTYPE' in value.upper():
        raise ValueError('Invalid XML')
    parser = etree.XMLParser(resolve_entities=False, no_network=True, dtd_validation=False, load_dtd=False, huge_tree=False)
    doc = etree.fromstring(value.encode(), parser)
    return etree.tostring(doc).decode('utf8')""",
        "diff": """diff --git a/main.py b/main.py
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
""",
        "test": """def test_xml_parser_rejects_external_entity_payload():
    payload = '<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><foo>&xxe;</foo>'
    with pytest.raises(Exception):
        main.parse_xml(payload)
""",
    },
    {
        "id": "BF-STD-005",
        "title": "Config endpoint decrypts attacker-controlled ciphertext and returns padding errors",
        "component": "main.py / config route",
        "root": "The config route decrypts arbitrary key query values with AES-CBC and returns raw exception text.",
        "fix": "Replace decryptable config links with HMAC-signed config-key tokens and generic invalid-key errors.",
        "side": "Previously generated encrypted config links become invalid.",
        "replace": """    crypt = lambda x : hexlify(encrypt(x.encode(), KEY)).decode('utf8')""",
        "with": """    crypt = sign_config_key""",
        "replace2": """            kv = unhexlify(key)
            decrypted_key = decrypt(kv, KEY).decode('utf8')
        except Exception as e:
            return str(e)""",
        "with2": """            decrypted_key = verify_config_key(key)
        except Exception:
            return 'Invalid config key'""",
        "helper": """def sign_config_key(config_key):
    key_bytes = config_key.encode()
    sig = hmac.new(KEY, key_bytes, hashlib.sha256).digest()
    return '{}.{}'.format(urlsafe_b64encode(key_bytes).decode().rstrip('='), urlsafe_b64encode(sig).decode().rstrip('='))


def verify_config_key(token):
    try:
        encoded_key, encoded_sig = token.split('.', 1)
        key_bytes = urlsafe_b64decode(encoded_key + '==')
        expected_sig = hmac.new(KEY, key_bytes, hashlib.sha256).digest()
        supplied_sig = urlsafe_b64decode(encoded_sig + '==')
    except Exception:
        raise ValueError('Invalid config key')
    if not hmac.compare_digest(expected_sig, supplied_sig):
        raise ValueError('Invalid config key')
    return key_bytes.decode()""",
        "diff": """diff --git a/main.py b/main.py
--- a/main.py
+++ b/main.py
@@
+def sign_config_key(config_key): ...
+def verify_config_key(token): ...
@@
-    crypt = lambda x : hexlify(encrypt(x.encode(), KEY)).decode('utf8')
+    crypt = sign_config_key
@@
-            kv = unhexlify(key)
-            decrypted_key = decrypt(kv, KEY).decode('utf8')
-        except Exception as e:
-            return str(e)
+            decrypted_key = verify_config_key(key)
+        except Exception:
+            return 'Invalid config key'
""",
        "test": """def test_config_token_verification_rejects_tampering():
    token = main.sign_config_key("app_name")
    assert main.verify_config_key(token) == "app_name"
    with pytest.raises(ValueError):
        main.verify_config_key(token + "tampered")
""",
    },
    {
        "id": "BF-STD-006",
        "title": "Greeting route renders user input as Jinja template source",
        "component": "main.py / sayhi route",
        "root": "The route inserts name into template source and calls render_template_string.",
        "fix": "Escape name and return fixed HTML directly without rendering user-controlled template source.",
        "side": "Jinja syntax submitted as a name is displayed as text.",
        "replace": """      name = '<br>Hello %s!<br><br>' %(request.form['name'])""",
        "with": """      name = '<br>Hello {}!<br><br>'.format(html.escape(request.form['name']))""",
        "replace2": """   return render_template_string(template)""",
        "with2": """   return template""",
        "diff": """diff --git a/main.py b/main.py
--- a/main.py
+++ b/main.py
@@
-      name = '<br>Hello %s!<br><br>' %(request.form['name'])
+      name = '<br>Hello {}!<br><br>'.format(html.escape(request.form['name']))
@@
-   return render_template_string(template)
+   return template
""",
        "test": """def test_sayhi_renders_template_payload_as_text():
    client = main.app.test_client()
    response = client.post("/sayhi", data={"name": "{{7*7}}"})
    assert response.status_code == 200
    assert b"{{7*7}}" in response.data
    assert b"49" not in response.data
""",
    },
    {
        "id": "BF-STD-007",
        "title": "Category query parameter is concatenated into SQL",
        "component": "main.py / listservices route",
        "root": "The category query parameter is formatted into a SQL WHERE clause.",
        "fix": "Use a DB-API parameter placeholder and pass category as a bound parameter.",
        "side": "External database backends need integration validation for placeholder style.",
        "replace": """        where = \" WHERE {} = '{}'\".format(param, category)""",
        "with": """        where = \" WHERE {} = {}\".format(param, sql_param)""",
        "replace2": """        cursor.execute(query_build('SELECT * from public_stuff{}'.format(where)))""",
        "with2": """        query = query_build('SELECT * from public_stuff{}'.format(where))
        if category:
            cursor.execute(query, (category,))
        else:
            cursor.execute(query)""",
        "helper": """    if args.database_type == 'oracle':
        sql_param = ':1'
    else:
        sql_param = '?' if args.database_type == 'sqlite' else '%s'""",
        "diff": """diff --git a/main.py b/main.py
--- a/main.py
+++ b/main.py
@@
-        where = \" WHERE {} = '{}'\".format(param, category)
+        where = \" WHERE {} = {}\".format(param, sql_param)
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
""",
        "test": """def test_listservices_uses_bound_parameter(monkeypatch):
    fake_cursor = FakeCursor()
    monkeypatch.setattr(main, "cursor", fake_cursor, raising=False)
    monkeypatch.setattr(main, "query_build", lambda query: query, raising=False)
    monkeypatch.setattr(main, "sql_param", "?", raising=False)
    client = main.app.test_client()
    response = client.get("/listservices?category=' OR '1'='1")
    assert response.status_code == 200
    assert fake_cursor.query == "SELECT * from public_stuff WHERE category = ?"
    assert fake_cursor.params == ("' OR '1'='1",)
""",
    },
    {
        "id": "BF-STD-008",
        "title": "JWT verifier accepts None and HS256 algorithms based on untrusted token header",
        "component": "main.py / verify_token",
        "root": "verify_token dispatches verification from the untrusted JWT alg header and allows None and HS256.",
        "fix": "Pin JWT verification to RS256 with expected audience and issuer.",
        "side": "None and HS256 tokens are rejected.",
        "replace": """ALLOWED_ALGORITHMS = ['RS256', 'HS256', 'None']""",
        "with": """ALLOWED_ALGORITHMS = ['RS256']""",
        "replace2": """    headers = jwt.get_unverified_header(token)
    if headers.get('alg') not in algorithms:
        raise Exception('Invalid algorithm specified')
    if headers.get('alg') == 'RS256':
        return verify_token_rsa(token, verify_key)
    if headers.get('alg') == 'HS256':
        return verify_token_hs256(token, verify_key)
    if headers.get('alg') == 'None':
        return verify_token_none(token, verify_key)
    raise Exception('Unknown error in token validation')""",
        "with2": """    return jwt.decode(token, verify_key, algorithms=['RS256'], audience=audience, issuer=issuer)""",
        "diff": """diff --git a/main.py b/main.py
--- a/main.py
+++ b/main.py
@@
-ALLOWED_ALGORITHMS = ['RS256', 'HS256', 'None']
+ALLOWED_ALGORITHMS = ['RS256']
@@
-    headers = jwt.get_unverified_header(token)
-    if headers.get('alg') not in algorithms:
-        raise Exception('Invalid algorithm specified')
-    if headers.get('alg') == 'RS256':
-        return verify_token_rsa(token, verify_key)
-    if headers.get('alg') == 'HS256':
-        return verify_token_hs256(token, verify_key)
-    if headers.get('alg') == 'None':
-        return verify_token_none(token, verify_key)
-    raise Exception('Unknown error in token validation')
+    return jwt.decode(token, verify_key, algorithms=['RS256'], audience=audience, issuer=issuer)
""",
        "test": """def test_verify_token_rejects_none_algorithm():
    with pytest.raises(Exception):
        main.verify_token(unsigned_token(main.ADMIN_USER), main.VERIFY_KEY)
""",
    },
]


for f in findings:
    sections = [
        f"# {f['id']}: {f['title']}\n",
        f"File path: `main.py`\n\nFunction/route/component: `{f['component']}`\n\n",
        f"Root cause: {f['root']}\n\nProposed fix: {f['fix']}\n\nPotential side effect: {f['side']}\n\n",
        "## Replacement 1\n\n### Replace this\n\n```python\n" + f["replace"] + "\n```\n\n### With this\n\n```python\n" + f["with"] + "\n```\n\n",
    ]
    for idx in ("2", "3"):
        if f.get("replace" + idx):
            sections.append(f"## Replacement {idx}\n\n### Replace this\n\n```python\n{f['replace' + idx]}\n```\n\n### With this\n\n```python\n{f['with' + idx]}\n```\n\n")
    if f.get("helper"):
        sections.append("## Insert Helper\n\nInsert near the existing helper functions before the affected route uses it.\n\n### With this\n\n```python\n" + f["helper"] + "\n```\n\n")
    sections.append("## Equivalent Unified Diff\n\n```diff\n" + f["diff"] + "```\n\n")
    sections.append("## Remediation Test\n\n```python\n" + f["test"] + "\n```\n")
    write(PATCH_DIR / f"{f['id']}.md", "".join(sections))
    write(TEST_DIR / f"{f['id']}_test.py.proposed", "import pytest\nfrom base64 import b64encode, urlsafe_b64encode\nimport json\nimport time\nimport main\n\n" + f["test"])

records = {
    "schemaVersion": "threatforge.remediation-proposals.v2",
    "generatedAt": "2026-10-05T00:00:00+05:30",
    "processingIdentity": {"name": "Remediation Engineer", "mode": "generate-only", "outputFolder": "Scan Report-8"},
    "sourceModified": False,
    "inputReferences": {
        "triagedFindings": "Scan Report-5/TriageFindings.json",
        "priorCombinedRemediation": "Scan Report-7/RemediationRecords.json"
    },
    "Finding": [
        {
            "findingId": f["id"],
            "title": f["title"],
            "rootCause": f["root"],
            "proposedFix": f["fix"],
            "patchReference": f"Scan Report-8/patches/{f['id']}.md",
            "testReference": f"Scan Report-8/tests/{f['id']}_test.py.proposed",
            "atomicity": "Finding-scoped proposal targeting the original repository baseline. Shared helper/import concepts must be merged carefully if multiple patches are applied together.",
            "sideEffects": [f["side"]],
            "status": "patch_generated_not_applied"
        }
        for f in findings
    ]
}
write(ROOT / "RemediationRecords.json", json.dumps(records, indent=2))

sarif = {
    "$schema": "https://json.schemastore.org/sarif-2.1.0.json",
    "version": "2.1.0",
    "runs": [{
        "tool": {"driver": {"name": "ThreatForge Remediation Engineer", "rules": [{"id": f["id"], "name": f["title"]} for f in findings]}},
        "results": [{
            "ruleId": f["id"],
            "level": "note",
            "message": {"text": f"Finding-scoped remediation patch generated for {f['id']}."},
            "locations": [{"physicalLocation": {"artifactLocation": {"uri": "main.py"}}}],
            "properties": {"patch": f"Scan Report-8/patches/{f['id']}.md", "test": f"Scan Report-8/tests/{f['id']}_test.py.proposed", "status": "patch_generated_not_applied"}
        } for f in findings]
    }]
}
write(ROOT / "remediation-results.sarif", json.dumps(sarif, indent=2))

report = ["# Remediation Proposal Report\n\nThis rerun provides separate finding-scoped remediation patches. The live repository source was not modified.\n\n"]
for f in findings:
    report.append(f"## {f['id']}: {f['title']}\n\nRoot cause: {f['root']}\n\nPatch: `{f'patches/{f['id']}.md'}`\n\nTest: `{f'tests/{f['id']}_test.py.proposed'}`\n\nSide effects: {f['side']}\n\n")
write(ROOT / "RemediationReport.md", "".join(report))

coverage = {
    "schemaVersion": "threatforge.remediation-coverage.v1",
    "findingsReceived": [f["id"] for f in findings],
    "findingsProcessed": [f["id"] for f in findings],
    "patchesGenerated": {f["id"]: f"patches/{f['id']}.md" for f in findings},
    "testsGenerated": {f["id"]: f"tests/{f['id']}_test.py.proposed" for f in findings},
    "excludedFindings": [],
    "sourceModified": False,
    "limitations": ["Per-finding patches target the original source baseline. Applying multiple patches together requires normal merge review for shared imports/helpers."]
}
write(ROOT / "CoverageReport.json", json.dumps(coverage, indent=2))
write(ROOT / "CoverageReport.md", "# Remediation Coverage Report\n\nAll 8 confirmed findings were processed. Each finding has its own patch file under `patches/` and its own proposed test file under `tests/`.\n\nNo source files were modified. Per-finding patches target the original baseline; if multiple patches are applied together, shared imports/helpers need merge review.\n")

manifest = {
    "schemaVersion": "threatforge.remediation-manifest.v2",
    "processingId": "remediation-separate-patches-2026-10-05-scan-report-8",
    "outputFolder": "Scan Report-8",
    "sourceModified": False,
    "inputArtifacts": ["Scan Report-5/TriageFindings.json", "Scan Report-7/RemediationRecords.json"],
    "generatedArtifacts": ["RemediationRecords.json", "remediation-results.sarif", "RemediationReport.md", "CoverageReport.md", "CoverageReport.json", "patches/*.md", "tests/*.py.proposed"],
    "status": "completed"
}
write(ROOT / "remediation-manifest.json", json.dumps(manifest, indent=2))
