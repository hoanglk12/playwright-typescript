# Semantic Locators Guide

## Overview
Playwright provides powerful semantic locators that are more resilient to changes and better for accessibility. This guide shows how to use them in this framework.

## Available Semantic Locators

### 1. **getByRole** (Recommended - Most Resilient)
Best for interactive elements based on ARIA roles and accessibility attributes.

```typescript
export class LoginPage extends BasePage {
  // Locators using getByRole
  private readonly usernameInput = this.page.getByRole('textbox', { name: 'Username' });
  private readonly passwordInput = this.page.getByRole('textbox', { name: 'Password' });
  private readonly loginButton = this.page.getByRole('button', { name: 'Login' });
  private readonly submitButton = this.page.getByRole('button', { name: /submit|sign in/i });
  
  // With exact matching
  private readonly logoutLink = this.page.getByRole('link', { name: 'Logout', exact: true });
  
  // Checkboxes and radio buttons
  private readonly agreeCheckbox = this.page.getByRole('checkbox', { name: 'I agree to terms' });
  private readonly genderMale = this.page.getByRole('radio', { name: 'Male' });
  
  constructor(page: Page) {
    super(page);
  }
}
```

**Common Roles:**
- `button` - Buttons
- `link` - Links
- `textbox` - Input fields
- `checkbox` - Checkboxes
- `radio` - Radio buttons
- `heading` - Headings (h1-h6)
- `list` - Lists (ul, ol)
- `listitem` - List items
- `table` - Tables
- `row` - Table rows
- `cell` - Table cells
- `dialog` - Modal dialogs
- `alert` - Alert messages
- `navigation` - Navigation sections
- `main` - Main content area

### 2. **getByText**
Finds elements by their text content. Good for static text and labels.

```typescript
export class HomePage extends BasePage {
  // Exact text match
  private readonly welcomeMessage = this.page.getByText('Welcome back!');
  
  // Partial text match
  private readonly errorMessage = this.page.getByText('Error:', { exact: false });
  
  // Using regex for flexible matching
  private readonly statusMessage = this.page.getByText(/success|completed/i);
  
  // Finding specific element type with text
  private readonly heading = this.page.getByText('Dashboard').and(this.page.locator('h1'));
  
  constructor(page: Page) {
    super(page);
  }
}
```

### 3. **getByLabel**
Best for form inputs associated with labels.

```typescript
export class RegistrationPage extends BasePage {
  // By exact label text
  private readonly firstNameInput = this.page.getByLabel('First Name');
  private readonly lastNameInput = this.page.getByLabel('Last Name');
  
  // By partial label text
  private readonly emailInput = this.page.getByLabel('Email', { exact: false });
  
  // Using regex
  private readonly phoneInput = this.page.getByLabel(/phone|mobile/i);
  
  constructor(page: Page) {
    super(page);
  }
}
```

### 4. **getByPlaceholder**
Finds inputs by their placeholder attribute.

```typescript
export class SearchPage extends BasePage {
  private readonly searchInput = this.page.getByPlaceholder('Search products...');
  private readonly emailField = this.page.getByPlaceholder(/enter.*email/i);
  
  constructor(page: Page) {
    super(page);
  }
}
```

### 5. **getByAltText**
Finds images by their alt text.

```typescript
export class ProductPage extends BasePage {
  private readonly productImage = this.page.getByAltText('Product main image');
  private readonly logo = this.page.getByAltText(/company.*logo/i);
  
  constructor(page: Page) {
    super(page);
  }
}
```

### 6. **getByTitle**
Finds elements by their title attribute.

```typescript
export class ToolbarPage extends BasePage {
  private readonly saveButton = this.page.getByTitle('Save document');
  private readonly helpIcon = this.page.getByTitle(/help|info/i);
  
  constructor(page: Page) {
    super(page);
  }
}
```

### 7. **getByTestId**
For elements with data-testid attributes (recommended for test-specific locators).

