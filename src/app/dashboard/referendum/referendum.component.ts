import {Component, ComponentFactoryResolver, ChangeDetectorRef, OnInit} from '@angular/core';
import {FormBuilder, FormGroup, Validators, FormArray} from '@angular/forms';
import {AccountsService} from '../../services/accounts.service';
import {EOSJSService} from '../../services/eosio/eosjs.service';
import {CryptoService} from '../../services/crypto/crypto.service';
import {BodyOutputType, Toast, ToasterConfig, ToasterService} from 'angular2-toaster';
import {Proposal} from '../../interfaces/proposal';
import * as moment from 'moment';
import {HttpClient} from '@angular/common/http';
import {DomSanitizer, SafeHtml} from '@angular/platform-browser';
import {createNumberMask} from 'text-mask-addons/dist/textMaskAddons';
import {debounceTime, distinctUntilChanged} from 'rxjs/operators';
import {utc} from 'moment';


@Component({
	selector: 'app-referendum',
	templateUrl: './referendum.component.html',
	styleUrls: ['./referendum.component.css']
})

export class ReferendumComponent implements OnInit {

	loading = true;
	voteModal = false;
	unvoteModal = false;
	proposalModal = false;
	seeMore = false;
	expired = false;
	busy = false;
	searchForm: FormGroup;
	createProposalForm: FormGroup;
	confirmvoteForm: FormGroup;
	confirmunvoteForm: FormGroup;
	confirmProposalForm: FormGroup;
	wrongpass: string;
	optionsV1: string;
	errormsg = '';
	selProposal: Proposal;
	vtProposal: number;
	page = 1;
	proposals: Proposal[] = [];
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
	sMTitle: string;
	sMContent: string;
	newContent: SafeHtml;
	sMProposer: string;
	sMProposer_name: string;
	sMexpires_at: string;
	sMType: string;
	sMOption = [];

	schemaJSON: any;
	showOptions: string;

	public markdownData = '';


	constructor(public aService: AccountsService,
				public eos: EOSJSService,
				private http: HttpClient,
				private fb: FormBuilder,
				private componentFactoryResolver: ComponentFactoryResolver,
				private toaster: ToasterService,
				private crypto: CryptoService,
				public sanitizer: DomSanitizer,
				private cdr: ChangeDetectorRef
	) {

		this.searchForm = this.fb.group({
			search: ['', [Validators.maxLength(12)]]
		});

		this.createProposalForm = this.fb.group({
			id: ['', [Validators.required, Validators.pattern('^(([a-z]|[1-5]|\\.){0,12})$')]],
			title: ['', [Validators.required]],
			content: ['', [Validators.required]],
			expiry: ['', [Validators.required, Validators.min(1), Validators.max(180)]],
			options: this.fb.array([]),
			type: ['', [Validators.required]],
		});

		this.createProposalForm.get('content').valueChanges.pipe(debounceTime(300), distinctUntilChanged()).subscribe((value) => {
			this.markdownData = value;
		});

		this.confirmvoteForm = this.fb.group({
			pass: ['', [Validators.required, Validators.minLength(10)]]
		});
		this.confirmunvoteForm = this.fb.group({
			pass: ['', [Validators.required, Validators.minLength(10)]]
		});
		this.confirmProposalForm = this.fb.group({
			pass: ['', [Validators.required, Validators.minLength(10)]]
		});

		this.optionsV1 = 'Choose an option!';
		this.sortExpression = 'stats.staked.total';
		this.sortReverse = true;
		this.comparatorMethod = null;
		this.sMexpires_at = '';
		this.sMType = '';
	}

	ngOnInit(): void {
		this.showOptions = 'none';
		setTimeout(() => {
			this.loadVoteTally(true);
		}, 200);
	}

	onPageChange(page: number) {
		this.page = page;
	}

	extOpen(value) {
		return window['shell']['openExternal'](value);
	}

