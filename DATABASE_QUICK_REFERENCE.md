# Database Quick Reference

## Quick Start

### Connection
```javascript
const db = require('./utils/db');
const { customers, pets, query } = require('./utils/queries');
const dbService = require('./utils/dbService');
```

### Test Connection
```bash
docker-compose logs app | grep "Database connected"
```

---

## Common Operations

### SELECT Queries

```javascript
// Get all records with limit and offset
await customers.getAll(limit = 10, offset = 0);

// Get single record by ID
await customers.getById(1);

// Get pets for a customer
await pets.getByCustomerId(1);

// Generic select
await query.select('CUSTOMER', ['CUSTOMER_ID', 'CUSTOMER_NAME']);

// With WHERE clause
await query.selectWhere('CUSTOMER', { CUSTOMER_ID: 1 });

// Raw SQL
await query.raw('SELECT TOP 10 * FROM CUSTOMER');
```

### INSERT Operations

```javascript
// Insert single record
await customers.create({
  CUSTOMER_NAME: 'John Doe',
  CUSTOMER_PHONE: '0123456789',
  CUSTOMER_EMAIL: 'john@example.com',
  CUSTOMER_GENDER: 'Nam',
  MEMBERSHIP_RANK_ID: 1,
});

// Generic insert
await query.insert('PET', {
  CUSTOMER_ID: 1,
  PET_NAME: 'Milo',
  PET_GENDER: 'Male',
  PET_HEALTH_STATUS: 'Healthy',
});
```

### UPDATE Operations

```javascript
// Update by ID
await customers.update(1, {
  CUSTOMER_NAME: 'Jane Doe',
  CUSTOMER_EMAIL: 'jane@example.com',
});

// Generic update with WHERE
await query.update('CUSTOMER', { CUSTOMER_ID: 1 }, {
  CUSTOMER_LOYALTY: 100,
});
```

### DELETE Operations

```javascript
// Delete by ID
await customers.delete(1);

// Delete customer with pets (handles foreign keys)
await deleteCustomer(1);

// Generic delete with WHERE
await query.delete('PET', { PET_ID: 1 });
```

---

## Advanced Operations

### Pagination

```javascript
const { getAllCustomers } = require('./utils/dbService');

const result = await getAllCustomers(
  page = 1,           // Page number (1-based)
  pageSize = 10       // Records per page
);

console.log(result);
// {
//   data: [{ CUSTOMER_ID: 1, ... }, ...],
//   pagination: {
//     page: 1,
//     pageSize: 10,
//     total: 50,
//     totalPages: 5
//   }
// }
```

### Relationships

```javascript
// Get customer with all pets
const customer = await getCustomerWithPets(1);
console.log(customer.pets); // [{ PET_ID: 1, ... }, ...]

// Get pet with owner info
const pet = await getPetWithOwner(1);
console.log(pet.owner); // { CUSTOMER_ID: 1, ... }
```

### Transactions

```javascript
const { transaction } = require('./utils/queries');

await transaction.execute(async (trx) => {
  // All operations use the transaction connection
  await trx('CUSTOMER').insert({ CUSTOMER_NAME: 'John' });
  await trx('PET').insert({ PET_NAME: 'Milo' });
  
  // If any operation fails, all are rolled back
  // If all succeed, all are committed
});
```

### Count Rows

```javascript
const result = await customers.count();
console.log(result.count); // Total number of customers
```

---

## Using in Routes

### Simple Read

```javascript
router.get('/customers/:id', async (req, res) => {
  try {
    const customer = await customers.getById(req.params.id);
    if (!customer) {
      return res.status(404).render('error', { message: 'Customer not found' });
    }
    res.render('customer', { customer });
  } catch (error) {
    res.status(500).render('error', { message: error.message });
  }
});
```

### Create

```javascript
router.post('/customers', async (req, res) => {
  try {
    const { customerName, customerPhone, customerEmail, customerGender } = req.body;
    
    const result = await customers.create({
      CUSTOMER_NAME: customerName,
      CUSTOMER_PHONE: customerPhone,
      CUSTOMER_EMAIL: customerEmail,
      CUSTOMER_GENDER: customerGender,
      MEMBERSHIP_RANK_ID: 1,
    });
    
    res.redirect('/customers');
  } catch (error) {
    res.status(400).render('error', { message: error.message });
  }
});
```

