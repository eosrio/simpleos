import { TestBed } from '@angular/core/testing';

import { ModalStateService } from './modal-state.service';

describe('ModalStateService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: ModalStateService = TestBed.get(ModalStateService);
    expect(service).toBeTruthy();
  });
});
