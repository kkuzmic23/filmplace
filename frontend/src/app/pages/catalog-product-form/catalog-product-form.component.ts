import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CatalogProductRequest, CatalogService } from '../../services/catalog.service';

@Component({
  selector: 'app-catalog-product-form',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './catalog-product-form.component.html',
  styleUrl: './catalog-product-form.component.scss',
})
export class CatalogProductFormComponent {
  private catalogService = inject(CatalogService);
  private router = inject(Router);

  public productType: CatalogProductRequest['productType'] = 'CAMERA';
  public brand = '';
  public name = '';
  public format = '';
  public filmType = '';
  public cameraType = '';
  public accessoryType = '';
  public compatibleFormats = '';
  public saving = signal(false);
  public error = signal('');

  save(): void {
    if (!this.brand.trim() || !this.name.trim()) {
      this.error.set('Brand and product name are required.');
      return;
    }

    this.saving.set(true);
    this.error.set('');

    const data: CatalogProductRequest = {
      productType: this.productType,
      brand: this.brand.trim(),
      name: this.name.trim(),
      format: this.emptyToNull(this.format),
      filmType: this.emptyToNull(this.filmType),
      cameraType: this.emptyToNull(this.cameraType),
      accessoryType: this.emptyToNull(this.accessoryType),
      compatibleFormats: this.emptyToNull(this.compatibleFormats),
    };

    this.catalogService.createCatalogProduct(data).subscribe({
      next: () => this.router.navigate(['/admin']),
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(error.error?.message ?? 'Catalog product could not be created.');
      },
    });
  }

  private emptyToNull(value: string): string | null {
    return value.trim() || null;
  }
}
