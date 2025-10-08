// /**
//  * GraphQL API Test Examples
//  * 
//  * This file demonstrates comprehensive GraphQL testing patterns using the
//  * Playwright TypeScript framework with GraphQL integration.
//  */

// import { apiTest as test } from '../../src/api/ApiTest';
// import { expect } from '@playwright/test';
// import { AuthType } from '../../src/api/ApiClient';

// test.describe('GraphQL API Tests - Query Operations', () => {
  
//   test('should execute simple query', async ({ graphqlClient }) => {
//     // Execute a simple query to fetch all posts
//     const response = await graphqlClient.queryWrapped(`
//       query GetAllPosts {
//         posts {
//           id
//           title
//           author {
//             name
//           }
//         }
//       }
//     `);

//     // Assert no GraphQL errors
//     await response.assertNoErrors();
    
//     // Assert data exists
//     await response.assertHasData();
    
//     // Assert posts array exists
//     await response.assertDataHasFields(['posts']);
    
//     // Extract and validate data
//     const data = await response.getData();
//     expect(data.posts).toBeInstanceOf(Array);
//     expect(data.posts.length).toBeGreaterThan(0);
//   });

//   test('should query with variables', async ({ graphqlClient }) => {
//     // Query with variables for specific user
//     const response = await graphqlClient.queryWrapped(
//       `
//       query GetUser($userId: ID!) {
//         user(id: $userId) {
//           id
//           username
//           email
//           posts {
//             id
//             title
//           }
//         }
//       }
//       `,
//       { userId: '1' }
//     );

//     await response.assertNoErrors();
//     await response.assertDataField('user.id', '1');
//     await response.assertDataField('user.username', expect.any(String));
    
//     // Validate nested data
//     const data = await response.getData();
//     expect(data.user.posts).toBeInstanceOf(Array);
//   });

//   test('should query nested fields', async ({ graphqlClient }) => {
//     const response = await graphqlClient.queryWrapped(`
//       query GetPostWithComments {
//         post(id: "1") {
//           id
//           title
//           content
//           author {
//             id
//             name
//             email
//           }
//           comments {
//             id
//             text
//             author {
//               name
//             }
//           }
//         }
//       }
//     `);

//     await response.assertNoErrors();
    
//     // Assert nested field structure
//     await response.assertDataField('post.id', '1');
//     await response.assertDataField('post.author.name', expect.any(String));
    
//     // Check comments list size
//     const commentsSize = await response.getListSize('post.comments');
//     expect(commentsSize).toBeGreaterThanOrEqual(0);
//   });

//   test('should use query aliases', async ({ graphqlClient }) => {
//     const response = await graphqlClient.queryWrapped(`
//       query GetMultipleUsers {
//         firstUser: user(id: "1") {
//           id
//           name
//         }
//         secondUser: user(id: "2") {
//           id
//           name
//         }
//       }
//     `);

//     await response.assertNoErrors();
//     await response.assertDataHasFields(['firstUser', 'secondUser']);
//     await response.assertDataField('firstUser.id', '1');
//     await response.assertDataField('secondUser.id', '2');
//   });

//   test('should use GraphQL fragments', async ({ graphqlClient }) => {
//     const response = await graphqlClient.queryWrapped(`
//       fragment UserBasicInfo on User {
//         id
//         username
//         email
//       }
      
//       fragment PostInfo on Post {
//         id
//         title
//         author {
//           ...UserBasicInfo
//         }
//       }
      
//       query GetPostsWithFragments {
//         posts {
//           ...PostInfo
//         }
//       }
//     `);

//     await response.assertNoErrors();
//     const data = await response.getData();
//     expect(data.posts[0]).toHaveProperty('id');
//     expect(data.posts[0]).toHaveProperty('title');
//     expect(data.posts[0].author).toHaveProperty('username');
//   });
// });

// test.describe('GraphQL API Tests - Mutation Operations', () => {
  
//   test('should create a new post', async ({ graphqlClient }) => {
//     const response = await graphqlClient.mutateWrapped(
//       `
//       mutation CreatePost($input: CreatePostInput!) {
//         createPost(input: $input) {
//           id
//           title
//           content
//           author {
//             id
//             name
//           }
//           createdAt
//         }
//       }
//       `,
//       {
//         input: {
//           title: 'Test Post',
//           content: 'This is a test post created via GraphQL mutation',
//           authorId: '1'
//         }
//       }
//     );

