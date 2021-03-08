class Logger {
  static info(text) {
    const timestamp = (new Date()).toISOString();
    console.log(`[INFO] - ${timestamp} - ${text}`);
  }

  static warn(text) {
    const timestamp = (new Date()).toISOString();
    console.log(`[WARN] - ${timestamp} - ${text}`);
  }
}

module.exports = {Logger};
