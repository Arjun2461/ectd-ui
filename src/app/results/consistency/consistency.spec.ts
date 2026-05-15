import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Consistency } from './consistency';

describe('Consistency', () => {
  let component: Consistency;
  let fixture: ComponentFixture<Consistency>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Consistency],
    }).compileComponents();

    fixture = TestBed.createComponent(Consistency);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
