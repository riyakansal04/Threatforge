# Breakable Flask Architecture Diagram

```mermaid
flowchart TD
    User["HTTP client / browser"] --> Flask["Flask app instance\nmain.py:296"]

    CLI["CLI startup\nargparse options\nmain.py:577-589"] --> DBSelect["Database module selection\nsqlite / postgres / mysql / mssql / oracle\nmain.py:597-617"]
    CLI --> KeyInit["JWT key initialization\nPRIVATE_KEY_FILE + PUBLIC_KEY_FILE or generated temp keys\nmain.py:107-123"]
    DBSelect --> DBSetup["Database bootstrap\nconnect, create database/table, seed rows\nmain.py:622-656"]
    DBSetup --> Cursor["Global DB cursor\nmain.py:647"]
    KeyInit --> JWTKeys["SIGN_KEY / VERIFY_KEY\nmain.py:108-119"]
    CLI --> Server["app.run(host=args.address, port=args.port)\nmain.py:661"]
    Server --> Flask

    Flask --> Index["GET /\nindex\nmain.py:299-318"]
    Flask --> Cookie["GET/POST /cookie\ncookie form and value cookie\nmain.py:320-350"]
    Flask --> Lookup["GET/POST /lookup\nDNS lookup form\nmain.py:353-367"]
    Flask --> Eval["GET/POST /evaluate\nexpression form\nmain.py:372-386"]
    Flask --> XML["GET/POST /xml\nXML parser form\nmain.py:392-411"]
    Flask --> Config["GET /config\nconfig selector\nmain.py:417-446"]
    Flask --> SayHi["GET/POST /sayhi\ngreeting template\nmain.py:450-468"]
    Flask --> Services["GET /listservices\nproduct/service listing\nmain.py:472-505"]
    Flask --> UserHome["GET /user\nJWT-protected user page\nmain.py:510-528"]
    Flask --> JWKS["GET /user/jwks\nRSA public JWK material\nmain.py:531-537"]
    Flask --> Login["GET/POST /user/login\ncredential form + auth cookie\nmain.py:540-573"]

    Cookie --> Pickle["pickle + base64 cookie serialization\nmain.py:329,346"]
    Lookup --> OS["os.popen wrapper rp()\nmain.py:171-172,360"]
    Eval --> PyEval["Python eval()\nmain.py:379"]
    XML --> LXML["lxml etree parser\nmain.py:397-400"]
    Config --> Crypto["AES-CBC encrypt/decrypt helpers\nmain.py:140-168,424-433"]
    Config --> ConfigStore["CONFIG dictionary\nmain.py:39-45"]
    SayHi --> Jinja["render_template_string\nmain.py:468"]
    Services --> Cursor
    Cursor --> ActiveDB["Active database\nsqlite memory/file or external DB\nmain.py:622-642"]
    DBSetup --> ActiveDB
    DBData["DATABASE_TABLES + DATABASE_CONTENTS\nmain.py:49-82"] --> DBSetup
    UserHome --> Verify["verify_token dispatch\nRS256 / HS256 / None\nmain.py:211-279"]
    Verify --> JWTKeys
    JWKS --> JWTKeys
    Login --> CreateJWT["create_token_rsa\nmain.py:179-190"]
    CreateJWT --> JWTKeys
    Login --> AuthCookie["authentication cookie\nmain.py:550"]
    AuthCookie --> UserHome
```

## Evidence Notes

- Runtime entry is the `if __name__ == "__main__"` block, which parses CLI options, selects and initializes a database connector, bootstraps tables and seed data, then starts Flask with `app.run`.
- The only in-repository application process is the Flask web server. Optional external database containers are documented separately for PostgreSQL, MySQL, MSSQL and Oracle.
- Route handlers, helper functions, configuration constants, key initialization and persistence setup all live in `main.py`.
