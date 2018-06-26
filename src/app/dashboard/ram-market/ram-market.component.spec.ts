import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { RamMarketComponent } from './ram-market.component';

describe('RamMarketComponent', () => {
  let component: RamMarketComponent;
  let fixture: ComponentFixture<RamMarketComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ RamMarketComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(RamMarketComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
