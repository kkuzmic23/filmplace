# Filmplace API

Spring Boot API for Filmplace. It uses the existing PostgreSQL schema, stateless JWT authentication, BCrypt password hashing, JDBC transactions, and local image storage. Seed images are packaged from `images/`; Docker Compose initializes a persistent `backend_images` volume from them.

## Run

From the repository root:

```bash
docker compose up --build
```

For backend development with PostgreSQL already running:

```bash
./mvnw spring-boot:run
```

Required production settings are supplied through environment variables:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | JDBC PostgreSQL URL |
| `DATABASE_USER` | Database user |
| `DATABASE_PASSWORD` | Database password |
| `JWT_SECRET` | JWT signing secret |
| `CORS_ORIGIN` | Allowed frontend origin or comma-separated origins |
| `IMAGES_PATH` | Uploaded-image directory |

## API areas

| Area | Base routes |
| --- | --- |
| Authentication | `/api/auth` |
| Users | `/api/users` |
| Storefronts | `/api/storefronts` |
| Catalog and listings | `/api/products` |
| Cart | `/api/cart` |
| Orders | `/api/orders` |
| SEO | `/api/seo/sitemap` |
| Health | `/api/health` |

All protected routes expect `Authorization: Bearer <accessToken>`. Checkout and order cancellation run in database transactions so inventory changes remain consistent.

## Test

```bash
./mvnw test
```
