import {Component, ComponentFactoryResolver} from '@angular/core';
import {FormBuilder, FormGroup, Validators} from '@angular/forms';
import {AccountsService} from '../../services/accounts.service';
import {EOSJSService} from '../../services/eosjs.service';
import {CryptoService} from '../../services/crypto.service';
import {BodyOutputType, Toast, ToasterConfig, ToasterService} from 'angular2-toaster';
import {Proposal} from '../../interfaces/proposal';
import * as moment from 'moment';
import {HttpClient} from '@angular/common/http';
import {createNumberMask} from 'text-mask-addons/dist/textMaskAddons';

@Component({
	selector: 'app-referendum',
	templateUrl: './referendum.component.html',
	styleUrls: ['./referendum.component.css']
})

export class ReferendumComponent {

	loading = true;
	voteModal = false;
	unvoteModal = false;
	expired = false;
	busy = false;
	searchForm: FormGroup;
	confirmForm: FormGroup;

	wrongpass: string;

	optionsV1: string;

	errormsg = '';

	selProposal: Proposal;
	vtProposal: number;

	page = 1;
	proposals: Proposal[];
	allProposals: Proposal[];

	config: ToasterConfig;

	searchTimer = null;

	searchString = '';

	sortExpression: string;
	sortReverse: boolean;
	comparatorMethod: any;

	numberMask = createNumberMask({
		prefix: '',
		allowDecimal: true,
		includeThousandsSeparator: true,
		decimalLimit: 4,
	});

	constructor(public aService: AccountsService,
				public eos: EOSJSService,
				private http: HttpClient,
				private fb: FormBuilder,
				private componentFactoryResolver: ComponentFactoryResolver,
				private toaster: ToasterService,
				private crypto: CryptoService
	) {

		this.searchForm = this.fb.group({
			search: ['', [Validators.maxLength(12)]]
		});

		this.confirmForm = this.fb.group({
			pass: ['', [Validators.required, Validators.minLength(10)]]
		});

		this.optionsV1 = 'Choose an option!';

		this.sortExpression = 'stats.staked.total';
		this.sortReverse = true;
		this.comparatorMethod = null;
		this.loadVoteTally();
	}

	filterProposals(term) {
		if (this.searchTimer) {
			clearTimeout(this.searchTimer);
		}
		this.searchTimer = setTimeout(() => {
			// fuzzy search with fuse.js
			this.searchString = term;
		}, 200);
	}

	sortingChange(event) {
		const mode = event.value;
		switch (mode) {
			case 'mosteos':
				console.log('SORT BY MOST EOS VOTED');
				this.sortExpression = 'stats.staked.total';
				this.sortReverse = true;
				break;
			case 'mostvoted':
				console.log('SORT BY MOST VOTED');
				this.sortExpression = 'stats.votes.total';
				this.sortReverse = true;
				break;
			case 'newest':
				console.log('SORT BY NEWER PROPOSALS');
				this.sortExpression = 'proposal.created_at';
				this.sortReverse = true;
				break;
			case 'oldest':
				console.log('SORT BY OLDER');
				this.sortExpression = 'proposal.created_at';
				this.sortReverse = false;
				break;
			case 'expiresfirst':
				console.log('Expires First');
				this.sortExpression = 'proposal.expires_at';
				this.sortReverse = false;
				break;
			case 'expireslast':
				console.log('Expires Last');
				this.sortExpression = 'proposal.expires_at';
				this.sortReverse = true;
				break;
			default:
				console.log('default order');
		}
	}


	loadVoteTally() {
		this.selProposal = null;
		this.vtProposal = 0;
		this.proposals = [];
		let now, lastFecth;
		const url = 'https://s3.amazonaws.com/api.eosvotes.io/eosvotes/tallies/latest.json';
		if (localStorage.getItem('simplEOS.lastProposalFetch') !== null) {
			lastFecth = parseInt(localStorage.getItem('simplEOS.lastProposalFetch'), 10);
			now = new Date().getTime();
			console.log('Last fetch ', (now - lastFecth) / 1000 / 60, ' minutes ago');
		}

		if ((now - lastFecth > 10 * 60 * 1000) || localStorage.getItem('simplEOS.lastProposalFetch') === null) {
			this.http.get(url).subscribe((data) => {
				this.processProposalData(data);
			}, err => {
				console.log(err);
				this.loading = false;
			});
		} else {
			console.log('Loading proposals from local cache');
			this.proposals = JSON.parse(localStorage.getItem('simplEOS.proposals'));
			this.allProposals = this.proposals;
			this.loading = false;
		}
	}

