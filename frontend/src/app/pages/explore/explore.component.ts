import { CommonModule, CurrencyPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { debounceTime } from 'rxjs';
import { CatalogService, ProductSearchParams } from '../../services/catalog.service';
import { imageSrcset, imageUrl as responsiveImageUrl } from '../../services/image-url';
import { Product, ProductCatalogItem } from '../../services/models';
import { SeoService } from '../../seo/seo.service';

interface FilterOption {
  label: string;
  value: string;
}

@Component({
  selector: 'app-explore',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, ReactiveFormsModule, RouterLink],
  templateUrl: './explore.component.html',
  styleUrl: './explore.component.scss',
})
export class ExploreComponent implements OnInit {
  private catalogService = inject(CatalogService);
  private seo = inject(SeoService);

  public products = signal<Product[]>([]);
  public pageProducts = signal<Product[]>([]);
  public catalog = signal<ProductCatalogItem[]>([]);
  public loading = signal<boolean>(true);
  public catalogLoading = signal<boolean>(true);
  public loadFailed = signal<boolean>(false);
  public currentPage = signal<number>(1);
  public readonly pageSize = 9;
  public totalPages = signal<number>(1);

  public typeOptions = signal<FilterOption[]>([]);
  public brandOptions = signal<FilterOption[]>([]);
  public cameraOptions = signal<FilterOption[]>([]);
  public cameraFormatOptions = signal<FilterOption[]>([]);
  public filmFormatOptions = signal<FilterOption[]>([]);
  public filmTypeOptions = signal<FilterOption[]>([]);

  formFilters = new FormGroup({
    q: new FormControl(''),
    type: new FormControl(''),
    brand: new FormControl(''),
    cameraModel: new FormControl(''),
    cameraFormat: new FormControl(''),
    filmFormat: new FormControl(''),
    filmType: new FormControl(''),
  });

  ngOnInit(): void {
    this.seo.setPageMetaData({
      title: 'Explore Instant Cameras, Film & Accessories | Filmplace',
      description: 'Browse instant cameras, film, and accessories from Filmplace sellers.',
      path: '/explore',
    });

    this.loadCatalog();
    this.loadProducts();

    this.formFilters.controls.type.valueChanges.subscribe((type) => {
      this.clearIrrelevantFilters(type);
      this.updateFilterControlStates();
      this.updateBrandDependentOptions();
    });

    this.formFilters.controls.brand.valueChanges.subscribe(() => {
      this.updateBrandDependentOptions();
    });

    this.formFilters.valueChanges.pipe(debounceTime(250)).subscribe(() => {
      this.loadProducts();
    });
  }

  loadCatalog(): void {
    this.catalogLoading.set(true);

    this.catalogService.getProductCatalog().subscribe({
      next: (catalog) => {
        this.catalog.set(catalog);
        this.populateFilters(catalog);
        this.updateBrandDependentOptions();
        this.catalogLoading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        console.error('Failed to load product catalog:', err);
        this.catalogLoading.set(false);
      },
    });
  }

  loadProducts(): void {
    this.loading.set(true);
    this.loadFailed.set(false);

    this.catalogService.getProducts(this.extractFilterValues()).subscribe({
      next: (products) => {
        this.products.set(products);
        this.currentPage.set(1);
        this.setPageProducts();
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        console.error('Failed to load products:', err);
        this.products.set([]);
        this.currentPage.set(1);
        this.setPageProducts();
        this.loading.set(false);
        this.loadFailed.set(true);
      },
    });
  }

  extractFilterValues(): ProductSearchParams {
    const value = this.formFilters.getRawValue();
    const params: ProductSearchParams = {
      q: value.q ?? '',
      type: value.type ?? '',
      brand: value.brand ?? '',
    };

    if (!this.cameraFiltersDisabled()) {
      params.cameraModel = value.cameraModel ?? '';
      params.cameraFormat = value.cameraFormat ?? '';
    }

    if (!this.filmFiltersDisabled()) {
      params.filmFormat = value.filmFormat ?? '';
      params.filmType = value.filmType ?? '';
    }

    return params;
  }

  populateFilters(catalog: ProductCatalogItem[]): void {
    this.typeOptions.set(this.uniqueOptions(catalog.map((item) => item.productType)));
    this.brandOptions.set(this.uniqueOptions(catalog.map((item) => item.brand)));
    this.filmTypeOptions.set(
      this.uniqueOptions(
        catalog.filter((item) => item.productType === 'FILM').map((item) => item.filmType),
      ),
    );
  }

