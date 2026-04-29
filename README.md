# Traffic-Simulation-History

[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=ARSW2026-JDC_Traffic-Simulator-History&metric=coverage)](https://sonarcloud.io/dashboard?id=ARSW2026-JDC_Traffic-Simulator-History)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=ARSW2026-JDC_Traffic-Simulator-History&metric=alert_status)](https://sonarcloud.io/dashboard?id=ARSW2026-JDC_Traffic-Simulator-History)
[![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=ARSW2026-JDC_Traffic-Simulator-History&metric=sqale_rating)](https://sonarcloud.io/dashboard?id=ARSW2026-JDC_Traffic-Simulator-History)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=ARSW2026-JDC_Traffic-Simulator-History&metric=security_rating)](https://sonarcloud.io/dashboard?id=ARSW2026-JDC_Traffic-Simulator-History)

Módulo de historial para la aplicación CUTS. Proporciona API REST para gestionar el historial de cambios de simulaciones y auditoría mediante Azure Service Bus.

## Tecnologías

- **[NestJS](https://nestjs.com/)** v11.0.0 - Framework backend
- **[TypeScript](https://www.typescriptlang.org/)** v5.3.3 - Tipado
- **[Prisma](https://www.prisma.io/)** v7.5.0 - ORM
- **[PostgreSQL](https://www.postgresql.org/)** - Base de datos
- **[Redis](https://redis.io/)** v5.3.2 - Cache y sesiones
- **[Socket.io](https://socket.io/)** v4.6.1 - WebSocket
- **[firebase-admin](https://firebase.google.com/docs/admin)** v12.0.0 - Autenticación
- **[Joi](https://joi.dev/)** v18.0.2 - Validación de env vars

## Prerrequisitos

- Node.js >= 18.x
- npm >= 9.x
- PostgreSQL >= 14.x
- Redis (opcional)

## Instalación

```bash
npm install
npm run prisma:generate  # Generar cliente Prisma
```

## Ejecución

```bash
# Desarrollo
npm run start:dev

# Producción
npm run build && npm run start:prod
```

## Tests

```bash
npm run test           # Unit tests
npm run test:e2e      # E2E tests
npm run test:cov       # Coverage
```

## Variables de Entorno

| Variable | Descripción | Requerido |
|----------|-------------|-----------|
| `PORT` | Puerto del servidor | ✅ |
| `DATABASE_URL` | URL PostgreSQL | ✅ |
| `DIRECT_URL` | URL directa PostgreSQL | ✅ |
| `REDIS_HOST` | Host Redis | ✅ |
| `REDIS_PORT` | Puerto Redis | ✅ |
| `VITE_FIREBASE_PROJECT_ID` | Firebase Project ID | ✅ |
| `VITE_FIREBASE_PRIVATE_KEY` | Firebase Private Key | ✅ |
| `VITE_FIREBASE_CLIENT_EMAIL` | Firebase Client Email | ✅ |

## Estructura

```
src/
├── auth/           # Autenticación Firebase
├── azure/          # Azure Service Bus
├── config/         # Variables de entorno
├── health/         # Health checks
├── history/        # Historial de simulaciones (controller, service, gateway)
├── prisma/         # Cliente Prisma
└── users/         # Gestión de usuarios
```

## Scripts disponibles

| Script | Descripción |
|--------|-------------|
| `npm run build` | Compila el proyecto |
| `npm run start` | Inicia en producción |
| `npm run start:dev` | Desarrollo con hot-reload |
| `npm run start:debug` | Modo debug |
| `npm run lint` | ESLint con auto-fix |
| `npm run format` | Prettier |
| `npm run prisma:generate` | Genera cliente Prisma |
| `npm run prisma:migrate` | Migra la base de datos |

## Notas de Implementación

Este módulo se comunica con el gateway a través de la ruta `/nrt` para manejar conexiones WebSocket de historial. Utiliza Azure Service Bus para publicar eventos de auditoría si está configurado.