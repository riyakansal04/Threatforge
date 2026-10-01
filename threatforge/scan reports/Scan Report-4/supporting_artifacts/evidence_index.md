# Evidence Index

## BF-001: Unauthenticated expression evaluator executes Python code

- main.py:372 defines /evaluate for GET and POST.
- main.py:375-376 assigns expression = request.form["expression"] on POST.
- main.py:379 calls str(eval(expression)) when expression is present.

## BF-002: DNS lookup route concatenates request input into os.popen

- main.py:11 imports popen from os.
- main.py:171-172 defines rp(command) as popen(command).read().
- main.py:356-360 reads address from the POST form and calls rp("nslookup " + address).

## BF-003: Client-controlled cookie is deserialized with pickle

- main.py:328-329 reads request.cookies["value"] and calls pickle.loads(b64decode(...)).
- main.py:345-346 creates cookies with base64(pickle.dumps(value)), with no signature or MAC.

## BF-004: Greeting route renders user input as Jinja template source

- main.py:453-454 places request.form["name"] into an HTML fragment.
- main.py:456-467 inserts that fragment into a template string.
- main.py:468 calls render_template_string(template).

## BF-005: Product category filter is interpolated into SQL

- main.py:476 reads category = request.args.get(param).
- main.py:480-481 formats category into the WHERE clause.
- main.py:484 executes SELECT * from public_stuff plus the formatted clause.
- main.py:60-65 defines secret_stuff and main.py:77-80 seeds secret rows.

## BF-006: JWT verification trusts attacker-selected algorithms including None and HS256

- main.py:32 allows RS256, HS256, and None.
- main.py:242-263 accepts alg None with an empty signature after claim checks.
- main.py:267-279 dispatches based on jwt.get_unverified_header(token).
- main.py:216-239 verifies HS256 with the key parameter and main.py:274-275 passes VERIFY_KEY.
- main.py:531-537 exposes RSA public key material through /user/jwks.
- main.py:516-522 grants admin when claims sub equals ADMIN_USER.

## BF-007: XML route parses untrusted XML with DTD and network-capable settings

- main.py:396 reads XML from request.form["xml"].
- main.py:397 creates etree.XMLParser(no_network=False, dtd_validation=False, load_dtd=True, huge_tree=True).
- main.py:399 parses xml.encode() with etree.fromstring(..., parser).
- requirements.txt:5 requires lxml.

## BF-008: Config selector exposes AES-CBC padding/decryption oracle

- main.py:140-148 raises Bad padding from unpad.
- main.py:163-168 decrypts AES-CBC and calls unpad.
- main.py:422 reads key from query string.
- main.py:430-433 decrypts attacker-controlled ciphertext and returns str(e) on errors.
- main.py:435 checks decrypted_key against all CONFIG keys, not only viewable keys.

## BF-009: User-controlled values are reflected into HTML without escaping

- main.py:326 assigns cookieValue = request.form["value"].
- main.py:334 concatenates str(cookieValue) into the response body.
- main.py:519-523 interpolates claims sub into HTML.
- main.py:525-526 concatenates token exception text into HTML.

## BF-010: Generated JWT private key is written to predictable temporary path

- main.py:107-109 uses configured key files only if both env vars are set.
- main.py:111-114 builds predictable temp paths private.pem and public.pem.
- main.py:116-121 generates keys and writes the private key to disk.
- main.py:122-124 prints private and public key paths.
- main.py:179-190 uses the private key to sign JWTs.

## BF-011: Authentication cookie is set without Secure, HttpOnly, or SameSite

- main.py:550 calls resp.set_cookie(AUTH_COOKIE, token, expires=exp).
- main.py:513-516 reads that cookie as the bearer authentication token.
- main.py:581 allows listen address to be configured beyond default localhost.

