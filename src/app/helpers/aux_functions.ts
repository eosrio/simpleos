export function handleErrorMessage(e: any, errormsg) {
    if (e.message.includes('Invalid checksum')) {
        errormsg = 'invalid private key';
    } else if (e.message === 'no_account') {
        errormsg = 'No account associated with this private key';
    } else if (e.message === 'non_active') {
        errormsg = 'This is not the active key. Please import the active key.';
    } else if (e.message === 'api_arror') {
        errormsg = 'API Unavailable, please try again with another endpoint.';
    }
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