	updateMarkdown() {
		this.markdownData = this.createProposalForm.get('content').value;
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
				// console.log('SORT BY MOST EOS VOTED');
				this.sortExpression = 'stats.staked.total';
				this.sortReverse = true;
				break;
			case 'mostvoted':
				// console.log('SORT BY MOST VOTED');
				this.sortExpression = 'stats.votes.total';
				this.sortReverse = true;
				break;
			case 'newest':
				// console.log('SORT BY NEWER PROPOSALS');
				this.sortExpression = 'proposal.created_at';
				this.sortReverse = true;
				break;
			case 'oldest':
				// console.log('SORT BY OLDER');
				this.sortExpression = 'proposal.created_at';
				this.sortReverse = false;
				break;
			case 'expiresfirst':
				// console.log('Expires First');
				this.sortExpression = 'proposal.expires_at';
				this.sortReverse = false;
				break;
			case 'expireslast':
				// console.log('Expires Last');
				this.sortExpression = 'proposal.expires_at';
				this.sortReverse = true;
				break;
			default:
				console.log('default order');
		}
	}


	loadVoteTally(forceReload?: boolean) {
		console.log('loadVoteTally');
		this.selProposal = null;
		this.vtProposal = 0;
		this.proposals = [];
		let now, lastFecth;
		const chainId = this.aService.activeChain.id;
		if (this.aService.activeChain.forumTally !== '') {
			if (localStorage.getItem('simplEOS.lastProposalFetch.' + chainId) !== null) {
				lastFecth = parseInt(localStorage.getItem('simplEOS.lastProposalFetch.' + chainId), 10);
				now = new Date().getTime();
				console.log('Last fetch ', (now - lastFecth) / 1000 / 60, ' minutes ago');
			}

			if (((now - lastFecth > 10 * 60 * 1000) || localStorage.getItem('simplEOS.lastProposalFetch.' + chainId) === null) || forceReload) {
				console.log('Loading live vote tally...');
				this.http.get(this.aService.activeChain.forumTally).subscribe((data) => {
					// console.log(data);
					this.processProposalData(data);
				}, err => {
					console.log(err);
					this.loading = false;
				});
			} else {
				console.log('Loading proposals from local cache');
				this.proposals = JSON.parse(localStorage.getItem('simplEOS.proposals.' + chainId));
				this.allProposals = this.proposals;
				this.loading = false;
			}
			this.cdr.detectChanges();
		}
	}

	processProposalData(data) {
		const proposals = [];
		Object.keys(data).forEach((prop: string) => {
			const temp_obj = data[prop];
			let temp_json = null;
			try {
				const pp_json = data[prop].proposal.proposal_json.replace(/[\n\r]/g, '');
				temp_json = data[prop].proposal.proposal_json !== '' ? JSON.parse(pp_json) : null;
			} catch (e) {
				console.log(e);
				console.log(data[prop].proposal.proposal_json);
			}
			if (temp_json !== null) {
				if (temp_json['content'] === null) {
					temp_json['content'] = `<em>[no contents]</em>`;
				}
				temp_obj['proposal']['json_data'] = temp_json;
				if (!temp_obj.proposal) {
					console.log('PROP', temp_obj);
				}
				proposals.push(temp_obj);
			} else {
				console.log('FAILED PROPOSAL', temp_obj);
			}
		});
		this.loading = false;
		localStorage.setItem('simplEOS.proposals.' + this.aService.activeChain.id, JSON.stringify(proposals));
		localStorage.setItem('simplEOS.lastProposalFetch.' + this.aService.activeChain.id, new Date().getTime().toString());
		this.allProposals = proposals;
		this.proposals = proposals;
		// console.log(this.proposals.length, 'proposals loaded');
	}


	// loadProposals(name) {
	// 	this.selProposal = null;
	// 	this.vtProposal = 0;
	// 	this.proposals = [];
	// 	this.eos.getProposals('eosio.forum', 200).then(dt => {
	// 		dt.rows.forEach((row) => {
	// 			const temp_obj = row;
	// 			let temp_json = null;
	// 			try {
	// 				temp_json = JSON.parse(row.proposal_json);
	// 			} catch (e) {
	// 				console.log(e);
	// 				console.log(row);
	// 			}
	// 			if (temp_json !== null) {
	// 				temp_obj['json_data'] = temp_json;
	// 			}
	// 			if (name !== '') {
	// 				if (name === temp_obj.proposal_name) {
	// 					this.proposals.push(temp_obj);
	// 				}
	// 			} else {
	// 				this.proposals.push(temp_obj);
	// 			}
	// 		});
	// 		this.loading = false;
	// 	}).catch(err => {
	// 		console.log(err);
	// 	});
	// }

	// searchProposal(event) {
	// 	this.proposals = [];
	// 	this.loading = true;
	// 	this.loadProposals(event);
	// }

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

	startVote(prop, vote, ev) {
		this.selProposal = prop;
		this.wrongpass = '';
		this.voteModal = true;
		this.vtProposal = vote;
		ev.stopPropagation();
	}

	startUnvote(prop, ev) {
		this.selProposal = prop;
		this.wrongpass = '';
		this.unvoteModal = true;
		ev.stopPropagation();
	}

	startMultiVote(prop, ev) {
		this.selProposal = prop;
		this.wrongpass = '';
		this.voteModal = true;
		ev.stopPropagation();
	}

	multiSelect(p: Proposal, value: number[], ev) {
		const binArr = ['0', '0', '0', '0', '0', '0', '0', '0'];
		value.forEach((v) => {
			binArr[v] = '1';
		});
		binArr.reverse();
		this.vtProposal = parseInt(binArr.join(''), 2);
		ev.stopPropagation();
	}

	clickEv(ev) {
		console.log(ev);
		console.log(ev.target);
		console.log(ev.target.getAttribute('ref-link'));
		if (ev.target.getAttribute('ref-link')) {
			this.extOpen(ev.target.getAttribute('ref-link'));
		}
	}

	contentStyle(txt, color?) {
		const splitLines = txt.split('\n');
		let newTxt = '';
		// console.log(splitLines);
		splitLines.forEach(line => {
			// console.log(line.length);
			if (line.length > 1) {
				if (line.substr(0, 4) === '####') {
					newTxt += '<h3 class="blue"><b>' + line.replace('####', '') + '</b></h3>';
				} else if (line.substr(0, 3) === '###') {
					newTxt += '<h5 class="text-muted2"><b>' + line.replace('###', '') + '</b></h5>';
				} else if (line.substr(0, 2) === '##') {
					newTxt += '<h4 class="blue"><b>' + line.replace('##', '') + '</b></h4>';
				} else if (line.substr(0, 1) === '#') {
					newTxt += '<h3 class="blue"><b>' + line.replace('#', '') + '</b></h3>';
				} else if (line.substr(0, 3) === '---' || line.substr(0, 3) === '___') {
					newTxt += '<hr class="lineHR"/>';
				} else if (line.match(/\(http(\w\S(.)*?)\)+/g)) {

					const link = line.match(/\(http(\w\S(.)*?)\)+/g);
					const linkName = line.match(/(\[.*?])+/g);
					const linkImage = line.match(/(!\[.*?])+/g);

					let newLine = line;
					link.forEach((val, idx: number) => {
						const newlink = val.replace('(', '').replace(')', '');
						let oldVal = val;
						let newValName = newlink;
						let repVal = '';

						if (linkImage !== null) {
							if (linkImage[idx] !== null && linkImage[idx] !== '![]') {
								newValName = linkImage[idx].replace('![', '').replace(']', '');
								oldVal = linkImage[idx] + val;
							} else if (linkImage[idx] !== null && linkImage[idx] === '![]') {
								newValName = '';
								oldVal = '![]' + val;
							} else {
								newValName = '';
								oldVal = val;
							}
							repVal = '<img style="width:100%" src="' + newlink + '" alt=""/><i>' + newValName + '</i>';

						} else {

							if (linkName !== null && linkName[idx] !== '[]') {
								newValName = linkName[idx].replace('[', '').replace(']', '');
								oldVal = linkName[idx] + val;
							} else if (linkName !== null && linkName[idx] === '[]') {
								oldVal = '[]' + val;
							} else {
								oldVal = val;
							}

							repVal = '<span class="link-ref" ref-link="' + newlink + '" >' + newValName + '</span>';
						}

						newLine = newLine.replace(oldVal, repVal);
					});

					newTxt += '<p class="' + color + '" style="overflow-wrap: break-word;" >' + newLine + '</p>';

				} else {
					newTxt += '<p class="' + color + '" style="overflow-wrap: break-word;" >' + line + '</p>';
				}
			}
		});
		if (newTxt.match(/`(.*?)`+/g)) {
			const strong = newTxt.match(/`(.*?)`+/g);
			strong.forEach((val) => {
				const newVal = '<span class="white">' + val.replace(new RegExp(/`+/g, 'g'), '') + '</span> ';
				newTxt = newTxt.replace(val, newVal);
			});
		}

		return newTxt;
	}

	openLargeView(p) {
		this.selProposal = p;
		this.seeMore = true;
		console.log(p);
		this.sMTitle = p.proposal.title;
		this.sMProposer = p.proposal.proposer;
		this.sMProposer_name = p.proposal.proposal_name;
		this.sMContent = p.proposal.json_data.content;
		this.sMexpires_at = p.proposal.expires_at;
		this.sMType = p.proposal.json_data.type;
		this.sMOption = p.proposal.json_data['options'];
		this.newContent = this.sanitizer.bypassSecurityTrustHtml(this.contentStyle(this.sMContent, 'text-muted'));
	}

	voteProposal() {
		this.busy = true;
		const account = this.aService.selected.getValue();
		const accountName = this.aService.selected.getValue().name;
		const password = this.confirmvoteForm.get('pass').value;
		const [pubkey, permission] = this.aService.getStoredKey(account);
		this.wrongpass = '';
		this.crypto.authenticate(password, pubkey).then((data) => {
			if (data === true) {
				const form = {
					voter: accountName,
					proposal_name: this.selProposal.proposal.proposal_name,
					vote: this.vtProposal,
					vote_json: ''
				};
				this.eos.pushActionContract('eosio.forum', 'vote', form, accountName, permission).then((info) => {
					this.voteModal = false;
					if (this.seeMore) {
						this.seeMore = !this.seeMore;
					}

					this.busy = false;
					console.log(info);
					this.showToast('success', 'Transation broadcasted', 'Check a block explorer for confirmation.');
					this.confirmvoteForm.reset();
				}).catch(error => {
					console.log(error);
          if(typeof error === 'object'){
            this.wrongpass =error.error.details[0].message;
          }else{
            this.wrongpass = JSON.parse(error).error.details[0].message;
          }
					this.busy = false;
					this.confirmvoteForm.reset();
				});
			}
		}).catch((err) => {
			console.log(err);
			this.wrongpass = 'Wrong password!';
			this.busy = false;
			this.confirmvoteForm.reset();
		});
	}

	unvoteProposal() {
		this.busy = true;
		const account = this.aService.selected.getValue();
		const accountName = this.aService.selected.getValue().name;
		const password = this.confirmunvoteForm.get('pass').value;
		const [pubkey, permission] = this.aService.getStoredKey(account);
		this.wrongpass = '';
		this.crypto.authenticate(password, pubkey).then((data) => {
			if (data === true) {
				const form = {voter: accountName, proposal_name: this.selProposal.proposal.proposal_name};
				this.eos.pushActionContract('eosio.forum', 'unvote', form, accountName, permission).then((info) => {
					this.unvoteModal = false;
					this.busy = false;
					if (this.seeMore) {
						this.seeMore = !this.seeMore;
					}
					console.log(info);
					this.showToast('success', 'Transation broadcasted', 'Check your history for confirmation.');
					this.confirmunvoteForm.reset();
				}).catch(error => {
					console.log(error);
          if(typeof error === 'object'){
            this.wrongpass =error.error.details[0].message;
          }else{
            this.wrongpass = JSON.parse(error).error.details[0].message;
          }

					if (this.wrongpass.includes('no vote exists')) {
						this.wrongpass = 'you never voted for this proposal!';
					}
					this.busy = false;
					this.confirmunvoteForm.reset();
				});
			}
		}).catch((err) => {
			console.log(err);
			this.wrongpass = 'Wrong password!';
			this.busy = false;
			this.confirmunvoteForm.reset();
		});

	}

	showOptionsField(val) {
		if (val === 'options-v1' || val === 'multi-select-v1') {
			this.showOptions = 'inline';
			this.options.controls = [];
			this.options.setValue([]);
			this.addOptiont();
		} else {
			this.showOptions = 'none';
			this.options.controls = [];
			this.options.setValue([]);
		}
	}

	addOptiont() {
		this.options.push(this.fb.control(''));
		console.log(moment().utc().add(this.createProposalForm.get('expiry').value, 'days').format(), this.createProposalForm.get('expiry').value);
		this.cdr.detectChanges();
	}

	removeOption() {
		const options: FormArray = this.createProposalForm.get('options') as FormArray;
		// Validators is optional
		if (options.length - 1 > 0) {
			options.removeAt((options.length - 1));
		}
		this.cdr.detectChanges();
	}

	// changeValueOptions(idx, val){
	// 	const optionsArray = this.getOptionsControl();
	// 	console.log(optionsArray[idx],val);
	// 	optionsArray[idx].get(idx).setValue(val);
	// }

	get options(): FormArray {
		return this.createProposalForm.get('options') as FormArray;
	}

	getExpiretimeProposal() {
		return (moment().utc().add(this.createProposalForm.get('expiry').value, 'days').fromNow());
	}

	pushProposal() {
		const contract = 'eosio.forum';
		const action = 'propose';
		const account = this.aService.selected.getValue();
		this.busy = true;

		const formVal = {
			'proposer': account.name,
			'proposal_name': this.createProposalForm.getRawValue().id,
			'title': this.createProposalForm.getRawValue().title,
			'proposal_json': '{\"type\":\"' + this.createProposalForm.getRawValue().type + '\",\"content\":\"' + this.createProposalForm.getRawValue().content.replace(/\n/g,'\\n') + '\"}',
			'expires_at': moment().utc().add(this.createProposalForm.get('expiry').value, 'days').format()
		};

		if (this.createProposalForm.getRawValue().options.length > 0) {
			formVal['proposal_json'] = '{\"type\":\"' + this.createProposalForm.getRawValue().type + '\",\"options\":\"' + this.createProposalForm.getRawValue().options + '\",\"content\":\"' + this.createProposalForm.getRawValue().content.replace(/\n/g,'\\n') + '\"}';
		}

		const accountName = this.aService.selected.getValue().name;
		const password = this.confirmProposalForm.get('pass').value;
		const [pubkey, permission] = this.aService.getStoredKey(account);

		this.crypto.authenticate(password, pubkey).then((data) => {
			if (data === true) {
				console.log(formVal);
				const val = this.eos.pushActionContract(contract, action, formVal, accountName, permission).then((info) => {
					console.log(info);
					this.busy = false;
					this.proposalModal = false;
					this.showToast('success', 'Transation broadcasted', 'Check your history for confirmation.');
				}).catch(error => {
					console.log(error);
					if(typeof error === 'object'){
					  this.wrongpass =error.error.details[0].message;
          }else{
					  this.wrongpass = JSON.parse(error).error.details[0].message;
          }
					this.busy = false;
				});
				console.log(val);
			}
		}).catch(error2 => {
			console.log(error2);
			this.wrongpass = 'Wrong password!';
			this.busy = false;
		});
		this.confirmProposalForm.reset();
	}

}

