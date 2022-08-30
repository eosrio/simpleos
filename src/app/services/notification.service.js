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
exports.NotificationService = void 0;
const core_1 = require("@angular/core");
const ngx_toastr_1 = require("ngx-toastr");
const operators_1 = require("rxjs/operators");
let NotificationService = class NotificationService {
    constructor(toastr) {
        this.toastr = toastr;
    }
    onSuccess(title, body) {
        this.toastr.success(body, title, {
            enableHtml: false,
            closeButton: true,
            positionClass: 'toast-top-right',
        });
    }
    onSuccessEX(title, body, data, explorers) {
        this.toastr.success(body, title, {
            enableHtml: true,
            closeButton: true,
            positionClass: 'toast-top-right',
        }).onTap.pipe((0, operators_1.take)(1))
            .subscribe(() => this.toasterClickedHandler(data, explorers));
    }
    toasterClickedHandler(data, explorers) {
        if (explorers) {
            if (explorers.length > 0) {
                const txBase = explorers[0].tx_url;
                if (data.id) {
                    window['shell']['openExternal'](txBase + data.id);
                }
            }
        }
    }
    onError(title, body) {
        this.toastr.error(body, title, {
            enableHtml: true,
            closeButton: true,
            positionClass: 'toast-top-right',
        });
    }
    onInfo(title, body) {
        this.toastr.info(body, title, {
            enableHtml: true,
            closeButton: true,
            positionClass: 'toast-top-right',
        });
    }
    onNotification(html) {
        this.toastr.show(html, '', {
            timeOut: 30000,
            closeButton: true,
            enableHtml: true,
            progressAnimation: 'increasing',
            positionClass: 'toast-bottom-right',
            toastClass: 'ngx-toastr snotifyToast',
        });
    }
};
NotificationService = __decorate([
    (0, core_1.Injectable)({
        providedIn: 'root'
    }),
    __metadata("design:paramtypes", [ngx_toastr_1.ToastrService])
], NotificationService);
exports.NotificationService = NotificationService;
//# sourceMappingURL=notification.service.js.map