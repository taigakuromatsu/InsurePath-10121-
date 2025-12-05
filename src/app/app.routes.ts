import { Routes } from '@angular/router';

import { authGuard } from './guards/auth.guard';
import { needsOfficeGuard } from './guards/needs-office.guard';
import { officeGuard } from './guards/office.guard';
import { roleGuard } from './guards/role.guard';

export const routes: Routes = [
  {
    path: '',
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'dashboard'
      },
      {
        path: 'dashboard',
        canActivate: [authGuard, officeGuard, roleGuard(['admin', 'hr'])],
        loadComponent: () => import('./pages/dashboard/dashboard.page').then((m) => m.DashboardPage)
      },
      {
        path: 'offices',
        canActivate: [authGuard, officeGuard, roleGuard(['admin'])],
        loadComponent: () => import('./pages/offices/offices.page').then((m) => m.OfficesPage)
      },
      {
        path: 'employees',
        canActivate: [authGuard, officeGuard, roleGuard(['admin', 'hr'])],
        loadComponent: () => import('./pages/employees/employees.page').then((m) => m.EmployeesPage)
      },
      {
        path: 'premiums',
        canActivate: [authGuard, officeGuard, roleGuard(['admin', 'hr'])],
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
        path: 'payments',
        canActivate: [authGuard, officeGuard, roleGuard(['admin', 'hr'])],
        loadComponent: () => import('./pages/payments/payments.page').then((m) => m.PaymentsPage)
      },
      {
        path: 'me',
        canActivate: [authGuard, officeGuard],
        loadComponent: () => import('./pages/me/my-page').then((m) => m.MyPage)
      },
      {
        path: 'simulator',
        canActivate: [authGuard, officeGuard, roleGuard(['admin', 'hr'])],
        loadComponent: () => import('./pages/simulator/simulator.page').then((m) => m.SimulatorPage)
      },
      {
        path: 'masters',
        canActivate: [authGuard, officeGuard, roleGuard(['admin'])],
        loadComponent: () => import('./pages/masters/masters.page').then((m) => m.MastersPage)
      },
      {
        path: 'requests',
        canActivate: [authGuard, officeGuard, roleGuard(['admin', 'hr'])],
        loadComponent: () => import('./pages/requests/requests.page').then((m) => m.RequestsPage)
      },
      {
        path: 'procedures',
        canActivate: [authGuard, officeGuard, roleGuard(['admin', 'hr'])],
        loadComponent: () => import('./pages/procedures/procedures.page').then((m) => m.ProceduresPage)
      },
      {
        path: 'dependent-reviews',
        canActivate: [authGuard, officeGuard, roleGuard(['admin', 'hr'])],
        loadComponent: () =>
          import('./pages/dependent-reviews/dependent-reviews.page').then((m) => m.DependentReviewsPage)
      },
      {
        path: 'documents',
        canActivate: [authGuard, officeGuard, roleGuard(['admin', 'hr'])],
        loadComponent: () => import('./pages/documents/documents.page').then((m) => m.DocumentsPage)
      },
      {
        path: 'cloud-masters',
        canActivate: [authGuard, officeGuard, roleGuard(['admin'])],
        loadComponent: () => import('./pages/cloud-masters/cloud-masters.page').then((m) => m.CloudMastersPage)
      }
    ]
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.page').then((m) => m.LoginPage)
  },
  {
    path: 'office-setup',
    canActivate: [authGuard, needsOfficeGuard],
    loadComponent: () => import('./pages/office-setup/office-setup.page').then((m) => m.OfficeSetupPage)
  },
  {
    path: '**',
    loadComponent: () => import('./pages/not-found/not-found.page').then((m) => m.NotFoundPage)
  }
];
