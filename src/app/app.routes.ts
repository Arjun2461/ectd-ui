import { Routes } from '@angular/router';
import { Layout } from './layout/layout';
// create/import your pages
import { Component } from '@angular/core';
import { Submission } from './submission/submission';
import { Consistency } from './results/consistency/consistency';
import { History } from './history/history';
import {Results} from './results/results'

@Component({
  standalone: true,
  template: `<h2>Dashboard</h2>`
})
class DashboardComponent {}



export const routes: Routes = [
  {
    path: '',
    component: Layout,
    children: [
      { path: 'dashboard', component: DashboardComponent },
      { path: 'upload', component: Submission },
      { path: 'consistency', component: Consistency },
      { path: 'history', component: History},
      { path: 'results', component: Results},
      // ✅ DEFAULT ROUTE
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
    ]
  }
];