import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { roleGuard } from './core/auth/role.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./features/auth/register/register.component').then(m => m.RegisterComponent),
  },
  {
    path: 'unauthorized',
    loadComponent: () =>
      import('./features/auth/unauthorized/unauthorized.component').then(
        m => m.UnauthorizedComponent
      ),
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
    canActivate: [authGuard, roleGuard],
    data: { role: 'EMPLOYEE' },
  },
  {
    path: 'designer',
    loadComponent: () =>
      import('./features/designer/designer.component').then(m => m.DesignerComponent),
    canActivate: [authGuard, roleGuard],
    data: { role: 'ADMIN_DESIGNER' },
  },
  {
    path: 'designer/:id',
    loadComponent: () =>
      import('./features/designer/designer.component')
        .then(m => m.DesignerComponent),
    canActivate: [authGuard, roleGuard],
    data: { role: 'ADMIN_DESIGNER' },
  },
  {
    path: 'policies',
    loadComponent: () =>
      import('./features/policies/policies.component').then(m => m.PoliciesComponent),
    canActivate: [authGuard, roleGuard],
    data: { role: 'ADMIN_DESIGNER' },
  },
  {
    path: 'analytics',
    loadComponent: () =>
      import('./features/analytics/analytics.component').then(m => m.AnalyticsComponent),
    canActivate: [authGuard, roleGuard],
    data: { role: 'ADMIN_DESIGNER' },
  },
  {
    path: 'processes',
    loadComponent: () =>
      import('./features/processes/process-list.component')
        .then(m => m.ProcessListComponent),
    canActivate: [authGuard, roleGuard],
    data: { role: 'ADMIN_DESIGNER' },
  },
  {
    path: 'processes/:id',
    loadComponent: () =>
      import('./features/processes/process-status.component').then(
        m => m.ProcessStatusComponent
      ),
    canActivate: [authGuard],
  },
  {
    path: 'departments',
    loadComponent: () =>
      import('./features/departments/departments.component')
        .then(m => m.DepartmentsComponent),
    canActivate: [authGuard, roleGuard],
    data: { role: 'ADMIN_DESIGNER' },
  },
  {
    path: 'users',
    loadComponent: () =>
      import('./features/users/users.component')
        .then(m => m.UsersComponent),
    canActivate: [authGuard, roleGuard],
    data: { role: 'ADMIN_DESIGNER' },
  },
  {
    path: 'start-process',
    loadComponent: () =>
      import('./features/processes/start-process.component')
        .then(m => m.StartProcessComponent),
    canActivate: [authGuard, roleGuard],
    data: { role: 'EMPLOYEE' },
  },
  {
    path: 'task/:id',
    loadComponent: () =>
      import('./features/dashboard/task-complete/task-complete.component')
        .then(m => m.TaskCompleteComponent),
    canActivate: [authGuard, roleGuard],
    data: { role: 'EMPLOYEE' },
  },
  { path: '**', redirectTo: 'login' },
];
