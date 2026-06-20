import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewChecked,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  LucideAngularModule,
  Bot,
  X,
  Send,
  Sparkles,
  ChevronRight,
  Home,
  MessageCircle,
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
export class FaqBot implements AfterViewChecked, OnDestroy {
  @ViewChild('scrollAnchor') private scrollAnchor!: ElementRef<HTMLDivElement>;

  Bot = Bot;
  X = X;
  Send = Send;
  Sparkles = Sparkles;
  ChevronRight = ChevronRight;
  Home = Home;
  MessageCircle = MessageCircle;

  readonly faqTree = FAQ_TREE;
  readonly mainMenuLabel = MAIN_MENU_LABEL;
  readonly closeLabel = CLOSE_LABEL;

  isOpen = false;
  draft = '';
  isTyping = false;
  hasUnread = true;
  private messageSeq = 0;
  private typingTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldScroll = false;

  currentBranch: Branch | null = null;

  messages: ChatMessage[] = [this.buildWelcomeMessage()];

  toggle(): void {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.hasUnread = false;
      this.shouldScroll = true;
    }
  }

  close(): void {
    this.isOpen = false;
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
        delay: 400,
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

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this.scrollAnchor?.nativeElement.scrollIntoView({
        behavior: 'smooth',
        block: 'end',
      });
      this.shouldScroll = false;
    }
  }

  ngOnDestroy(): void {
    if (this.typingTimer) clearTimeout(this.typingTimer);
  }

  private buildWelcomeMessage(): ChatMessage {
    return {
      id: ++this.messageSeq,
      from: 'bot',
      text: 'Hi there! I\'m your eCTD Assistant. Choose a topic below or type a question.',
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
    this.messages.push({ ...partial, id: ++this.messageSeq });
    this.shouldScroll = true;
  }

  private clearSuggestions(): void {
    this.messages.forEach((m) => {
      m.suggestions = undefined;
      m.showMenu = false;
    });
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
    const delay = options.delay ?? 700 + Math.min(text.length * 8, 900);
    this.isTyping = true;
    this.shouldScroll = true;

    if (this.typingTimer) clearTimeout(this.typingTimer);

    this.typingTimer = setTimeout(() => {
      this.isTyping = false;
      this.pushMessage({
        from: 'bot',
        text,
        suggestions: options.suggestions,
        showMenu: options.showMenu,
      });
      options.onComplete?.();
    }, delay);
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
