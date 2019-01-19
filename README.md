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
As of 13/01/2018, SimplEOS main features include:

- Multiple chain support
- EOS Referendum system at `eosio.forum`
- Direct contract interaction
- Local Storage: private keys are encrypted and stored locally only.
- Multiple accounts support
- Token transfer
- All transactions are password protected
- Contacts List
- Transactions / Actions History
- Voting Portal
- Stake / Unstake functions - (un)delegatebw
- Support for generic tokens (airdrops)
- Custom endpoints on the mainnet
- Create new account

## Roadmap

Next features to be implemented:
- Browser library & universal integration
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

- Windows (32/64-bit): [**simpleos.setup.0.7.1.exe**](https://github.com/eosrio/simpleos/releases/download/v0.7.1/simpleos.setup.0.7.1.exe)
  - `0c1adb9d2c43c233bee7746486555f3ee3c033cad377df44cfdba904a5637acf`
- Linux
  - [**simpleos.0.7.1.AppImage**](https://github.com/eosrio/simpleos/releases/download/v0.7.1/simpleos.0.7.1.AppImage)
  `3d542787c723bd0116e9f493d50ece47ee18160a3a577c71c0b3a98c69be4c49`
  - [**simpleos_0.7.1_amd64.deb**](https://github.com/eosrio/simpleos/releases/download/v0.7.1/simpleos_0.7.1_amd64.deb)
  `0771fc0876c00981b4bb710b03638d1c25dedef1c757197451fb7f9b2394ddd7`  
- MacOS: [**simpleos-0.7.1.dmg**](https://github.com/eosrio/simpleos/releases/download/v0.7.1/simpleos-0.7.1.dmg)
  - `39f0627a72d13387daf4f1042738416849d03cb2cd2111f19a7b8ff22de461d6`

## Legal Disclaimer

By downloading SimplEOS you agree to the [Terms of Service](https://eosrio.io/terms-of-service/).

## Build it yourself

[Yarn](http://yarnpkg.com/) is [strongly](https://github.com/electron-userland/electron-builder/issues/1147#issuecomment-276284477) recommended instead of npm.

### Dependencies Setup
- [Node.js 11.6.0](https://nodejs.org/en/download/current/)

## Setup sources:
```console
git clone https://github.com/eosrio/simpleos.git
cd simpleos
npm install
npm run build:prod
```
Package the installer:
```
npm run dist
```
The packages will be available on the `/dist` folder.

## Further help

To get more help please contact our team at contact@eosrio.io or at our [Telegram channel](https://t.me/eosrio).
