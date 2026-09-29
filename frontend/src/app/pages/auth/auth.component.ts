import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService } from '../../auth/auth.service';
import { AuthResponse } from '../../auth/auth.models';

type AuthForm = FormGroup<{
  firstName: FormControl<string>;
  lastName: FormControl<string>;
  displayName: FormControl<string>;
  email: FormControl<string>;
  password: FormControl<string>;
}>;

@Component({
  selector: 'app-auth',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './auth.component.html',
  styleUrl: './auth.component.scss',
})
export class AuthComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  form: AuthForm;

  public submitting = signal(false);
  public error = signal('');

  constructor() {
    let registrationValidators: ValidatorFn[] = [];
    let passwordValidators: ValidatorFn[] = [Validators.required];

    if (this.register) {
      registrationValidators = [Validators.required];
      passwordValidators = [Validators.required, Validators.minLength(8)];
    }

    this.form = new FormGroup({
      firstName: new FormControl('', {
        nonNullable: true,
        validators: registrationValidators,
      }),
      lastName: new FormControl('', {
        nonNullable: true,
        validators: registrationValidators,
      }),
      displayName: new FormControl('', {
        nonNullable: true,
        validators: registrationValidators,
      }),
      email: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.email],
      }),
      password: new FormControl('', {
        nonNullable: true,
        validators: passwordValidators,
      }),
    });
  }

  get register(): boolean {
    return this.route.snapshot.data['mode'] === 'register';
  }

  submit(): void {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.error.set('');
    const v = this.form.getRawValue();

    let request: Observable<AuthResponse> = this.auth.login({
      email: v.email,
      password: v.password,
    });

    if (this.register) {
      request = this.auth.register(v);
    }

    request.subscribe({
      next: () =>
        void this.router.navigateByUrl(this.route.snapshot.queryParamMap.get('returnUrl') || '/'),
      error: (err: HttpErrorResponse) => {
        this.error.set(err.error?.message ?? 'Something went wrong. Please try again.');
        this.submitting.set(false);
      },
    });
  }
}
