# GraphQL Assertion Cheatsheet

Use `queryWrapped` / `mutateWrapped` to get a `GraphQLResponseWrapper`.

## Happy-path order (always follow this sequence)

```ts
await response.assertStatus(200)      // 1. HTTP check
await response.assertNoErrors()       // 2. REQUIRED — fails if GQL errors field present
await response.assertHasData()        // 3. data is not null/undefined
await response.assertDataHasFields(['user', 'posts'])  // 4. field presence
await response.assertDataField('user.id', '1')         // 5. dot-notation equality
await response.assertDataFieldContains('user.email', '@') // partial / array / object
await response.assertListSize('users', 10)             // array length
```

## Error-path order

```ts
await response.assertHasErrors()
await response.assertErrorMessage('Unauthorized')   // partial match on any error
await response.assertErrorCode('UNAUTHENTICATED')   // extensions.code
await response.assertErrorPath(['secretData'])       // error.path array
```

## Extraction

```ts
const data = await response.getData<{ user: User }>()
const errors = response.getErrors()
const messages = response.getErrorMessages()   // string[]
const count = await response.getListSize('users')
```

## Full `GraphQLResponseWrapper` method reference

| Method | Description |
|---|---|
| `assertStatus(code)` | HTTP status code |
| `assertNoErrors()` | Fails if `errors` field present |
| `assertHasErrors()` | Fails if no `errors` field |
| `assertErrorMessage(msg)` | Partial match on any error message |
| `assertErrorCode(code)` | Matches `extensions.code` |
| `assertErrorPath(path[])` | Matches `error.path` array |
| `assertData(expected)` | `toMatchObject` on `data` |
| `assertDataField(path, value)` | Dot-notation equality |
| `assertDataFieldContains(path, value)` | Contains (string/array/partial object) |
| `assertHasData()` | `data` defined and not null |
| `assertDataHasFields(fields[])` | Each field name present in `data` |
| `getListSize(path)` | Array length at dot-notation path |
| `assertListSize(path, size)` | Assert array length |
| `getData<T>()` | Typed `data` object |
| `getErrors()` | Raw errors array |
| `getErrorMessages()` | String[] of error messages |
