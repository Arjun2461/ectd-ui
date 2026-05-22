import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { LucideAngularModule, LayoutDashboard, Upload, History, ShieldCheck } from 'lucide-angular';
import { Toast } from '../shared/toast/toast';
import { LogOut } from 'lucide-angular';

@Component({
  selector: 'app-layout',
  imports: [RouterModule, CommonModule, MatIconModule, LucideAngularModule, Toast],
  templateUrl: './layout.html',
  styleUrl: './layout.css',
})
export class Layout {
  isCollapsed = false;
  LayoutDashboard = LayoutDashboard;
  Upload = Upload;
  History = History;
  ShieldCheck = ShieldCheck;

  LogOut = LogOut;

  toggleSidebar() {
    this.isCollapsed = !this.isCollapsed;
  }
}
