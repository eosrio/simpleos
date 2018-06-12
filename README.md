<h1 align="center">
  <br>
  SimplEOS
  <br>
</h1>
<h3 align="center">
Your simple and secure EOS wallet.
</h3>

*Made with :hearts: by [EOS Rio](https://eosrio.io/)*, a Block producer candidate for the EOS ecosystem.

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

## Roadmap
As soon as mainnet is activated with 15% of votes:
- Stake/Unstake functions
- Display the other tokens

Next features to be implemented:
- Create new account *- high priority*
- Create new wallet *- high priority*
- Edit/remove contacts *- high priority*
- Testnets support
- Delegate Permissions
- Secured Delayed Transactions
- Mobile Version
- Multi languages support

## Security Measures
### Encryption & Local storage only
Your private keys are stored locally only and are properly encrypted with a user defined password of 10+ characters.

### Proxy to fetch external data
External informations outside of the blockchain (such as the Block Producer standard) are fetched via a proxy server provided by EOS Rio, to avoid malformed json data and third-party servers misconfigurations. 

## Download
- [Windows]()
- [MacOS]()
- [Linux]()

## Building Instructions

#### Windows
```console
git clone https://github.com/eosrio/simpleos.git
cd simpleos
npm install
npm run build:prod
```
Creater installer on Windows:
```
npm install -g @electron-forge/maker-squirrel
npx @electron-forge/cli make
```

For development and quick preview
```console
npm run build && npx @electron-forge/cli start
```

#### MacOS

#### Linux

## Legal Disclaimer

By downloading SimplEOS you agree to the [Terms of Service](https://eosrio.io/terms-of-service/).

## Further help

To get more help please contact our team at contact@eosrio.io or at our [Telegram channel](https://t.me/eosrio).
