import { Component, computed, input, output } from '@angular/core';

@Component({
  selector: 'app-table-pager',
  templateUrl: './table-pager.component.html',
  styleUrl: './table-pager.component.scss',
})
export class TablePagerComponent {
  readonly total = input(0);
  readonly page = input(1);
  readonly pageSize = input(20);
  readonly pageChange = output<number>();

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize())));
  readonly currentPage = computed(() => Math.min(Math.max(1, this.page()), this.totalPages()));
  readonly from = computed(() => this.total() === 0 ? 0 : (this.currentPage() - 1) * this.pageSize() + 1);
  readonly to = computed(() => Math.min(this.currentPage() * this.pageSize(), this.total()));

  previous(): void {
    this.pageChange.emit(this.currentPage() - 1);
  }

  next(): void {
    this.pageChange.emit(this.currentPage() + 1);
  }
}
