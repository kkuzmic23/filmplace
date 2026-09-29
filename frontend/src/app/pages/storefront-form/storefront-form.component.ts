import { HttpErrorResponse } from '@angular/common/http';
import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CatalogService } from '../../services/catalog.service';
import { Storefront, StorefrontTheme } from '../../services/models';

@Component({
  selector: 'app-storefront-form',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './storefront-form.component.html',
  styleUrl: './storefront-form.component.scss',
})
export class StorefrontFormComponent {
  private catalogService = inject(CatalogService);

  private editingStorefront: Storefront | null = null;

  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<Storefront>();

  @Input()
  set storefront(value: Storefront | null) {
    this.editingStorefront = value;

    if (value === null) {
      this.name = '';
      this.slug = '';
      this.description = '';
      this.theme = 'theme-1';
      return;
    }

    this.name = value.name;
    this.slug = value.slug;
    this.description = value.description ?? '';
    this.theme = value.theme;
  }

  public name = '';
  public slug = '';
  public description = '';
  public theme: StorefrontTheme = 'theme-1';
  public saving = false;
  public saveFailed = false;
  public themes: StorefrontTheme[] = ['theme-1', 'theme-2', 'theme-3', 'theme-4', 'theme-5'];

  isEditing(): boolean {
    return this.editingStorefront !== null;
  }

  close(): void {
    this.closed.emit();
  }

  save(): void {
    this.saving = true;
    this.saveFailed = false;

    const data = {
      name: this.name,
      slug: this.slug,
      description: this.description.trim() || null,
      theme: this.theme,
    };

    if (this.editingStorefront === null) {
      this.catalogService.createStorefront(data).subscribe({
        next: (storefront) => this.handleSaved(storefront),
        error: (error: HttpErrorResponse) => this.handleError(error),
      });
      return;
    }

    this.catalogService.updateStorefront(this.editingStorefront.id, data).subscribe({
      next: (storefront) => this.handleSaved(storefront),
      error: (error: HttpErrorResponse) => this.handleError(error),
    });
  }

  private handleSaved(storefront: Storefront): void {
    this.saving = false;
    this.saved.emit(storefront);
  }

  private handleError(error: HttpErrorResponse): void {
    console.error('Failed to save storefront:', error);
    this.saving = false;
    this.saveFailed = true;
  }
}
