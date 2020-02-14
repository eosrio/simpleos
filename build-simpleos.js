const fs = require('fs');

const conf = require('./package.json');

conf.compilerVersion = "EOS MAINNET";
conf.name = 'simpleos';
conf.appId = "io.eosrio.simpleos";
conf.productName = 'simpleos';
conf.description = 'EOSIO Blockchain Interface & Wallet';
conf.build.appId = 'simpleos';
conf.build.win.icon = "src/favicon.ico";
conf.build.mac.icon = "icon.png";
conf.build.dmg.icon = "src/assets/icons/256x256.icns";
conf.build.linux.icon = "256x256.png";

fs.writeFileSync('./package.json', JSON.stringify(conf, null, "\t"));

