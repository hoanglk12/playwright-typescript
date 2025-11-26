# Semantic Locators - Practical Example

## Example: Refactoring ProfileListingPage with Semantic Locators

### Before (CSS Selectors)
```typescript
export class ProfileListingPage extends BasePage {
  private readonly searchTextBox = 'div[role="combobox"] > input';
  private readonly sortByDropdown = 'select[class*="custom-input custom-input"]';
  private readonly profileAnchorSelector = 'main a[href*="/people/"]';
  
  constructor(page: Page) {
    super(page);
  }
}
```

### After (Semantic Locators)
```typescript
import { Page, Locator } from '@playwright/test';
import { BasePage } from '../base-page';

export class ProfileListingPage extends BasePage {
  // Semantic locators - more resilient and readable
  private readonly searchBox: Locator;
  private readonly sortByDropdown: Locator;
  private readonly profileLinks: Locator;
  private readonly ascendingButton: Locator;
  
  constructor(page: Page) {
    super(page);
    
    // Use semantic locators for better resilience
    this.searchBox = page.getByRole('combobox').getByRole('textbox');
    // OR if there's a label: page.getByLabel('Search');
    // OR if there's a placeholder: page.getByPlaceholder('Search...');
    
    this.sortByDropdown = page.getByRole('combobox', { name: /sort/i });
    // OR more specific: page.getByLabel('Sort By');
    
    this.profileLinks = page.getByRole('main').getByRole('link', { 
      name: /./  // Matches any non-empty text
    }).filter({ href: /\/people\// });
    
    this.ascendingButton = page.getByRole('button', { name: 'Ascending' });
  }
}
```

## Complete Refactored Example

