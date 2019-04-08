# HTTP Server

You might end up in a case where you would like to do one
of the following:

  1. Serve files from your MAGE server (useful when developing HTML5 games)
  2. Serve service status files (or content)
  3. Proxy requests to a remote server through MAGE

To this end, MAGE provides to developers an [API](./api/interfaces/imagecore.html#httpserver) that will allow you
to do such things.

## Cross-Origin Resource Sharing (CORS)

If you want your application to span multiple domains, you need to enable CORS. For information on
what CORS is, please consult the following websites.

- [HTML5 Rocks tutorial](http://www.html5rocks.com/en/tutorials/cors/)
- [Mozilla](https://developer.mozilla.org/en/docs/HTTP/Access_control_CORS)
- [w3c spec](http://www.w3.org/TR/cors/)

### Performance

Keep in mind that using CORS will often cause so-called "preflight" requests. A preflight request
is an HTTP `OPTIONS` request to the server to confirm if a request is allowed to be made in a manner
that is considered safe for the user. Only after this confirmation will a real `GET` or `POST`
request be made. All this happens invisible to the end user and developer, but there is a
performance penalty that you pay, caused by this extra round trip to the server.

### Using authentication and CORS

If you use `Basic` or any other HTTP authentication mechanism, you cannot configure CORS to allow
any origin using the `*` wildcard symbol. In that case, you must specify exactly which origin is
allowed to access your server.

### Configuration

In your configuration, you can enable CORS like this:

```yaml
server:
    clientHost:
        cors:
            methods: "GET, POST, OPTIONS"
            origin: "http://mage-app.wizcorp.jp"
            credentials: true
```

* `methods` (optional) lists which HTTP request methods are acceptable.
* `origin` (optional) sets the required origin, may be (and defaults to) `"*"`
* `credentials` (optional) must be set to `true` if you want cookies and HTTP
  authentication to be usable at all. You can then no longer use the wildcard origin.

## Log Configuration

```yaml
server:
    quietRoutes: # Filter out debug and verbose logs for URLs matching these regex
        - ^\/check\.txt
        - ^\/favicon\.ico
    longRoutes: # Filter out long warnings for U##### What does it change for other browsers?

Absolutely nothing. And you can still apply the retry logic on network errors, it's not a bad idea.RLs matching these regex
        - ^\/msgstream
    longThreshold: 500 # The number of milliseconds before a request is considered to be taking too long
````

The following logs will be filtered out when the url for the request matches any regex in the
`quietRoutes`:

```plaintext
m-28019 - 19:58:44.830     <debug> [MAGE http] Received HTTP GET request: /check.txt
m-28019 - 19:58:44.830   <verbose> [MAGE http] Following HTTP route /check.txt
```

The following log will be shown for any http request that takes longer than the configured
`longThreshold` and can be filtered out when the url for the request matches any reges in the
`longRoutes`:

```plaintext
m-876 - 20:08:58.193   <warning> [MAGE http] /app/pc/landing completed in 1181 msec
```