import { Page, Dialog } from '@playwright/test';
import { BasePage } from '../base-page';
import { DragAndDropData } from '../../data/drag-and-drop-data';
import { TIMEOUTS } from '../../constants/timeouts';


export class FormDragAndDropPage extends BasePage {

  private readonly uploadFileElement = 'input[type="file"]';
  private readonly fileName = 'span.progress-file-name';
  alertText: string | null = null;


  constructor(page: Page) {
    super(page);

  }

  async navigateToFormPage(): Promise<void> {
    await this.goto(DragAndDropData.formPageUrl);
    await this.waitForPageLoadState('domcontentloaded');
  }
  async dragAndDropFile(filePath: string): Promise<void> {
    await this.waitForElementClickable(this.uploadFileElement);
    const fileInput = this.elements.locator(this.uploadFileElement);
    await fileInput.setInputFiles(filePath);
  }

  async getUploadedFileName(): Promise<string> {
    const fileNameElement = this.elements.locator(this.fileName);
    await fileNameElement.waitFor({ state: 'visible', timeout: TIMEOUTS.ELEMENT_VISIBLE });
    return await fileNameElement.textContent() || '';
  }
  async getAlertText(): Promise<string> {
    // WHY: no WaitHelper equivalent for browser dialog events
    const dialog = await this.page.waitForEvent('dialog');
    return dialog.message();
  }

}


