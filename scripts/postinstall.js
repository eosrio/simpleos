const fs = require('fs');

// patch webpack browser config for electron
const f_angular = 'node_modules/@angular-devkit/build-angular/src/angular-cli-files/models/webpack-configs/browser.js';
const data = fs.readFileSync(f_angular, 'utf8');
if (!data) {
    return console.log('failed to read:' + f_angular);
}
let result = data.replace(/target: "electron-renderer",/g, '');
result = result.replace(/target: "web",/g, '');
result = result.replace(/return {/g, 'return {target: "electron-renderer",');
result = result.replace(/node: false/g, 'node: {crypto: true, stream: true}');
fs.writeFileSync(f_angular, result, 'utf8');

// Copy electron typings
fs.copyFileSync('src/types/electron.bak', 'node_modules/electron/electron.d.ts');
