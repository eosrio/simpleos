export function parseTokenValue(value: any): any {
    if (typeof value === "number") {
        return value;
    } else if (typeof value === "string") {
        return parseFloat(value.split(' ')[0]);
    } else {
        return value;
    }
}

export function handleErrorMessage(e: any) {
    let errormsg;
    if (e.message.includes('Invalid checksum')) {
        errormsg = 'invalid private key';
    } else if (e.message === 'no_account') {
        errormsg = 'No account associated with this private key';
    } else if (e.message === 'non_active') {
        errormsg = 'This is not the active key. Please import the active key.';
    } else if (e.message === 'api_arror') {
        errormsg = 'API Unavailable, please try again with another endpoint.';
    } else {
        errormsg = e.message;
    }
    return errormsg;
}

export function compare2FormPasswords(form) {
    if (form.value.matchingPassword.pass1 && form.value.matchingPassword.pass2) {
        if (form.value.matchingPassword.pass1 === form.value.matchingPassword.pass2) {
            form['controls'].matchingPassword['controls']['pass2'].setErrors(null);
            return true;
        } else {
            form['controls'].matchingPassword['controls']['pass2'].setErrors({'incorrect': true});
            return false;
        }
    }
}

export function contentStyle(txt, color?) {
    const splitLines = txt.split('<br>');
    let newTxt = '';
    splitLines.forEach(line => {
        if (line.length > 1) {
            if (line.substr(0, 4) === '####') {
                newTxt += '<h3 class="blue"><b>' + line.replace('####', '') + '</b></h3>';
            } else if (line.substr(0, 3) === '###') {
                newTxt += '<h5 class="text-muted2"><b>' + line.replace('###', '') + '</b></h5>';
            } else if (line.substr(0, 2) === '##') {
                newTxt += '<h4 class="blue"><b>' + line.replace('##', '') + '</b></h4>';
            } else if (line.substr(0, 1) === '#') {
                newTxt += '<h3 class="blue"><b>' + line.replace('#', '') + '</b></h3>';
            } else if (line.substr(0, 3) === '---' || line.substr(0, 3) === '___') {
                newTxt += '<hr class="lineHR"/>';
            } else if (line.match(/\(http(\w\S(.)*?)\)/g)) {
                const link = line.match(/\(http(\w\S(.)*?)\)+/g);
                const linkName = line.match(/(\[.*?])+/g);
                const linkImage = line.match(/(!\[.*?])+/g);
                let newLine = line;
                link.forEach((val: string, idx: number) => {
                    const newlink = val.replace('(', '').replace(')', '');
                    let oldVal: string;
                    let newValName = newlink;
                    let repVal: string;
                    if (linkImage !== null) {
                        if (linkImage[idx] !== null && linkImage[idx] !== '![]') {
                            newValName = linkImage[idx].replace('![', '').replace(']', '');
                            oldVal = linkImage[idx] + val;
                        } else if (linkImage[idx] !== null && linkImage[idx] === '![]') {
                            newValName = '';
                            oldVal = '![]' + val;
                        } else {
                            newValName = '';
                            oldVal = val;
                        }
                        repVal = '<img style="width:100%" src="' + newlink + '" alt=""/>' + newValName + '';
                    } else {
                        if (linkName !== null && linkName[idx] !== '[]') {
                            newValName = linkName[idx].replace('[', '').replace(']', '');
                            oldVal = linkName[idx] + val;
                        } else if (linkName !== null && linkName[idx] === '[]') {
                            oldVal = '[]' + val;
                        } else {
                            oldVal = val;
                        }
                        repVal = '<span class="link-ref" ref-link="' + newlink + '" >' + newValName + '</span>';
                    }
                    newLine = newLine.replace(oldVal, repVal);
                });
                newTxt += '<p class="' + color + '" >' + newLine + '</p>';
            } else if (line.match(/`(.*?)`/g)) {
                newTxt += '<p class="' + color + '" style="overflow-wrap: break-word;" >' + line + '</p>';
            } else {
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
