import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'movements',
    loadComponent: () => import('./features/movements/movements.page').then(m => m.MovementsPage),
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
    path: 'cushion',
    loadComponent: () => import('./features/cushion/cushion.page').then(m => m.CushionPage),
  },
  {
    path: 'tax',
    loadComponent: () => import('./features/tax/tax.page').then(m => m.TaxPage),
  },
  {
    path: 'export',
    loadComponent: () => import('./features/export/export.page').then(m => m.ExportPage),
  },
  {
    path: 'account',
    loadComponent: () => import('./features/account/account.page').then(m => m.AccountPage),
  },
  { path: '', redirectTo: 'movements', pathMatch: 'full' },
];
