import {AfterViewInit, Component, OnInit} from '@angular/core';
import {VotingService} from './voting.service';
import {AccountsService} from '../../accounts.service';
import {EOSJSService} from '../../eosjs.service';
import {FormBuilder, FormGroup, Validators} from '@angular/forms';
import {BodyOutputType, Toast, ToasterConfig, ToasterService} from 'angular2-toaster';
import {createNumberMask} from 'text-mask-addons/dist/textMaskAddons';
import {CryptoService} from '../../services/crypto.service';

@Component({
    selector: 'app-vote',
    templateUrl: './vote.component.html',
    styleUrls: ['./vote.component.css']
})
export class VoteComponent implements OnInit, AfterViewInit {
    max: number;
    min: number;
    minstake: boolean;
    valuetoStake: string;
    percenttoStake: string;
    stakeModal: boolean;
    voteModal: boolean;
    nVotes: number;
    busy: boolean;
    totalBalance: number;
    stakedBalance: number;
    singleSelectionBP: any;
    selectedBPs: any[];
    wrongpass: string;
    passForm: FormGroup;
    passFormStake: FormGroup;
    config: ToasterConfig;
    numberMask = createNumberMask({
        prefix: '',
        allowDecimal: true,
        includeThousandsSeparator: false,
        decimalLimit: 4,
    });
    percentMask = createNumberMask({
        prefix: '',
        allowDecimal: true,
        includeThousandsSeparator: false,
        decimalLimit: 1,
        integerLimit: 3,
    });
    stakingDiff: number;
    stakingHRV: string;
    stakerr: string;
    stakedisabled: boolean;

    constructor(public voteService: VotingService,
                public aService: AccountsService,
                public eos: EOSJSService,
                public crypto: CryptoService,
                private fb: FormBuilder,
                private toaster: ToasterService) {
        this.max = 100;
        this.min = 0;
        this.minstake = false;
        this.valuetoStake = '';
        this.percenttoStake = '';
        this.stakeModal = false;
        this.voteModal = false;
        this.busy = false;
        this.totalBalance = 0;
        this.stakedBalance = 0;
        this.wrongpass = '';
        this.stakerr = '';
        this.stakedisabled = true;
        this.singleSelectionBP = {
            name: ''
        };
        this.selectedBPs = [];
        this.passForm = this.fb.group({
            pass: ['', [Validators.required, Validators.minLength(10)]]
        });
        this.passFormStake = this.fb.group({
            pass: ['', [Validators.required, Validators.minLength(10)]]
        });
    }

    sliderLabel(value: number): string {
        const val = parseInt(value.toString(), 10);
        return val.toString();
    }

    setStake() {
        const prevStake = Math.round(this.aService.selected.getValue().staked * 10000);
        const nextStakeFloat = parseFloat(this.valuetoStake);
        const nextStakeInt = Math.round(nextStakeFloat * 10000);
        console.log(prevStake, nextStakeInt);
        const diff = nextStakeInt - prevStake;
        this.stakingDiff = diff;
        this.stakingHRV = (Math.abs(this.stakingDiff) / 10000) + ' EOS';
        if (diff === 0) {
            this.stakerr = 'Value has not changed';
        } else {
            this.stakeModal = true;
        }

    }

    callSetStake(password) {
        this.busy = true;
        const account = this.aService.selected.getValue();
        const pubkey = account.details['permissions'][0]['required_auth'].keys[0].key;
        this.crypto.authenticate(password, pubkey).then((data) => {
            if (data === true) {
                let call;
                if (this.stakingDiff < 0) {
                    console.log('Unstaking: ' + Math.abs(this.stakingDiff));
                    call = this.eos.unstake(account.name, Math.abs(this.stakingDiff));
                } else {
                    console.log('Staking: ' + Math.abs(this.stakingDiff));
                    call = this.eos.stake(account.name, Math.abs(this.stakingDiff));
                }
                call.then(() => {
                    this.busy = false;
                    this.wrongpass = '';
                    this.stakeModal = false;
                    this.showToast('success', 'Action broadcasted', 'Check your history for confirmation.');
                    this.aService.refreshFromChain();
                }).catch((error) => {
                    console.log(JSON.parse(error));
                    if (JSON.parse(error).error.name === 'leeway_deadline_exception') {
                        this.wrongpass = 'Not enough CPU bandwidth to perform transaction. Try again later.';
                    } else {
                        this.wrongpass = JSON.parse(error).error.what;
                    }
                    this.busy = false;
                });
            } else {
                console.dir(data);
                this.wrongpass = 'Catch2!';
                this.busy = false;
            }
        }).catch(() => {
            this.busy = false;
            this.wrongpass = 'Wrong password!';
        });
    }

