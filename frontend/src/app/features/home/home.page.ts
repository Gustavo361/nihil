import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { AfterViewInit, Component, ElementRef, HostListener, ViewChild, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconAlertTriangle, IconCash, IconChartLine, IconPackage, IconReceipt, IconShoppingCart, IconTruckDelivery, IconTrendingUp, TablerIconComponent } from '@tabler/icons-angular';
import { SaleCatalogService } from '../../core/sales/sale-catalog.service';
import { CashRegisterService } from '../../core/cash/cash-register.service';
import { StockInventoryService } from '../../core/stock/stock-inventory.service';
import { PurchaseCatalogService } from '../../core/purchases/purchase-catalog.service';
import { SupplierCatalogService } from '../../core/suppliers/supplier-catalog.service';
import { ExpenseCatalogService } from '../../core/expenses/expense-catalog.service';
import { ThemeService } from '../../core/theme/theme.service';
import * as echarts from 'echarts/core';
import { BarChart, LineChart, PieChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { graphic } from 'echarts/core';

echarts.use([BarChart, LineChart, PieChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer]);

type DashboardPeriod = 'today' | '7d' | '30d' | 'custom';
interface ActivityItem { id: string; label: string; at: string; value?: number; route: string; kind: 'sale' | 'purchase' | 'stock' | 'cash'; }

@Component({
  selector: 'app-home-page',
  imports: [CurrencyPipe, DatePipe, DecimalPipe, RouterLink, TablerIconComponent],
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss',
})
export class HomePage implements AfterViewInit {
  @ViewChild('salesChart') private salesChart?: ElementRef<HTMLDivElement>;
  @ViewChild('modalityChart') private modalityChart?: ElementRef<HTMLDivElement>;
  private readonly sales = inject(SaleCatalogService);
  private readonly cash = inject(CashRegisterService);
  private readonly stock = inject(StockInventoryService);
  private readonly purchases = inject(PurchaseCatalogService);
  private readonly suppliers = inject(SupplierCatalogService);
  private readonly expenses = inject(ExpenseCatalogService);
  private readonly theme = inject(ThemeService);

  readonly today = todayKey();
  readonly todayLabel = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
  readonly iconTrend = IconTrendingUp;
  readonly iconChart = IconChartLine;
  readonly iconReceipt = IconReceipt;
  readonly iconCash = IconCash;
  readonly iconStock = IconPackage;
  readonly iconAlert = IconAlertTriangle;
  readonly iconCart = IconShoppingCart;
  readonly iconTruck = IconTruckDelivery;
  readonly chartMode = signal<'area' | 'bar'>('area');
  readonly chartRefresh = signal(0);
  readonly period = signal<DashboardPeriod>('today');
  readonly customFrom = signal(this.today);
  readonly customTo = signal(this.today);

  readonly range = computed(() => dashboardRange(this.period(), this.customFrom(), this.customTo()));
  readonly periodSales = computed(() => this.sales.confirmedInDayRange(this.range().from, this.range().to));
  readonly previousRange = computed(() => previousDashboardRange(this.range()));
  readonly previousSales = computed(() => this.sales.confirmedInDayRange(this.previousRange().from, this.previousRange().to));
  readonly revenue = computed(() => this.periodSales().reduce((sum, sale) => sum + sale.total, 0));
  readonly previousRevenue = computed(() => this.previousSales().reduce((sum, sale) => sum + sale.total, 0));
  readonly saleCount = computed(() => this.periodSales().length);
  readonly revenueVariation = computed(() => variation(this.revenue(), this.previousRevenue()));
  readonly averageTicket = computed(() => this.saleCount() ? this.revenue() / this.saleCount() : 0);
  readonly lowStock = this.stock.lowOrOutCount;
  readonly inventoryValue = this.stock.estimatedValue;
  readonly deliveries = this.suppliers.awaitingCount;
  readonly cashOpen = this.cash.isOpen;
  readonly expensesToday = computed(() => this.expenses.commitmentsInRange(this.range().from, this.range().to).reduce((sum, expense) => sum + expense.amount, 0));
  readonly purchaseTotal = computed(() => this.purchases.purchases().filter((purchase) => purchase.at.slice(0, 10) >= this.range().from && purchase.at.slice(0, 10) <= this.range().to).reduce((sum, purchase) => sum + purchase.totalCost, 0));
  readonly activity = computed<ActivityItem[]>(() => [
    ...this.sales.sales().map((sale) => ({ id: `sale-${sale.id}`, label: `${sale.status === 'cancelled' ? 'Venda cancelada' : 'Venda confirmada'} · ${sale.summary}`, at: sale.at, value: sale.total, route: '/vendas', kind: 'sale' as const })),
    ...this.purchases.purchases().map((purchase) => ({ id: `purchase-${purchase.id}`, label: `Compra registrada · ${purchase.summary}`, at: purchase.at, value: purchase.totalCost, route: '/compras', kind: 'purchase' as const })),
    ...this.stock.movements().map((movement) => ({ id: `stock-${movement.id}`, label: `Movimentação de estoque · ${movement.note}`, at: movement.at, route: '/estoque', kind: 'stock' as const })),
    ...this.cash.movements().map((movement) => ({ id: `cash-${movement.id}`, label: movement.description, at: movement.at, value: movement.amount, route: '/caixa', kind: 'cash' as const })),
  ].filter((item) => item.at.slice(0, 10) >= this.range().from && item.at.slice(0, 10) <= this.range().to).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 5));
  readonly salesByHour = computed(() => {
    const count = this.period() === 'today' ? 12 : this.period() === '7d' ? 7 : this.period() === '30d' ? 10 : Math.min(12, Math.max(1, Math.ceil((new Date(`${this.range().to}T00:00:00`).getTime() - new Date(`${this.range().from}T00:00:00`).getTime()) / 86400000) + 1));
    const points = Array.from({ length: count }, (_, index) => ({ label: this.period() === 'today' ? `${String(index + 8).padStart(2, '0')}h` : this.period() === '30d' ? `+${index * 3 + 1}d` : `+${index + 1}d`, value: 0 }));
    for (const sale of this.periodSales()) {
      const hour = this.period() === 'today' ? new Date(sale.at).getHours() - 8 : bucketIndex(sale.at, this.range().from, points.length, this.period());
      if (hour >= 0 && hour < points.length) points[hour].value += sale.total;
    }
    const max = Math.max(...points.map((point) => point.value), 1);
    return points.map((point) => ({ ...point, height: Math.max(4, Math.round((point.value / max) * 100)) }));
  });
  readonly topModalities = computed(() => {
    const counts = new Map<string, number>();
    for (const sale of this.periodSales()) counts.set(sale.modality, (counts.get(sale.modality) ?? 0) + 1);
    return [
      { label: 'Buffet', value: counts.get('buffet') ?? 0 },
      { label: 'Por kg', value: counts.get('kg') ?? 0 },
      { label: 'Pratos', value: counts.get('dishes') ?? 0 },
    ];
  });

  private salesChartInstance?: echarts.ECharts;
  private modalityChartInstance?: echarts.ECharts;

  constructor() {
    effect(() => {
      this.salesByHour(); this.topModalities(); this.chartMode(); this.chartRefresh(); this.period(); this.customFrom(); this.customTo(); this.theme.themeId();
      queueMicrotask(() => this.renderCharts());
    });
  }

  ngAfterViewInit(): void { this.renderCharts(); }

  toggleChartMode(): void { this.chartMode.update((mode) => mode === 'area' ? 'bar' : 'area'); }

  refresh(): void { this.chartRefresh.update((value) => value + 1); }
  @HostListener('window:resize') onResize(): void { this.salesChartInstance?.resize(); this.modalityChartInstance?.resize(); }
  setPeriod(period: DashboardPeriod): void { this.period.set(period); }
  setCustomFrom(value: string): void { this.customFrom.set(value); }
  setCustomTo(value: string): void { this.customTo.set(value); }

  private renderCharts(): void {
    if (!this.salesChart?.nativeElement || !this.modalityChart?.nativeElement) return;
    this.salesChartInstance ??= echarts.init(this.salesChart.nativeElement);
    this.modalityChartInstance ??= echarts.init(this.modalityChart.nativeElement);
    const styles = getComputedStyle(document.documentElement);
    const text = styles.getPropertyValue('--text-secondary').trim();
    const primary = styles.getPropertyValue('--accent').trim();
    const seriesType = this.chartMode() === 'area' ? 'line' : 'bar';
    this.salesChartInstance.setOption({ animationDuration: 350, tooltip: { trigger: 'axis' }, legend: { top: 0, textStyle: { color: text, fontSize: 10 } }, grid: { left: 35, right: 18, top: 32, bottom: 28 }, xAxis: { type: 'category', boundaryGap: seriesType === 'bar', data: this.salesByHour().map((point) => point.label), axisLabel: { color: text, fontSize: 10 }, axisLine: { lineStyle: { color: text, opacity: .2 } } }, yAxis: { type: 'value', axisLabel: { color: text, fontSize: 10 }, splitLine: { lineStyle: { color: text, opacity: .1 } } }, series: [{ name: 'Atual', type: seriesType, smooth: true, data: this.salesByHour().map((point) => point.value), itemStyle: { color: primary, borderRadius: seriesType === 'bar' ? [5, 5, 0, 0] : 0 }, lineStyle: { color: primary, width: 3 }, areaStyle: { color: new graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: `${primary}66` }, { offset: 1, color: `${primary}05` }]) } }, { name: 'Anterior', type: 'line', smooth: true, data: this.comparisonPoints(), lineStyle: { color: text, opacity: .45, type: 'dashed' }, itemStyle: { color: text, opacity: .5 }, symbol: 'none' }] }, true);
    const modality = this.topModalities();
    this.modalityChartInstance.setOption({ animationDuration: 350, tooltip: { trigger: 'item' }, legend: { bottom: 0, textStyle: { color: text, fontSize: 10 } }, series: [{ type: 'pie', radius: ['52%', '74%'], center: ['50%', '45%'], avoidLabelOverlap: true, label: { show: false }, data: modality.map((item, index) => ({ name: item.label, value: item.value, itemStyle: { color: [primary, styles.getPropertyValue('--accent-strong').trim(), styles.getPropertyValue('--success').trim()][index] } })) }] }, true);
  }

  private comparisonPoints(): number[] { const count = this.salesByHour().length; const values = Array.from({ length: count }, () => 0); for (const sale of this.previousSales()) { const index = this.period() === 'today' ? new Date(sale.at).getHours() - 8 : bucketIndex(sale.at, this.previousRange().from, count, this.period()); if (index >= 0 && index < count) values[index] += sale.total; } return values; }
}

