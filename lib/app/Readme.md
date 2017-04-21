# App

Here we create instances of applications (entry points) under which user commands are exposed by MAGE.

#### Configuration

In your configuration, you can enable an app using something like this:

```yaml
apps:
    # Replace appName with the name of the app you wish to enable
    appName:
        responseCache: 180
        disabled: false
```

* `appName` (mandatory) This is the name of the app you wish to enable.
* `responseCache` (optional) Number of seconds usercommand responses should be cached for. (default: 3 mins)
* `disabled` (optional) This will determine if the app gets exposed at all. (default: true)
