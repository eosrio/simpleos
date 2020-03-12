import {Injectable} from '@angular/core';
import {HttpClient, HttpHeaders} from '@angular/common/http';

@Injectable({
    providedIn: 'root'
})
export class ChainService {

    constructor(private http: HttpClient) {
    }

    setRawGithub() {
        const expiration = (1000 * 60 * 60);
        const stored_data = localStorage.getItem('configSimpleos');
        if (localStorage.getItem('configSimpleos') !== null) {
            const cachedPayload = JSON.parse(stored_data);
            if (new Date().getTime() - new Date(cachedPayload.lastUpdate).getTime() > expiration) {
                // Expired
                console.log('update');
                this.getRawGithub().catch(console.log);
            }
        } else {
            console.log('getting');
            this.getRawGithub().then(console.log).catch(console.log);
        }
    }

    async getRawGithub() {
        const url = 'https://raw.githubusercontent.com/eosrio/simpleos/master/config.json';
        let result = await this.http.get(url, {
            headers: new HttpHeaders({
                'Cache-Control': 'no-cache, no-store, must-revalidate, post-check=0, pre-check=0',
                'Pragma': 'no-cache',
                'Expires': '0'
            }),
            responseType: 'json'
        }).toPromise();
        const payload = {lastUpdate: new Date(), config: result};
        console.log(payload);
        localStorage.setItem('configSimpleos', JSON.stringify(payload));
    }
}

