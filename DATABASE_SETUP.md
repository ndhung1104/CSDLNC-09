# Database Setup Guide

## Overview

This project uses **MS SQL Server 2022** as the database with **Knex.js** as the query builder. Docker Compose automatically initializes the database with the `PETCAREX_Script.sql` file.

---

## Database Configuration

### Connection Details (Docker)
- **Host:** mssql (or localhost when running locally)
- **Port:** 1433
- **User:** sa
- **Password:** PetCareX@2024
- **Database:** PETCAREX

### Environment Variables
The following environment variables control the database connection:

```bash
DB_HOST=mssql                    # Database server host
DB_PORT=1433                     # Database server port
DB_USER=sa                       # Database user
DB_PASSWORD=PetCareX@2024        # Database password
DB_NAME=PETCAREX                 # Database name
```

---

## Starting the Application

### With Docker Compose (Recommended)
```bash
docker-compose up --build
```

This will:
1. Start the MS SQL Server container
2. Wait for the database to be healthy (30+ seconds)
3. Execute `PETCAREX_Script.sql` to initialize database and tables
4. Start the Node.js application

### Without Docker (Local Development)
1. Install MS SQL Server locally
2. Run `PETCAREX_Script.sql` in SQL Server Management Studio
3. Install dependencies: `npm install`
4. Set environment variables for DB connection
5. Start the app: `npm start`

---

## Database Connection Files

### `src/utils/db.js`
Main database connection module using Knex.js

```javascript
const db = require('./utils/db');

// Direct queries
await db('CUSTOMER').select();
```

**Features:**
- Automatic connection pooling (min: 2, max: 10)
- Connection timeout: 30 seconds
- Automatic connection test on startup
- SSL encryption enabled
- TrustServerCertificate for development

### `src/utils/queries.js`
Pre-built query helpers organized by table

```javascript
const { customers, pets, query } = require('./utils/queries');

// Customer queries
await customers.getAll(limit, offset);
await customers.getById(id);
await customers.create(data);
await customers.update(id, data);
await customers.delete(id);

// Pet queries
await pets.getAll(limit, offset);
await pets.getById(id);
await pets.getByCustomerId(customerId);
await pets.create(data);
await pets.update(id, data);
await pets.delete(id);

// Generic queries
await query.select('CUSTOMER', ['*']);
await query.selectWhere('CUSTOMER', { CUSTOMER_ID: 1 });
await query.insert('CUSTOMER', { CUSTOMER_NAME: 'John' });
await query.raw('SELECT * FROM CUSTOMER WHERE CUSTOMER_ID = ?', [1]);
```

### `src/utils/dbService.js`
Business logic layer with database operations

```javascript
const {
  getCustomerWithPets,
  getAllCustomers,
  getPetWithOwner,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} = require('./utils/dbService');

// Get customer with all their pets
const customer = await getCustomerWithPets(1);

// Get paginated customers list
const result = await getAllCustomers(page = 1, pageSize = 10);
// Returns: { data: [...], pagination: { page, pageSize, total, totalPages } }
```

---

## Usage Examples

### Fetching Data

**Example 1: Get a customer**
```javascript
const { customers } = require('./utils/queries');

const customer = await customers.getById(1);
console.log(customer);
// {
//   CUSTOMER_ID: 1,
//   CUSTOMER_NAME: 'Jane Doe',
//   CUSTOMER_PHONE: '0123456789',
//   CUSTOMER_EMAIL: 'jane@petcarex.com',
//   ...
// }
```

**Example 2: Get customer with pets**
```javascript
const { getCustomerWithPets } = require('./utils/dbService');

const customer = await getCustomerWithPets(1);
console.log(customer.pets); // Array of pet objects
```

**Example 3: Get all customers (paginated)**
```javascript
const { getAllCustomers } = require('./utils/dbService');

const result = await getAllCustomers(1, 10);
console.log(result);
// {
//   data: [...],
//   pagination: { page: 1, pageSize: 10, total: 50, totalPages: 5 }
// }
```

### Inserting Data