```typescript
import { Page, Locator } from '@playwright/test';
import { BasePage } from '../base-page';
import { getEnvironment } from '../../config/environment';
import * as ProfileListingData from '../../data/profile-listing-data';

/**
 * Profile Listing Page Object - Using Semantic Locators
 */
export class ProfileListingPageSemantic extends BasePage {
  // Semantic locators defined as properties
  private readonly searchBox: Locator;
  private readonly sortByDropdown: Locator;
  private readonly profileLinks: Locator;
  private readonly ascendingButton: Locator;
  private readonly mainContent: Locator;

  constructor(page: Page) {
    super(page);
    
    // Initialize locators in constructor
    this.mainContent = page.getByRole('main');
    
    // Search box - try multiple strategies for flexibility
    this.searchBox = page.getByRole('combobox')
      .locator('input')
      .or(page.getByPlaceholder(/search/i))
      .or(page.getByLabel(/search/i));
    
    // Sort dropdown - using label or role
    this.sortByDropdown = page.getByLabel(/sort by/i)
      .or(page.locator('select').filter({ hasText: /sort|default/i }));
    
    // Profile links within main content area
    this.profileLinks = this.mainContent
      .getByRole('link')
      .filter({ has: page.locator('[href*="/people/"]') });
    
    // Ascending/Descending buttons
    this.ascendingButton = page.getByRole('button', { name: /ascending/i });
  }

  /**
   * Navigate to profile listing page
   */
  async navigateToProfileListingPage(): Promise<void> {
    const env = getEnvironment();
    await this.page.goto(ProfileListingData.ProfileListingTestDataGenerator.profileListingUrl);
  }

  /**
   * Search for profiles using keyword
   */
  async searchWithKeyword(keyword: string): Promise<void> {
    await this.searchBox.fill(keyword);
    // Wait for search results
    await this.waitForAjaxRequestsCompleteAdvanced();
  }

  /**
   * Select sort option by visible text
   */
  async selectSortByOption(optionText: string): Promise<void> {
    await this.sortByDropdown.selectOption({ label: optionText });
    await this.waitForAjaxRequestsCompleteAdvanced();
  }

  /**
   * Select Surname sorting with ascending order
   */
  async selectSortByDropDownWithSurname(): Promise<void> {
    await this.sortByDropdown.selectOption({ 
      label: ProfileListingData.SortData.SORT_BY_SURNAME.SURNAME 
    });
    
    // Click ascending button if present
    const count = await this.ascendingButton.count();
    if (count > 0) {
      await this.ascendingButton.first().click();
    }
    
    await this.waitForAjaxRequestsCompleteAdvanced();
  }

  /**
   * Get currently selected sort option
   */
  async getSelectedSortByLabel(): Promise<string> {
    const selectedOption = await this.sortByDropdown.locator('option:checked').textContent();
    return (selectedOption || '').trim();
  }

  /**
   * Get the number of profile links displayed
   */
  async getProfileCount(): Promise<number> {
    try {
      await this.waitForProfilesToBePresent(1, 30000);
    } catch (e) {
      // Return current count even if minimum not reached
    }
    return await this.profileLinks.count();
  }

  /**
   * Get all profile names
   */
  async getProfileFullNames(): Promise<string[]> {
    const names = await this.profileLinks.allTextContents();
    return names.map(n => n.trim()).filter(n => n.length > 0);
  }

  /**
   * Verify profiles are sorted by surname in ascending order
   */
  async verifyProfilesSortedBySurnameAscending(): Promise<boolean> {
    await this.waitForProfilesToBePresent(1, 30000);
    
    // Get all profile names
    const names = await this.getProfileFullNames();
    
    // Filter out email addresses and phone numbers
    const validNames = names.filter(n => 
      n && 
      !n.includes('@') && 
      !n.toLowerCase().startsWith('tel:') && 
      /[A-Za-zÀ-ÖØ-öø-ÿ]/.test(n)
    );

    if (validNames.length < 2) {
      return true; // Consider sorted if 0 or 1 profiles
    }

    // Deduplicate adjacent duplicates
    const deduped = validNames.filter((name, index) => 
      index === 0 || name !== validNames[index - 1]
    );

    // Extract surnames (last word of name)
    const surnames = deduped.map(name => {
      const cleaned = name.replace(/\s*[,\(\[].*$/, '').trim();
      const parts = cleaned.split(/\s+/);
      
      if (parts.length <= 2) {
        return parts[parts.length - 1].toLowerCase();
      } else {
        return parts.slice(1).join(' ').toLowerCase();
      }
    });

    // Check if surnames are in ascending order
    for (let i = 1; i < surnames.length; i++) {
      const comparison = surnames[i].localeCompare(
        surnames[i - 1], 
        undefined, 
        { sensitivity: 'base' }
      );
      
      if (comparison < 0) {
        console.error('Profiles not sorted. Names:', deduped.slice(0, 20));
        console.error('Surnames:', surnames.slice(0, 20));
        return false;
      }
    }

    return true;
  }

  /**
   * Wait for minimum number of profiles to be present
   */
  async waitForProfilesToBePresent(minCount = 1, timeout = 30000): Promise<void> {
    await this.page.waitForFunction(
      ({ min }) => {
        const links = document.querySelectorAll('main a[href*="/people/"]');
        return links.length >= min;
      },
      { min: minCount },
      { timeout }
    );
  }

  /**
   * Click on a specific profile by name
   */
  async clickProfileByName(profileName: string): Promise<void> {
    await this.profileLinks
      .filter({ hasText: profileName })
      .first()
      .click();
  }

  /**
   * Check if specific profile exists
   */
  async isProfileDisplayed(profileName: string): Promise<boolean> {
    const count = await this.profileLinks
      .filter({ hasText: profileName })
      .count();
    return count > 0;
  }
}
```

## Advanced Examples

### 1. Working with Dynamic Content

```typescript
export class DynamicProfilePage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  /**
   * Get profile card by position
   */
  getProfileCard(index: number): Locator {
    return this.page
      .getByRole('article')
      .or(this.page.locator('[data-testid="profile-card"]'))
      .nth(index);
  }

  /**
   * Get profile card by name
   */
  getProfileCardByName(name: string): Locator {
    return this.page
      .getByRole('article')
      .filter({ hasText: name });
  }

  /**
   * Click action button within a specific profile card
   */
  async clickActionInProfile(profileName: string, action: string): Promise<void> {
    await this.getProfileCardByName(profileName)
      .getByRole('button', { name: action })
      .click();
  }
}
```

### 2. Working with Tables

