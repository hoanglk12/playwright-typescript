import { GraphQLClient } from '../../src/api/GraphQLClient';
import { plaTestData } from '../../src/data/api/pla-test-data';
import { setCustomerToken } from './shared-state';
import { TestLogger } from '../../src/utils/test-logger';

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

/**
 * Signs in fresh with `plaTestData.validCredentials`, creates the account first if it
 * doesn't exist yet, stores the token via `setCustomerToken`, and returns it.
 *
 * Always authenticates fresh — never reuses an existing shared-state token.
 * Per tests/api/CLAUDE.md: "Never reuse getCustomerToken() from shared-state."
 */
export async function signInAndStoreToken(
  client: GraphQLClient,
  logger: TestLogger,
): Promise<string> {
  const { email, password, remember } = plaTestData.validCredentials;
  const signInVars = { email, password, remember };

  logger.step('Auth: sign in fresh to obtain a valid token');
  const signInGql = await (
    await client.mutateWrapped(SIGN_IN_MUTATION, signInVars)
  ).getGraphQLResponse();

  if (!(signInGql.errors?.length)) {
    const token: string = signInGql.data?.generateCustomerToken?.token ?? '';
    if (!token) throw new Error('signInAndStoreToken: sign-in succeeded but token was missing');
    setCustomerToken(token);
    logger.action('Fresh token acquired', '');
    return token;
  }

  // Sign-in failed — create account first (ignore "already exists"), then retry
  logger.step('Auth: sign-in failed — creating account first');
  const createGql = await (
    await client.mutateWrapped(CREATE_ACCOUNT_MUTATION, plaTestData.validCustomer)
  ).getGraphQLResponse();

  if ((createGql.errors?.length ?? 0) > 0) {
    const msg = createGql.errors![0]?.message ?? '';
    if (!msg.toLowerCase().includes('already') && !msg.toLowerCase().includes('exists')) {
      throw new Error(`signInAndStoreToken: account creation failed: ${msg}`);
    }
    logger.action('Account already exists — proceeding to sign in', '');
  }

  const retryGql = await (
    await client.mutateWrapped(SIGN_IN_MUTATION, signInVars)
  ).getGraphQLResponse();

  if ((retryGql.errors?.length ?? 0) > 0) {
    throw new Error(
      `signInAndStoreToken: sign-in failed after account creation: ${retryGql.errors![0]?.message ?? 'unknown'}`,
    );
  }

  const retryToken: string = retryGql.data?.generateCustomerToken?.token ?? '';
  if (!retryToken) throw new Error('signInAndStoreToken: sign-in after account creation returned no token');
  setCustomerToken(retryToken);
  logger.action('Token acquired after account creation', '');
  return retryToken;
}