//     await response.assertNoErrors();
//     await response.assertHasData();
//     await response.assertDataField('createPost.title', 'Test Post');
    
//     // Extract created post ID for potential cleanup
//     const data = await response.getData();
//     const createdPostId = data.createPost.id;
//     console.log('Created post with ID:', createdPostId);
//   });

//   test('should update existing post', async ({ graphqlClient }) => {
//     const response = await graphqlClient.mutateWrapped(
//       `
//       mutation UpdatePost($id: ID!, $input: UpdatePostInput!) {
//         updatePost(id: $id, input: $input) {
//           id
//           title
//           content
//           updatedAt
//         }
//       }
//       `,
//       {
//         id: '1',
//         input: {
//           title: 'Updated Post Title',
//           content: 'Updated content'
//         }
//       }
//     );

//     await response.assertNoErrors();
//     await response.assertDataField('updatePost.id', '1');
//     await response.assertDataField('updatePost.title', 'Updated Post Title');
//   });

//   test('should delete post', async ({ graphqlClient }) => {
//     // First create a post to delete
//     const createResp = await graphqlClient.mutateWrapped(
//       `
//       mutation CreatePost($input: CreatePostInput!) {
//         createPost(input: $input) {
//           id
//         }
//       }
//       `,
//       {
//         input: {
//           title: 'Post to Delete',
//           content: 'Will be deleted',
//           authorId: '1'
//         }
//       }
//     );
    
//     await createResp.assertNoErrors();
//     const postId = (await createResp.getData()).createPost.id;

//     // Now delete it
//     const deleteResp = await graphqlClient.mutateWrapped(
//       `
//       mutation DeletePost($id: ID!) {
//         deletePost(id: $id) {
//           success
//           message
//         }
//       }
//       `,
//       { id: postId }
//     );

//     await deleteResp.assertNoErrors();
//     await deleteResp.assertDataField('deletePost.success', true);
//   });
// });

// test.describe('GraphQL API Tests - Error Handling', () => {
  
//   test('should handle invalid query gracefully', async ({ graphqlClient }) => {
//     const response = await graphqlClient.queryWrapped(`
//       query InvalidQuery {
//         nonExistentField {
//           id
//         }
//       }
//     `);

//     // Should have GraphQL errors
//     await response.assertHasErrors();
    
//     // Check error message
//     const errorMessages = await response.getErrorMessages();
//     expect(errorMessages.length).toBeGreaterThan(0);
//     console.log('GraphQL errors:', errorMessages);
//   });

//   test('should handle validation errors', async ({ graphqlClient }) => {
//     const response = await graphqlClient.mutateWrapped(
//       `
//       mutation CreateInvalidPost($input: CreatePostInput!) {
//         createPost(input: $input) {
//           id
//         }
//       }
//       `,
//       {
//         input: {
//           title: '', // Empty title should fail validation
//           content: '',
//           authorId: 'invalid-id'
//         }
//       }
//     );

//     await response.assertHasErrors();
//     await response.assertErrorMessage('Validation');
//   });

//   test('should handle resource not found', async ({ graphqlClient }) => {
//     const response = await graphqlClient.queryWrapped(
//       `
//       query GetNonExistentUser($id: ID!) {
//         user(id: $id) {
//           id
//           name
//         }
//       }
//       `,
//       { id: 'non-existent-id-999999' }
//     );

//     const hasErrors = await response.hasErrors();
//     if (hasErrors) {
//       await response.assertErrorMessage('not found');
//     } else {
//       // Some APIs return null for not found
//       const data = await response.getData();
//       expect(data.user).toBeNull();
//     }
//   });

//   test('should handle authentication errors', async ({ createGraphQLClient }) => {
//     // Create client without authentication
//     const unauthClient = await createGraphQLClient({
//       authType: AuthType.NONE
//     });

//     const response = await unauthClient.queryWrapped(`
//       query GetProtectedData {
//         protectedResource {
//           id
//           secretValue
//         }
//       }
//     `);

//     await response.assertHasErrors();
//     await response.assertErrorCode('UNAUTHENTICATED');
//   });
// });

// test.describe('GraphQL API Tests - Authentication', () => {
  
//   test('should authenticate with Bearer token', async ({ createGraphQLClient }) => {
//     const client = await createGraphQLClient({
//       authType: AuthType.BEARER,
//       token: 'your-test-jwt-token'
//     });