```typescript
export class ProfileTablePage extends BasePage {
  private readonly profileTable: Locator;

  constructor(page: Page) {
    super(page);
    this.profileTable = page.getByRole('table', { name: /profiles?/i });
  }

  /**
   * Get table row by profile name
   */
  getRowByName(name: string): Locator {
    return this.profileTable
      .getByRole('row')
      .filter({ hasText: name });
  }

  /**
   * Click action button in specific row
   */
  async clickActionInRow(profileName: string, action: string): Promise<void> {
    await this.getRowByName(profileName)
      .getByRole('button', { name: action })
      .click();
  }

  /**
   * Get all profile names from table
   */
  async getAllProfileNames(): Promise<string[]> {
    const rows = this.profileTable.getByRole('row');
    const count = await rows.count();
    const names: string[] = [];

    for (let i = 1; i < count; i++) { // Start from 1 to skip header
      const nameCell = rows.nth(i).getByRole('cell').first();
      const name = await nameCell.textContent();
      if (name) names.push(name.trim());
    }

    return names;
  }
}
```

### 3. Working with Forms

```typescript
export class ProfileFormPage extends BasePage {
  private readonly form: Locator;

  constructor(page: Page) {
    super(page);
    this.form = page.getByRole('form').or(page.locator('form'));
  }

  /**
   * Fill profile form using semantic locators
   */
  async fillProfileForm(data: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    country: string;
  }): Promise<void> {
    // Using getByLabel for form fields
    await this.form.getByLabel(/first.*name/i).fill(data.firstName);
    await this.form.getByLabel(/last.*name|surname/i).fill(data.lastName);
    await this.form.getByLabel(/email/i).fill(data.email);
    await this.form.getByLabel(/phone|mobile/i).fill(data.phone);
    
    // Dropdown using label
    await this.form.getByLabel(/country/i).selectOption(data.country);
    
    // Submit button
    await this.form.getByRole('button', { name: /submit|save/i }).click();
  }

  /**
   * Check validation errors
   */
  async getValidationError(fieldLabel: string): Promise<string | null> {
    // Get the input field
    const field = this.form.getByLabel(new RegExp(fieldLabel, 'i'));
    
    // Find associated error message
    // Option 1: Using aria-describedby
    const errorId = await field.getAttribute('aria-describedby');
    if (errorId) {
      return await this.page.locator(`#${errorId}`).textContent();
    }
    
    // Option 2: Find error near the field
    const error = field.locator('..').getByRole('alert');
    const count = await error.count();
    if (count > 0) {
      return await error.textContent();
    }
    
    return null;
  }
}
```

### 4. Working with Modals/Dialogs

```typescript
export class ProfileModalPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  /**
   * Get modal dialog
   */
  getModal(title?: string): Locator {
    const modal = this.page.getByRole('dialog');
    if (title) {
      return modal.filter({ has: this.page.getByRole('heading', { name: title }) });
    }
    return modal;
  }

  /**
   * Click button within modal
   */
  async clickModalButton(modalTitle: string, buttonName: string): Promise<void> {
    await this.getModal(modalTitle)
      .getByRole('button', { name: buttonName })
      .click();
  }

  /**
   * Close modal by clicking close button
   */
  async closeModal(): Promise<void> {
    await this.page
      .getByRole('dialog')
      .getByRole('button', { name: /close|dismiss|cancel/i })
      .click();
  }

  /**
   * Wait for modal to appear
   */
  async waitForModal(title: string, timeout = 5000): Promise<void> {
    await this.getModal(title).waitFor({ state: 'visible', timeout });
  }
}
```

## Key Takeaways

1. **Define locators as class properties** in the constructor
2. **Use semantic locators** (`getByRole`, `getByLabel`, etc.) over CSS selectors
3. **Chain locators** to scope searches (e.g., `form.getByLabel()`)
4. **Use filter()** to narrow down multiple matches
5. **Provide fallbacks** with `.or()` for flexible matching
6. **Use regex** for case-insensitive or flexible text matching
7. **Keep selectors readable** - semantic locators are self-documenting

## Migration Checklist

- [ ] Identify elements with ARIA roles → use `getByRole`
- [ ] Identify form labels → use `getByLabel`
- [ ] Identify static text → use `getByText`
- [ ] Identify placeholders → use `getByPlaceholder`
- [ ] Add data-testid for elements without semantic meaning
- [ ] Test on different browsers to ensure compatibility
- [ ] Update documentation and tests
