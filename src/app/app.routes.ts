import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./shell/tabs.page').then(m => m.TabsPage),
    children: [
      {
        path: 'accounts',
        loadComponent: () => import('./features/accounts/accounts.page').then(m => m.AccountsPage),
      },
      {
        path: 'transactions',
        loadComponent: () =>
          import('./features/transactions/transactions.page').then(m => m.TransactionsPage),
      },
      {
        path: 'import',
        loadComponent: () => import('./features/import/import.page').then(m => m.ImportPage),
      },
      { path: '', redirectTo: 'accounts', pathMatch: 'full' },
    ],
  },
];