//     const response = await client.queryWrapped(`
//       query GetCurrentUser {
//         me {
//           id
//           username
//           email
//         }
//       }
//     `);

//     // If token is valid, should succeed
//     if (!(await response.hasErrors())) {
//       await response.assertHasData();
//       await response.assertDataHasFields(['me']);
//     } else {
//       // If token is invalid/expired, should get auth error
//       await response.assertErrorCode('UNAUTHENTICATED');
//     }
//   });

//   test('should authenticate with API Key', async ({ createGraphQLClient }) => {
//     const client = await createGraphQLClient({
//       authType: AuthType.API_KEY,
//       apiKey: 'test-api-key',
//       apiKeyHeaderName: 'X-API-Key'
//     });

//     const response = await client.queryWrapped(`
//       query GetPublicData {
//         publicPosts {
//           id
//           title
//         }
//       }
//     `);

//     await response.assertNoErrors();
//     await response.assertHasData();
//   });
// });

// test.describe('GraphQL API Tests - Advanced Features', () => {
  
//   test('should introspect GraphQL schema', async ({ graphqlClient }) => {
//     const response = await graphqlClient.introspect();
    
//     expect(response.status()).toBe(200);
//     const schema = await response.json();
    
//     // Validate schema structure
//     expect(schema.data).toBeDefined();
//     expect(schema.data.__schema).toBeDefined();
//     expect(schema.data.__schema.types).toBeInstanceOf(Array);
    
//     // Find Query type
//     const queryType = schema.data.__schema.types.find(
//       (t: any) => t.name === 'Query'
//     );
//     expect(queryType).toBeDefined();
    
//     console.log('Available query operations:', 
//       queryType.fields.map((f: any) => f.name)
//     );
//   });

//   test('should batch multiple queries', async ({ graphqlClient }) => {
//     // Note: This is a conceptual example
//     // The actual batching implementation may vary based on your GraphQL server
    
//     // For demonstration, we'll execute queries sequentially
//     const user1Resp = await graphqlClient.queryWrapped(
//       `query GetUser1 { user(id: "1") { id name } }`
//     );
//     const user2Resp = await graphqlClient.queryWrapped(
//       `query GetUser2 { user(id: "2") { id name } }`
//     );
//     const postsResp = await graphqlClient.queryWrapped(
//       `query GetAllPosts { posts { id title } }`
//     );

//     await user1Resp.assertNoErrors();
//     await user2Resp.assertNoErrors();
//     await postsResp.assertNoErrors();
    
//     // Verify all queries returned data
//     expect(await user1Resp.getData()).toBeDefined();
//     expect(await user2Resp.getData()).toBeDefined();
//     expect(await postsResp.getData()).toBeDefined();
//   });

//   test('should use GraphQL directives', async ({ graphqlClient }) => {
//     const includeEmail = true;
//     const skipPosts = false;

//     const response = await graphqlClient.queryWrapped(
//       `
//       query GetUserWithDirectives(
//         $id: ID!,
//         $includeEmail: Boolean!,
//         $skipPosts: Boolean!
//       ) {
//         user(id: $id) {
//           id
//           username
//           email @include(if: $includeEmail)
//           posts @skip(if: $skipPosts) {
//             id
//             title
//           }
//         }
//       }
//       `,
//       { id: '1', includeEmail, skipPosts }
//     );

//     await response.assertNoErrors();
    
//     const data = await response.getData();
    
//     if (includeEmail) {
//       expect(data.user.email).toBeDefined();
//     }
    
//     if (!skipPosts) {
//       expect(data.user.posts).toBeDefined();
//     }
//   });
// });

// test.describe('GraphQL API Tests - Performance', () => {
  
//   test('should complete query within acceptable time', async ({ graphqlClient }) => {
//     const startTime = Date.now();

//     const response = await graphqlClient.queryWrapped(`
//       query GetUsersWithPosts {
//         users(limit: 50) {
//           id
//           username
//           posts(limit: 10) {
//             id
//             title
//           }
//         }
//       }
//     `);

//     const duration = Date.now() - startTime;

//     await response.assertNoErrors();
    
//     // Assert query completed within 2 seconds
//     expect(duration).toBeLessThan(2000);
    
//     console.log(`Query completed in ${duration}ms`);
//   });

