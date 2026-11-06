import { CurrencyPipe } from '@angular/common';
import { AfterViewInit, Component, ElementRef, ViewChild, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconAlertTriangle, IconCash, IconChartLine, IconPackage, IconReceipt, IconShoppingCart, IconTruckDelivery, IconTrendingUp, TablerIconComponent } from '@tabler/icons-angular';
import { SaleCatalogService } from '../../core/sales/sale-catalog.service';
import { CashRegisterService } from '../../core/cash/cash-register.service';
import { StockInventoryService } from '../../core/stock/stock-inventory.service';
import { PurchaseCatalogService } from '../../core/purchases/purchase-catalog.service';
import { SupplierCatalogService } from '../../core/suppliers/supplier-catalog.service';
import { ExpenseCatalogService } from '../../core/expenses/expense-catalog.service';
import * as echarts from 'echarts';

@Component({
  selector: 'app-home-page',
  imports: [CurrencyPipe, RouterLink, TablerIconComponent],
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

  readonly todaySales = computed(() => this.sales.confirmedInDayRange(this.today, this.today));
  readonly revenue = computed(() => this.todaySales().reduce((sum, sale) => sum + sale.total, 0));
  readonly saleCount = computed(() => this.todaySales().length);
  readonly averageTicket = computed(() => this.saleCount() ? this.revenue() / this.saleCount() : 0);
  readonly lowStock = this.stock.lowOrOutCount;
  readonly inventoryValue = this.stock.estimatedValue;
  readonly deliveries = this.suppliers.awaitingCount;
  readonly cashOpen = this.cash.isOpen;
  readonly expensesToday = computed(() => this.expenses.commitmentsInRange(this.today, this.today).reduce((sum, expense) => sum + expense.amount, 0));
  readonly purchaseTotal = computed(() => this.purchases.purchases().filter((purchase) => purchase.at.slice(0, 10) === this.today).reduce((sum, purchase) => sum + purchase.totalCost, 0));
  readonly salesByHour = computed(() => {
    const points = Array.from({ length: 12 }, (_, index) => ({ label: `${String(index + 8).padStart(2, '0')}h`, value: 0 }));
    for (const sale of this.todaySales()) {
      const hour = new Date(sale.at).getHours() - 8;
      if (hour >= 0 && hour < points.length) points[hour].value += sale.total;
    }
    const max = Math.max(...points.map((point) => point.value), 1);
    return points.map((point) => ({ ...point, height: Math.max(4, Math.round((point.value / max) * 100)) }));
  });
  readonly topModalities = computed(() => {
    const counts = new Map<string, number>();
    for (const sale of this.todaySales()) counts.set(sale.modality, (counts.get(sale.modality) ?? 0) + 1);
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
      this.salesByHour(); this.topModalities(); this.chartMode(); this.chartRefresh();
      queueMicrotask(() => this.renderCharts());
    });
  }

  ngAfterViewInit(): void { this.renderCharts(); }

  toggleChartMode(): void { this.chartMode.update((mode) => mode === 'area' ? 'bar' : 'area'); }

  refresh(): void { this.chartRefresh.update((value) => value + 1); }

  private renderCharts(): void {
    if (!this.salesChart?.nativeElement || !this.modalityChart?.nativeElement) return;
    this.salesChartInstance ??= echarts.init(this.salesChart.nativeElement);
    this.modalityChartInstance ??= echarts.init(this.modalityChart.nativeElement);
    const styles = getComputedStyle(document.documentElement);
    const text = styles.getPropertyValue('--text-secondary').trim();
    const primary = styles.getPropertyValue('--accent').trim();
    const seriesType = this.chartMode() === 'area' ? 'line' : 'bar';
    this.salesChartInstance.setOption({ animationDuration: 350, tooltip: { trigger: 'axis' }, grid: { left: 35, right: 18, top: 20, bottom: 28 }, xAxis: { type: 'category', boundaryGap: seriesType === 'bar', data: this.salesByHour().map((point) => point.label), axisLabel: { color: text, fontSize: 10 }, axisLine: { lineStyle: { color: text, opacity: .2 } } }, yAxis: { type: 'value', axisLabel: { color: text, fontSize: 10 }, splitLine: { lineStyle: { color: text, opacity: .1 } } }, series: [{ type: seriesType, smooth: true, data: this.salesByHour().map((point) => point.value), itemStyle: { color: primary, borderRadius: seriesType === 'bar' ? [5, 5, 0, 0] : 0 }, lineStyle: { color: primary, width: 3 }, areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: `${primary}66` }, { offset: 1, color: `${primary}05` }]) } }] }, true);
    const modality = this.topModalities();
    this.modalityChartInstance.setOption({ animationDuration: 350, tooltip: { trigger: 'item' }, legend: { bottom: 0, textStyle: { color: text, fontSize: 10 } }, series: [{ type: 'pie', radius: ['52%', '74%'], center: ['50%', '45%'], avoidLabelOverlap: true, label: { show: false }, data: modality.map((item, index) => ({ name: item.label, value: item.value, itemStyle: { color: [primary, styles.getPropertyValue('--accent-strong').trim(), styles.getPropertyValue('--success').trim()][index] } })) }] }, true);
  }
}

function todayKey(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
