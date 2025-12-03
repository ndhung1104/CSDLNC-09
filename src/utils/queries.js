const db = require('./db');

/**
 * Customers Queries
 */
const customers = {
  getAll: (limit = 10, offset = 0) =>
    db('CUSTOMER')
      .select('*')
      .limit(limit)
      .offset(offset),

  getById: (id) =>
    db('CUSTOMER')
      .where('CUSTOMER_ID', id)
      .first(),

  create: (customerData) =>
    db('CUSTOMER').insert(customerData),

  update: (id, customerData) =>
    db('CUSTOMER')
      .where('CUSTOMER_ID', id)
      .update(customerData),

  delete: (id) =>
    db('CUSTOMER')
      .where('CUSTOMER_ID', id)
      .del(),

  count: () =>
    db('CUSTOMER').count('CUSTOMER_ID as count').first(),
};

/**
 * Pets Queries
 */
const pets = {
  getAll: (limit = 10, offset = 0) =>
    db('PET')
      .select('*')
      .limit(limit)
      .offset(offset),

  getById: (id) =>
    db('PET')
      .where('PET_ID', id)
      .first(),

  getByCustomerId: (customerId) =>
    db('PET')
      .where('CUSTOMER_ID', customerId)
      .select('*'),

  create: (petData) =>
    db('PET').insert(petData),

  update: (id, petData) =>
    db('PET')
      .where('PET_ID', id)
      .update(petData),

  delete: (id) =>
    db('PET')
      .where('PET_ID', id)
      .del(),

  count: () =>
    db('PET').count('PET_ID as count').first(),
};

/**
 * Generic Query Helper
 */
const query = {
  select: (table, columns = ['*']) =>
    db(table).select(columns),

  selectWhere: (table, whereClause, columns = ['*']) =>
    db(table)
      .where(whereClause)
      .select(columns),

  insert: (table, data) =>
    db(table).insert(data),

  update: (table, whereClause, data) =>
    db(table)
      .where(whereClause)
      .update(data),

  delete: (table, whereClause) =>
    db(table)
      .where(whereClause)
      .del(),

  raw: (sql, bindings = []) =>
    db.raw(sql, bindings),
};

/**
 * Transaction Helper
 */
const transaction = {
  execute: async (callback) => {
    const trx = await db.transaction();
    try {
      const result = await callback(trx);
      await trx.commit();
      return result;
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  },
};

module.exports = {
  db,
  customers,
  pets,
  query,
  transaction,
};
