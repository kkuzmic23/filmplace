import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../seo/seo.service';

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit {
  private readonly seo = inject(SeoService);

  ngOnInit(): void {
    this.seo.setPageMetaData({
      title: 'Filmplace | Instant Photography Marketplace',
      description: 'Buy and sell instant cameras, film, and accessories on Filmplace.',
      path: '/',
    });
    this.seo.setHomeStructuredData();
  }
}
