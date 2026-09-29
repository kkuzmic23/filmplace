import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogService } from '../../services/catalog.service';
import { CatalogSalesStatistics } from '../../services/models';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss',
})
export class AdminComponent implements OnInit {
  private catalogService = inject(CatalogService);

  public statistics = signal<CatalogSalesStatistics | null>(null);
  public statisticsLoading = signal(true);

  ngOnInit(): void {
    this.catalogService.getCatalogSalesStatistics().subscribe({
      next: (statistics) => {
        this.statistics.set(statistics);
        this.statisticsLoading.set(false);
      },
      error: () => this.statisticsLoading.set(false),
    });
  }
}
