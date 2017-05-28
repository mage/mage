# Introduction

MAGE is a Game Server Framework for Node.js. It allows game developers to quickly create
highly interactive games that are performant and scalable.

Why MAGE?
---------

### Write interactive games

Even if you are writing a single-player game, you may want to develop
features such as ranking and shops, store player information, or send
push notifications to your game clients.

MAGE makes this easy by providing both a framework to create RPC calls
(called user commands), and by providing a backend API to send asynchronous
messages between players.

### Write multiplayer games

MAGE's *forte* comes down to writing multiplayer games. MAGE
is an excellent fit for writing PVP games.

### Scalable game servers

One of MAGE's goal is to make it easy to write game servers that scale.

But scale how? More specifically, MAGE helps you:

  - Scale your code; MAGE helps you write code that fits in your head
  - Scale your runtime; your game server will run on your laptop, in
    a large cluster, and on anything in between
  - Scale your ops; MAGE provides all the necessary APIs for you to be
    able to monitor your game server

### Rich ecosystem

MAGE provides only the primitives required to write interactive games. However,
MAGE comes with a rich ecosystem of official and third-party modules that will help
you add features such as static data management, maintenance management, and so on.

Official MAGE modules can be found on [GitHub](https://github.com/mage). We also
often showcase external modules (and how to use them) on our
[development blog](https://medium.com/mage-framework).

Features
--------

### TypeScript & JavaScript

MAGE actively supports both JavaScript and TypeScript projects; you can easily choose in which language you wish to create a project, and many tools support both languages.

### Transactional API endpoints

This is the core feature of MAGE; it provides you with a
[State API](#states) that helps you create transactional API endpoints.

Transactional API endpoints (named [user commands](#user-commands))
will allow you to stack all your data mutations and asynchronous messages
on a state object. This state object will either automatically be commited
once your API call completes, or rollback if an error occurs.

### Multiple storage backends

The [data storage API](#archivist) allows you to abstract your storage
backend. Not only it will allow you to access and store data to your
database of choice, but it will also help you with database migrations
whenever needed.

### Built-in distributed mode

Thanks to the built-in [service discovery system](api.html#service-discovery),
all you need to do to deploy your game server in a cluster is configure
the discovery service.

This means that your messages will always be routed to the right server and
correctly forwarded to the right player.

### Rich ecosystem of SDKs, modules and tools

MAGE officially provides client SDKs for both
[HTML5](https://github.com/mage/mage-sdk-js) and
[Unity](https://github.com/mage/mage-sdk-unity) games,
making it easier than ever to connect your game to your servers.

On top of that, the [mage organization on GitHub](https://github.com/mage)
hosts a wide range of additional tools and modules which can help you
with various aspects of your MAGE development pipeline.
