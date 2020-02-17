const fs = require('fs');

const conf = require('./package.json');

conf.compilerVersion = "DEFAULT";
conf.name = 'simpleos';
conf.appId = "io.eosrio.simpleos";
conf.productName = 'simpleos';
conf.description = 'EOSIO Blockchain Interface & Wallet';
conf.build.appId = 'simpleos';
conf.build.win.icon = "src/favicon.ico";
conf.build.mac.icon = "other_assets/icon.png";
conf.build.dmg.icon = "src/assets/icons/256x256.icns";
conf.build.linux.icon = "other_assets/256x256.png";

fs.writeFileSync('./package.json', JSON.stringify(conf, null, "\t"));

