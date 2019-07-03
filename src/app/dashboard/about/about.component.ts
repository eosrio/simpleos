import {Component, OnInit} from '@angular/core';
import {AccountsService} from '../../services/accounts.service';
import {AppComponent} from '../../app.component';

@Component({
	selector: 'app-about',
	templateUrl: './about.component.html',
	styleUrls: ['./about.component.css']
})
export class AboutComponent implements OnInit {

	constructor(public aService: AccountsService, public app: AppComponent) {
	}

	ngOnInit() {
	}

	extOpen(value) {
		window['shell'].openExternal(value);
	}

}