```typescript
export class CheckoutPage extends BasePage {
  private readonly cartTotal = this.page.getByTestId('cart-total');
  private readonly checkoutButton = this.page.getByTestId('checkout-btn');
  
  constructor(page: Page) {
    super(page);
  }
}
```

## Combining Locators

### Chaining with .locator()
```typescript
export class DataTablePage extends BasePage {
  // Find button within a specific section
  private readonly sectionButton = this.page
    .getByRole('region', { name: 'User Settings' })
    .getByRole('button', { name: 'Save' });
  
  // Find input within a form
  private readonly formEmail = this.page
    .locator('form#registration')
    .getByLabel('Email Address');
  
  constructor(page: Page) {
    super(page);
  }
}
```

### Using .and() for intersection
```typescript
export class FilterPage extends BasePage {
  // Element that matches both conditions
  private readonly activeSubmitButton = this.page
    .getByRole('button', { name: 'Submit' })
    .and(this.page.locator('.active'));
  
  constructor(page: Page) {
    super(page);
  }
}
```

### Using .or() for alternatives
```typescript
export class NavigationPage extends BasePage {
  // Match either condition
  private readonly loginButton = this.page
    .getByRole('button', { name: 'Login' })
    .or(this.page.getByRole('button', { name: 'Sign In' }));
  
  constructor(page: Page) {
    super(page);
  }
}
```

### Using .filter()
```typescript
export class ListPage extends BasePage {
  // Filter by text content
  private readonly activeItems = this.page
    .getByRole('listitem')
    .filter({ hasText: 'Active' });
  
  // Filter by another locator
  private readonly completedTasks = this.page
    .getByRole('listitem')
    .filter({ has: this.page.locator('.completed') });
  
  constructor(page: Page) {
    super(page);
  }
}
```

## Complete Example Page Object

```typescript
import { Page, Locator } from '@playwright/test';
import { BasePage } from '../base-page';

/**
 * Example page showing semantic locators
 */
export class SemanticLocatorsExamplePage extends BasePage {
  // Role-based locators (most resilient)
  private readonly heading = this.page.getByRole('heading', { name: 'Welcome' });
  private readonly submitButton = this.page.getByRole('button', { name: /submit|save/i });
  private readonly cancelLink = this.page.getByRole('link', { name: 'Cancel' });
  
  // Label-based locators (best for forms)
  private readonly usernameInput = this.page.getByLabel('Username');
  private readonly passwordInput = this.page.getByLabel('Password');
  private readonly rememberMeCheckbox = this.page.getByLabel('Remember me');
  
  // Text-based locators
  private readonly errorMessage = this.page.getByText('Invalid credentials');
  private readonly successBanner = this.page.getByText(/success/i);
  
  // Placeholder-based locators
  private readonly searchBox = this.page.getByPlaceholder('Search...');
  
  // Test ID locators (for elements without semantic meaning)
  private readonly userAvatar = this.page.getByTestId('user-avatar');
  
  // Combined locators
  private readonly modalSubmitButton = this.page
    .getByRole('dialog')
    .getByRole('button', { name: 'Submit' });
  
  // Filtered locators
  private readonly activeMenuItems = this.page
    .getByRole('menuitem')
    .filter({ hasText: 'Active' });
  
  constructor(page: Page) {
    super(page);
  }

  /**
   * Example: Using semantic locators in methods
   */
  async login(username: string, password: string): Promise<void> {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  /**
   * Example: Working with dynamic elements
   */
  async selectMenuItem(itemName: string): Promise<void> {
    await this.page
      .getByRole('menuitem', { name: itemName })
      .click();
  }

  /**
   * Example: Getting all matching elements
   */
  async getAllProductNames(): Promise<string[]> {
    const products = this.page.getByRole('listitem').filter({ hasText: 'Product' });
    const count = await products.count();
    const names: string[] = [];
    
    for (let i = 0; i < count; i++) {
      const name = await products.nth(i).textContent();
      if (name) names.push(name.trim());
    }
    
    return names;
  }

  /**
   * Example: Waiting for semantic locators
   */
  async waitForSuccessMessage(): Promise<void> {
    await this.successBanner.waitFor({ state: 'visible', timeout: 5000 });
  }
}
```