	processProposalData(data) {
		Object.keys(data).forEach((prop: string) => {
			const temp_obj = data[prop];
			let temp_json = null;
			try {
				temp_json = JSON.parse(data[prop].proposal.proposal_json);
			} catch (e) {
				console.log(e);
				console.log(data[prop]);
			}
			if (temp_json !== null) {
				if (temp_json['content'] === null) {
					temp_json['content'] = `<em>[no contents]</em>`;
				}
				temp_obj['proposal']['json_data'] = temp_json;
			}

			this.proposals.push(temp_obj);
		});
		this.loading = false;
		localStorage.setItem('simplEOS.proposals', JSON.stringify(this.proposals));
		localStorage.setItem('simplEOS.lastProposalFetch', new Date().getTime().toString());
		this.allProposals = this.proposals;
	}


	loadProposals(name) {
		this.selProposal = null;
		this.vtProposal = 0;
		this.proposals = [];
		this.eos.getProposals('eosio.forum', 200).then(dt => {
			dt.rows.forEach((row) => {
				const temp_obj = row;
				let temp_json = null;
				try {
					temp_json = JSON.parse(row.proposal_json);
				} catch (e) {
					console.log(e);
					console.log(row);
				}
				if (temp_json !== null) {
					temp_obj['json_data'] = temp_json;
				}
				if (name !== '') {
					if (name === temp_obj.proposal_name) {
						this.proposals.push(temp_obj);
					}
				} else {
					this.proposals.push(temp_obj);
				}
			});
			this.loading = false;
		}).catch(err => {
			console.log(err);
		});
	}


	searchProposal(event) {

		this.proposals = [];
		this.loading = true;
		this.loadProposals(event);

	}

	getExpiretime(date) {
		const info = moment.utc(date).fromNow();
		return (info.includes('ago') ? 'Expired ' : 'Expires ') + info;
	}

	isExpired(date) {
		return moment.utc(date).isBefore(moment.now());
	}

	private showToast(type: string, title: string, body: string) {
		this.config = new ToasterConfig({
			positionClass: 'toast-top-right',
			timeout: 10000,
			newestOnTop: true,
			tapToDismiss: true,
			preventDuplicates: false,
			animation: 'slideDown',
			limit: 1,
		});
		const toast: Toast = {
			type: type,
			title: title,
			body: body,
			timeout: 10000,
			showCloseButton: true,
			bodyOutputType: BodyOutputType.TrustedHtml,
		};
		this.toaster.popAsync(toast);
	}

	startVote(prop, vote) {
		this.selProposal = prop;
		this.wrongpass = '';
		this.voteModal = true;
		this.vtProposal = vote;
	}

	startUnvote(prop) {
		this.selProposal = prop;
		this.wrongpass = '';
		this.unvoteModal = true;
	}

	startMultiVote(prop) {
		this.selProposal = prop;
		this.wrongpass = '';
		this.voteModal = true;
	}

	voteProposal() {
		const account = this.aService.selected.getValue();
		const accountName = this.aService.selected.getValue().name;
		const password = this.confirmForm.get('pass').value;
		const pubkey = account.details['permissions'][0]['required_auth'].keys[0].key;
		this.wrongpass = '';

		this.crypto.authenticate(password, pubkey).then((data) => {
			if (data === true) {
				const form = {voter: accountName, proposal_name: this.selProposal.proposal.proposal_name, vote: this.vtProposal, vote_json: ''};
				this.eos.pushActionContract('eosio.forum', 'vote', form, accountName).then((info) => {
					this.voteModal = false;
					this.busy = false;
					console.log(info);
					this.showToast('success', 'Transation broadcasted', 'Check a block explorer for confirmation.');
					this.confirmForm.reset();
				}).catch(error => {
					this.wrongpass = 'Error: ' + JSON.stringify(JSON.parse(error).error.details[0].message);
				});
				this.busy = false;
			}
		}).catch(error2 => {
			this.wrongpass = 'Wrong password!';
			this.busy = false;
		});

	}

	unvoteProposal() {
		const account = this.aService.selected.getValue();
		const accountName = this.aService.selected.getValue().name;
		const password = this.confirmForm.get('pass').value;
		const pubkey = account.details['permissions'][0]['required_auth'].keys[0].key;
		this.wrongpass = '';

		this.crypto.authenticate(password, pubkey).then((data) => {
			if (data === true) {
				const form = {voter: accountName, proposal_name: this.selProposal.proposal.proposal_name};
				this.eos.pushActionContract('eosio.forum', 'unvote', form, accountName).then((info) => {
					this.unvoteModal = false;
					this.busy = false;
					console.log(info);
					this.showToast('success', 'Transation broadcasted', 'Check your history for confirmation.');
					this.confirmForm.reset();
				}).catch(error => {
					this.wrongpass = 'Error: ' + JSON.stringify(JSON.parse(error).error.details[0].message);
				});
				this.busy = false;
			}
		}).catch(error2 => {
			this.wrongpass = 'Wrong password!';
			this.busy = false;
			this.confirmForm.reset();
		});

	}

}
