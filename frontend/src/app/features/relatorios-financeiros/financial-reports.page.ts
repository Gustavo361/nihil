import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconChartLine, IconDownload, IconFileAnalytics, IconWallet, TablerIconComponent } from '@tabler/icons-angular';
import { SaleCatalogService } from '../../core/sales/sale-catalog.service';
import { ExpenseCatalogService } from '../../core/expenses/expense-catalog.service';
import { StockInventoryService } from '../../core/stock/stock-inventory.service';
import { CashRegisterService } from '../../core/cash/cash-register.service';

type Period = 'today' | '7d' | '30d' | 'year';
type Tab = 'performance' | 'dre' | 'cashflow';

@Component({
  selector: 'app-financial-reports-page',
  imports: [CurrencyPipe, DatePipe, RouterLink, TablerIconComponent],
  templateUrl: './financial-reports.page.html',
  styleUrl: './financial-reports.page.scss',
})
export class FinancialReportsPage {
  private readonly sales = inject(SaleCatalogService);
  private readonly expenses = inject(ExpenseCatalogService);
  private readonly stock = inject(StockInventoryService);
  private readonly cash = inject(CashRegisterService);

  readonly period = signal<Period>('30d');
  readonly tab = signal<Tab>('performance');
  readonly iconChart = IconChartLine;
  readonly iconFile = IconFileAnalytics;
  readonly iconWallet = IconWallet;
  readonly iconDownload = IconDownload;

  readonly range = computed(() => dateRange(this.period()));
  readonly periodLabel = computed(() => ({ today: 'Hoje', '7d': '7 dias', '30d': '30 dias', year: 'Ano' }[this.period()]));
  readonly periodSales = computed(() => this.sales.confirmedInDayRange(this.range().from, this.range().to));
  readonly revenue = computed(() => this.periodSales().reduce((sum, sale) => sum + sale.total, 0));
  readonly expenseRows = computed(() => this.expenses.commitmentsInRange(this.range().from, this.range().to));
  readonly expensesTotal = computed(() => this.expenseRows().reduce((sum, expense) => sum + expense.amount, 0));
  readonly cogs = computed(() => this.stock.cogsInDayRange(this.range().from, this.range().to));
  readonly grossResult = computed(() => this.revenue() - this.cogs().amount);
  readonly estimatedResult = computed(() => this.grossResult() - this.expensesTotal());
  readonly cashEntries = computed(() => this.cash.movements().filter((movement) => movement.at.slice(0, 10) >= this.range().from && movement.at.slice(0, 10) <= this.range().to));
  readonly cashIn = computed(() => this.cashEntries().filter((m) => ['opening', 'sale_receipt', 'supply'].includes(m.type)).reduce((sum, m) => sum + m.amount, 0));
  readonly cashOut = computed(() => this.cashEntries().filter((m) => ['bleed', 'sale_reversal'].includes(m.type)).reduce((sum, m) => sum + m.amount, 0));
  readonly cashBalance = computed(() => this.cashIn() - this.cashOut());
  readonly dailyBars = computed(() => {
    const days = this.period() === 'today' ? 1 : this.period() === '7d' ? 7 : this.period() === '30d' ? 10 : 12;
    const points = Array.from({ length: days }, (_, index) => ({ label: periodPointLabel(this.range().from, this.period(), index, days), value: 0 }));
    for (const sale of this.periodSales()) {
      const index = this.period() === 'today' ? 0 : bucketIndex(sale.at, this.range().from, this.period(), days);
      if (points[index]) points[index].value += sale.total;
    }
    const max = Math.max(...points.map((point) => point.value), 1);
    return points.map((point) => ({ ...point, height: Math.max(4, (point.value / max) * 100) }));
  });

  setPeriod(period: Period): void { this.period.set(period); }
  setTab(tab: Tab): void { this.tab.set(tab); }

  exportCsv(): void {
    const rows = [['Tipo', 'Descrição', 'Data', 'Valor']];
    for (const sale of this.periodSales()) rows.push(['Receita', sale.summary, sale.at.slice(0, 10), sale.total.toFixed(2)]);
    for (const expense of this.expenseRows()) rows.push(['Despesa', expense.description, expense.dueDate, expense.amount.toFixed(2)]);
    const csv = rows.map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(';')).join('\r\n');
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = `nihil-relatorio-${this.period()}.csv`; link.click(); URL.revokeObjectURL(url);
  }
}

function dateRange(period: Period): { from: string; to: string } {
  const to = new Date(); const from = new Date(to);
  if (period === 'today') from.setDate(to.getDate());
  if (period === '7d') from.setDate(to.getDate() - 6);
  if (period === '30d') from.setDate(to.getDate() - 29);
  if (period === 'year') from.setMonth(0, 1);
  return { from: dayKey(from), to: dayKey(to) };
}
function dayKey(date: Date): string { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function bucketIndex(iso: string, from: string, period: Period, count: number): number { const date = new Date(iso); const start = new Date(`${from}T00:00:00`); const days = Math.max(0, Math.floor((date.getTime() - start.getTime()) / 86400000)); return period === 'year' ? Math.min(count - 1, date.getMonth()) : Math.min(count - 1, Math.floor(days / (period === '30d' ? 3 : 1))); }
function periodPointLabel(from: string, period: Period, index: number, count: number): string { if (period === 'today') return 'Hoje'; if (period === 'year') return String(index + 1).padStart(2, '0'); const date = new Date(`${from}T00:00:00`); date.setDate(date.getDate() + (period === '30d' ? index * 3 : index)); return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`; }
