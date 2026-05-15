import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Hyperlinking } from './hyperlinking';

describe('Hyperlinking', () => {
  let component: Hyperlinking;
  let fixture: ComponentFixture<Hyperlinking>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Hyperlinking],
    }).compileComponents();

    fixture = TestBed.createComponent(Hyperlinking);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
