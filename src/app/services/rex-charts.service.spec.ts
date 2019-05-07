import { TestBed } from '@angular/core/testing';

import { RexChartsService } from './rex-charts.service';

describe('RexChartsService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: RexChartsService = TestBed.get(RexChartsService);
    expect(service).toBeTruthy();
  });
});
