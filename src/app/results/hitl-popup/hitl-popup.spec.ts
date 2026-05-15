import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HitlPopup } from './hitl-popup';

describe('HitlPopup', () => {
  let component: HitlPopup;
  let fixture: ComponentFixture<HitlPopup>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HitlPopup],
    }).compileComponents();

    fixture = TestBed.createComponent(HitlPopup);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
