# LDAP Ident Engine

The `ldap` engine provides a username/password identification mechanism that queries an LDAP server
for checking the user credentials. It uses the [ldapjs](https://npmjs.org/package/ldapjs) module
and requires you to have access to a functional LDAP server.

## Configuration

This is the engine configuration, please ask your system administrators for the values to use:

```yaml
config:
    # The URL is where to query the server, use ldap:// for unencrypted access and ldaps:// for ssl.
    url: 'ldap://ldap.my.organization.com'

    # The base DN is something your administrator should know, it is the location where your users
    # are stored on the ldap server.
    baseDn: 'ou=users,dc=my,dc=organization,dc=com'

    # By default we match the username on the "uid" attribute of the user, which is a safe default,
    # but in some cases you may need to override it based on your ldap server and configuration.
    #uidAttr: "uid"
```

## Parameters

These are the parameters you can give to the `check` function for that engine:

* __username__ _(string)_: The user's username.
* __password__ _(string)_: The user's password.
