# Anonymous Ident Engine

The anonymous ident engine allows you to quickly login without credentials.
This can be a useful timesaver during development.

The anonymous engine cannot be configured. It's always available under the name `anonymous`. It
grants the following access level:

* `anonymous` access level in production.
* `admin` access level in development mode.

When logging in, you do not have to pass credentials, and therefore may send `{}` or `null`.
