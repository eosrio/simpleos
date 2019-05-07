import { TestBed } from '@angular/core/testing';

import { Eosjs2Service } from './eosjs2.service';

describe('Eosjs2Service', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: Eosjs2Service = TestBed.get(Eosjs2Service);
    expect(service).toBeTruthy();
  });
});
