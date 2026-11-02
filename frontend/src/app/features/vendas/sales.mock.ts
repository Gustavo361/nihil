import { MenuDish, Sale } from './sales.models';

/** UI-only sample data until sales/menu API exists. Not business source of truth. */

export const DEFAULT_BUFFET_PRICE = 49.9;
export const DEFAULT_KG_PRICE = 69.9;

export const MENU_DISHES_MOCK: MenuDish[] = [
  { id: 'd1', name: 'À la minuta bife', unitPrice: 28.9 },
  { id: 'd2', name: 'À la minuta frango', unitPrice: 24.9 },
  { id: 'd3', name: 'Filé de peixe grelhado', unitPrice: 32.5 },
  { id: 'd4', name: 'Strogonoff de frango', unitPrice: 27.0 },
  { id: 'd5', name: 'Feijoada (prato)', unitPrice: 35.0 },
  { id: 'd6', name: 'Executivo carne', unitPrice: 26.5 },
  { id: 'd7', name: 'Executivo vegetariano', unitPrice: 22.0 },
  { id: 'd8', name: 'Salada completa', unitPrice: 18.5 },
];

function atToday(hours: number, minutes: number): string {
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
}

function atDaysAgo(daysAgo: number, hours: number, minutes: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
}

export const SALES_MOCK: Sale[] = [
  {
    id: 'V2026-0001',
    at: atToday(11, 15),
    modality: 'buffet',
    summary: 'Buffet · 2 pessoa(s)',
    total: 99.8,
    payment: 'pix',
    status: 'confirmed',
    peopleCount: 2,
    pricePerPerson: 49.9,
  },
  {
    id: 'V2026-0002',
    at: atToday(12, 5),
    modality: 'kg',
    summary: 'Marmita · 0,850 kg',
    total: 59.15,
    payment: 'cash',
    status: 'confirmed',
    weightKg: 0.85,
    pricePerKg: 69.9,
  },
  {
    id: 'V2026-0003',
    at: atToday(12, 40),
    modality: 'dishes',
    summary: '1× À la minuta bife, 1× Salada completa',
    total: 47.4,
    payment: 'debit',
    status: 'confirmed',
    lines: [
      { dishId: 'd1', dishName: 'À la minuta bife', unitPrice: 28.9, quantity: 1 },
      { dishId: 'd8', dishName: 'Salada completa', unitPrice: 18.5, quantity: 1 },
    ],
  },
  {
    id: 'V2026-0004',
    at: atToday(13, 20),
    modality: 'buffet',
    summary: 'Buffet · 4 pessoa(s)',
    total: 199.6,
    payment: 'credit',
    status: 'confirmed',
    peopleCount: 4,
    pricePerPerson: 49.9,
  },
  {
    id: 'V2026-0005',
    at: atToday(14, 10),
    modality: 'dishes',
    summary: '2× Executivo carne',
    total: 53.0,
    payment: 'pix',
    status: 'cancelled',
    lines: [{ dishId: 'd6', dishName: 'Executivo carne', unitPrice: 26.5, quantity: 2 }],
    cancellation: {
      at: atToday(14, 25),
      reason: 'Cliente desistiu após confirmação.',
      user: 'Administrador',
    },
  },
  {
    id: 'V2026-0006',
    at: atToday(15, 5),
    modality: 'kg',
    summary: 'Marmita · 1,200 kg',
    total: 83.88,
    payment: 'debit',
    status: 'confirmed',
    weightKg: 1.2,
    pricePerKg: 69.9,
  },
  {
    id: 'V2026-0007',
    at: atToday(16, 30),
    modality: 'dishes',
    summary: '1× Feijoada (prato), 1× Strogonoff de frango',
    total: 62.0,
    payment: 'cash',
    status: 'confirmed',
    lines: [
      { dishId: 'd5', dishName: 'Feijoada (prato)', unitPrice: 35.0, quantity: 1 },
      { dishId: 'd4', dishName: 'Strogonoff de frango', unitPrice: 27.0, quantity: 1 },
    ],
  },
  {
    id: 'V2026-0008',
    at: atDaysAgo(1, 12, 45),
    modality: 'buffet',
    summary: 'Buffet · 3 pessoa(s)',
    total: 149.7,
    payment: 'pix',
    status: 'confirmed',
    peopleCount: 3,
    pricePerPerson: 49.9,
  },
  {
    id: 'V2026-0009',
    at: atDaysAgo(1, 18, 10),
    modality: 'dishes',
    summary: '1× Filé de peixe grelhado',
    total: 32.5,
    payment: 'credit',
    status: 'confirmed',
    lines: [{ dishId: 'd3', dishName: 'Filé de peixe grelhado', unitPrice: 32.5, quantity: 1 }],
  },
];
