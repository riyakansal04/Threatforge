# BF-STD-008: JWT verifier accepts None and HS256 algorithms based on untrusted token header
File path: `main.py`

Function/route/component: `main.py / verify_token`

Root cause: verify_token dispatches verification from the untrusted JWT alg header and allows None and HS256.

Proposed fix: Pin JWT verification to RS256 with expected audience and issuer.

Potential side effect: None and HS256 tokens are rejected.

## Replacement 1

### Replace this

```python
ALLOWED_ALGORITHMS = ['RS256', 'HS256', 'None']
```

### With this

```python
ALLOWED_ALGORITHMS = ['RS256']
```

## Replacement 2

### Replace this

```python
    headers = jwt.get_unverified_header(token)
    if headers.get('alg') not in algorithms:
        raise Exception('Invalid algorithm specified')
    if headers.get('alg') == 'RS256':
        return verify_token_rsa(token, verify_key)
    if headers.get('alg') == 'HS256':
        return verify_token_hs256(token, verify_key)
    if headers.get('alg') == 'None':
        return verify_token_none(token, verify_key)
    raise Exception('Unknown error in token validation')
```

### With this

```python
    return jwt.decode(token, verify_key, algorithms=['RS256'], audience=audience, issuer=issuer)
```

## Equivalent Unified Diff

```diff
diff --git a/main.py b/main.py
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
```

## Remediation Test

```python
def test_verify_token_rejects_none_algorithm():
    with pytest.raises(Exception):
        main.verify_token(unsigned_token(main.ADMIN_USER), main.VERIFY_KEY)

```
