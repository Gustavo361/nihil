import { Component, ElementRef, HostListener, computed, input, output, signal } from '@angular/core';
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

  readonly selectedLabel = computed(() => {
    const current = this.value();
    const match = this.options().find((opt) => opt.value === current);
    return match?.label ?? this.placeholder();
  });

  constructor(private readonly host: ElementRef<HTMLElement>) {}

  toggle(event: MouseEvent): void {
    event.stopPropagation();
    this.open.update((v) => !v);
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
}
