# PetCareX

PetCareX is a web application for a veterinary clinic network. It supports customer care, pet records, appointments, medical visits, product sales, vaccination plans, receipts, and management reports.

This project started as an advanced database course project. It presents database design skills and application development skills in one working system.

## Main Features

### Customer Portal

- Customer sign-in with sample accounts
- Pet profile and medical history view
- Appointment booking and cancellation
- Veterinarian schedule search
- Product purchase and cart checkout
- Receipt history view

### Staff Portal

- Role-based access for reception staff, sales staff, veterinarians, managers, and a director
- Customer and pet management
- Appointment management
- Check-up records and prescriptions
- Receipt creation and payment flow
- Product, medicine, and vaccination plan management
- Daily revenue report and membership review

### Database Work

- Relational schema for clinic operations
- Stored procedures for core business flows
- Functions for loyalty points and membership discounts
- Triggers for appointment rules
- Indexes for common searches and reports
- Large data generator for performance analysis

## Technology Stack

| Area | Technology |
| --- | --- |
| Server | Node.js 20, Express.js |
| Views | EJS, Bootstrap |
| Data access | Knex.js, Tedious |
| Database | Microsoft SQL Server 2022 |
| Environment | Docker Compose |
| Data generation | Python, Faker, pyodbc |

## Project Structure

```text
.
|-- database/
|   |-- schema.sql                       Database schema, constraints, triggers, indexes
|   |-- routines.sql                     Functions and stored procedures
|   |-- seed.sql                         Sample data for a local demo
|   |-- init-db.sh                       Docker database setup script
|   `-- generate_performance_data.py     Large test data generator
|-- docs/
|   |-- requirements.md                  Original project requirements
|   |-- additional-requirements.md       Extended application requirements
|   |-- petcarex-erd.drawio              Entity relationship diagram
|   |-- partition-index.xlsx             Physical design analysis file
|   `-- archive/                         Earlier development notes
|-- src/
|   |-- app.js                           Express entry point
|   |-- models/                          Database access modules
|   |-- routes/                          Web route modules
|   |-- middleware/                      Access control middleware
|   |-- views/                           EJS pages and partials
|   `-- public/                          Browser assets
|-- .env.example
|-- docker-compose.yml
`-- README.md
```

## Local Setup With Docker

### Requirements

- Docker Desktop or Docker Engine with Docker Compose

### Start the Project

1. Create local environment settings.

```bash
cp .env.example .env
```

2. Create the database and insert sample data.

```bash
docker compose --profile seed run --rm db-init
```

3. Start the web application.

```bash
docker compose up --build app
```

4. Open a portal in a browser.

| Portal | URL |
| --- | --- |
| Staff | `http://localhost:54321/login` |
| Customer | `http://localhost:54321/guest/customer/login` |

The seed command resets the `PETCAREX` database. Use this command only for local demo setup.

## Sample Accounts

### Staff Accounts

| Role | Email | Password |
| --- | --- | --- |
| Reception | `emp1@petcarex.com` | `emp_pwd_0000000001` |
| Sales | `emp5@petcarex.com` | `emp_pwd_0000000005` |
| Veterinarian | `emp7@petcarex.com` | `emp_pwd_0000000007` |
| Manager | `emp11@petcarex.com` | `emp_pwd_0000000011` |
| Director | `director@petcarex.com` | `director_pwd_001` |

### Customer Accounts

| Email | Password |
| --- | --- |
| `nguyenvanan@gmail.com` | `customer_pwd_001` |
| `tranthiminh@gmail.com` | `customer_pwd_002` |
| `lehoangcuong@gmail.com` | `customer_pwd_003` |

## Application Development

Start SQL Server and seed data with Docker first. Run the Node.js app on the host for faster code updates.

```bash
cd src
npm install
DB_HOST=localhost npm run dev
```

Check JavaScript entry point syntax:

```bash
cd src
npm run check
```

## Performance Data

The repository includes a Python script for large test data sets. It supports database index experiments and report query analysis.

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install Faker pyodbc
DB_HOST=127.0.0.1 python database/generate_performance_data.py
```

Microsoft ODBC Driver 18 for SQL Server is required for this script.

## Database Files

| File | Purpose |
| --- | --- |
| `database/schema.sql` | Creates database tables, keys, triggers, and indexes |
| `database/routines.sql` | Creates functions and stored procedures |
| `database/seed.sql` | Adds branches, services, products, staff, customers, and pets |
| `database/generate_performance_data.py` | Adds large sample data for performance tests |

## Current Scope

This repository is an academic and portfolio project. Seeded accounts use sample passwords for local demonstration. A production version needs password hashing, secure secret storage, CSRF protection, stricter validation, automated tests, and deployment controls.

## Documentation

- [Project requirements](docs/requirements.md)
- [Additional requirements](docs/additional-requirements.md)
- [Entity relationship diagram](docs/petcarex-erd.drawio)
- [Physical design analysis](docs/partition-index.xlsx)
