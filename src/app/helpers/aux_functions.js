"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertFraction = exports.makeUndelegateBW = exports.makeDelegateBW = exports.makeAsset = exports.makeSingleKeyAuth = exports.contentStyle = exports.compare2FormPasswords = exports.handleErrorMessage = exports.parseTokenValue = void 0;
function parseTokenValue(value) {
    if (typeof value === 'number') {
        return value;
    }
    else if (typeof value === 'string') {
        return parseFloat(value.split(' ')[0]);
    }
    else {
        return value;
    }
}
exports.parseTokenValue = parseTokenValue;
function handleErrorMessage(e) {
    let errormsg;
    if (e.message.includes('Invalid checksum')) {
        errormsg = 'invalid private key';
    }
    else if (e.message === 'no_account') {
        errormsg = 'No account associated with this private key';
    }
    else if (e.message === 'non_active') {
        errormsg = 'This is not the active key. Please import the active key.';
    }
    else if (e.message === 'api_arror') {
        errormsg = 'API Unavailable, please try again with another endpoint.';
    }
    else {
        errormsg = e.message;
    }
    return errormsg;
}
exports.handleErrorMessage = handleErrorMessage;
function compare2FormPasswords(form) {
    if (form.value.matchingPassword.pass1 && form.value.matchingPassword.pass2) {
        if (form.value.matchingPassword.pass1 === form.value.matchingPassword.pass2) {
            form['controls'].matchingPassword['controls']['pass2'].setErrors(null);
            return true;
        }
        else {
            form['controls'].matchingPassword['controls']['pass2'].setErrors({ 'incorrect': true });
            return false;
        }
    }
}
exports.compare2FormPasswords = compare2FormPasswords;
function contentStyle(txt, color) {
    const splitLines = txt.split('<br>');
    let newTxt = '';
    splitLines.forEach(line => {
        if (line.length > 1) {
            if (line.substr(0, 4) === '####') {
                newTxt += '<h3 class="blue"><b>' + line.replace('####', '') + '</b></h3>';
            }
            else if (line.substr(0, 3) === '###') {
                newTxt += '<h5 class="text-muted2"><b>' + line.replace('###', '') + '</b></h5>';
            }
            else if (line.substr(0, 2) === '##') {
                newTxt += '<h4 class="blue"><b>' + line.replace('##', '') + '</b></h4>';
            }
            else if (line.substr(0, 1) === '#') {
                newTxt += '<h3 class="blue"><b>' + line.replace('#', '') + '</b></h3>';
            }
            else if (line.substr(0, 3) === '---' || line.substr(0, 3) === '___') {
                newTxt += '<hr class="lineHR"/>';
            }
            else if (line.match(/\(http(\w\S(.)*?)\)/g)) {
                const link = line.match(/\(http(\w\S(.)*?)\)+/g);
                const linkName = line.match(/(\[.*?])+/g);
                const linkImage = line.match(/(!\[.*?])+/g);
                let newLine = line;
                link.forEach((val, idx) => {
                    const newlink = val.replace('(', '').replace(')', '');
                    let oldVal;
                    let newValName = newlink;
                    let repVal;
                    if (linkImage !== null) {
                        if (linkImage[idx] !== null && linkImage[idx] !== '![]') {
                            newValName = linkImage[idx].replace('![', '').replace(']', '');
                            oldVal = linkImage[idx] + val;
                        }
                        else if (linkImage[idx] !== null && linkImage[idx] === '![]') {
                            newValName = '';
                            oldVal = '![]' + val;
                        }
                        else {
                            newValName = '';
                            oldVal = val;
                        }
                        repVal = '<img style="width:100%" src="' + newlink + '" alt=""/>' + newValName + '';
                    }
                    else {
                        if (linkName !== null && linkName[idx] !== '[]') {
                            newValName = linkName[idx].replace('[', '').replace(']', '');
                            oldVal = linkName[idx] + val;
                        }
                        else if (linkName !== null && linkName[idx] === '[]') {
                            oldVal = '[]' + val;
                        }
                        else {
                            oldVal = val;
                        }
                        repVal = '<span class="link-ref" ref-link="' + newlink + '" >' + newValName + '</span>';
                    }
                    newLine = newLine.replace(oldVal, repVal);
                });
                newTxt += '<p class="' + color + '" >' + newLine + '</p>';
            }
            else if (line.match(/`(.*?)`/g)) {
                newTxt += '<p class="' + color + '" style="overflow-wrap: break-word;" >' + line + '</p>';
            }
            else {
                newTxt += '<p class="' + color + '" style="overflow-wrap: break-word;" >' + line + '</p>';
            }
        }
    });
    if (newTxt.match(/`(.*?)`+/g)) {
        const strong = newTxt.match(/`(.*?)`+/g);
        strong.forEach((val) => {
            const newVal = '<span class="white">' + val.replace(new RegExp(/`+/g, 'g'), '') + '</span> ';
            newTxt = newTxt.replace(val, newVal);
        });
    }
    return newTxt;
}
exports.contentStyle = contentStyle;
function makeSingleKeyAuth(public_key) {
    return {
        'threshold': 1,
        'keys': [{ 'key': public_key, 'weight': 1 }],
        'accounts': [],
        'waits': []
    };
}
exports.makeSingleKeyAuth = makeSingleKeyAuth;
function makeAsset(amount, symbol, precision) {
    const value = typeof amount === 'string' ? parseFloat(amount) : amount;
    return `${value.toFixed(precision)} ${symbol}`;
}
exports.makeAsset = makeAsset;
function makeDelegateBW(auth, from, receiver, stake_net_quantity, stake_cpu_quantity, transfer, symbol) {
    return {
        account: 'eosio',
        name: 'delegatebw',
        authorization: [auth],
        data: {
            'from': from,
            'receiver': receiver,
            'stake_net_quantity': stake_net_quantity + ' ' + symbol,
            'stake_cpu_quantity': stake_cpu_quantity + ' ' + symbol,
            'transfer': transfer,
        },
    };
}
exports.makeDelegateBW = makeDelegateBW;
function makeUndelegateBW(auth, from, receiver, unstake_net_quantity, unstake_cpu_quantity, symbol) {
    return {
        account: 'eosio',
        name: 'undelegatebw',
        authorization: [auth],
        data: {
            'from': from,
            'receiver': receiver,
            'unstake_net_quantity': unstake_net_quantity + ' ' + symbol,
            'unstake_cpu_quantity': unstake_cpu_quantity + ' ' + symbol,
        },
    };
}
exports.makeUndelegateBW = makeUndelegateBW;
function convertFraction(diff, div, fr) {
    return ((Math.abs(diff)) / div).toFixed(fr);
}
exports.convertFraction = convertFraction;
//# sourceMappingURL=aux_functions.js.map