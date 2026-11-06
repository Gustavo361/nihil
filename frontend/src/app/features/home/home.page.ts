import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconAlertTriangle, IconCash, IconChartLine, IconPackage, IconReceipt, IconShoppingCart, IconTruckDelivery, IconTrendingUp, TablerIconComponent } from '@tabler/icons-angular';
import { SaleCatalogService } from '../../core/sales/sale-catalog.service';
import { CashRegisterService } from '../../core/cash/cash-register.service';
import { StockInventoryService } from '../../core/stock/stock-inventory.service';
import { PurchaseCatalogService } from '../../core/purchases/purchase-catalog.service';
import { SupplierCatalogService } from '../../core/suppliers/supplier-catalog.service';
import { ExpenseCatalogService } from '../../core/expenses/expense-catalog.service';

@Component({
  selector: 'app-home-page',
  imports: [CurrencyPipe, DecimalPipe, DatePipe, RouterLink, TablerIconComponent],
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss',
})
export class HomePage {
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
}

function todayKey(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
