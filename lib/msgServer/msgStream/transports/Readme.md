# Message Stream Transports

## Minimal required API

* void getSessionKey()
* string[] getConfirmIds()
* void deliver(string/Buffer[])
* void sendServerError()
* void close()

It must also be an event emitter that *must* emit a "close" when closing the connection to the
client, and *may* emit "confirm" with an array of IDs that may be confirmed.
