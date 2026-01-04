# Seed Credentials

This file contains the default credentials created by the seed script.

## Super Admin User

- **Email:** `admin@ai.com`
- **Password:** `Admin@123`
- **Role:** `SUPER_ADMIN`
- **Status:** Active, Email Verified

## Regular User (Demo)

- **Email:** `user@example.com`
- **Password:** `user123`
- **Role:** `USER`
- **Status:** Active, Email Verified

---

## Running the Seed

To seed the database with these users:

```bash
yarn db:seed
```

Or:

```bash
ts-node prisma/seed.ts
```

## Security Note

⚠️ **Important:** Change these default passwords in production! These credentials are for development/testing only.

