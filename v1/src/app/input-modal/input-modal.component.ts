import {ChangeDetectorRef, Component, OnDestroy} from '@angular/core';
import {FormBuilder, FormGroup, Validators} from '@angular/forms';
import {createNumberMask} from 'text-mask-addons/dist/textMaskAddons';
import {ModalStateService} from '../services/modal-state.service';
import {Subscription} from 'rxjs';

@Component({
	selector: 'app-input-modal',
	templateUrl: './input-modal.component.html',
	styleUrls: ['./input-modal.component.css']
})
export class InputModalComponent implements OnDestroy {

	inputForm: FormGroup;
	numberMask = createNumberMask({
		prefix: '',
		allowDecimal: true,
		includeThousandsSeparator: false,
		decimalLimit: 4,
	});
	errormsg = '';
	valid = false;

	inputSubscription: Subscription;

	constructor(private fb: FormBuilder, public mds: ModalStateService, private cdr: ChangeDetectorRef) {
		this.inputForm = this.fb.group({
			amount: ['', Validators.min(0)]
		});

		this.inputSubscription = this.inputForm.get('amount').valueChanges.subscribe(() => {
			this.checkAmount();
		});
	}

	ngOnDestroy(): void {
		this.inputSubscription.unsubscribe();
	}


	submit() {
		if (this.valid) {
			this.mds.inputModal.event.emit({
				event: 'done',
				value: this.inputForm.get('amount').value
			});
			this.mds.inputModal.visibility = false;
			this.cdr.detectChanges();
		}
	}

	checkAmount() {
		let value = parseFloat(this.inputForm.get('amount').value);
		if (isNaN(value)) {
			value = 0;
		}
		if (value > this.mds.inputModal.maxValue) {
			this.inputForm.get('amount').setErrors({'invalid': true});
			this.errormsg = this.mds.inputModal.errorMessage;
			this.valid = false;
		} else {
			this.inputForm.get('amount').setErrors(null);
			this.errormsg = '';
			this.valid = true;
		}
	}

	setMaxAmount() {
		this.inputForm.patchValue({
			amount: this.mds.inputModal.maxValue
		});
	}

	onClose() {
		this.inputForm.reset();
		this.mds.inputModal.event.emit({
			event: 'close',
			value: null
		});
	}

}
