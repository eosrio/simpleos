import { TestBed, inject } from '@angular/core/testing';

import { LedgerHWService } from './ledger-h-w.service';

describe('LedgerHWService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [LedgerHWService]
    });
  });

  it('should be created', inject([LedgerHWService], (service: LedgerHWService) => {
    expect(service).toBeTruthy();
  }));
});
