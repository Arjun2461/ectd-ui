import {
  Component,
  ElementRef,
  ViewChild,
  OnDestroy,
  OnInit,
  ChangeDetectorRef,
  NgZone,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  LucideAngularModule,
  X,
  Send,
  ChevronRight,
  Home,
} from 'lucide-angular';
import {
  FAQ_TREE,
  Branch,
  MAIN_MENU_LABEL,
  CLOSE_LABEL,
} from './faq-data';

interface ChatMessage {
  id: number;
  from: 'bot' | 'user';
  text: string;
  suggestions?: string[];
  showMenu?: boolean;
}

@Component({
  selector: 'app-faq-bot',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './faq-bot.html',
  styleUrl: './faq-bot.css',
})
export class FaqBot implements OnInit, OnDestroy {
  @ViewChild('scrollAnchor') private scrollAnchor!: ElementRef<HTMLDivElement>;

  X = X;
  Send = Send;
  ChevronRight = ChevronRight;
  Home = Home;

  readonly faqTree = FAQ_TREE;
  readonly mainMenuLabel = MAIN_MENU_LABEL;
  readonly closeLabel = CLOSE_LABEL;

  isOpen = false;
  draft = '';
  isTyping = false;
  hasUnread = true;
  showNudge = false;
  nudgeMessage = '';
  private nudgeIndex = 0;
  private nudgeInterval: ReturnType<typeof setInterval> | null = null;
  private nudgeHideTimer: ReturnType<typeof setTimeout> | null = null;
  private messageSeq = 0;
  private typingTimer: ReturnType<typeof setTimeout> | null = null;

  readonly nudgeMessages = [
    'May I help you? 👋',
    'Need help with eCTD?',
    'Ask me anything!',
    'I\'m here if you need me!',
  ];

  currentBranch: Branch | null = null;

  messages: ChatMessage[] = [this.buildWelcomeMessage()];

  constructor(
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
  ) {}

  ngOnInit(): void {
    setTimeout(() => this.displayNudge(), 1200);
    this.nudgeInterval = setInterval(() => {
      if (!this.isOpen) {
        this.displayNudge();
      }
    }, 3000);
  }

