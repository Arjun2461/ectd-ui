import { Routes } from '@angular/router';
import { Layout } from './layout/layout';
import { Submission } from './submission/submission';
import { Consistency } from './results/consistency/consistency';
import { History } from './history/history';
import { Results } from './results/results';
import { Dashboard } from './dashboard/dashboard';

export const routes: Routes = [
  {
    path: '',
    component: Layout,
    children: [
      { path: 'dashboard', component: Dashboard },
      { path: 'upload', component: Submission },
      { path: 'consistency', component: Consistency },
      { path: 'history', component: History},
      { path: 'results', component: Results},
      // ✅ DEFAULT ROUTE
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
    ]
  }
];