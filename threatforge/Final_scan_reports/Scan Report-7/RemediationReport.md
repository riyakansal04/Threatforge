# Remediation Proposal Report

This rerun provides separate finding-scoped remediation patches. The live repository source was not modified.

## BF-STD-001: Client-controlled cookie is deserialized with pickle

Root cause: The /cookie route stores browser-controlled state as pickle data and passes the returned value cookie to pickle.loads.

Patch: `patches/BF-STD-001.md`

Test: `tests/BF-STD-001_test.py.proposed`

Side effects: Existing pickle-formatted cookies become invalid.

## BF-STD-002: DNS lookup route concatenates form input into an OS command

Root cause: The /lookup route concatenates address into a shell command executed by os.popen.

Patch: `patches/BF-STD-002.md`

Test: `tests/BF-STD-002_test.py.proposed`

Side effects: Lookup output changes from raw nslookup text to resolved address lines.

## BF-STD-003: Expression evaluation route executes user input with eval

Root cause: The /evaluate route passes request.form['expression'] directly to Python eval.

Patch: `patches/BF-STD-003.md`

Test: `tests/BF-STD-003_test.py.proposed`

Side effects: Arbitrary Python expressions are no longer supported.

## BF-STD-004: XML parser enables DTD loading and network access

Root cause: The XML route parses untrusted XML with load_dtd=True, no_network=False, and huge_tree=True.

Patch: `patches/BF-STD-004.md`

Test: `tests/BF-STD-004_test.py.proposed`

Side effects: XML documents requiring DTDs are rejected.

## BF-STD-005: Config endpoint decrypts attacker-controlled ciphertext and returns padding errors

Root cause: The config route decrypts arbitrary key query values with AES-CBC and returns raw exception text.

Patch: `patches/BF-STD-005.md`

Test: `tests/BF-STD-005_test.py.proposed`

Side effects: Previously generated encrypted config links become invalid.

## BF-STD-006: Greeting route renders user input as Jinja template source

Root cause: The route inserts name into template source and calls render_template_string.

Patch: `patches/BF-STD-006.md`

Test: `tests/BF-STD-006_test.py.proposed`

Side effects: Jinja syntax submitted as a name is displayed as text.

## BF-STD-007: Category query parameter is concatenated into SQL

Root cause: The category query parameter is formatted into a SQL WHERE clause.

Patch: `patches/BF-STD-007.md`

Test: `tests/BF-STD-007_test.py.proposed`

Side effects: External database backends need integration validation for placeholder style.

## BF-STD-008: JWT verifier accepts None and HS256 algorithms based on untrusted token header

Root cause: verify_token dispatches verification from the untrusted JWT alg header and allows None and HS256.

Patch: `patches/BF-STD-008.md`

Test: `tests/BF-STD-008_test.py.proposed`

Side effects: None and HS256 tokens are rejected.

