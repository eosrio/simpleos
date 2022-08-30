"use strict";
// tslint:disable:no-bitwise
// noinspection JSBitwiseOperatorUsage
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrivateKey = void 0;
const eosjs_numeric_1 = require("enf-eosjs/dist/eosjs-numeric");
const KeyConversions_1 = require("./KeyConversions");
/** Represents/stores a private key and provides easy conversion for use with `elliptic` lib */
class PrivateKey {
    constructor(key, ec) {
        this.key = key;
        this.ec = ec;
    }
    /** Instantiate private key from an `elliptic`-format private key */
    static fromElliptic(privKey, keyType, ec) {
        if (!ec) {
            ec = (0, KeyConversions_1.constructElliptic)(keyType);
        }
        return new PrivateKey({
            type: keyType,
            data: privKey.getPrivate().toArrayLike(Buffer, 'be', 32),
        }, ec);
    }
    /** Instantiate private key from an EOSIO-format private key */
    static fromString(keyString, ec) {
        const privateKey = (0, eosjs_numeric_1.stringToPrivateKey)(keyString);
        if (!ec) {
            ec = (0, KeyConversions_1.constructElliptic)(privateKey.type);
        }
        return new PrivateKey(privateKey, ec);
    }
    /** Export private key as `elliptic`-format private key */
    toElliptic() {
        return this.ec.keyFromPrivate(this.key.data);
    }
    /** Export private key as EOSIO-format private key */
    toString() {
        return (0, eosjs_numeric_1.privateKeyToString)(this.key);
    }
    /** Get key type from key */
    getType() {
        return this.key.type;
    }
    /** Retrieve the public key from a private key */
    getPublicKey() {
        const ellipticPrivateKey = this.toElliptic();
        return KeyConversions_1.PublicKey.fromElliptic(ellipticPrivateKey, this.getType(), this.ec);
    }
    /** Sign a message or hashed message digest with private key */
    sign(data, shouldHash = true, encoding = 'utf8') {
        if (shouldHash) {
            if (typeof data === 'string') {
                data = Buffer.from(data, encoding);
            }
            data = this.ec.hash().update(data).digest();
        }
        let tries = 0;
        let signature;
        const isCanonical = (sigData) => !(sigData[1] & 0x80) && !(sigData[1] === 0 && !(sigData[2] & 0x80))
            && !(sigData[33] & 0x80) && !(sigData[33] === 0 && !(sigData[34] & 0x80));
        const constructSignature = (options) => {
            const ellipticPrivateKey = this.toElliptic();
            const ellipticSignature = ellipticPrivateKey.sign(data, options);
            return KeyConversions_1.Signature.fromElliptic(ellipticSignature, this.getType(), this.ec);
        };
        if (this.key.type === eosjs_numeric_1.KeyType.k1) {
            do {
                signature = constructSignature({ canonical: true, pers: [++tries] });
            } while (!isCanonical(signature.toBinary()));
        }
        else {
            signature = constructSignature({ canonical: true });
        }
        return signature;
    }
    /** Validate a private key */
    isValid() {
        try {
            const ellipticPrivateKey = this.toElliptic();
            const validationObj = ellipticPrivateKey.validate();
            return validationObj.result;
        }
        catch (_a) {
            return false;
        }
    }
}
exports.PrivateKey = PrivateKey;
//# sourceMappingURL=PrivateKey.js.map