    ngOnInit() {
        const selectedAcc = this.aService.selected.getValue();
        this.aService.selected.asObservable().subscribe((selected: any) => {
            if (selected) {
                this.totalBalance = selected.full_balance;
                this.stakedBalance = selected.staked;
                this.loadPlacedVotes(selected);
            }
        });
        this.voteService.listReady.asObservable().subscribe((state) => {
            if (state) {
                this.updateCounter();
            }
        });
        this.aService.accounts.forEach((a) => {
            if (a) {
                if (a.name === selectedAcc.name) {
                    const currentVotes = a.details['voter_info']['producers'];
                    this.voteService.bps.forEach((elem) => {
                        elem.checked = currentVotes.indexOf(elem.account) !== -1;
                    });
                }
            }
        });
        this.getCurrentStake();
    }

    ngAfterViewInit() {
        // this.voteService.listProducers();
    }

    getCurrentStake() {
        this.percenttoStake = ((this.stakedBalance / this.totalBalance) * 100).toString();
        this.valuetoStake = this.stakedBalance.toString();
    }

    updateStakeValue() {
        this.stakedisabled = false;
        this.minstake = false;
        this.valuetoStake = (this.totalBalance * (parseFloat(this.percenttoStake) / 100)).toString();
        if (this.valuetoStake ===  '1') {
            this.minstake = true;
        }
    }

    updateStakePercent() {
        this.stakedisabled = false;
        this.percenttoStake = ((parseFloat(this.valuetoStake) * 100) / this.totalBalance).toString();
    }

    checkPercent() {
        this.minstake = false;
        const min = 100 / this.totalBalance;
        if (parseFloat(this.percenttoStake) <= min) {
            this.percenttoStake = min.toString();
            this.updateStakeValue();
            this.minstake = true;
        }
        if (parseFloat(this.percenttoStake) > 100) {
            this.percenttoStake = '100';
            this.updateStakeValue();
        }
    }

    checkValue() {
        this.minstake = false;
        if (parseFloat(this.valuetoStake) <= 1) {
            this.valuetoStake = '1';
            this.updateStakePercent();
            this.minstake = true;
        }
        if (parseFloat(this.valuetoStake) > this.totalBalance) {
            this.valuetoStake = this.totalBalance.toString();
            this.updateStakePercent();
        }
    }

    shuffleBps() {
        this.voteService.randomizeList();
    }

    processVotes() {
        this.selectedBPs = [];
        this.voteService.bps.forEach((bp) => {
            if (bp.checked) {
                this.selectedBPs.push(bp.account);
            }
        });
        this.passForm.reset();
        this.voteModal = true;
    }

    updateCounter() {
        let val = 0;
        this.voteService.bps.forEach((bp) => {
            if (bp.checked) {
                val++;
            }
        });
        this.nVotes = val;
    }

    modalVote(pass) {
        this.busy = true;
        const voter = this.aService.selected.getValue();
        const publicKey = voter.details['permissions'][0]['required_auth'].keys[0].key;
        this.crypto.authenticate(pass, publicKey).then((data) => {
            if (data === true) {
                this.eos.voteProducer(voter.name, this.selectedBPs).then(() => {
                    this.wrongpass = '';
                    this.voteModal = false;
                    this.busy = false;
                    this.showToast('success', 'Vote broadcasted', 'Check your history for confirmation.');
                    this.passForm.reset();
                    this.aService.refreshFromChain();
                    setTimeout(() => {
                        this.loadPlacedVotes(this.aService.selected.getValue());
                    }, 500);
                }).catch((err2) => {
                    if (err2.error.code === 3081001) {
                        this.wrongpass = 'Not enough stake to perform this action.';
                    } else {
                        this.wrongpass = err2.error['what'];
                    }
                    this.busy = false;
                });
            } else {
                this.wrongpass = 'Something went wrong!';
                this.busy = false;
            }
        }).catch(() => {
            this.busy = false;
            this.wrongpass = 'Wrong password!';
        });
    }

    loadPlacedVotes(selectedAccount) {
        const currentVotes = selectedAccount.details['voter_info']['producers'];
        this.nVotes = currentVotes.length;
        this.voteService.bps.forEach((elem) => {
            elem.checked = currentVotes.indexOf(elem.account) !== -1;
        });
        this.updateCounter();
    }

    private showToast(type: string, title: string, body: string) {
        this.config = new ToasterConfig({
            positionClass: 'toast-top-right',
            timeout: 5000,
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
            timeout: 5000,
            showCloseButton: true,
            bodyOutputType: BodyOutputType.TrustedHtml,
        };
        this.toaster.popAsync(toast);
    }

}
