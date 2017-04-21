## Elasticsearch vault

Elasticsearch is a full-text search engine based on Lucene. It is powered by the [elasticsearch](https://github.com/ncb000gt/node-es)
module and supports sharding, either automatic (Elasticsearch will shard everything based on the key) or manual through the
`shard` function.


### Configuration

```yaml
elasticsearch:
    type: elasticsearch
    config:
        # this is the default index used for storage, you can override this in your code if necessary
        index: testgame
        # here is your server configuration
        server:
            hostname: '192.168.2.176'
            port: 9200
            secure: false
```

### Supported operations

operation | supported | implementation
----------|:---------:|---------------
list      |           |
get       | ✔         | `elasticsearch.get`
add       | ✔         | `elasticsearch.index` with op_type set to `create`
set       | ✔         | `elasticsearch.index`
touch     |           |
del       | ✔         | `elasticsearch.del`


### Required Topic API

signature                      | required | default implementation
-------------------------------|----------|-----------------------
`createTarget(topic, index)`   |          | use the topic as a type and urlencode the index as the id
`serialize(value)`             |          | uses live encoding but throws on Buffers
`deserialize(data, value)`     |          | parse live encoding
`shard(value)`                 |          | auto sharding by Elasticsearch

### TTL Support

Elasticsearch supports automatic expiration of documents, but not updating a documents TTL (you need to repost the whole
document) so the touch function is not available. Also, if using TTL, you will need to manually update your type's mapping
to enable ttl as is explained here: [Ttl Field Reference](http://www.elasticsearch.org/guide/reference/mapping/ttl-field/).

### Binary data storage

By default, the serialize function will fail on buffers. It is because Elasticsearch is a full-text document search engine,
as such storing binary data doesn't make much sense. If you really really do need to store binary data, I recommend
either embedding it within an object in base64 format, like:

```javascript
// retrieve our binary buffer
var picture = uploadedUserPhotoAsBuffer();

// then store it for searching stuff
var data = {
    name: 'foobar.jpg',
    tags: ['cats', 'kawaii'],
    data: picture.toString('base64');
};

state.archivist.set('photos', { userId: userId, pictureId: pictureId }, data);
```

Then manually decode it when getting it back from Elasticsearch.

Another (more recommended) way to do that is to use Elasticsearch to only store the metadata for search purposes and
store the binary file itself in a more appropriate vault (such as file).

### Searching for data

Archivist doesn't provide any way to search for data in a complex manner, if you need to search for data you will need
to call the Elasticsearch client yourself, here is an example of how to find the picture stored in the example above:

```javascript
// retrieve client
var esClient = archivist.getReadVault('elasticsearch').client;

// the index is automatically filled in from the configuration but if need you can just override _index here
var options = { _type: 'photos' };

// build query, for example every photos tagged with cats
var query = {
    query: {
        term: {
            tags: 'cats'
        }
    }
}

// then run your search query
esClient.search(options, query, function (err, data) {
    // then parse the data array
});
```

For more details about the Elasticsearch client, please read this [documentation](https://github.com/ncb000gt/node-es),
then for the Elasticsearch query language please read the [Query](http://www.elasticsearch.org/guide/reference/api/search/query/)
and [Query DSL](http://www.elasticsearch.org/guide/reference/query-dsl/) documentation on the Elasticsearch website.

### Notes about manual sharding

While it is possible to override the sharding by making the `api.shard` return a string, special attention is to be made
so that sharding always yield the same result for records, elasticsearch will not throw any error if the same id with
different data exists in 2 different shards and both values will be retrieved by the search function.