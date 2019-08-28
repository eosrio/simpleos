import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';

@Injectable ( {
	providedIn: 'root'
} )
export class ChainService {
	constructor(private http: HttpClient) {
	}

	setRawGithub() {
		const expiration = (1000 * 10);
		// const expiration = (1000 * 60 * 60 * 24);
		const stored_data = localStorage.getItem('configSimpleos');
		if(localStorage.getItem('configSimpleos')!==null){
				const cachedPayload = JSON.parse(stored_data);
			if ( new Date().getTime() - new Date(cachedPayload.lastUpdate).getTime() > expiration) {
				// Expired
				console.log('update');
				this.getRawGithub().catch(console.log);
			}
		}else{
			console.log('getting');
			this.getRawGithub().then(console.log).catch(console.log);
		}


	}
	async getRawGithub(){
		const url = 'https://raw.githubusercontent.com/eosrio/simpleos/master/config.json';
		let result = await this.http.get ( url , {responseType: 'json'} ).toPromise ();
		const payload = {lastUpdate: new Date(), config: result };
		localStorage.setItem('configSimpleos',JSON.stringify(payload));
	}
}

