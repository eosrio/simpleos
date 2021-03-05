import {Injectable} from '@angular/core';
import {ToastrService} from 'ngx-toastr';
import {take} from 'rxjs/operators';

@Injectable({
	providedIn: 'root'
})
export class NotificationService {

	constructor(private toastr: ToastrService) {
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
		}).onTap.pipe(take(1))
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

}
