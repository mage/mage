# Requirements

## Node.js

<aside class="notice">
We recommend using version 4 since it is an LTS version
</aside>

```shell
nvm install 4
nvm use 4
```

```powershell
# You will need to provide the specific version to install and use
Install-NodeVersion v4.8.2
Set-NodeVersion v4.8.2
```

Node.js (or Node) is essentially JavaScript for servers, and the MAGE platform has been built on it.
There are some concepts you will most likely benefit from understanding before getting started on a
serious Node project. Here are some resources which might help you make your first steps on Node:

  * [The Node Beginner Book](http://www.nodebeginner.org)
  * [NodeSchool](http://nodeschool.io)
  * [Node API Documentation](http://nodejs.org/api)


We recommend using the following Node.js version manager depending on your platform:

  * macOS, Linux: [NVM](https://github.com/creationix/nvm).
  * Windows: [ps-nvmw](https://github.com/aaronpowell/ps-nvmw)

## NPM

> NPM command completion is not available on Windows

```shell
npm install -g npm@latest
npm completion >> ~/.bashrc

npm run [tab][tab]
# Will output: archivist-create   archivist-drop     archivist-migrate  develop  [...]
```

```powershell
npm install -g npm@latest
```


NPM will ship by default with your Node.js installation. However,
since bugs are fixed in later versions, we strongly recommend
to periodically update your NPM installation to make sure to
get all the fixes.

This project, as well as the projects it generates on bootstrap,
use NPM for all its build task. Therefore, we also recommend
to set up NPM command completion in your terminal.
See https://docs.npmjs.com/cli/completion for more details.
