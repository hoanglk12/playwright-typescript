import { graTest as test, expect, softExpect } from './gra-test';
import { AuthType } from '../../src/api/ApiClient';
import { createTestLogger } from '../../src/utils/test-logger';
import { graAuthData, graAuthErrorMessages } from '../../src/data/api/gra-auth-data';
import { signInAndStoreToken } from './api-test-helpers';
import { TIMEOUTS } from '../../src/constants/timeouts';
import { GraphQLResponseWrapper } from '../../src/api/GraphQLResponse';

let testEmail: string = '';

const SIGN_IN_MUTATION = `
  mutation SignIn($email: String!, $password: String!, $remember: Boolean) {
    generateCustomerToken(email: $email, password: $password, remember: $remember) {
      token
    }
  }
`;

const CREATE_ACCOUNT_MUTATION = `
  mutation CreateAccount(
    $email: String!, $firstname: String!, $lastname: String!,
    $password: String!, $phone_number: String!, $is_subscribed: Boolean!,
    $loyalty_program_status: Boolean, $order_number: String,
    $gender: Int, $date_of_birth: String
  ) {
    createCustomer(input: {
      email: $email, firstname: $firstname, lastname: $lastname,
      password: $password, phone_number: $phone_number,
      is_subscribed: $is_subscribed, loyalty_program_status: $loyalty_program_status,
      order_number: $order_number, gender: $gender, date_of_birth: $date_of_birth
    }) {
      customer { id email __typename }
    }
  }
`;

const REVOKE_TOKEN_MUTATION = `
  mutation RevokeCustomerToken {
    revokeCustomerToken {
      result
    }
  }
`;

const CUSTOMER_QUERY = `
  query GetCustomer {
    customer {
      id
      email
    }
  }
`;

const REQUEST_PASSWORD_RESET_MUTATION = `
  mutation RequestPasswordResetEmail($email: String!) {
    requestPasswordResetEmail(email: $email)
  }
`;

const RESET_PASSWORD_MUTATION = `
  mutation ResetPassword(
    $email: String!
    $resetPasswordToken: String!
    $newPassword: String!
  ) {
    resetPassword(
      email: $email
      resetPasswordToken: $resetPasswordToken
      newPassword: $newPassword
    )
  }
`;

