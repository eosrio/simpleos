import {Injectable} from '@angular/core';
import {IpcRenderer, ipcRenderer} from 'electron';

@Injectable({
	providedIn: 'root'
})
export class ConnectService {
	public ipc: IpcRenderer;

	constructor() {
		this.ipc = ipcRenderer;
	}
}
