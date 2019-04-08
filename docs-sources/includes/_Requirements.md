# Requirements

## Node.js

<aside class="warning">
MAGE only supports node from version 8.x
We recommend using the most recent Active LTS version, but we always try to support the Current Release as well.

You can see what the LTS and Current versions are in the Node.js
<a href="https://github.com/nodejs/Release#release-schedule">release schedule</a>.
</aside>

```shell
nvm install 8
nvm use 8
```

```powershell
# You will need to provide the specific version to install and use
Install-NodeVersion v8.10.0
Set-NodeVersion v8.10.0
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
# Will output: archivist:create   archivist:drop     archivist:migrate  develop  [...]
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
