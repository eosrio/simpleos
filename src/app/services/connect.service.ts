import {Injectable} from '@angular/core';

import * as socketIo from 'socket.io-client';

@Injectable({
	providedIn: 'root'
})
export class ConnectService {
	private readonly socket: any;

	constructor() {
		// console.log('Loading simpleos-connect service');

		if (window['remote']) {
			this.socket = socketIo('http://localhost:3000/');
			this.socket.on('handshake', (message) => {
				// console.log(message);
				this.sendID();
			});
			this.socket.on('new_data', function (data) {
				console.log(data);
			});
		}
	}

	sendID() {
		this.socket.emit('id', 'LISTENER');
	}
}
