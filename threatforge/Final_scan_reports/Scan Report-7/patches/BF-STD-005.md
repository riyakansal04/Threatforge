# BF-STD-005: Config endpoint decrypts attacker-controlled ciphertext and returns padding errors
File path: `main.py`

Function/route/component: `main.py / config route`

Root cause: The config route decrypts arbitrary key query values with AES-CBC and returns raw exception text.

Proposed fix: Replace decryptable config links with HMAC-signed config-key tokens and generic invalid-key errors.

Potential side effect: Previously generated encrypted config links become invalid.

## Replacement 1

### Replace this

```python
    crypt = lambda x : hexlify(encrypt(x.encode(), KEY)).decode('utf8')
```

### With this

```python
    crypt = sign_config_key
```

## Replacement 2

### Replace this

```python
            kv = unhexlify(key)
            decrypted_key = decrypt(kv, KEY).decode('utf8')
        except Exception as e:
            return str(e)
```

### With this

```python
            decrypted_key = verify_config_key(key)
        except Exception:
            return 'Invalid config key'
```

## Insert Helper

Insert near the existing helper functions before the affected route uses it.

### With this

```python
def sign_config_key(config_key):
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
    return key_bytes.decode()
```

## Equivalent Unified Diff

```diff
diff --git a/main.py b/main.py
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
```

## Remediation Test

```python
def test_config_token_verification_rejects_tampering():
    token = main.sign_config_key("app_name")
    assert main.verify_config_key(token) == "app_name"
    with pytest.raises(ValueError):
        main.verify_config_key(token + "tampered")

```