//   test('should handle pagination efficiently', async ({ graphqlClient }) => {
//     const response = await graphqlClient.queryWrapped(
//       `
//       query GetPaginatedPosts($limit: Int!, $offset: Int!) {
//         posts(limit: $limit, offset: $offset) {
//           id
//           title
//         }
//         postsCount
//       }
//       `,
//       { limit: 20, offset: 0 }
//     );

//     await response.assertNoErrors();
//     await response.assertListSize('posts', 20);
    
//     const data = await response.getData();
//     console.log(`Retrieved 20 posts out of ${data.postsCount} total`);
//   });
// });

// test.describe('GraphQL API Tests - Data Validation', () => {
  
//   test('should validate response data structure', async ({ graphqlClient }) => {
//     const response = await graphqlClient.queryWrapped(`
//       query GetUserProfile {
//         user(id: "1") {
//           id
//           username
//           email
//           profile {
//             bio
//             avatar
//             location
//           }
//           stats {
//             postCount
//             followerCount
//           }
//         }
//       }
//     `);

//     await response.assertNoErrors();
    
//     // Validate top-level fields
//     await response.assertDataHasFields(['user']);
    
//     // Validate nested fields
//     await response.assertDataField('user.id', expect.any(String));
//     await response.assertDataField('user.username', expect.any(String));
//     await response.assertDataField('user.stats.postCount', expect.any(Number));
    
//     // Validate complete structure
//     const data = await response.getData();
//     expect(data.user).toMatchObject({
//       id: expect.any(String),
//       username: expect.any(String),
//       email: expect.stringContaining('@'),
//       profile: {
//         bio: expect.any(String),
//         avatar: expect.any(String)
//       },
//       stats: {
//         postCount: expect.any(Number),
//         followerCount: expect.any(Number)
//       }
//     });
//   });

//   test('should validate list data', async ({ graphqlClient }) => {
//     const response = await graphqlClient.queryWrapped(`
//       query GetAllUsers {
//         users {
//           id
//           username
//           role
//         }
//       }
//     `);

//     await response.assertNoErrors();
    
//     const data = await response.getData();
    
//     // Validate array
//     expect(data.users).toBeInstanceOf(Array);
//     expect(data.users.length).toBeGreaterThan(0);
    
//     // Validate each item has required fields
//     data.users.forEach((user: any) => {
//       expect(user).toHaveProperty('id');
//       expect(user).toHaveProperty('username');
//       expect(user).toHaveProperty('role');
//     });
//   });
// });

// test.describe('GraphQL API Tests - Complete Workflows', () => {
  
//   test('should complete full CRUD workflow', async ({ graphqlClient }) => {
//     // CREATE
//     const createResp = await graphqlClient.mutateWrapped(
//       `
//       mutation CreateUser($input: CreateUserInput!) {
//         createUser(input: $input) {
//           id
//           username
//           email
//         }
//       }
//       `,
//       {
//         input: {
//           username: 'testuser123',
//           email: 'testuser123@example.com',
//           password: 'SecurePass123!'
//         }
//       }
//     );

//     await createResp.assertNoErrors();
//     const userId = (await createResp.getData()).createUser.id;
//     console.log('Created user ID:', userId);

//     // READ
//     const readResp = await graphqlClient.queryWrapped(
//       `
//       query GetUser($id: ID!) {
//         user(id: $id) {
//           id
//           username
//           email
//         }
//       }
//       `,
//       { id: userId }
//     );

//     await readResp.assertNoErrors();
//     await readResp.assertDataField('user.username', 'testuser123');

//     // UPDATE
//     const updateResp = await graphqlClient.mutateWrapped(
//       `
//       mutation UpdateUser($id: ID!, $input: UpdateUserInput!) {
//         updateUser(id: $id, input: $input) {
//           id
//           username
//           email
//         }
//       }
//       `,
//       {
//         id: userId,
//         input: {
//           username: 'updateduser123'
//         }
//       }
//     );

//     await updateResp.assertNoErrors();
//     await updateResp.assertDataField('updateUser.username', 'updateduser123');

//     // DELETE
//     const deleteResp = await graphqlClient.mutateWrapped(
//       `
//       mutation DeleteUser($id: ID!) {
//         deleteUser(id: $id) {
//           success
//           message
//         }
//       }
//       `,
//       { id: userId }
//     );

//     await deleteResp.assertNoErrors();
//     await deleteResp.assertDataField('deleteUser.success', true);
//   });
// });
