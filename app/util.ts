export class Logger {
    static info(text): void {
        const timestamp = (new Date()).toISOString();
        console.log(`[INFO] - ${timestamp} - ${text}`);
    }

    static warn(text): void {
        const timestamp = (new Date()).toISOString();
        console.log(`[WARN] - ${timestamp} - ${text}`);
    }
}
