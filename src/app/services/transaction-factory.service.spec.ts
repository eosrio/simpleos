import { TestBed } from '@angular/core/testing';

import { TransactionFactoryService } from './transaction-factory.service';

describe('TransactionFactoryService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: TransactionFactoryService = TestBed.get(TransactionFactoryService);
    expect(service).toBeTruthy();
  });
});
