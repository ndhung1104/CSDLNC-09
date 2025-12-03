const { customers, pets, query } = require('../utils/queries');

/**
 * Fetch customer with their pets
 */
async function getCustomerWithPets(customerId) {
  try {
    const customer = await customers.getById(customerId);
    if (!customer) return null;

    const petList = await pets.getByCustomerId(customerId);
    return {
      ...customer,
      pets: petList,
    };
  } catch (error) {
    console.error('Error fetching customer with pets:', error);
    throw error;
  }
}

/**
 * Fetch all customers with count
 */
async function getAllCustomers(page = 1, pageSize = 10) {
  try {
    const offset = (page - 1) * pageSize;
    const customerList = await customers.getAll(pageSize, offset);
    const countResult = await customers.count();
    const total = countResult.count;

    return {
      data: customerList,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  } catch (error) {
    console.error('Error fetching customers:', error);
    throw error;
  }
}

/**
 * Fetch pet with owner info
 */
async function getPetWithOwner(petId) {
  try {
    const pet = await pets.getById(petId);
    if (!pet) return null;

    const owner = await customers.getById(pet.CUSTOMER_ID);
    return {
      ...pet,
      owner,
    };
  } catch (error) {
    console.error('Error fetching pet with owner:', error);
    throw error;
  }
}

/**
 * Create new customer with validation
 */
async function createCustomer(customerData) {
  try {
    // Validate required fields
    if (!customerData.CUSTOMER_NAME || !customerData.CUSTOMER_GENDER) {
      throw new Error('Customer name and gender are required');
    }

    const result = await customers.create(customerData);
    return result;
  } catch (error) {
    console.error('Error creating customer:', error);
    throw error;
  }
}

/**
 * Update customer
 */
async function updateCustomer(customerId, customerData) {
  try {
    const result = await customers.update(customerId, customerData);
    if (result === 0) {
      throw new Error('Customer not found');
    }
    return result;
  } catch (error) {
    console.error('Error updating customer:', error);
    throw error;
  }
}

/**
 * Delete customer and their pets
 */
async function deleteCustomer(customerId) {
  try {
    // Delete pets first (foreign key constraint)
    await pets.delete(customerId);
    // Delete customer
    const result = await customers.delete(customerId);
    return result;
  } catch (error) {
    console.error('Error deleting customer:', error);
    throw error;
  }
}

module.exports = {
  getCustomerWithPets,
  getAllCustomers,
  getPetWithOwner,
  createCustomer,
  updateCustomer,
  deleteCustomer,
};
