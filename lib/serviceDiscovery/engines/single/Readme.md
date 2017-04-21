## Single-server discovery engine

This engine allows you to have a fake service discovery engine, to have the
service discovery library available when you are using only one server.

The services are stored directly in memory.
In cluster mode, it uses the [process messenger](../../../processMessenger)
to exchange messages between master and workers.


### Limitations

* It works only if you have no more than one server.
