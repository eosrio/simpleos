import {Component, OnInit} from '@angular/core';
import {AccountsService} from '../../services/accounts.service';

@Component({
	selector: 'app-about',
	templateUrl: './about.component.html',
	styleUrls: ['./about.component.css']
})
export class AboutComponent implements OnInit {

	constructor(public aService: AccountsService) {
	}

	ngOnInit() {
	}

	extOpen(value) {
		window['shell'].openExternal(value);
	}

}
