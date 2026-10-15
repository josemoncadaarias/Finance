import { inject } from '@angular/core';
import { Routes } from '@angular/router';

import { ViewPrefsService } from './core/ui/view-prefs.service';

export const routes: Routes = [
  {
    path: 'movements',
    loadComponent: () => import('./features/movements/movements.page').then(m => m.MovementsPage),
  },
  {
    // Opened from the summary screen, which is where its period and account
    // are chosen. It is not in the drawer for that reason: reached from the
    // side it would have nothing to be about.
    path: 'report',
    loadComponent: () => import('./features/report/report.page').then(m => m.ReportPage),
  },
  {
    path: 'currencies',
    loadComponent: () => import('./features/currencies/currencies.page').then(m => m.CurrenciesPage),
  },
  {
    path: 'accounts',
    loadComponent: () => import('./features/accounts/accounts.page').then(m => m.AccountsPage),
  },
  {
    path: 'categories',
    loadComponent: () => import('./features/categories/categories.page').then(m => m.CategoriesPage),
  },
  {
    path: 'products',
    loadComponent: () => import('./features/products/products.page').then(m => m.ProductsPage),
  },
  {
    // Cuentas, its Deudas face, and one card's page.
    path: 'debts',
    loadComponent: () => import('./features/debts/debts.page').then(m => m.DebtsPage),
  },
  {
    path: 'debts/loan/:id',
    loadComponent: () => import('./features/debts/loan.page').then(m => m.LoanPage),
  },
  {
    path: 'debts/:id',
    loadComponent: () => import('./features/debts/card.page').then(m => m.CardPage),
  },
  {
    path: 'plans',
    loadComponent: () => import('./features/plans/plans.page').then(m => m.PlansPage),
  },
  {
    path: 'plans/goal/:id',
    loadComponent: () => import('./features/plans/goal.page').then(m => m.GoalPage),
  },
  {
    path: 'plans/:id',
    loadComponent: () => import('./features/plans/limit.page').then(m => m.LimitPage),
  },
  {
    path: 'tax',
    loadComponent: () => import('./features/tax/tax.page').then(m => m.TaxPage),
  },
  {
    // Where a reading waits for a person. Reached from the drawer, which is
    // also where the count of what is waiting shows, so nothing piles up unseen.
    path: 'review',
    loadComponent: () => import('./features/review/review.page').then(m => m.ReviewPage),
  },
  {
    path: 'notifications',
    loadComponent: () =>
      import('./features/notifications/notifications.page').then(m => m.NotificationsPage),
  },
  {
    path: 'export',
    loadComponent: () => import('./features/export/export.page').then(m => m.ExportPage),
  },
  {
    path: 'account',
    loadComponent: () => import('./features/account/account.page').then(m => m.AccountPage),
  },
  {
    // Más → Tus datos → Borrar todos los datos (21f).
    path: 'erase',
    loadComponent: () => import('./features/erase/erase.page').then(m => m.ErasePage),
  },
  {
    // Más: everything the drawer held that is not a tab.
    path: 'more',
    loadComponent: () => import('./features/more/more.page').then(m => m.MorePage),
  },
  {
    // Más → Preferencias → Personaliza tu vista (31e-31h).
    path: 'view',
    loadComponent: () => import('./features/view/view.page').then(m => m.ViewPage),
  },
  {
    // Personaliza tu vista → Barra de abajo (33b).
    path: 'view/bar',
    loadComponent: () => import('./features/view/bar.page').then(m => m.BarPage),
  },
  {
    path: 'view/:screen',
    loadComponent: () => import('./features/view/view.page').then(m => m.ViewPage),
  },
  // The app opens on the bottom bar's first button (Inicio unless chosen otherwise, 33e).
  { path: '', redirectTo: () => inject(ViewPrefsService).startRoute().slice(1), pathMatch: 'full' },
];