  toggle(): void {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.hasUnread = false;
      this.hideNudge();
      this.scrollToBottom();
    }
  }

  onFabHover(): void {
    this.hideNudge();
  }

  close(): void {
    this.isOpen = false;
    this.cdr.detectChanges();
  }

  ask(text: string): void {
    const trimmed = text.trim();
    if (!trimmed || this.isTyping) return;

    this.clearSuggestions();
    this.pushMessage({ from: 'user', text: trimmed });
    this.draft = '';

    if (this.isMainMenuRequest(trimmed)) {
      this.currentBranch = null;
      this.botReply(this.buildWelcomeMessage().text, {
        showMenu: true,
        suggestions: this.rootSuggestions(),
      });
      return;
    }

    if (trimmed === CLOSE_LABEL) {
      this.botReply('Glad I could help! Reach out anytime you need assistance.', {
        delay: 350,
        onComplete: () => this.close(),
      });
      return;
    }

    const branch = FAQ_TREE.find(
      (b) => b.title === trimmed || b.id === trimmed,
    );
    if (branch) {
      this.currentBranch = branch;
      this.botReply(branch.intro, {
        suggestions: [
          ...branch.items.map((i) => i.question),
          MAIN_MENU_LABEL,
        ],
      });
      return;
    }

    if (this.currentBranch) {
      const item = this.currentBranch.items.find((i) => i.question === trimmed);
      if (item) {
        this.botReply(item.answer, {
          suggestions: [
            ...this.currentBranch.items.map((i) => i.question),
            MAIN_MENU_LABEL,
            CLOSE_LABEL,
          ],
        });
        return;
      }
    }

    const fuzzy = this.findFuzzyMatch(trimmed);
    if (fuzzy) {
      if (fuzzy.type === 'branch') {
        this.ask(fuzzy.branch.title);
        return;
      }
      this.currentBranch = fuzzy.branch;
      this.botReply(fuzzy.item.answer, {
        suggestions: [
          ...fuzzy.branch.items.map((i) => i.question),
          MAIN_MENU_LABEL,
          CLOSE_LABEL,
        ],
      });
      return;
    }

    this.botReply(
      "I couldn't find an exact match. Pick a topic below or rephrase your question.",
      { showMenu: true, suggestions: this.rootSuggestions() },
    );
  }

  selectBranch(branch: Branch): void {
    this.ask(branch.title);
  }

  onSend(): void {
    this.ask(this.draft);
  }

  onSuggestionClick(question: string): void {
    this.ask(question);
  }

  trackMessage(_index: number, msg: ChatMessage): number {
    return msg.id;
  }

  ngOnDestroy(): void {
    if (this.typingTimer) clearTimeout(this.typingTimer);
    if (this.nudgeInterval) clearInterval(this.nudgeInterval);
    if (this.nudgeHideTimer) clearTimeout(this.nudgeHideTimer);
  }

  private displayNudge(): void {
    if (this.isOpen) return;

    this.nudgeMessage = this.nudgeMessages[this.nudgeIndex];
    this.nudgeIndex = (this.nudgeIndex + 1) % this.nudgeMessages.length;
    this.showNudge = true;
    this.cdr.detectChanges();

    if (this.nudgeHideTimer) clearTimeout(this.nudgeHideTimer);
    this.nudgeHideTimer = setTimeout(() => {
      this.ngZone.run(() => this.hideNudge());
    }, 2400);
  }

  private hideNudge(): void {
    this.showNudge = false;
    this.cdr.detectChanges();
  }

  private buildWelcomeMessage(): ChatMessage {
    return {
      id: ++this.messageSeq,
      from: 'bot',
      text: 'Hi! I\'m your eCTD Assistant. Pick a topic or type a question.',
      showMenu: true,
      suggestions: this.rootSuggestions(),
    };
  }

  private rootSuggestions(): string[] {
    return FAQ_TREE.map((b) => b.title);
  }

  private isMainMenuRequest(text: string): boolean {
    const lower = text.toLowerCase();
    return (
      text === MAIN_MENU_LABEL ||
      lower === 'menu' ||
      lower === 'main menu' ||
      lower === 'back' ||
      lower === 'home'
    );
  }

  private pushMessage(partial: Omit<ChatMessage, 'id'>): void {
    this.messages = [...this.messages, { ...partial, id: ++this.messageSeq }];
    this.cdr.detectChanges();
    this.scrollToBottom();
  }

  private clearSuggestions(): void {
    this.messages = this.messages.map((m) => ({
      ...m,
      suggestions: undefined,
      showMenu: false,
    }));
    this.cdr.detectChanges();
  }

  private botReply(
    text: string,
    options: {
      suggestions?: string[];
      showMenu?: boolean;
      delay?: number;
      onComplete?: () => void;
    } = {},
  ): void {
    const delay = options.delay ?? 500 + Math.min(text.length * 5, 600);
    this.isTyping = true;
    this.cdr.detectChanges();
    this.scrollToBottom();

    if (this.typingTimer) clearTimeout(this.typingTimer);

    this.typingTimer = setTimeout(() => {
      this.ngZone.run(() => {
        this.isTyping = false;
        this.pushMessage({
          from: 'bot',
          text,
          suggestions: options.suggestions,
          showMenu: options.showMenu,
        });
        options.onComplete?.();
      });
    }, delay);
  }

  private scrollToBottom(): void {
    requestAnimationFrame(() => {
      this.scrollAnchor?.nativeElement?.scrollIntoView({
        behavior: 'smooth',
        block: 'end',
      });
    });
  }

  private findFuzzyMatch(query: string):
    | { type: 'branch'; branch: Branch }
    | { type: 'item'; branch: Branch; item: Branch['items'][number] }
    | null {
    const q = query.toLowerCase();

    for (const branch of FAQ_TREE) {
      if (
        branch.title.toLowerCase().includes(q) ||
        branch.intro.toLowerCase().includes(q)
      ) {
        return { type: 'branch', branch };
      }
      for (const item of branch.items) {
        if (
          item.question.toLowerCase().includes(q) ||
          item.answer.toLowerCase().includes(q)
        ) {
          return { type: 'item', branch, item };
        }
      }
    }
    return null;
  }
}
