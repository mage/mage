# Message Stream

## The protocol

The serialization protocol used by the message stream is the same regardless of the transport type
used. Packages of messages are formatted in JSON as follows:

```json
{
  "1": [
    ["some.event.name"],
    ["another.event", { "some": "data" }]
  ],
  "2": [
    ["eventname", { "any": "data" }]
  ]
}
```

The key represents the message pack ID, which increments by 1 for each batch of messages emitted.
Messages must be processed in order of message pack ID and the array order in which they occur. The
content of the message is an array of 1 or 2 elements.

The first element is a string that represents the type of the message. This may be used as the event
name in a client-side event emitter. The optional second element is the real payload of the message.

Message types may be dot-separated. A client may choose to implement delivery of messages through
the emission of an event in chunks from most-relevant to least-relevant. For example, the message of
type `shop.purchase` with data `{ "item": "boots" }` may be emitted twice:

1. `shop.purchase` with data `{ "item": "boots" }`
2. `shop` with data `{ "item": "boots" }`

Because networks (especially mobile) are not always reliable, MAGE will keep all messages on the
server until the client actively reports successful delivery. This is done per message pack ID.
Successful reception of these messages must be confirmed back to the server. Each transport
implements this mechanism in its own way.


## Transport types

### HTTP short-polling

With short-polling, the endpoint for message retrieval becomes:

```plaintext
GET http://domain/msgstream?sessionKey=abc&transport=shortpolling&confirmIds=1,2,3
```

Always be sure to pass the active session key for this user. Without it, no messages can be
delivered. If messages are available, they will be returned in the format described in
"The protocol", with content-type `application/json` and HTTP status code `200`. If no messages are
available, HTTP status code `204` will be returned without a response body.

Message pack IDs you want to confirm are to be sent back in the URL's query string named
`confirmIds` and must be comma separated.

### HTTP long-polling

With long-polling, the endpoint for message retrieval becomes:

```plaintext
GET http://domain/msgstream?sessionKey=abc&transport=longpolling&confirmIds=1,2,3
```

Always be sure to pass the active session key for this user. Without it, no messages can be
delivered. If messages are available, they will be returned in the format described in
"The protocol", with content-type `application/json` and HTTP status code `200`. This is no
different from short-polling. If there are no messages available however, the connection will hang
and wait for messages to arrive. The moment messages are ready for delivery, the HTTP request will
return with HTTP status code `200` and content-type `application/json`.

In order to reliably detect clients' unavailability, the server will periodically close the
connection to the client. It is up to the client to detect this, and reconnect with the server to
make its presence known. The disconnect will happen with HTTP status code `204` and does not carry a
response body.

Message pack IDs you want to confirm are to be sent back in the URL's query string named
`confirmIds` and must be comma separated.

### WebSocket

The WebSocket endpoint is:

```plaintext
ws://domain/msgstream?sessionKey=abc
```

Always be sure to pass the active session key for this user. Without it, no messages can be
delivered. If messages are available, they will be returned in the format described in
"The protocol".

Message pack IDs you want to confirm are to be sent back in single strings that are simply all the
IDs comma separated. For example: `1,2,3`.