test.describe('GRA Authentication @api @graphql @regression', () => {
  test.beforeAll(async ({ createGraphQLClient, site, siteState }) => {
    test.setTimeout(TIMEOUTS.API_SUITE_SETUP);
    const logger = createTestLogger('beforeAll PLA Authentication setup');
    testEmail = site.testData.validCredentials.email;
    const client = await createGraphQLClient();
    await signInAndStoreToken(client, logger, site, siteState);
  });

  // ─── revokeCustomerToken ───────────────────────────────────────────────────

  test('TC_01 - revokeCustomerToken - valid token should revoke and return true', async ({ createGraphQLClient, site }) => {
    const logger = createTestLogger('TC_01 revokeCustomerToken - valid token returns true');

    let disposableToken!: string;
    await logger.step('Step 1 - Sign in to obtain a disposable token', async () => {
      const publicClient = await createGraphQLClient();
      const signInResponse = await publicClient.mutateWrapped(SIGN_IN_MUTATION, site.testData.validCredentials);
      await signInResponse.assertNoErrors();
      const signInData = await signInResponse.getData();
      disposableToken = signInData.generateCustomerToken.token;
      expect(disposableToken).toBeTruthy();
    });

    let revokeResponse!: GraphQLResponseWrapper;
    await logger.step('Step 2 - Revoke the token', async () => {
      const authClient = await createGraphQLClient({ authType: AuthType.BEARER, token: disposableToken });
      revokeResponse = await authClient.mutateWrapped(REVOKE_TOKEN_MUTATION);
    });

    await logger.step('Step 3 - Assert revoke succeeded', async () => {
      await revokeResponse.assertNoErrors();
      await revokeResponse.assertHasData();

      const revokeData = await revokeResponse.getData();
      logger.verify('revokeCustomerToken.result is true', true, revokeData.revokeCustomerToken?.result);
      softExpect(revokeData.revokeCustomerToken?.result).toBe(true);
    });
  });

  test('TC_02 - revokeCustomerToken - revoked token should not access protected resources', async ({ createGraphQLClient, site }) => {
    const logger = createTestLogger('TC_02 revokeCustomerToken - revoked token denies access');

    // TC_01 revokes a token for the same account. Wait for Magento's session store to fully
    // commit that revocation before signing in again — avoids a race where the new token
    // is created before the revocation write completes and is immediately marked invalid.
    await new Promise(r => setTimeout(r, TIMEOUTS.POLL_INTERVAL_NORMAL));

    let disposableToken!: string;
    await logger.step('Step 1 - Sign in to obtain a disposable token', async () => {
      const publicClient = await createGraphQLClient();
      const signInResponse = await publicClient.mutateWrapped(SIGN_IN_MUTATION, site.testData.validCredentials);
      await signInResponse.assertNoErrors();
      const signInData = await signInResponse.getData();
      disposableToken = signInData.generateCustomerToken.token;
      expect(disposableToken).toBeTruthy();
    });

    await logger.step('Step 2 - Revoke the token', async () => {
      const authClient = await createGraphQLClient({ authType: AuthType.BEARER, token: disposableToken });
      const revokeResponse = await authClient.mutateWrapped(REVOKE_TOKEN_MUTATION);
      await revokeResponse.assertNoErrors();
    });

    // Magento token invalidation is eventually consistent — the blacklist entry may not
    // propagate before the very next request in CI. Poll until the revoked token is
    // rejected, retrying up to 5 times with a 1s gap (covers observed staging delays).
    let pollErrors: { extensions?: { category?: string }; message?: string }[] = [];
    await logger.step('Step 3 - Poll protected resource until revoked token is rejected (eventual consistency)', async () => {
      const MAX_POLL_ATTEMPTS = 5;

      for (let attempt = 1; attempt <= MAX_POLL_ATTEMPTS; attempt++) {
        if (attempt > 1) await new Promise(r => setTimeout(r, TIMEOUTS.POLL_INTERVAL_NORMAL));
        const revokedClient = await createGraphQLClient({ authType: AuthType.BEARER, token: disposableToken });
        const customerResponse = await revokedClient.queryWrapped(CUSTOMER_QUERY);
        const gql = await customerResponse.getGraphQLResponse();
        pollErrors = gql.errors ?? [];
        if (pollErrors.length > 0) break;
        if (attempt < MAX_POLL_ATTEMPTS) {
          await logger.step(`Step 3.${attempt} - Token still accepted after revocation; retrying in ${TIMEOUTS.POLL_INTERVAL_NORMAL}ms`, async () => {});
        }
      }
    });

    await logger.step('Step 4 - Assert authorization error is returned', async () => {
      logger.verify('Authorization error present', true, pollErrors.length > 0);
      expect(pollErrors.length, 'Expected graphql-authorization error after token revocation — token not invalidated within 5s').toBeGreaterThan(0);
      softExpect(pollErrors[0].extensions?.category).toBe('graphql-authorization');
    });
  });

  test('TC_03 - revokeCustomerToken - unauthenticated request should return authorization error', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_03 revokeCustomerToken - unauthenticated returns error');

    let revokeResponse!: GraphQLResponseWrapper;
    await logger.step('Step 1 - Create unauthenticated client and call revokeCustomerToken', async () => {
      const publicClient = await createGraphQLClient();
      revokeResponse = await publicClient.mutateWrapped(REVOKE_TOKEN_MUTATION);
    });

    await logger.step('Step 2 - Assert authorization error', async () => {
      await revokeResponse.assertHasErrors();
      const gqlResponse = await revokeResponse.getGraphQLResponse();
      logger.verify('graphql-authorization error returned', 'graphql-authorization', gqlResponse.errors![0].extensions?.category);
      softExpect(gqlResponse.errors![0].extensions?.category).toBe('graphql-authorization');
      softExpect(gqlResponse.errors![0].message).toContain(graAuthErrorMessages.unauthorizedAccess.split('.')[0]);
    });
  });

  // ─── requestPasswordResetEmail ─────────────────────────────────────────────

  test('TC_04 - requestPasswordResetEmail - valid registered email should succeed', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_04 requestPasswordResetEmail - valid registered email');

    let response!: GraphQLResponseWrapper;
    await logger.step('Step 1 - Request password reset for registered email', async () => {
      const client = await createGraphQLClient();
      response = await client.mutateWrapped(REQUEST_PASSWORD_RESET_MUTATION, { email: testEmail });
    });

    await logger.step('Step 2 - Assert no errors and result is truthy', async () => {
      await response.assertNoErrors();
      await response.assertHasData();

      const data = await response.getData();
      logger.verify('requestPasswordResetEmail returned true', true, data.requestPasswordResetEmail);
      softExpect(data.requestPasswordResetEmail).toBe(true);
    });
  });

  test('TC_05 - requestPasswordResetEmail - non-existent email returns an error response', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_05 requestPasswordResetEmail - non-existent email returns error');

    let response!: GraphQLResponseWrapper;
    await logger.step('Step 1 - Request password reset for non-existent email', async () => {
      const client = await createGraphQLClient();
      response = await client.mutateWrapped(
        REQUEST_PASSWORD_RESET_MUTATION,
        { email: graAuthData.nonExistentEmailPasswordRequest.email }
      );
    });

    await logger.step('Step 2 - Assert API returns an error (staging discloses non-existence via graphql-input)', async () => {
      await response.assertHasErrors();
      const gqlResponse = await response.getGraphQLResponse();
      const errorCount = gqlResponse.errors?.length ?? 0;
      logger.verify('Error returned for non-existent email', true, errorCount > 0);
      softExpect(errorCount).toBeGreaterThan(0);
    });
  });

  test('TC_06 - requestPasswordResetEmail - invalid email format should return validation error', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_06 requestPasswordResetEmail - invalid format returns error');

    let response!: GraphQLResponseWrapper;
    await logger.step('Step 1 - Request password reset with invalid email format', async () => {
      const client = await createGraphQLClient();
      response = await client.mutateWrapped(
        REQUEST_PASSWORD_RESET_MUTATION,
        { email: graAuthData.invalidFormatEmailPasswordRequest.email }
      );
    });

    await logger.step('Step 2 - Assert validation error', async () => {
      await response.assertHasErrors();
      const gqlResponse = await response.getGraphQLResponse();
      logger.verify('graphql-input error returned', 'graphql-input', gqlResponse.errors![0].extensions?.category);
      softExpect(gqlResponse.errors![0].extensions?.category).toBe('graphql-input');
      softExpect(gqlResponse.errors![0].message).toContain(graAuthErrorMessages.invalidEmailFormat);
    });
  });

  // ─── resetPassword ─────────────────────────────────────────────────────────

  test('TC_07 - resetPassword - invalid reset token should return error', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_07 resetPassword - invalid reset token returns error');

    let response!: GraphQLResponseWrapper;
    await logger.step('Step 1 - Call resetPassword with an invalid token', async () => {
      const client = await createGraphQLClient();
      response = await client.mutateWrapped(RESET_PASSWORD_MUTATION, graAuthData.invalidTokenReset);
    });

    await logger.step('Step 2 - Assert error is returned', async () => {
      await response.assertHasErrors();
      const gqlResponse = await response.getGraphQLResponse();
      const errorCount = gqlResponse.errors?.length ?? 0;
      logger.verify('Error returned for invalid reset token', true, errorCount > 0);
      softExpect(errorCount).toBeGreaterThan(0);
    });
  });

  test('TC_08 - resetPassword - invalid email format should return validation error', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_08 resetPassword - invalid email format returns error');

    let response!: GraphQLResponseWrapper;
    await logger.step('Step 1 - Call resetPassword with an invalid email format', async () => {
      const client = await createGraphQLClient();
      const input = {
        email: graAuthData.invalidFormatEmailPasswordRequest.email,
        resetPasswordToken: 'any-token-value',
        newPassword: 'ValidPass123!',
      };
      response = await client.mutateWrapped(RESET_PASSWORD_MUTATION, input);
    });

    await logger.step('Step 2 - Assert validation error for email format', async () => {
      await response.assertHasErrors();
      const gqlResponse = await response.getGraphQLResponse();
      logger.verify('Error returned for invalid email format', true, gqlResponse.errors!.length > 0);
      softExpect(gqlResponse.errors!.length).toBeGreaterThan(0);
    });
  });

  test('TC_09 - resetPassword - weak new password should return error', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_09 resetPassword - weak password returns error');

    let response!: GraphQLResponseWrapper;
    await logger.step('Step 1 - Call resetPassword with a weak new password', async () => {
      const client = await createGraphQLClient();
      response = await client.mutateWrapped(RESET_PASSWORD_MUTATION, graAuthData.weakPasswordReset);
    });

    await logger.step('Step 2 - Assert error is returned', async () => {
      await response.assertHasErrors();
      const gqlResponse = await response.getGraphQLResponse();
      logger.verify('Error returned for weak password / invalid token', true, gqlResponse.errors!.length > 0);
      softExpect(gqlResponse.errors!.length).toBeGreaterThan(0);
    });
  });
});
