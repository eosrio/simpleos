import {Injectable} from '@angular/core';
import {IpcRenderer} from 'electron';

@Injectable({
	providedIn: 'root'
})
export class ConnectService {
	public ipc: IpcRenderer;

	constructor() {
		if ((<any>window).require) {
			try {
				this.ipc = (<any>window).require('electron').ipcRenderer;
			} catch (error) {
				throw error;
			}
		} else {
			console.warn('Electron IPC could not be loaded!');
		}
	}
}
