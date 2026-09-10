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
    path: 'review',
    loadComponent: () => import('./features/review/review.page').then(m => m.ReviewPage),
  },
  {
    path: 'import',
    loadComponent: () => import('./features/import/import.page').then(m => m.ImportPage),
  },
  { path: '', redirectTo: 'movements', pathMatch: 'full' },
];