### Update

```javascript
router.post('/customers/:id', async (req, res) => {
  try {
    await customers.update(req.params.id, {
      CUSTOMER_NAME: req.body.customerName,
      CUSTOMER_EMAIL: req.body.customerEmail,
    });
    
    res.redirect(`/customers/${req.params.id}`);
  } catch (error) {
    res.status(400).render('error', { message: error.message });
  }
});
```

### Delete

```javascript
router.delete('/customers/:id', async (req, res) => {
  try {
    await deleteCustomer(req.params.id);
    res.redirect('/customers');
  } catch (error) {
    res.status(400).render('error', { message: error.message });
  }
});
```

### List with Pagination

```javascript
router.get('/customers', async (req, res) => {
  try {
    const page = parseInt(req.query.page || 1);
    const result = await getAllCustomers(page, 10);
    
    res.render('customers', {
      customers: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    res.status(500).render('error', { message: error.message });
  }
});
```

---

## Table Structures

### CUSTOMER
```sql
CUSTOMER_ID              INT (Primary Key)
MEMBERSHIP_RANK_ID       INT
CUSTOMER_NAME            NVARCHAR(50)
CUSTOMER_PHONE           CHAR(10)
CUSTOMER_EMAIL           VARCHAR(100)
CUSTOMER_GENDER          NVARCHAR(4)
CUSTOMER_BIRTHDATE       DATE
CUSTOMER_LOYALTY         INT
```

### PET
```sql
PET_ID                   INT (Primary Key)
CUSTOMER_ID              INT (Foreign Key)
PET_NAME                 NVARCHAR(20)
PET_BREED_ID             INT
PET_GENDER               NVARCHAR(4)
PET_BIRTHDATE            DATE
PET_HEALTH_STATUS        NVARCHAR(20)
```

---

## Error Handling

```javascript
try {
  const customer = await customers.getById(1);
} catch (error) {
  console.error('Database error:', error.message);
  // Handle error appropriately
}
```

Common errors:
- `Customer not found` - ID doesn't exist
- `Connection refused` - Database not running
- `Timeout` - Database took too long to respond
- `Foreign key constraint` - Related records exist

---

## Performance Tips

1. **Limit queries** - Use pagination for large datasets
2. **Select needed columns** - Don't fetch all columns if not needed
3. **Use indexes** - Database has indexes on ID fields
4. **Connection pooling** - Already configured (min: 2, max: 10)
5. **Cache results** - For frequently accessed data

---

## Environment Variables

```bash
# Database Connection
DB_HOST=mssql                    # Server host
DB_PORT=1433                     # Server port
DB_USER=sa                       # Database user
DB_PASSWORD=PetCareX@2024        # Database password
DB_NAME=PETCAREX                 # Database name

# Application
NODE_ENV=production              # Environment
PORT=54321                       # App port
```

---

## Docker Commands

```bash
# Start containers
docker-compose up

# Start in background
docker-compose up -d

# Stop containers
docker-compose down

# View logs
docker-compose logs app
docker-compose logs mssql

# Follow logs in real-time
docker-compose logs -f

# Rebuild images
docker-compose up --build

# Remove everything (including data)
docker-compose down -v

# Execute SQL in container
docker exec -it petcarex-mssql /opt/mssql-tools/bin/sqlcmd -S localhost -U sa -P PetCareX@2024
```

---

## Debugging

### Check Database Connection
```javascript
const { db } = require('./utils/db');

// In route or service
try {
  const test = await db.raw('SELECT 1 as test');
  console.log('✅ Connected:', test);
} catch (error) {
  console.error('❌ Error:', error.message);
}
```

### View All Tables
```javascript
const tables = await query.raw(`
  SELECT TABLE_NAME 
  FROM INFORMATION_SCHEMA.TABLES 
  WHERE TABLE_TYPE = 'BASE TABLE'
`);
```

### Check Record Count
```javascript
const count = await query.raw('SELECT COUNT(*) as total FROM CUSTOMER');
console.log('Total customers:', count[0].total);
```