  updateBrandDependentOptions(): void {
    const selectedBrand = this.formFilters.controls.brand.value;

    const cameraCatalog = this.catalog().filter(
      (item) =>
        item.productType === 'CAMERA' &&
        (selectedBrand == null || selectedBrand.length === 0 || item.brand === selectedBrand),
    );
    const filmCatalog = this.catalog().filter(
      (item) =>
        item.productType === 'FILM' &&
        (selectedBrand == null || selectedBrand.length === 0 || item.brand === selectedBrand),
    );

    const cameraOptions = this.uniqueOptions(cameraCatalog.map((item) => item.name));
    const cameraFormatOptions = this.uniqueOptions(cameraCatalog.map((item) => item.format));
    const filmFormatOptions = this.uniqueOptions(filmCatalog.map((item) => item.format));

    this.cameraOptions.set(cameraOptions);
    this.cameraFormatOptions.set(cameraFormatOptions);
    this.filmFormatOptions.set(filmFormatOptions);

    const selectedCamera = this.formFilters.controls.cameraModel.value;
    if (selectedCamera && !cameraOptions.some((option) => option.value === selectedCamera)) {
      this.formFilters.controls.cameraModel.setValue('', { emitEvent: false });
    }

    const selectedCameraFormat = this.formFilters.controls.cameraFormat.value;
    if (
      selectedCameraFormat &&
      !cameraFormatOptions.some((option) => option.value === selectedCameraFormat)
    ) {
      this.formFilters.controls.cameraFormat.setValue('', { emitEvent: false });
    }

    const selectedFormat = this.formFilters.controls.filmFormat.value;
    if (selectedFormat && !filmFormatOptions.some((option) => option.value === selectedFormat)) {
      this.formFilters.controls.filmFormat.setValue('', { emitEvent: false });
    }
  }

  uniqueOptions(values: Array<string | null>): FilterOption[] {
    const options: FilterOption[] = [];
    const seen = new Set<string>();

    for (const value of values) {
      if (value != null && value.length > 0 && !seen.has(value)) {
        seen.add(value);
        options.push({ label: value, value });
      }
    }

    return options.sort((a, b) => a.label.localeCompare(b.label));
  }

  clearFilters(): void {
    this.formFilters.reset({
      q: '',
      type: '',
      brand: '',
      cameraModel: '',
      cameraFormat: '',
      filmFormat: '',
      filmType: '',
    });

    this.updateFilterControlStates();
  }

  resultEstimate(): string {
    return `${this.products().length}+ RESULTS`;
  }

  setPageProducts(): void {
    const totalPages = Math.max(1, Math.ceil(this.products().length / this.pageSize));

    if (this.currentPage() > totalPages) {
      this.currentPage.set(totalPages);
    }

    const start = (this.currentPage() - 1) * this.pageSize;

    this.totalPages.set(totalPages);
    this.pageProducts.set(this.products().slice(start, start + this.pageSize));
  }

  previousPage(): void {
    if (this.currentPage() <= 1) {
      return;
    }

    this.currentPage.update((page) => page - 1);
    this.setPageProducts();
  }

  nextPage(): void {
    if (this.currentPage() >= this.totalPages()) {
      return;
    }

    this.currentPage.update((page) => page + 1);
    this.setPageProducts();
  }

  productTypeClass(product: Product): string {
    return `type-${product.productType.toLowerCase()}`;
  }

  brandClass(product: Product): string {
    if (product.catalogBrand === 'POLAROID') {
      return 'brand-polaroid';
    }

    if (product.catalogBrand === 'INSTAX') {
      return 'brand-instax';
    }

    return '';
  }

  clearIrrelevantFilters(type: string | null): void {
    if (type == null || type.length === 0) {
      this.formFilters.patchValue(
        {
          brand: '',
          cameraModel: '',
          cameraFormat: '',
          filmFormat: '',
          filmType: '',
        },
        { emitEvent: false },
      );
    }

    if (type === 'CAMERA') {
      this.formFilters.patchValue(
        {
          filmFormat: '',
          filmType: '',
        },
        { emitEvent: false },
      );
    }

    if (type === 'FILM') {
      this.formFilters.patchValue(
        {
          cameraModel: '',
          cameraFormat: '',
        },
        { emitEvent: false },
      );
    }

    if (type === 'ACCESSORY') {
      this.formFilters.patchValue(
        {
          cameraModel: '',
          cameraFormat: '',
          filmFormat: '',
          filmType: '',
        },
        { emitEvent: false },
      );
    }
  }

  updateFilterControlStates(): void {
    if (this.cameraFiltersDisabled()) {
      this.formFilters.controls.cameraModel.disable({ emitEvent: false });
      this.formFilters.controls.cameraFormat.disable({ emitEvent: false });
    } else {
      this.formFilters.controls.cameraModel.enable({ emitEvent: false });
      this.formFilters.controls.cameraFormat.enable({ emitEvent: false });
    }

    if (this.filmFiltersDisabled()) {
      this.formFilters.controls.filmFormat.disable({ emitEvent: false });
      this.formFilters.controls.filmType.disable({ emitEvent: false });
    } else {
      this.formFilters.controls.filmFormat.enable({ emitEvent: false });
      this.formFilters.controls.filmType.enable({ emitEvent: false });
    }
  }

  cameraFiltersDisabled(): boolean {
    const type = this.formFilters.controls.type.value;

    return type === 'FILM' || type === 'ACCESSORY';
  }

  filmFiltersDisabled(): boolean {
    const type = this.formFilters.controls.type.value;

    return type === 'CAMERA' || type === 'ACCESSORY';
  }

  buildImagePath(product: Product, width = 480): string {
    if (product.images.length > 0) {
      const imageUrl = product.images[0].imageUrl;

      return responsiveImageUrl(imageUrl, width);
    }

    return 'https://placehold.co/700x520?text=filmplace';
  }

  buildImageSrcset(product: Product): string | null {
    return product.images[0] ? imageSrcset(product.images[0].imageUrl) : null;
  }

  price(product: Product): number {
    return product.priceCents / 100;
  }
}