```javascript
const { customers } = require('./utils/queries');

const newCustomer = await customers.create({
  CUSTOMER_NAME: 'John Doe',
  CUSTOMER_PHONE: '0987654321',
  CUSTOMER_EMAIL: 'john@petcarex.com',
  CUSTOMER_GENDER: 'Nam',
  CUSTOMER_LOYALTY: 0,
  MEMBERSHIP_RANK_ID: 1,
});
```

### Updating Data

```javascript
const { customers } = require('./utils/queries');

await customers.update(1, {
  CUSTOMER_NAME: 'Jane Smith',
  CUSTOMER_EMAIL: 'jane.smith@petcarex.com',
});
```

### Deleting Data

```javascript
const { deleteCustomer } = require('./utils/dbService');

// This will delete customer and their pets
await deleteCustomer(1);
```

### Raw SQL Queries

```javascript
const { query } = require('./utils/queries');

const results = await query.raw(
  'SELECT * FROM CUSTOMER WHERE CUSTOMER_LOYALTY > ?',
  [100]
);
```

### Transactions

```javascript
const { transaction } = require('./utils/queries');

await transaction.execute(async (trx) => {
  await trx('CUSTOMER').insert({ ... });
  await trx('PET').insert({ ... });
  // If any error occurs, both operations will rollback
});
```

---

## Integration with Routes

### Example: Customer Route with Database

**File:** `src/routes/customer.route.js`

```javascript
const express = require('express');
const { getAllCustomers } = require('../utils/dbService');

const router = express.Router();

router.get('/customers', async (req, res) => {
  try {
    const page = req.query.page || 1;
    const result = await getAllCustomers(page, 10);
    
    res.render('management/customers', {
      title: 'Customers',
      customers: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).render('error', { message: 'Failed to fetch customers' });
  }
});

module.exports = router;
```

---

## Docker Compose Structure

```yaml
services:
  mssql:
    - Image: MS SQL Server 2022
    - Port: 1433
    - Volumes: 
      - mssql_data (persistent data)
      - PETCAREX_Script.sql (initialization)
    - Health check: Every 10 seconds
    - Network: petcarex-network

  app:
    - Dockerfile: src/Dockerfile
    - Port: 54321
    - Depends on: mssql (waits for health check)
    - Network: petcarex-network
```

### Volume Persistence
Database data is stored in the `mssql_data` Docker volume. This ensures data persists between container restarts.

### Health Check
The mssql service has a health check that:
- Runs every 10 seconds
- Waits up to 5 seconds for response
- Retries up to 5 times
- Has 30-second startup period

The app service only starts after the database passes the health check.

---

## Stopping and Cleaning Up

### Stop containers (keep data)
```bash
docker-compose down
```

### Stop and remove all data
```bash
docker-compose down -v
```

### View logs
```bash
docker-compose logs mssql
docker-compose logs app
docker-compose logs -f  # Follow logs
```

---

## Troubleshooting

### Database Connection Fails
1. Check if MSSQL container is running: `docker ps`
2. View logs: `docker-compose logs mssql`
3. Verify credentials in `docker-compose.yml`
4. Wait at least 30 seconds for database to initialize

### Database Not Initialized
1. Check if `PETCAREX_Script.sql` exists in root directory
2. Verify volume mount in docker-compose.yml
3. Check MSSQL logs for SQL errors

### Port Already in Use
- MSSQL (1433): `netstat -ano | findstr :1433`
- App (54321): `netstat -ano | findstr :54321`
- Change port in `docker-compose.yml`

### Reconnecting Issues
1. Clear node_modules: `rm -rf src/node_modules`
2. Reinstall: `npm install`
3. Rebuild containers: `docker-compose up --build`

---

## Best Practices

1. **Use dbService.js** for business logic, not raw queries in routes
2. **Always use async/await** with try-catch for error handling
3. **Validate user input** before database operations
4. **Use transactions** for multi-step operations
5. **Don't expose** database credentials in client-side code
6. **Set strict** environment variables in production
7. **Use connection pooling** (already configured in db.js)

---

## Documentation Links

- [Knex.js Documentation](https://knexjs.org/)
- [MS SQL Server Connection String](https://www.connectionstrings.com/sql-server/)
- [Docker Hub - MSSQL Image](https://hub.docker.com/_/microsoft-mssql-server)
- [SQL Server Best Practices](https://docs.microsoft.com/en-us/sql/relational-databases/best-practices)
