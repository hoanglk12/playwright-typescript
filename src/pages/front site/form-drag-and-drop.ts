import { Page, Dialog } from '@playwright/test';
import { BasePage } from '../base-page';
import { getEnvironment } from '../../config/environment';


/**
 * Form Drag And Drop Page Object
 */
export class FormDragAndDropPage extends BasePage {
  // Header locators

  private readonly uploadFileElement = 'input[type="file"]';
  private readonly fileName = 'span.progress-file-name';
  alertText: string | null = null;


  constructor(page: Page) {
    super(page);

  }

  /**
   * Navigate to Form home page
   */
  async navigateToFormPage(): Promise<void> {
    //const env = getEnvironment();
    await this.page.goto('https://ff-fieldfishercom-qa-web-ekfefjdmh6dbg3f7.uksouth-01.azurewebsites.net/en/services/service-test-form');
    await this.waitForPageLoadState();
  }
  /**
   * Click upload file element
   */
  async dragAndDropFile(filePath: string): Promise<void> {
    await this.waitForElementClickable(this.uploadFileElement);
    const fileInput = this.page.locator(this.uploadFileElement);
    await fileInput.setInputFiles(filePath);
  }

  async getUploadedFileName(): Promise<string> {
    const fileNameElement = this.page.locator(this.fileName);
    await fileNameElement.waitFor({ state: 'visible', timeout: 5000 });
    return await fileNameElement.textContent() || '';
  }
  async getAlertText(): Promise<string> {
    const dialog = await this.page.waitForEvent('dialog');
    const dialogMessage = dialog.message();
    console.log('Dialog message:', dialogMessage);
    return dialogMessage;
}

}


