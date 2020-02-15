import { TestBed, inject } from '@angular/core/testing';

import { LedgerService } from './ledger.service';

describe('LedgerHWService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [LedgerService]
    });
  });

  it('should be created', inject([LedgerService], (service: LedgerService) => {
    expect(service).toBeTruthy();
  }));
});