function todayKey(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function dayKey(date: Date): string { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function dashboardRange(period: DashboardPeriod, from: string, to: string): { from: string; to: string } { if (period === 'custom') return { from, to: from <= to ? to : from }; const end = new Date(); const start = new Date(end); if (period === '7d') start.setDate(end.getDate() - 6); if (period === '30d') start.setDate(end.getDate() - 29); return { from: dayKey(start), to: dayKey(end) }; }
function previousDashboardRange(range: { from: string; to: string }): { from: string; to: string } { const start = new Date(`${range.from}T00:00:00`); const end = new Date(`${range.to}T00:00:00`); const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1); const previousEnd = new Date(start); previousEnd.setDate(start.getDate() - 1); const previousStart = new Date(previousEnd); previousStart.setDate(previousEnd.getDate() - days + 1); return { from: dayKey(previousStart), to: dayKey(previousEnd) }; }
function variation(current: number, previous: number): number | null { return previous ? ((current - previous) / previous) * 100 : null; }
function bucketIndex(iso: string, from: string, count: number, period: DashboardPeriod): number { const date = new Date(iso); const start = new Date(`${from}T00:00:00`); const days = Math.max(0, Math.floor((date.getTime() - start.getTime()) / 86400000)); return period === '30d' ? Math.min(count - 1, Math.floor(days / 3)) : Math.min(count - 1, days); }
