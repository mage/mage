# %APP_NAME%

## Introduction

%APP_DESCRIPTION%

## Requirements

Make sure you have a `NODE_ENV` environment variable set up to describe your environment:

### macOS, Linux

```shell
# To verify the variable's value
echo $NODE_ENV
# To set the variable
export NODE_ENV=development
```

### Windows

```powershell
# To verify the variable's value
echo $env:NODE_ENV

# To set the variable
set-item env:NODE_ENV development
```

## Setup

```shell
git clone %APP_REPO% %APP_NAME%
cd %APP_NAME%
npm install
npm run archivist:create
npm run develop
```

## For more information

  * [MAGE Documentation](https://mage.github.io/mage)

## License

All rights reserved %APP_AUTHOR%
