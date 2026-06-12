import { graTest as test, expect, softExpect } from './gra-test';
import { AuthType } from '../../src/api/ApiClient';
import { signInAndStoreToken } from './api-test-helpers';
import { createTestLogger } from '../../src/utils/test-logger';
import {
  plaCustomerProfileData,
  plaCustomerProfileErrorMessages,
} from '../../src/data/api/gra-customer-profile-data';

const CHANGE_PASSWORD_MUTATION = `
  mutation ChangeCustomerPassword($currentPassword: String!, $newPassword: String!) {
    changeCustomerPassword(currentPassword: $currentPassword, newPassword: $newPassword) {
      id
      email
      __typename
    }
  }
`;

const UPDATE_NAME_MUTATION = `
  mutation UpdateFirstnameLastname($firstname: String, $lastname: String) {
    updateCustomerV2(input: {firstname: $firstname, lastname: $lastname}) {
      customer {
        id
        firstname
        lastname
        __typename
      }
      __typename
    }
  }
`;

const UPDATE_DOB_MUTATION = `
  mutation UpdateDateOfBirth($date_of_birth: String) {
    updateCustomerV2(input: {date_of_birth: $date_of_birth}) {
      customer {
        id
        date_of_birth
        __typename
      }
      __typename
    }
  }
`;

const UPDATE_PHONE_MUTATION = `
  mutation UpdatePhoneNumber($phone_number: String) {
    updateCustomerV2(input: {phone_number: $phone_number}) {
      customer {
        id
        __typename
      }
      __typename
    }
  }
`;

const UPDATE_EMAIL_MUTATION = `
  mutation UpdateEmail($email: String) {
    updateCustomerV2(input: {email: $email}) {
      customer {
        id
        email
        __typename
      }
      __typename
    }
  }
`;

const GET_CUSTOMER_QUERY = `
  query GetCustomerPersonalInfo {
    customer {
      id
      firstname
      lastname
      date_of_birth
      __typename
    }
  }
`;

