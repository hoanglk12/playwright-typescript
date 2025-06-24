import { Page,Dialog } from '@playwright/test';
import { BasePage } from '../base-page';
import { getEnvironment } from '../../config/environment';


/**
 * Home Page Object
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
    await this.waitForFullPageLoad();
  }
    /**
     * Click upload file element
     */
async dragAndDropFile(filePath:string): Promise<void> {
      const fileInput =  this.page.locator(this.uploadFileElement);
    await fileInput.setInputFiles(filePath);
  }
  
  async getUploadedFileName(): Promise<string>{
    const fileNameElement = this.page.locator(this.fileName);
    await fileNameElement.waitFor({ state: 'visible', timeout: 5000 });
    return await fileNameElement.textContent() || '';
  }
  getAlertText(): string | null {
    this.page.on('dialog', async (dialog: Dialog) => {
      this.alertText = dialog.message();
      console.log('Captured alert text:', this.alertText);
      await dialog.accept();
    });
    return this.alertText;
  }
 
  

}
