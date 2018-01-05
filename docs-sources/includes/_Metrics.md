# Metrics

MAGE exposes different metrics out of the box.

## Configuration

<aside class="notice">
This is not configured by default by a MAGE bootstrap.
</aside>

> config/default.yaml

```yaml
sampler:
    sampleMage: false
    intervals:
        metrics: 1000 # Sampling time window, in milliseconds
```

There are essentially two configuration elements which you can set
in your configuration:

  * **sampleMage**: activate or deactivate MAGE's internal metrics
  * **intervals**: define endpoint(s) where to expose the metrics.

Depending on your needs, you may wish to configure multiple endpoints, but
in many cases, one will suffice.

## Accessing metrics

> Query sampler

```shell
curl http://localhost:8080/savvy/sampler/metrics
```

```powershell
 Invoke-RestMethod -Method Get -Uri "http://localhost:8080/savvy/sampler/metrics" | ConvertTo-Json
```

> Response

```json
{
  "id": 0,
  "name": "metrics",
  "interval": 1,
  "data": {}
}
```

Unless you turn `sampleMage` to true (and you really should!), the amount
of data that will be returned will be minimal.

However, when turning `sampleMage` on, you will be able to see things such as number
of state errors, mean latency per user command, and so on.

## Adding custom metrics

> lib/modules/players/usercommands/countClicks.js

```javascript
var mage = require('mage');
var sampler = mage.core.sampler;

exports.acl = ['*']

exports.execute = function (state, callback) {
	sampler.inc(['players', 'clicks'], 'count', 1);
	callback();
};
```

> Trigger clicks

```shell
curl -X POST http://127.0.0.1:8080/game/players.countClicks \
--data-binary @- << EOF
[]
{}
EOF
```

```powershell
 Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8080/game/players.countClicks" -Body '[]
{}' | ConvertTo-Json
```

> New sampler output

```plaintext
[...]
  "data": {
    "players": {
      "clicks": {
        "count": {
          "type": "inc",
          "values": {
            "1": {
              "val": 4,
              "timeStamp": 1491400000000
[...]
```

Here we can see a full example of how we can create our own custom metrics and then
access them.

Sampler values are defined on-the-fly; therefore, you must be careful when
choosing a sampler key for your metrics, so to avoid overlaps.

See [the sampler API documentation](./api/interfaces/imagecore.html#sampler) for more documentation.
