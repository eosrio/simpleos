import { TestBed } from '@angular/core/testing';

import { ChainService } from './chain.service';

describe('ChainService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: ChainService = TestBed.get(ChainService);
    expect(service).toBeTruthy();
  });
});
