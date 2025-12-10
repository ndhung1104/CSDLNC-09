export const demoUser = {
  initials: 'JD',
  name: 'Jane Doe',
  email: 'jane@petcarex.com',
};

export function getCustomerDashboardData() {
  return {
    user: demoUser,
    customer: {
      name: demoUser.name,
      loyaltyPoints: 120,
      membershipRank: 'Gold',
    },
    stats: {
      totalPets: 2,
      upcomingAppointments: 3,
    },
    pets: [
      {
        petId: 1,
        name: 'Milo',
        breed: 'Golden Retriever',
        typeOfPet: 'Dog',
        gender: 'Male',
        healthStatus: 'Healthy',
      },
      {
        petId: 2,
        name: 'Luna',
        breed: 'Siamese',
        typeOfPet: 'Cat',
        gender: 'Female',
        healthStatus: 'Check-up due',
      },
    ],
    upcomingAppointments: [
      {
        appointmentId: 1,
        serviceName: 'Vaccination',
        appointmentDate: '2025-12-05',
        appointmentTime: '09:00 AM',
        branchName: 'Downtown Clinic',
        petName: 'Milo',
        status: 'Pending',
      },
      {
        appointmentId: 2,
        serviceName: 'Grooming',
        appointmentDate: '2025-12-12',
        appointmentTime: '02:00 PM',
        branchName: 'Uptown Clinic',
        petName: 'Luna',
        status: 'Confirmed',
      },
    ],
  };
}

export function getCustomerAppointmentsData() {
  return {
    user: demoUser,
    upcomingAppointments: [
      {
        appointmentId: 1,
        serviceName: 'Vaccination',
        status: 'Pending',
        appointmentDate: '2025-12-05',
        appointmentTime: '09:00 AM',
        branchName: 'Downtown Clinic',
        petName: 'Milo',
        notes: 'Bring previous medical records',
      },
    ],
    pastAppointments: [
      {
        appointmentId: 2,
        serviceName: 'General Check-up',
        appointmentDate: '2025-11-10',
        appointmentTime: '10:00 AM',
        branchName: 'Uptown Clinic',
        petName: 'Luna',
      },
    ],
    cancelledAppointments: [],
  };
}

export function getCustomerNewAppointmentData() {
  return {
    user: demoUser,
    pets: [
      {
        petId: 1,
        name: 'Milo',
        breed: 'Golden Retriever',
        typeOfPet: 'Dog',
      },
      {
        petId: 2,
        name: 'Luna',
        breed: 'Siamese',
        typeOfPet: 'Cat',
      },
    ],
    services: [
      { serviceId: 1, serviceName: 'General Check-up', price: 35 },
      { serviceId: 2, serviceName: 'Vaccination', price: 45 },
      { serviceId: 3, serviceName: 'Grooming', price: 30 },
    ],
    branches: [
      { branchId: 1, branchName: 'Downtown Clinic', address: '123 Main St' },
      { branchId: 2, branchName: 'Uptown Clinic', address: '456 Oak Ave' },
    ],
  };
}

export function getCustomerPetsData() {
  return {
    user: demoUser,
    pets: [
      {
        petId: 1,
        name: 'Milo',
        breed: 'Golden Retriever',
        typeOfPet: 'Dog',
        gender: 'Male',
        age: 3,
        weight: 28,
        healthStatus: 'Healthy',
      },
      {
        petId: 2,
        name: 'Luna',
        breed: 'Siamese',
        typeOfPet: 'Cat',
        gender: 'Female',
        age: 2,
        weight: 4,
        healthStatus: 'Check-up due',
      },
    ],
  };
}

export function getCustomerReceiptsData() {
  return {
    user: demoUser,
    receipts: [
      {
        receiptId: 101,
        receiptNo: 'INV-101',
        receiptDate: '2025-11-15',
        branchName: 'Downtown Clinic',
        paymentMethod: 'Credit Card',
        totalPrice: 85,
        items: [
          { itemName: 'Vaccination', quantity: 1, totalPrice: 45 },
          { itemName: 'Pet Vitamins', quantity: 2, totalPrice: 40 },
        ],
      },
    ],
  };
}

export function getManagementCustomersData() {
  return {
    user: demoUser,
    customers: [
      {
        customerId: 1,
        customerName: 'Alex Johnson',
        gender: 'Nam',
        phone: '0123456789',
        email: 'alex@example.com',
        membershipRank: 'Gold',
        membershipColor: 'warning',
        loyaltyPoints: 320,
      },
      {
        customerId: 2,
        customerName: 'Maria Chen',
        gender: 'N Ż_',
        phone: '0987654321',
        email: 'maria@example.com',
        membershipRank: 'Platinum',
        membershipColor: 'primary',
        loyaltyPoints: 520,
      },
    ],
    pagination: {
      start: 1,
      end: 2,
      total: 2,
      isFirst: true,
      isLast: true,
      prevPage: 1,
      nextPage: 1,
      pages: [{ page: 1, active: true }],
    },
  };
}
