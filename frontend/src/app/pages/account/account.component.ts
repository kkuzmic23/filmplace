import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { UserService } from '../../services/user.service';
import { DatePipe } from '@angular/common';

import { User } from '../../auth/auth.models';
import { AuthService } from '../../auth/auth.service';

@Component({
  selector: 'app-account',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, RouterLink],
  templateUrl: './account.component.html',
  styleUrls: ['./account.component.scss'],
})
export class AccountComponent implements OnInit {
  private userService = inject(UserService);
  private auth = inject(AuthService);

  public profile = signal<User | null>(null);

  public firstName: string = '';
  public lastName: string = '';
  public displayName: string = '';
  public email: string = '';
  public bio: string = '';
  public password: string = '';

  public loading = signal<boolean>(true);
  public loadFailed = signal<boolean>(false);
  public saving = signal<boolean>(false);
  public success = signal<boolean>(false);

  ngOnInit(): void {
    this.loadProfile();
  }

  loadProfile(): void {
    this.loading.set(true);
    this.loadFailed.set(false);

    this.userService.getProfile().subscribe({
      next: (user) => {
        this.profile.set(user);
        this.firstName = user.firstName;
        this.lastName = user.lastName;
        this.displayName = user.displayName;
        this.email = user.email;
        this.bio = user.bio ?? '';
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        console.error('Failed to load profile:', err);
        this.loading.set(false);
        this.loadFailed.set(true);
      },
    });
  }

  save(): void {
    this.saving.set(true);
    this.success.set(false);

    this.userService
      .updateProfile({
        firstName: this.firstName,
        lastName: this.lastName,
        displayName: this.displayName,
        email: this.email,
        bio: this.bio.trim() || null,
        ...(this.password.trim() && { password: this.password }),
      })
      .subscribe({
        next: (user) => {
          this.profile.set(user);
          this.auth.updateUser(user);
          this.password = '';
          this.saving.set(false);
          this.success.set(true);
        },
        error: () => {
          this.saving.set(false);
        },
      });
  }
}
