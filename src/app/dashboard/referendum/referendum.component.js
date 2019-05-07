"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
var core_1 = require("@angular/core");
var forms_1 = require("@angular/forms");
var accounts_service_1 = require("../../services/accounts.service");
var eosjs_service_1 = require("../../services/eosjs.service");
var crypto_service_1 = require("../../services/crypto.service");
var angular2_toaster_1 = require("angular2-toaster");
var moment = require("moment");
var http_1 = require("@angular/common/http");
var textMaskAddons_1 = require("text-mask-addons/dist/textMaskAddons");
var ReferendumComponent = /** @class */ (function () {
    function ReferendumComponent(aService, eos, http, fb, componentFactoryResolver, toaster, crypto) {
        this.aService = aService;
        this.eos = eos;
        this.http = http;
        this.fb = fb;
        this.componentFactoryResolver = componentFactoryResolver;
        this.toaster = toaster;
        this.crypto = crypto;
        this.loading = true;
        this.voteModal = false;
        this.unvoteModal = false;
        this.expired = false;
        this.busy = false;
        this.errormsg = '';
        this.page = 1;
        this.proposals = [];
        this.searchTimer = null;
        this.searchString = '';
        this.numberMask = textMaskAddons_1.createNumberMask({
            prefix: '',
            allowDecimal: true,
            includeThousandsSeparator: true,
            decimalLimit: 4,
        });
        this.searchForm = this.fb.group({
            search: ['', [forms_1.Validators.maxLength(12)]]
        });
        this.confirmvoteForm = this.fb.group({
            pass: ['', [forms_1.Validators.required, forms_1.Validators.minLength(10)]]
        });
        this.confirmunvoteForm = this.fb.group({
            pass: ['', [forms_1.Validators.required, forms_1.Validators.minLength(10)]]
        });
        this.optionsV1 = 'Choose an option!';
        this.sortExpression = 'stats.staked.total';
        this.sortReverse = true;
        this.comparatorMethod = null;
    }
    ReferendumComponent.prototype.ngOnInit = function () {
        var _this = this;
        setTimeout(function () {
            _this.loadVoteTally();
        }, 200);
    };
    ReferendumComponent.prototype.filterProposals = function (term) {
        var _this = this;
        if (this.searchTimer) {
            clearTimeout(this.searchTimer);
        }
        this.searchTimer = setTimeout(function () {
            // fuzzy search with fuse.js
            _this.searchString = term;
        }, 200);
    };
    ReferendumComponent.prototype.sortingChange = function (event) {
        var mode = event.value;
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
    };
    ReferendumComponent.prototype.loadVoteTally = function () {
        var _this = this;
        this.selProposal = null;
        this.vtProposal = 0;
        this.proposals = [];
        var now, lastFecth;
        var url = 'https://s3.amazonaws.com/api.eosvotes.io/eosvotes/tallies/latest.json';
        if (localStorage.getItem('simplEOS.lastProposalFetch') !== null) {
            lastFecth = parseInt(localStorage.getItem('simplEOS.lastProposalFetch'), 10);
            now = new Date().getTime();
            // console.log('Last fetch ', (now - lastFecth) / 1000 / 60, ' minutes ago');
        }
        if ((now - lastFecth > 10 * 60 * 1000) || localStorage.getItem('simplEOS.lastProposalFetch') === null) {
            this.http.get(url).subscribe(function (data) {
                _this.processProposalData(data);
            }, function (err) {
                console.log(err);
                _this.loading = false;
            });
        }
        else {
            // console.log('Loading proposals from local cache');
            this.proposals = JSON.parse(localStorage.getItem('simplEOS.proposals'));
            this.allProposals = this.proposals;
            this.loading = false;
        }
    };
    ReferendumComponent.prototype.processProposalData = function (data) {
        var proposals = [];
        Object.keys(data).forEach(function (prop) {
            var temp_obj = data[prop];
            var temp_json = null;
            try {
                temp_json = JSON.parse(data[prop].proposal.proposal_json);
            }
            catch (e) {
                console.log(e);
                console.log(data[prop]);
            }
            if (temp_json !== null) {
                if (temp_json['content'] === null) {
                    temp_json['content'] = "<em>[no contents]</em>";
                }
                temp_obj['proposal']['json_data'] = temp_json;
            }
            proposals.push(temp_obj);
        });
        this.loading = false;
        localStorage.setItem('simplEOS.proposals', JSON.stringify(proposals));
        localStorage.setItem('simplEOS.lastProposalFetch', new Date().getTime().toString());
        this.allProposals = proposals;
        this.proposals = proposals;
    };
    ReferendumComponent.prototype.loadProposals = function (name) {
        var _this = this;
        this.selProposal = null;
        this.vtProposal = 0;
        this.proposals = [];
        this.eos.getProposals('eosio.forum', 200).then(function (dt) {
            dt.rows.forEach(function (row) {
                var temp_obj = row;
                var temp_json = null;
                try {
                    temp_json = JSON.parse(row.proposal_json);
                }
                catch (e) {
                    console.log(e);
                    console.log(row);
                }
                if (temp_json !== null) {
                    temp_obj['json_data'] = temp_json;
                }
                if (name !== '') {
                    if (name === temp_obj.proposal_name) {
                        _this.proposals.push(temp_obj);
                    }
                }
                else {
                    _this.proposals.push(temp_obj);
                }
            });
            _this.loading = false;
        }).catch(function (err) {
            console.log(err);
        });
    };
    ReferendumComponent.prototype.searchProposal = function (event) {
        this.proposals = [];
        this.loading = true;
        this.loadProposals(event);
    };
    ReferendumComponent.prototype.getExpiretime = function (date) {
        var info = moment.utc(date).fromNow();
        return (info.includes('ago') ? 'Expired ' : 'Expires ') + info;
    };
    ReferendumComponent.prototype.isExpired = function (date) {
        return moment.utc(date).isBefore(moment.now());
    };
    ReferendumComponent.prototype.showToast = function (type, title, body) {
        this.config = new angular2_toaster_1.ToasterConfig({
            positionClass: 'toast-top-right',
            timeout: 10000,
            newestOnTop: true,
            tapToDismiss: true,
            preventDuplicates: false,
            animation: 'slideDown',
            limit: 1,
        });
        var toast = {
            type: type,
            title: title,
            body: body,
            timeout: 10000,
            showCloseButton: true,
            bodyOutputType: angular2_toaster_1.BodyOutputType.TrustedHtml,
        };
        this.toaster.popAsync(toast);
    };
    ReferendumComponent.prototype.startVote = function (prop, vote) {
        this.selProposal = prop;
        this.wrongpass = '';
        this.voteModal = true;
        this.vtProposal = vote;
    };
    ReferendumComponent.prototype.startUnvote = function (prop) {
        this.selProposal = prop;
        this.wrongpass = '';
        this.unvoteModal = true;
    };
    ReferendumComponent.prototype.startMultiVote = function (prop) {
        this.selProposal = prop;
        this.wrongpass = '';
        this.voteModal = true;
    };
    ReferendumComponent.prototype.multiSelect = function (p, value) {
        var binArr = ['0', '0', '0', '0', '0', '0', '0', '0'];
        value.forEach(function (v) {
            binArr[v] = '1';
        });
        binArr.reverse();
        this.vtProposal = parseInt(binArr.join(''), 2);
    };
    ReferendumComponent.prototype.voteProposal = function () {
        var _this = this;
        this.busy = true;
        var account = this.aService.selected.getValue();
        var accountName = this.aService.selected.getValue().name;
        var password = this.confirmvoteForm.get('pass').value;
        var pubkey = account.details['permissions'][0]['required_auth'].keys[0].key;
        this.wrongpass = '';
        this.crypto.authenticate(password, pubkey).then(function (data) {
            if (data === true) {
                var form = { voter: accountName, proposal_name: _this.selProposal.proposal.proposal_name, vote: _this.vtProposal, vote_json: '' };
                _this.eos.pushActionContract('eosio.forum', 'vote', form, accountName).then(function (info) {
                    _this.voteModal = false;
                    _this.busy = false;
                    console.log(info);
                    _this.showToast('success', 'Transation broadcasted', 'Check a block explorer for confirmation.');
                    _this.confirmvoteForm.reset();
                }).catch(function (error) {
                    console.log(error);
                    _this.wrongpass = 'Error: ' + JSON.stringify(JSON.parse(error).error.details[0].message);
                    _this.busy = false;
                    _this.confirmvoteForm.reset();
                });
            }
        }).catch(function (err) {
            console.log(err);
            _this.wrongpass = 'Wrong password!';
            _this.busy = false;
            _this.confirmvoteForm.reset();
        });
    };
    ReferendumComponent.prototype.unvoteProposal = function () {
        var _this = this;
        this.busy = true;
        var account = this.aService.selected.getValue();
        var accountName = this.aService.selected.getValue().name;
        var password = this.confirmunvoteForm.get('pass').value;
        var pubkey = account.details['permissions'][0]['required_auth'].keys[0].key;
        this.wrongpass = '';
        this.crypto.authenticate(password, pubkey).then(function (data) {
            if (data === true) {
                var form = { voter: accountName, proposal_name: _this.selProposal.proposal.proposal_name };
                _this.eos.pushActionContract('eosio.forum', 'unvote', form, accountName).then(function (info) {
                    _this.unvoteModal = false;
                    _this.busy = false;
                    console.log(info);
                    _this.showToast('success', 'Transation broadcasted', 'Check your history for confirmation.');
                    _this.confirmunvoteForm.reset();
                }).catch(function (error) {
                    console.log(error);
                    _this.wrongpass = 'Error: ' + JSON.stringify(JSON.parse(error).error.details[0].message);
                    if (_this.wrongpass.includes('no vote exists')) {
                        _this.wrongpass = 'you never voted for this proposal!';
                    }
                    _this.busy = false;
                    _this.confirmunvoteForm.reset();
                });
            }
        }).catch(function (err) {
            console.log(err);
            _this.wrongpass = 'Wrong password!';
            _this.busy = false;
            _this.confirmunvoteForm.reset();
        });
    };
    ReferendumComponent = __decorate([
        core_1.Component({
            selector: 'app-referendum',
            templateUrl: './referendum.component.html',
            styleUrls: ['./referendum.component.css']
        }),
        __metadata("design:paramtypes", [accounts_service_1.AccountsService,
            eosjs_service_1.EOSJSService,
            http_1.HttpClient,
            forms_1.FormBuilder,
            core_1.ComponentFactoryResolver,
            angular2_toaster_1.ToasterService,
            crypto_service_1.CryptoService])
    ], ReferendumComponent);
    return ReferendumComponent;
}());
exports.ReferendumComponent = ReferendumComponent;
//# sourceMappingURL=referendum.component.js.map