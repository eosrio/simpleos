"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalConfigStorage = void 0;
const electron_1 = require("electron");
const path = __importStar(require("path"));
const util_1 = require("../util");
const fs = __importStar(require("fs"));
const level_1 = require("level");
class LocalConfigStorage {
    constructor() {
        this.basePath = path.join(electron_1.app.getPath('appData'), 'simpleos-config');
        this.dbPath = path.join(this.basePath, 'simpleos-db');
        util_1.Logger.info(`LevelDB located at: ${this.dbPath}`);
        if (!fs.existsSync(this.basePath)) {
            fs.mkdirSync(this.basePath);
        }
        this.db = new level_1.Level(this.dbPath);
    }
    setKey(key, value) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.db.put(key, value);
                return true;
            }
            catch (e) {
                util_1.Logger.warn(e);
                return false;
            }
        });
    }
    getKey(key) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.db.get(key);
            }
            catch (e) {
                util_1.Logger.warn(e);
                return null;
            }
        });
    }
}
exports.LocalConfigStorage = LocalConfigStorage;
//# sourceMappingURL=local-config-storage.js.map