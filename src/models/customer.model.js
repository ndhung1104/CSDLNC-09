import db from '../utils/db.js';

// Get all customers with pagination and search
// Get all customers with pagination, search, and rank filter
export async function getAll({ search = '', page = 1, limit = 20, rankId = null } = {}) {
    const offset = (page - 1) * limit;

    let countQuery = db('CUSTOMER')
        .join('MEMBERSHIP_RANK', 'CUSTOMER.MEMBERSHIP_RANK_ID', 'MEMBERSHIP_RANK.MEMBERSHIP_RANK_ID');

    let dataQuery = db('CUSTOMER')
        .join('MEMBERSHIP_RANK', 'CUSTOMER.MEMBERSHIP_RANK_ID', 'MEMBERSHIP_RANK.MEMBERSHIP_RANK_ID')
        .select(
            'CUSTOMER.CUSTOMER_ID as id',
            'CUSTOMER.CUSTOMER_NAME as name',
            'CUSTOMER.CUSTOMER_PHONE as phone',
            'CUSTOMER.CUSTOMER_EMAIL as email',
            'CUSTOMER.CUSTOMER_GENDER as gender',
            'CUSTOMER.CUSTOMER_LOYALTY as loyalty',
            'MEMBERSHIP_RANK.MEMBERSHIP_RANK_NAME as membershipRank'
        );

    // Filter by Rank
    if (rankId) {
        countQuery = countQuery.where('CUSTOMER.MEMBERSHIP_RANK_ID', rankId);
        dataQuery = dataQuery.where('CUSTOMER.MEMBERSHIP_RANK_ID', rankId);
    }

    if (search) {
        const searchCondition = function () {
            this.where('CUSTOMER.CUSTOMER_NAME', 'like', `%${search}%`)
                .orWhere('CUSTOMER.CUSTOMER_PHONE', 'like', `%${search}%`)
                .orWhere('CUSTOMER.CUSTOMER_EMAIL', 'like', `%${search}%`);
        };
        countQuery = countQuery.where(searchCondition);
        dataQuery = dataQuery.where(searchCondition);
    }

    const total = await countQuery.count('CUSTOMER.CUSTOMER_ID as count').first();
    const customers = await dataQuery
        .orderBy('CUSTOMER.CUSTOMER_ID', 'asc')
        .offset(offset)
        .limit(limit);

    return { customers, total: total?.count || 0, page, limit };
}

// Get all membership ranks for dropdown
export async function getRanks() {
    return db('MEMBERSHIP_RANK').select('MEMBERSHIP_RANK_ID as id', 'MEMBERSHIP_RANK_NAME as name');
}

// Get customer by ID with pets
export async function getById(id) {
    const customer = await db('CUSTOMER')
        .join('MEMBERSHIP_RANK', 'CUSTOMER.MEMBERSHIP_RANK_ID', 'MEMBERSHIP_RANK.MEMBERSHIP_RANK_ID')
        .select(
            'CUSTOMER.*',
            'MEMBERSHIP_RANK.MEMBERSHIP_RANK_NAME as membershipRank'
        )
        .where('CUSTOMER.CUSTOMER_ID', id)
        .first();

    if (!customer) return null;

    const pets = await db('PET')
        .join('PET_BREED', 'PET.BREED_ID', 'PET_BREED.BREED_ID')
        .select('PET.*', 'PET_BREED.BREED_NAME as breedName', 'PET_BREED.TYPE_OF_PET as typeOfPet')
        .where('PET.CUSTOMER_ID', id);

    return { ...customer, pets };
}

// Create customer using stored procedure
export async function create({ name, phone, email, password, gender, birthdate }) {
    const result = await db.raw(`
    DECLARE @NewId INT;
    EXEC dbo.uspCustomerCreate 
      @CustomerName = ?,
      @CustomerPhone = ?,
      @CustomerEmail = ?,
      @CustomerPassword = ?,
      @CustomerGender = ?,
      @CustomerBirthdate = ?,
      @CustomerId = @NewId OUTPUT;
    SELECT @NewId AS id;
  `, [name, phone || null, email, password, gender, birthdate || null]);

    return result[0]?.id || null;
}

// Search customer by phone or email
export async function findByPhoneOrEmail(phone, email) {
    return db('CUSTOMER')
        .where('CUSTOMER_PHONE', phone)
        .orWhere('CUSTOMER_EMAIL', email)
        .first();
}
