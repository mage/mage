## DynamoDB vault

Excerpt from Amazon:

> Amazon DynamoDB is a fully managed NoSQL database service that provides fast and predictable
> performance with seamless scalability. If you are a developer, you can use Amazon DynamoDB to
> create a database table that can store and retrieve any amount of data, and serve any level of
> request traffic. Amazon DynamoDB automatically spreads the data and traffic for the table over
> a sufficient number of servers to handle the request capacity specified by the customer and the
> amount of data stored, while maintaining consistent and fast performance. All data items are stored
> on Solid State Disks (SSDs) and are automatically replicated across multiple Availability Zones
> in a Region to provide built-in high availability and data durability.


### Configuration

For production, use a config similar to this:

```yaml
dynamodb:
    type: "dynamodb"
    config:
        accessKeyId: "The access ID provided by Amazon"
        secretAccessKey: "The secret ID provided by Amazon"
        region: "A valid region. Refer to the Amazon doc or ask your sysadmin. Asia is ap-northeast-1"
```

For a development environment running it's own DynamoDB, use this:

```yaml
dynamodb:
    type: "dynamodb"
    config:
        # accessKeyId and region are used to generate the database name, secret will be ignored
        accessKeyId: "Your name is a good idea here"
        secretAccessKey: "Any value, will be ignored"
        region: "And here the game/project name is a good idea"
        endpoint: "hostname:port"
        sslEnabled: false
```


### Supported operations

operation | supported | implementation
----------|:---------:|---------------
list      |           |
get       | ✔         | `DynamoDB.getItem`
add       | ✔         | `DynamoDB.putItem` with `Expect.exists = false` set to the index keys
set       | ✔         | `DynamoDB.putItem`
touch     |           |
del       | ✔         | `DynamoDB.deleteItem`


### Required Topic API

signature                      | required | default implementation
-------------------------------|----------|-----------------------
`createKey(index)`             |          | `{ index1: { 'S': 'value1' }, index2: ... }`
`serialize(value)`             |          | `{ data: { 'S': utf8FromValue }, mediaType: { 'S': value.mediaType } }`
`deserialize(data, value)`     |          | parses row.data and row.mediaType into Value
`transformError(value, error)` |          | `if (error.code === knownError) return new Error('Comprehensive message')`
`consistent`                   |          | A boolean, default to true


### Reads consistency

By default reads made directly through the DynamoDB vault are eventually consistent, but for calls
made through archivist the consistency is set to strongly consistent by default in the API.
Strongly consistent calls are more expensive and slower than eventually consistent ones, so if you
feel that your table doesn't need to be strongly consistent, feel free to change the "consistent"
boolean in the topic DynamoDB API to false.


### Schema migrations

Archivist allows for [schema migrations](../../SchemaMigrations.md), and the DynamoDB vault supports
this.

When writing migration scripts, please refer to
[Class: AWS.DynamoDB](http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB.html) for more
details on how to use the DynamoDB class exposed by the vault as `vault.dynamodb`. For most tables
you will only need to create the indexes (at least 1 Hash index, 1 optional Range index and up to 5
secondary indexes), all other columns are created dynamically at insert time by DynamoDB.

See [Amazon DynamoDB Data Model](http://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DataModel.html)
for more details on how you should choose your Hash and Range indexes.

For the mandatory `ProvisionedThroughput` map in the createTable object, values for production
should be 100 `ReadCapacityUnits` and 20 `WriteCapacityUnits`, then please ask the game's sysadmins
to take care of updating those values manually to more appropriate numbers. This has a direct impact
on the price Amazon charges for the service.


### How to set up your DynamoDB tables

The default driver expects a table with a basic HashKey and optional RangeKey both set as strings,
it will then store data serialized in 2 columns named `data` and `mediaType`.

If you need to explicitly unpack your data in multiple columns, you will need to override serialize
and deserialize like in the following example:

```javascript
exports.people.vaults.dynamodb.serialize = function (value) {
    // serialize the primary keys as usual
    var item = this.createKey(value.index);

    // store manually in each column
    item.fullName = { 'S': value.data.fullName };
    item.email = { 'S': value.data.email };

    // AWS requires everything to be strings, even numbers, when sent through their API
    item.age = { 'N': value.data.age.toString() };
    item.interests = { 'SS': value.data.interests };

    return item;
};

// make sure to override deserialize too!

exports.people.vaules.dynamodb.deserialize = function (data, value) {
    // just read data from DynamoDB, you may need to do some type conversions manually
    value.setData(null, {
        fullName: data.fullName.S,
        email: data.email.S,
        age: parseInt(data.age.N, 10),
        interests: data.interests.SS
    });
}
```