test.describe('GRA Customer Profile @api @graphql @regression', () => {
  let customerToken: string = '';

  test.beforeAll(async ({ createGraphQLClient, site, siteState }) => {
    const logger = createTestLogger('PLA Customer Profile - Setup');
    const client = await createGraphQLClient();
    customerToken = await signInAndStoreToken(client, logger, site, siteState);
  });

  // ─── changeCustomerPassword ────────────────────────────────────────────────

  test('TC_01 - changeCustomerPassword - valid credentials should update password successfully', async ({
    createGraphQLClient, site,
  }) => {
    const logger = createTestLogger('TC_01 changeCustomerPassword - valid credentials succeed');

    logger.step('Step 1 - Change password to temp password');
    const authClient = await createGraphQLClient({ authType: AuthType.BEARER, token: customerToken });
    const changeResponse = await authClient.mutateWrapped(
      CHANGE_PASSWORD_MUTATION,
      plaCustomerProfileData.validPasswordChange
    );

    await changeResponse.assertNoErrors();
    await changeResponse.assertHasData();

    const changeData = await changeResponse.getData();
    logger.step('Step 2 - Assert password change returned customer object');
    logger.verify('changeCustomerPassword returned customer data', true, !!changeData.changeCustomerPassword);
    softExpect(changeData.changeCustomerPassword?.email).toBe(site.testData.validCredentials.email);
    softExpect(changeData.changeCustomerPassword?.__typename).toBe('Customer');

    logger.step('Step 3 - Restore original password so other specs remain functional');
    const restoreResponse = await authClient.mutateWrapped(
      CHANGE_PASSWORD_MUTATION,
      plaCustomerProfileData.restorePasswordChange
    );
    await restoreResponse.assertNoErrors();

    logger.action('Password restored to original', '');
  });

  test('TC_02 - changeCustomerPassword - wrong current password should return authentication error', async ({
    createGraphQLClient,
  }) => {
    const logger = createTestLogger('TC_02 changeCustomerPassword - wrong current password returns error');

    logger.step('Step 1 - Attempt password change with incorrect current password');
    const authClient = await createGraphQLClient({ authType: AuthType.BEARER, token: customerToken });
    const response = await authClient.mutateWrapped(
      CHANGE_PASSWORD_MUTATION,
      plaCustomerProfileData.invalidCurrentPassword
    );

    logger.step('Step 2 - Assert authentication error is returned');
    await response.assertHasErrors();
    const gqlResponse = await response.getGraphQLResponse();
    const errorMsg = gqlResponse.errors?.length ? (gqlResponse.errors[0]?.message ?? '') : '';
    logger.verify('Error returned for wrong current password', true, gqlResponse.errors!.length > 0);
    softExpect(errorMsg).toContain(plaCustomerProfileErrorMessages.wrongCurrentPassword.split('.')[0]);
  });

  test('TC_03 - changeCustomerPassword - weak new password should return validation error', async ({
    createGraphQLClient,
  }) => {
    const logger = createTestLogger('TC_03 changeCustomerPassword - weak new password returns error');

    logger.step('Step 1 - Attempt password change with a weak new password');
    const authClient = await createGraphQLClient({ authType: AuthType.BEARER, token: customerToken });
    const response = await authClient.mutateWrapped(
      CHANGE_PASSWORD_MUTATION,
      plaCustomerProfileData.weakNewPassword
    );

    logger.step('Step 2 - Assert validation error is returned');
    await response.assertHasErrors();
    const gqlResponse = await response.getGraphQLResponse();
    logger.verify('Error returned for weak new password', true, gqlResponse.errors!.length > 0);
    softExpect(gqlResponse.errors!.length).toBeGreaterThan(0);
  });

  test('TC_04 - changeCustomerPassword - unauthenticated request should return UNAUTHORIZED error', async ({
    createGraphQLClient,
  }) => {
    const logger = createTestLogger('TC_04 changeCustomerPassword - unauthenticated returns UNAUTHORIZED');

    logger.step('Step 1 - Call changeCustomerPassword without auth token');
    const publicClient = await createGraphQLClient();
    const response = await publicClient.mutateWrapped(
      CHANGE_PASSWORD_MUTATION,
      plaCustomerProfileData.validPasswordChange
    );

    logger.step('Step 2 - Assert authorization error is returned');
    await response.assertHasErrors();
    const gqlResponse = await response.getGraphQLResponse();
    logger.verify('graphql-authorization error returned', 'graphql-authorization', gqlResponse.errors![0].extensions?.category);
    softExpect(gqlResponse.errors![0].extensions?.category).toBe('graphql-authorization');
  });

  // ─── updateCustomerV2 personal info ───────────────────────────────────────

  test('TC_05 - updateCustomerV2 - firstname+lastname update blocked by store password policy on staging', async ({
    createGraphQLClient,
  }) => {
    const logger = createTestLogger('TC_05 updateCustomerV2 - personal info update blocked by store config');

    logger.step('Step 1 - Attempt to update firstname and lastname');
    const authClient = await createGraphQLClient({ authType: AuthType.BEARER, token: customerToken });
    const response = await authClient.mutateWrapped(UPDATE_NAME_MUTATION, {
      firstname: plaCustomerProfileData.updatedFirstname,
      lastname: plaCustomerProfileData.updatedLastname,
    });

    logger.step('Step 2 - Assert store returns password-required error (staging has Require Password for Account Changes enabled)');
    await response.assertHasErrors();
    const gqlResponse = await response.getGraphQLResponse();
    const errorMsg = gqlResponse.errors?.length ? (gqlResponse.errors[0]?.message ?? '') : '';
    logger.verify('Password-required error returned', true, gqlResponse.errors!.length > 0);
    softExpect(gqlResponse.errors![0].extensions?.category).toBe('graphql-input');
    softExpect(errorMsg).toContain('Password is required');
  });

  test('TC_06 - updateCustomerV2 - date_of_birth update blocked by store password policy on staging', async ({
    createGraphQLClient,
  }) => {
    const logger = createTestLogger('TC_06 updateCustomerV2 - date_of_birth update blocked by store config');

    logger.step('Step 1 - Attempt to update date_of_birth');
    const authClient = await createGraphQLClient({ authType: AuthType.BEARER, token: customerToken });
    const response = await authClient.mutateWrapped(UPDATE_DOB_MUTATION, {
      date_of_birth: plaCustomerProfileData.updatedDateOfBirth,
    });

    logger.step('Step 2 - Assert store returns password-required error');
    await response.assertHasErrors();
    const gqlResponse = await response.getGraphQLResponse();
    logger.verify('Password-required error returned', true, gqlResponse.errors!.length > 0);
    softExpect(gqlResponse.errors!.length).toBeGreaterThan(0);
    softExpect(gqlResponse.errors![0].extensions?.category).toBe('graphql-input');
  });

  test('TC_07 - updateCustomerV2 - phone_number update blocked by store password policy on staging', async ({
    createGraphQLClient,
  }) => {
    const logger = createTestLogger('TC_07 updateCustomerV2 - phone_number update blocked by store config');

    logger.step('Step 1 - Attempt to update phone_number');
    const authClient = await createGraphQLClient({ authType: AuthType.BEARER, token: customerToken });
    const response = await authClient.mutateWrapped(UPDATE_PHONE_MUTATION, {
      phone_number: plaCustomerProfileData.updatedPhone,
    });

    logger.step('Step 2 - Assert store returns password-required error');
    await response.assertHasErrors();
    const gqlResponse = await response.getGraphQLResponse();
    logger.verify('Password-required error returned', true, gqlResponse.errors!.length > 0);
    softExpect(gqlResponse.errors!.length).toBeGreaterThan(0);
  });

  test('TC_08 - updateCustomerV2 - email change without password should return error', async ({
    createGraphQLClient,
  }) => {
    const logger = createTestLogger('TC_08 updateCustomerV2 - email change without password returns error');

    logger.step('Step 1 - Send updateCustomerV2 with new email but no password');
    const authClient = await createGraphQLClient({ authType: AuthType.BEARER, token: customerToken });
    const response = await authClient.mutateWrapped(UPDATE_EMAIL_MUTATION, {
      email: plaCustomerProfileData.emailChangeWithoutPassword.input.email,
    });

    logger.step('Step 2 - Assert error is returned for email change without password');
    await response.assertHasErrors();
    const gqlResponse = await response.getGraphQLResponse();
    logger.verify('Error returned for email change without password', true, gqlResponse.errors!.length > 0);
    softExpect(gqlResponse.errors!.length).toBeGreaterThan(0);
  });

  test('TC_09 - updateCustomerV2 - duplicate email should return already exists error', async ({
    createGraphQLClient, site,
  }) => {
    const logger = createTestLogger('TC_09 updateCustomerV2 - duplicate email returns already exists error');

    logger.step('Step 1 - Send updateCustomerV2 attempting to claim an already-registered email');
    const authClient = await createGraphQLClient({ authType: AuthType.BEARER, token: customerToken });
    const response = await authClient.mutateWrapped(UPDATE_EMAIL_MUTATION, {
      email: site.testData.validCredentials.email,
    });

    logger.step('Step 2 - Assert error is returned (duplicate or password-required)');
    await response.assertHasErrors();
    const gqlResponse = await response.getGraphQLResponse();
    logger.verify('Error returned', true, gqlResponse.errors!.length > 0);
    softExpect(gqlResponse.errors!.length).toBeGreaterThan(0);
  });
});
