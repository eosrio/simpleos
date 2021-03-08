const path = require('path');
const {app} = require('electron');
const fs = require('fs');
const level = require('level');
const {Logger} = require('./util');

class LocalConfigStorage {

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
    this.db = level(this.dbPath);
  }

  async setKey(key, value) {
    try {
      await this.db.put(key, value);
      return true;
    } catch (e) {
      Logger.warn(e);
      return false;
    }
  }

  async getKey(key) {
    try {
      return await this.db.get(key);
    } catch (e) {
      Logger.warn(e);
      return null;
    }
  }
}

module.exports = {LocalConfigStorage};
