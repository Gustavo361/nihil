import { Injectable, computed, signal } from '@angular/core';
import {
  DishRecipeLine,
  DishStatus,
  MenuDish,
  SaleMenuDish,
  estimatedRecipeCost,
  normalizeRecipeLine,
} from '../../features/pratos-receitas/menu.models';

const STORAGE_KEY = 'nihil.menu-catalog.v1';

export interface UpsertDishInput {
  id?: string;
  name: string;
  description?: string;
  salePrice: number;
  status: DishStatus;
  recipe: DishRecipeLine[];
}

/**
 * Shared menu catalog for Pratos/receitas and Vendas.
 * Starts empty — no invented dishes. Persists in localStorage until menu API exists.
 */
@Injectable({ providedIn: 'root' })
export class MenuCatalogService {
  readonly dishes = signal<MenuDish[]>([]);

  readonly totalCount = computed(() => this.dishes().length);
  readonly availableCount = computed(
    () => this.dishes().filter((d) => d.status === 'available').length,
  );
  readonly unavailableCount = computed(
    () => this.dishes().filter((d) => d.status === 'unavailable').length,
  );

  /** Only available dishes with recipe, for Sales picker. */
  readonly availableForSale = computed((): SaleMenuDish[] =>
    this.dishes()
      .filter((d) => d.status === 'available' && d.recipe.length > 0)
      .map((d) => ({ id: d.id, name: d.name, unitPrice: d.salePrice }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
  );

  constructor() {
    const stored = readStore();
    const dishes = (stored ?? []).map(enforceRecipeAvailability);
    this.dishes.set(dishes);
    if (stored && dishes.some((d, i) => d.status !== stored[i]?.status)) {
      this.persist();
    }
  }

  findById(id: string): MenuDish | undefined {
    return this.dishes().find((d) => d.id === id);
  }

  recipeCost(dish: MenuDish): number | null {
    return estimatedRecipeCost(dish.recipe);
  }

  upsert(input: UpsertDishInput): MenuDish {
    const name = input.name.trim();
    if (!name) throw new Error('Informe o nome do prato.');
    if (input.salePrice == null || input.salePrice <= 0) {
      throw new Error('Informe um preço de venda maior que zero.');
    }

    const now = new Date().toISOString();
    const duplicate = this.dishes().some(
      (d) => d.name.toLowerCase() === name.toLowerCase() && d.id !== input.id,
    );
    if (duplicate) throw new Error('Já existe um prato com esse nome.');

    const recipe = sanitizeRecipe(input.recipe);
    if (input.status === 'available' && recipe.length === 0) {
      throw new Error('Prato sem ingredientes fica indisponível. Cadastre a receita para disponibilizar.');
    }
    const status: DishStatus = recipe.length === 0 ? 'unavailable' : input.status;

    if (input.id) {
      const existing = this.findById(input.id);
      if (!existing) throw new Error('Prato não encontrado.');
      const updated: MenuDish = {
        ...existing,
        name,
        description: input.description?.trim() || undefined,
        salePrice: roundMoney(input.salePrice),
        status,
        recipe,
        updatedAt: now,
      };
      this.dishes.update((list) => list.map((d) => (d.id === updated.id ? updated : d)));
      this.persist();
      return updated;
    }

    const created: MenuDish = {
      id: this.nextId(),
      name,
      description: input.description?.trim() || undefined,
      salePrice: roundMoney(input.salePrice),
      status,
      recipe,
      createdAt: now,
      updatedAt: now,
    };
    this.dishes.update((list) => [created, ...list]);
    this.persist();
    return created;
  }

  setStatus(id: string, status: DishStatus): MenuDish {
    const existing = this.findById(id);
    if (!existing) throw new Error('Prato não encontrado.');
    if (status === 'available' && existing.recipe.length === 0) {
      throw new Error('Cadastre ingredientes na receita antes de disponibilizar o prato.');
    }
    const updated = { ...existing, status, updatedAt: new Date().toISOString() };
    this.dishes.update((list) => list.map((d) => (d.id === id ? updated : d)));
    this.persist();
    return updated;
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.dishes()));
    } catch {
      // ignore
    }
  }

  private nextId(): string {
    return `dish-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  }
}

function sanitizeRecipe(recipe: DishRecipeLine[]): DishRecipeLine[] {
  return recipe
    .filter((line) => line.stockItemId && line.qtyValue > 0 && (line.qtyUnit === 'g' || line.qtyUnit === 'kg'))
    .map((line) => ({
      stockItemId: line.stockItemId,
      name: line.name,
      qtyValue: line.qtyValue,
      qtyUnit: line.qtyUnit,
      stockUnit: line.stockUnit,
      unitCost: roundMoney(Math.max(0, line.unitCost)),
    }));
}

/** Sem receita → sempre indisponível. */
function enforceRecipeAvailability(dish: MenuDish): MenuDish {
  if (dish.recipe.length > 0) return dish;
  if (dish.status === 'unavailable') return dish;
  return { ...dish, status: 'unavailable' };
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function readStore(): MenuDish[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed
      .map((entry) => {
        if (!entry || typeof entry !== 'object') return null;
        const d = entry as Record<string, unknown>;
        const recipeRaw = Array.isArray(d['recipe']) ? d['recipe'] : [];
        const recipe = recipeRaw
          .map((line) => normalizeRecipeLine(line))
          .filter((line): line is DishRecipeLine => line != null);
        return {
          id: String(d['id'] ?? ''),
          name: String(d['name'] ?? ''),
          description: d['description'] ? String(d['description']) : undefined,
          salePrice: Number(d['salePrice'] ?? 0),
          status:
            recipe.length === 0
              ? 'unavailable'
              : d['status'] === 'unavailable'
                ? 'unavailable'
                : 'available',
          recipe,
          createdAt: String(d['createdAt'] ?? new Date().toISOString()),
          updatedAt: String(d['updatedAt'] ?? new Date().toISOString()),
        } as MenuDish;
      })
      .filter((d): d is MenuDish => !!d && !!d.id && !!d.name);
  } catch {
    return null;
  }
}
