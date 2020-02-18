const fs = require('fs');
const conf = require('../package.json');

conf.compilerVersion = "LIBERLAND";
conf.name = 'liberland-wallet';
conf.appId = "io.eosrio.liberland-wallet";
conf.productName = 'Liberland Wallet';
conf.description = 'Liberland Blockchain Wallet';
conf.build.appId = 'liberland-wallet';
conf.build.win.icon = "src/assets/liberland_256_LdC_icon.ico";
conf.build.dmg.icon = "src/assets/icons/liberland256x256.icns";
conf.build.mac.icon = "other_assets/liberland518x518.png";
conf.build.linux.icon = "other_assets/liberland256x256.png";

fs.writeFileSync('package.json', JSON.stringify(conf, null, "\t"));