## Using with BasePage Methods

Since BasePage methods now accept string selectors, you can still use them, but for semantic locators, you'll interact directly with the Locator:

```typescript
export class ModernPage extends BasePage {
  private readonly saveButton = this.page.getByRole('button', { name: 'Save' });
  private readonly nameInput = this.page.getByLabel('Full Name');
  
  constructor(page: Page) {
    super(page);
  }

  async saveName(name: string): Promise<void> {
    // Direct locator usage (recommended)
    await this.nameInput.fill(name);
    await this.saveButton.click();
    
    // Or use BasePage helper methods if they accept Locators
    // await this.enterText(this.nameInput, name);
    // await this.clickElement(this.saveButton);
  }
}
```

## Best Practices

### 1. **Priority Order (Most to Least Resilient)**
1. `getByRole` - Best for accessibility and resilience
2. `getByLabel` - Great for form fields
3. `getByPlaceholder` - Good for inputs
4. `getByText` - For static content
5. `getByTestId` - Last resort for elements without semantic meaning
6. CSS/XPath selectors - Avoid if possible

### 2. **Use Descriptive Variable Names**
```typescript
// ✅ Good
private readonly primarySubmitButton = this.page.getByRole('button', { name: 'Submit' });
private readonly emailAddressInput = this.page.getByLabel('Email Address');

// ❌ Bad
private readonly btn1 = this.page.getByRole('button', { name: 'Submit' });
private readonly input = this.page.getByLabel('Email Address');
```

### 3. **Use Regex for Flexible Matching**
```typescript
// Matches "Submit", "submit", "SUBMIT"
private readonly submitButton = this.page.getByRole('button', { name: /submit/i });

// Matches "Email" or "E-mail"
private readonly emailInput = this.page.getByLabel(/e-?mail/i);
```

### 4. **Scope Locators When Needed**
```typescript
// Find button only within a specific form
private readonly formSubmitButton = this.page
  .locator('form#checkout')
  .getByRole('button', { name: 'Submit' });
```

### 5. **Use .first(), .last(), .nth() for Multiple Matches**
```typescript
private readonly firstProduct = this.page.getByRole('article').first();
private readonly lastProduct = this.page.getByRole('article').last();
private readonly thirdProduct = this.page.getByRole('article').nth(2); // 0-based
```

## Migration Example

### Before (CSS Selectors)
```typescript
export class OldLoginPage extends BasePage {
  private readonly usernameInput = this.page.locator('#username');
  private readonly passwordInput = this.page.locator('input[type="password"]');
  private readonly loginButton = this.page.locator('button.btn-primary');
  
  constructor(page: Page) {
    super(page);
  }
}
```

### After (Semantic Locators)
```typescript
export class NewLoginPage extends BasePage {
  private readonly usernameInput = this.page.getByLabel('Username');
  private readonly passwordInput = this.page.getByLabel('Password');
  private readonly loginButton = this.page.getByRole('button', { name: 'Login' });
  
  constructor(page: Page) {
    super(page);
  }
}
```

## Benefits

✅ **More Resilient** - Less likely to break with UI changes  
✅ **Better Accessibility** - Ensures proper ARIA attributes  
✅ **Self-Documenting** - Code clearly shows what it's interacting with  
✅ **Easier Maintenance** - Semantic meaning is clearer than CSS classes  
✅ **Better IDE Support** - Type-safe with autocomplete

## References

- [Playwright Locators Documentation](https://playwright.dev/docs/locators)
- [Accessibility Roles](https://www.w3.org/TR/wai-aria-1.2/#role_definitions)
