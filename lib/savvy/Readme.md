# Savvy

## API

Savvy provides an HTTP server for various management interfaces. When running your project without
a master node, it will use the normal MAGE HTTP server. If there is a master process, Savvy will sit
in this master process, catching all HTTP requests to `/savvy/...`. This makes it ideal for serving
data that the master process may be aggregating from workers. Two examples of this are the logger,
and the sampler subsystems.

* `getBaseUrl()`
* `addRoute(pathMatch, handler, type)`

The base URL is configuration driven, and can be resolved with the `getBaseUrl` function.

`addRoute` is identical to the `addRoute` method of the MAGE HTTP server, except that it will make
sure you are not registering a route outside of the `/savvy/` URL space. Also, when calling this on
a worker node, it will be a no-operation. Savvy only registers your routes on the master node.
