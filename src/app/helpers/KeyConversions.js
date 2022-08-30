"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sha256 = exports.generateKeyPair = exports.constructElliptic = exports.Signature = exports.PublicKey = exports.PrivateKey = void 0;
const elliptic_1 = require("elliptic");
const hash = require("hash.js");
const eosjs_numeric_1 = require("enf-eosjs/dist/eosjs-numeric");
const PublicKey_1 = require("./PublicKey");
const PrivateKey_1 = require("./PrivateKey");
var PrivateKey_2 = require("./PrivateKey");
Object.defineProperty(exports, "PrivateKey", { enumerable: true, get: function () { return PrivateKey_2.PrivateKey; } });
var PublicKey_2 = require("./PublicKey");
Object.defineProperty(exports, "PublicKey", { enumerable: true, get: function () { return PublicKey_2.PublicKey; } });
var Signature_1 = require("./Signature");
Object.defineProperty(exports, "Signature", { enumerable: true, get: function () { return Signature_1.Signature; } });
/** Construct the elliptic curve object based on key type */
const constructElliptic = (type) => {
    if (type === eosjs_numeric_1.KeyType.k1) {
        return new elliptic_1.ec('secp256k1');
    }
    return new elliptic_1.ec('p256');
};
exports.constructElliptic = constructElliptic;
const generateKeyPair = (type, options = {}) => {
    if (!options.secureEnv) {
        throw new Error('Key generation is completely INSECURE in production environments in the browser. ' +
            'If you are absolutely certain this does NOT describe your environment, set `secureEnv` in your ' +
            'options to `true`.  If this does describe your environment and you set `secureEnv` to `true`, ' +
            'YOU DO SO AT YOUR OWN RISK AND THE RISK OF YOUR USERS.');
    }
    let ec;
    if (type === eosjs_numeric_1.KeyType.k1) {
        ec = new elliptic_1.ec('secp256k1');
    }
    else {
        ec = new elliptic_1.ec('p256');
    }
    const ellipticKeyPair = ec.genKeyPair(options.ecOptions);
    const publicKey = PublicKey_1.PublicKey.fromElliptic(ellipticKeyPair, type, ec);
    const privateKey = PrivateKey_1.PrivateKey.fromElliptic(ellipticKeyPair, type, ec);
    return { publicKey, privateKey };
};
exports.generateKeyPair = generateKeyPair;
const sha256 = (data) => {
    return hash.sha256().update(data).digest();
};
exports.sha256 = sha256;
//# sourceMappingURL=KeyConversions.js.map