import { TestBed } from '@angular/core/testing';

import { FusejsService } from './fusejs.service';

describe('FusejsService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: FusejsService = TestBed.get(FusejsService);
    expect(service).toBeTruthy();
  });
});
