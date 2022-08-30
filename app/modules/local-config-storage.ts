import {app} from 'electron';
import * as path from 'path';
import {Logger} from '../util';
import * as fs from 'fs';
import {Level} from 'level';

export class LocalConfigStorage {

    db;
    basePath;
    dbPath;

    constructor() {
        this.basePath = path.join(app.getPath('appData'), 'simpleos-config');
        this.dbPath = path.join(this.basePath, 'simpleos-db');
        Logger.info(`LevelDB located at: ${this.dbPath}`);
        if (!fs.existsSync(this.basePath)) {
            fs.mkdirSync(this.basePath);
        }
        this.db = new Level(this.dbPath);
    }

    async setKey(key, value): Promise<boolean> {
        try {
            await this.db.put(key, value);
            return true;
        } catch (e) {
            Logger.warn(e);
            return false;
        }
    }

    async getKey(key): Promise<any> {
        try {
            return await this.db.get(key);
        } catch (e) {
            Logger.warn(e);
            return null;
        }
    }
}
