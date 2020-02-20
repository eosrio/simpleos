const fs = require('fs');
const conf = require('../package.json');

conf.compilerVersion = "LIBERLAND";
conf.name = 'liberland-wallet';
conf.appId = "io.eosrio.liberland-wallet";
conf.productName = 'Liberland Wallet';
conf.description = 'Liberland Blockchain Wallet';
conf.build.appId = 'liberland-wallet';

// icons
conf.build.win.icon = "icons/liberland";
conf.build.mac.icon = "icons/liberland";
conf.build.linux.icon = "icons/liberland";
conf.build.linux.executableName = "liberland-wallet";
conf.build.linux.desktop = {
    "Name": "Liberland Wallet",
    "GenericName": "Liberland Wallet",
    "X-GNOME-FullName": "liberland-wallet",
    "Comment": "Liberland Blockchain Wallet",
    "Type": "Application",
    "Terminal": "false",
    "StartupNotify": "false",
    "Categories": "Network;"
};

fs.writeFileSync('./package.json', JSON.stringify(conf, null, "\t"));

