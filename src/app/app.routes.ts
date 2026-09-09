import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./shell/tabs.page').then(m => m.TabsPage),
    children: [
      {
        path: 'movements',
        loadComponent: () => import('./features/movements/movements.page').then(m => m.MovementsPage),
      },
      {
        path: 'accounts',
        loadComponent: () => import('./features/accounts/accounts.page').then(m => m.AccountsPage),
      },
      {
        path: 'import',
        loadComponent: () => import('./features/import/import.page').then(m => m.ImportPage),
      },
      { path: '', redirectTo: 'movements', pathMatch: 'full' },
    ],
  },
];
