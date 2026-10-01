# Architecture-Level Threat Model Diagram

```mermaid
flowchart TD
    Attacker["Unauthenticated HTTP client\nor browser user"] --> HTTP["Flask HTTP routes\nmain.py:299-573"]

    HTTP --> Cookie["/cookie\npickle cookie decode\nmain.py:320-350"]
    HTTP --> Lookup["/lookup\nnslookup via rp()\nmain.py:353-367"]
    HTTP --> Evaluate["/evaluate\nPython eval\nmain.py:372-386"]
    HTTP --> XML["/xml\nlxml parser\nmain.py:392-411"]
    HTTP --> Config["/config\nAES selector decrypt\nmain.py:417-446"]
    HTTP --> SayHi["/sayhi\nrender_template_string\nmain.py:450-468"]
    HTTP --> Services["/listservices\nSQL query through cursor\nmain.py:472-505"]
    HTTP --> UserLogin["/user/login\nJWT issuance\nmain.py:540-573"]
    HTTP --> UserHome["/user\nJWT verification\nmain.py:510-528"]
    HTTP --> JWKS["/user/jwks\npublic RSA JWK\nmain.py:531-537"]

    Cookie --> ProcessAuthority["Python process authority\nfilesystem, process memory, DB cursor, network as available"]
    Lookup --> OSBoundary["OS shell/process boundary\nos.popen\nmain.py:171-172"]
    OSBoundary --> ProcessAuthority
    Evaluate --> ProcessAuthority
    SayHi --> TemplateEngine["Jinja template engine\nmain.py:468"]
    TemplateEngine --> ProcessAuthority

    XML --> XMLParser["lxml XML parser\nDTD/network-enabled options\nmain.py:397-400"]
    XMLParser --> LocalFiles["Local files / network destinations\nconditional on parser/runtime access"]

    Config --> Crypto["AES-CBC decrypt/unpad\nmain.py:140-168"]
    Crypto --> ConfigSecrets["CONFIG hidden entries\nKEY and ADMIN_SECRET references\nmain.py:39-45"]

    Services --> SQLBuilder["String-built SQL WHERE clause\nmain.py:480-484"]
    SQLBuilder --> DB["Active relational DB\nsqlite or external DB\nmain.py:622-656"]
    DB --> PublicData["public_stuff\nmain.py:49-59"]
    DB --> SecretData["secret_stuff\nmain.py:60-82"]

    UserLogin --> AuthCookie["authentication cookie\nmain.py:550"]
    AuthCookie --> UserHome
    JWKS --> VerifyKey["VERIFY_KEY public material\nmain.py:533-536"]
    UserHome --> JWTDispatch["verify_token algorithm dispatch\nRS256 / HS256 / None\nmain.py:267-279"]
    JWTDispatch --> AdminState["Admin authorization state\nADMIN_USER check\nmain.py:518-522"]
    VerifyKey --> JWTDispatch
```

## Diagram Scope

This diagram shows trust-boundary crossings and sensitive consumers evidenced by the implementation. It is a threat-model diagram, not a validated vulnerability report and not a remediation plan.
