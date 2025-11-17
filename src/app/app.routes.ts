import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'dashboard'
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./pages/dashboard/dashboard.page').then((m) => m.DashboardPage)
  },
  {
    path: 'offices',
    loadComponent: () => import('./pages/offices/offices.page').then((m) => m.OfficesPage)
  },
  {
    path: 'employees',
    loadComponent: () => import('./pages/employees/employees.page').then((m) => m.EmployeesPage)
  },
  {
    path: 'premiums',
    children: [
      {
        path: 'monthly',
        loadComponent: () =>
          import('./pages/premiums/monthly/monthly-premiums.page').then((m) => m.MonthlyPremiumsPage)
      },
      {
        path: 'bonus',
        loadComponent: () =>
          import('./pages/premiums/bonus/bonus-premiums.page').then((m) => m.BonusPremiumsPage)
      },
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'monthly'
      }
    ]
  },
  {
    path: 'me',
    loadComponent: () => import('./pages/me/my-page').then((m) => m.MyPage)
  },
  {
    path: 'simulator',
    loadComponent: () => import('./pages/simulator/simulator.page').then((m) => m.SimulatorPage)
  },
  {
    path: 'masters',
    loadComponent: () => import('./pages/masters/masters.page').then((m) => m.MastersPage)
  },
  {
    path: 'requests',
    loadComponent: () => import('./pages/requests/requests.page').then((m) => m.RequestsPage)
  },
  {
    path: '**',
    loadComponent: () => import('./pages/not-found/not-found.page').then((m) => m.NotFoundPage)
  }
];
