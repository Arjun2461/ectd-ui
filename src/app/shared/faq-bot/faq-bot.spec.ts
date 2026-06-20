import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { FaqBot } from './faq-bot';
import { FAQ_TREE, MAIN_MENU_LABEL } from './faq-data';

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

  it('should show welcome message with main menu', () => {
    expect(component.messages[0].showMenu).toBe(true);
    expect(component.messages[0].suggestions?.length).toBe(FAQ_TREE.length);
  });

  it('should navigate to a branch and answer a question', fakeAsync(() => {
    const branch = FAQ_TREE[0];
    component.ask(branch.title);
    tick(2000);
    expect(component.currentBranch).toBe(branch);

    const question = branch.items[0].question;
    component.ask(question);
    tick(2000);
    const lastBot = [...component.messages].reverse().find((m) => m.from === 'bot');
    expect(lastBot?.text).toBe(branch.items[0].answer);
  }));

  it('should return to main menu', fakeAsync(() => {
    component.ask(FAQ_TREE[0].title);
    tick(2000);
    component.ask(MAIN_MENU_LABEL);
    tick(2000);
    expect(component.currentBranch).toBeNull();
    const lastBot = [...component.messages].reverse().find((m) => m.from === 'bot');
    expect(lastBot?.showMenu).toBe(true);
  }));
});
