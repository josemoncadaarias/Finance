import { Routes } from '@angular/router';

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
    path: 'export',
    loadComponent: () => import('./features/export/export.page').then(m => m.ExportPage),
  },
  {
    path: 'account',
    loadComponent: () => import('./features/account/account.page').then(m => m.AccountPage),
  },
  { path: '', redirectTo: 'movements', pathMatch: 'full' },
];
