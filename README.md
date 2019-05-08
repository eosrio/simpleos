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
- REX Support
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

- Windows (64-bit): [**simpleos.Setup.0.8.0.exe**](https://github.com/eosrio/simpleos/releases/download/v0.8.0/simpleos.Setup.0.8.0.exe)
  - `374c598ee58bda0966344d899b732a33add8b3d962c3aa0e635475244e6a5f58`
- Linux
  - [**simpleos.0.8.0.AppImage**](https://github.com/eosrio/simpleos/releases/download/v0.8.0/simpleos.0.8.0.AppImage)
  `9176f7cbd08e869da82f220633647d77e2bd23c976dea438814dc45245f2f99a`
  - [**simpleos_0.8.0_amd64.deb**](https://github.com/eosrio/simpleos/releases/download/v0.8.0/simpleos_0.8.0_amd64.deb)
  `dfe371b95b6664485dd24eec2ad3ef4c4e11770f3318c54a6f3863bbcd725327`  
- MacOS: [**simpleos-0.8.0.dmg**](https://github.com/eosrio/simpleos/releases/download/v0.8.0/simpleos-0.8.0.dmg)
  - `fec8bf0ec532bb689bc2eb41c7d6ca04ce36351aef083796b7a6bd79fbadcb73`

## Legal Disclaimer

By downloading SimplEOS you agree to the [Terms of Service](https://eosrio.io/terms-of-service/).

## Build it yourself

### Dependencies Setup
- [Node.js 12.2.0](https://nodejs.org/en/download/current/)

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
