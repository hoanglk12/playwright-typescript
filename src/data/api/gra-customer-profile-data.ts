export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface UpdatePersonalInfoInput {
  input: {
    firstname?: string;
    lastname?: string;
    date_of_birth?: string;
    phone_number?: string;
    email?: string;
    password?: string;
  };
}

export interface CustomerProfileDataShape {
  validPasswordChange: ChangePasswordInput;
  restorePasswordChange: ChangePasswordInput;
  invalidCurrentPassword: ChangePasswordInput;
  weakNewPassword: ChangePasswordInput;
  updateNameInput: UpdatePersonalInfoInput;
  updateDobInput: UpdatePersonalInfoInput;
  updatePhoneInput: UpdatePersonalInfoInput;
  emailChangeWithoutPassword: UpdatePersonalInfoInput;
  updatedFirstname: string;
  updatedLastname: string;
  updatedDateOfBirth: string;
  updatedPhone: string;
}

export interface CustomerProfileErrorMessages {
  wrongCurrentPassword: string;
  unauthorized: string;
}

export const plaCustomerProfileData: CustomerProfileDataShape = {
  validPasswordChange: {
    currentPassword: 'Johncena5',
    newPassword: 'TempPass99',
  },
  restorePasswordChange: {
    currentPassword: 'TempPass99',
    newPassword: 'Johncena5',
  },
  invalidCurrentPassword: {
    currentPassword: 'WrongPassword999',
    newPassword: 'TempPass99',
  },
  weakNewPassword: {
    currentPassword: 'Johncena5',
    newPassword: 'weak',
  },
  updateNameInput: {
    input: {
      firstname: 'UpdatedFirst',
      lastname: 'UpdatedLast',
      password: 'Johncena5',
    },
  },
  updateDobInput: {
    input: {
      date_of_birth: '06/29/1995',
      password: 'Johncena5',
    },
  },
  updatePhoneInput: {
    input: {
      phone_number: '0412345678',
      password: 'Johncena5',
    },
  },
  emailChangeWithoutPassword: {
    input: {
      email: 'changed-no-pass@example.com',
    },
  },
  updatedFirstname: 'UpdatedFirst',
  updatedLastname: 'UpdatedLast',
  updatedDateOfBirth: '06/29/1995',
  updatedPhone: '0412345678',
};

export const plaCustomerProfileErrorMessages: CustomerProfileErrorMessages = {
  wrongCurrentPassword: 'Invalid login or password.',
  unauthorized: "The current customer isn't authorized.",
};
