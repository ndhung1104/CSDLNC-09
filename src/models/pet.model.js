import db from '../utils/db.js';

// Get all pets with owner info
export async function getAll({ search = '', searchBy = 'pet', page = 1, limit = 20 } = {}) {
    const offset = (page - 1) * limit;

    // Count query - simple, with join only if needed for search
    let countQuery = db('PET')
        .join('CUSTOMER', 'PET.CUSTOMER_ID', 'CUSTOMER.CUSTOMER_ID');

    // Data query with all joins and columns
    let dataQuery = db('PET')
        .join('PET_BREED', 'PET.PET_BREED_ID', 'PET_BREED.BREED_ID')
        .join('CUSTOMER', 'PET.CUSTOMER_ID', 'CUSTOMER.CUSTOMER_ID')
        .select(
            'PET.PET_ID as id',
            'PET.PET_NAME as name',
            'PET.PET_GENDER as gender',
            'PET.PET_HEALTH_STATUS as healthStatus',
            'PET_BREED.BREED_NAME as breedName',
            'PET_BREED.TYPE_OF_PET as typeOfPet',
            'CUSTOMER.CUSTOMER_ID as customerId',
            'CUSTOMER.CUSTOMER_NAME as ownerName'
        );

    if (search) {
        // Search by pet name or owner name based on searchBy parameter
        const column = searchBy === 'owner' ? 'CUSTOMER.CUSTOMER_NAME' : 'PET.PET_NAME';
        countQuery = countQuery.where(column, 'like', `%${search}%`);
        dataQuery = dataQuery.where(column, 'like', `%${search}%`);
    }

    const total = await countQuery.count('* as count').first();
    const pets = await dataQuery.offset(offset).limit(limit);

    return { pets, total: total?.count || 0, page, limit };
}

// Get pet by ID
export async function getById(id) {
    return db('PET')
        .join('PET_BREED', 'PET.PET_BREED_ID', 'PET_BREED.BREED_ID')
        .join('CUSTOMER', 'PET.CUSTOMER_ID', 'CUSTOMER.CUSTOMER_ID')
        .select('PET.*', 'PET_BREED.BREED_NAME as breedName', 'PET_BREED.TYPE_OF_PET as typeOfPet', 'CUSTOMER.CUSTOMER_NAME as ownerName')
        .where('PET.PET_ID', id)
        .first();
}

// Create pet using stored procedure
export async function create({ customerId, breedId, name, gender, healthStatus = 'Khỏe mạnh' }) {
    const result = await db.raw(`
    DECLARE @NewId INT;
    EXEC dbo.uspPetCreateForCustomer
      @CustomerId = ?,
      @BreedId = ?,
      @PetName = ?,
      @PetGender = ?,
      @PetHealthStatus = ?,
      @PetId = @NewId OUTPUT;
    SELECT @NewId AS id;
  `, [customerId, breedId, name, gender, healthStatus]);

    return result[0]?.id || null;
}

// Get all breeds
export async function getBreeds() {
    return db('PET_BREED').select('BREED_ID as id', 'BREED_NAME as name', 'TYPE_OF_PET as type');
}

// Get pets by customer
export async function getByCustomerId(customerId) {
    return db('PET')
        .join('PET_BREED', 'PET.PET_BREED_ID', 'PET_BREED.BREED_ID')
        .select(
            'PET.PET_ID as id',
            'PET.PET_NAME as name',
            'PET.PET_GENDER as gender',
            'PET.PET_BIRTHDATE as birthdate',
            'PET.PET_HEALTH_STATUS as healthStatus',
            'PET_BREED.BREED_NAME as breedName',
            'PET_BREED.TYPE_OF_PET as typeOfPet',
            'PET.CUSTOMER_ID as customerId'
        )
        .where('PET.CUSTOMER_ID', customerId);
}
