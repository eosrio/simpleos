<h1 align="center">
  <br>
  SimplEOS
  <br>
</h1>
<h3 align="center">
Your simple and secure EOS wallet.
</h3>

*Made with :hearts: by [EOS Rio](https://eosrio.io/)*, a Block producer candidate for the EOS ecosystem.

[![Build Status](https://travis-ci.com/eosrio/simpleos.svg?branch=master)](https://travis-ci.com/eosrio/simpleos)

# About

SimplEOS is a wallet made solely for the EOS ecosystem and fully integrated with all features available in the EOS.IO software.
 
EOS Rio made SimplEOS with a security and transparency philosophy. It is a desktop application compatible with the most popular operation systems (Windows, Linux and MacOS).

User experience focus was also a main part of SimplEOS creation process.  

## Warning

Only download SimplEOS from EOS Rio's [website](https://eosrio.io/simpleos/) or [github](https://github.com/eosrio/simpleos). Avoid scams, do not trust any other source.

Distribution or copy of this software or any of its parts and associated documentation, is not allowed by applicable law, unless previous written permission is given by EOS Rio. All rights are reserved.

SimplEOS doesn't keep any of your information. All information is kept locally only, not in any cloud services or databases.

## Main Features
As of 12/06/2018, SimplEOS main features include:

- Local Storage: private keys are encrypted and stored locally only.
- Import Exodus wallet
- Multiple accounts support
- Token transfer
- All transactions are password protected
- Contacts List / Add contacts
- Transactions / Actions History
- Voting Portal
- Stake / Unstake functions - (un)delegatebw
- Support for generic tokens (airdrops)
- Custom endpoints on the mainnet
- Create new account

## Roadmap

Next features to be implemented:
- Edit / Remove contacts *- high priority*
- Testnets support
- Delegate Permissions
- Setup Delayed Transactions
- Mobile Version
- Multi languages support

## Security Measures
### Encryption & Local storage only
Your private keys are stored locally only and are properly encrypted with a user defined password of 10+ characters.

### Proxy to fetch external data
Off-chain information (such as the Block Producer standard) are fetched via a proxy server provided by EOS Rio, to avoid malformed json data and third-party servers misconfigurations. 

## Download a pre-compiled build
- [Windows](https://github.com/eosrio/simpleos/releases/download/v0.6.2-1/simpleos.Setup.0.6.2-1.exe)
  - `d4b5b4fa569f00764a82184fc4b86df9e21c6bfd36e7c26c9c5e82dae7b9bd02  simpleos Setup 0.6.2-1.exe`
- [MacOS](https://github.com/eosrio/simpleos/releases/download/v0.6.2-1/simpleos-0.6.2-1.dmg)
  - `04516e87629331f27bd4a3ecdff5d24278ff9a8fca241ec440f781775d00755c  simpleos-0.6.2-1.dmg`
- [Linux AppImage](https://github.com/eosrio/simpleos/releases/download/v0.6.2/simpleos-0.6.2-x86_64.AppImage)
  - `eee5f46b806853539d2401276cf900ace592affcddca59ad0f6f1a2a4f83dd22  simpleos-0.6.2-x86_64.AppImage`
- [Linux DEB](https://github.com/eosrio/simpleos/releases/download/v0.6.2/simpleos_0.6.2_amd64.deb)
  - `a2e9bce3c52af931bc0ee3679374c0cb4327b30b8e67af61951cfae5303b55e4  simpleos_0.6.2_amd64.deb`

## Legal Disclaimer

By downloading SimplEOS you agree to the [Terms of Service](https://eosrio.io/terms-of-service/).

## Build it yourself

[Yarn](http://yarnpkg.com/) is [strongly](https://github.com/electron-userland/electron-builder/issues/1147#issuecomment-276284477) recommended instead of npm.

### Dependencies Setup

#### Windows
- [Node.js](https://nodejs.org/en/download/current/)
- [Yarn](https://yarnpkg.com/en/docs/install#windows-stable)

#### Ubuntu
```
# Install Node.js 10
curl -sL https://deb.nodesource.com/setup_10.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo apt-get install -y build-essential

# Install Yarn
curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | sudo apt-key add -
echo "deb https://dl.yarnpkg.com/debian/ stable main" | sudo tee /etc/apt/sources.list.d/yarn.list
sudo apt-get update && sudo apt-get install yarn
```

#### Fedora / Red Hat®
```
# Install Node.js 10
curl --silent --location https://rpm.nodesource.com/setup_10.x | sudo bash -
sudo yum -y install nodejs
sudo yum install gcc-c++ make

# Install Yarn
curl --silent --location https://dl.yarnpkg.com/rpm/yarn.repo | sudo tee /etc/yum.repos.d/yarn.repo
sudo yum install yarn
```

#### MacOS
```
# Install brew
/usr/bin/ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)"

# Install Node.js 10
brew install node

# Install Yarn
brew install yarn
```

#### MacOS Development
```
# cd in to directory where Metatron was cloned

# Install dependencies
yarn install

# Build project
yarn build

# Option 1: Run Electron
./node_modules/.bin/electron .

# Option 2: Run Electron with dev tools
./node_modules/.bin/electron . --devtools

```

## Setup sources:
```console
git clone https://github.com/eosrio/simpleos.git
cd simpleos
yarn install
yarn run build:prod
```
Create installer:
```
yarn dist
```
The packages will be available on the `/dist` folder.

## Further help

To get more help please contact our team at contact@eosrio.io or at our [Telegram channel](https://t.me/eosrio).
