const fs = require('fs');

const conf = require('../package.json');

conf.compilerVersion = "DEFAULT";
conf.name = 'simpleos';
conf.appId = "io.eosrio.simpleos";
conf.productName = 'simpleos';
conf.description = 'EOSIO Blockchain Interface & Wallet';
conf.build.appId = 'simpleos';

// icons
conf.build.win.icon = "icons/simpleos/icon.ico";
conf.build.mac.icon = "icons/simpleos/icon.icns";
conf.build.linux.icon = "icons/simpleos";
conf.build.linux.executableName = "simpleos";
conf.build.linux.desktop = {
    "Name": "SimplEOS",
    "GenericName": "SimplEOS Wallet",
    "X-GNOME-FullName": "simpleos",
    "Comment": "SimplEOS Blockchain Wallet",
    "Type": "Application",
    "Terminal": "false",
    "StartupNotify": "false",
    "Categories": "Network;"
};

fs.writeFileSync('./package.json', JSON.stringify(conf, null, "\t"));

