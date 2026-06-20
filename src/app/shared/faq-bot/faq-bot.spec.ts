import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FaqBot } from './faq-bot';

describe('FaqBot', () => {
  let component: FaqBot;
  let fixture: ComponentFixture<FaqBot>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FaqBot],
    }).compileComponents();

    fixture = TestBed.createComponent(FaqBot);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
