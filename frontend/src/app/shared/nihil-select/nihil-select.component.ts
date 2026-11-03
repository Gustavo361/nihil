import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { IconChevronDown, TablerIconComponent } from '@tabler/icons-angular';

export interface NihilSelectOption {
  value: string;
  label: string;
}

@Component({
  selector: 'app-nihil-select',
  imports: [TablerIconComponent],
  templateUrl: './nihil-select.component.html',
  styleUrl: './nihil-select.component.scss',
})
export class NihilSelectComponent {
  readonly iconChevron = IconChevronDown;

  readonly value = input<string>('');
  readonly options = input<NihilSelectOption[]>([]);
  readonly appearance = input<'field' | 'form'>('field');
  readonly ariaLabel = input('');
  readonly placeholder = input('Selecionar');

  readonly valueChange = output<string>();

  readonly open = signal(false);
  readonly menuStyle = signal<Record<string, string>>({});

  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);

  readonly selectedLabel = computed(() => {
    const current = this.value();
    const match = this.options().find((opt) => opt.value === current);
    return match?.label ?? this.placeholder();
  });

  constructor() {
    const onScroll = (): void => {
      if (this.open()) this.syncMenuPosition();
    };
    document.addEventListener('scroll', onScroll, true);
    this.destroyRef.onDestroy(() => document.removeEventListener('scroll', onScroll, true));
  }

  toggle(event: MouseEvent): void {
    event.stopPropagation();
    const next = !this.open();
    if (next) this.syncMenuPosition();
    this.open.set(next);
    if (next) {
      afterNextRender(() => this.syncMenuPosition(), { injector: this.injector });
    }
  }

  pick(option: NihilSelectOption, event: MouseEvent): void {
    event.stopPropagation();
    this.valueChange.emit(option.value);
    this.open.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.open()) return;
    const target = event.target as Node | null;
    if (target && this.host.nativeElement.contains(target)) return;
    this.open.set(false);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open()) this.open.set(false);
  }

  @HostListener('window:resize')
  onResize(): void {
    if (this.open()) this.syncMenuPosition();
  }

  private syncMenuPosition(): void {
    const trigger = this.host.nativeElement.querySelector('.nihil-select__trigger');
    if (!(trigger instanceof HTMLElement)) return;

    const rect = trigger.getBoundingClientRect();
    const gap = 6;
    const bottomInset = 8;
    const top = rect.bottom + gap;
    const maxHeight = Math.max(96, window.innerHeight - top - bottomInset);

    this.menuStyle.set({
      position: 'fixed',
      top: `${top}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      right: 'auto',
      maxHeight: `${maxHeight}px`,
      zIndex: '80',
    });
  }
}
