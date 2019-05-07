import {EventEmitter, Injectable} from '@angular/core';

export interface EventPayload {
	event: string;
	value: number;
}

export interface InputModal {
	visibility: boolean;
	maxValue: number;
	modalTitle: string;
	modalTooltip: string;
	errorMessage: string;
	inputPlaceholder: string;
	hintHTML: string;
	buttonText: string;
	event: EventEmitter<EventPayload>;
}

@Injectable({
	providedIn: 'root'
})
export class ModalStateService {

	public inputModal: InputModal;

	constructor() {
		this.inputModal = {
			visibility: false,
			maxValue: 0,
			modalTitle: '',
			modalTooltip: '',
			inputPlaceholder: 'Amount',
			errorMessage: 'invalid amount',
			hintHTML: '',
			buttonText: 'CONFIRM',
			event: new EventEmitter(true)
		};
	}
}
