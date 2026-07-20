import { test, expect } from '@config/base-test';
import { DragAndDropData } from '../../src/data/drag-and-drop-data';
import { createTestLogger } from '../../src/utils/test-logger';
import path from 'path';

/**
 * Upload File Tests
 * @feature Upload File
 * @story Upload File
 */

  
test.describe('Form Drag And Drop Tests', () => {
  test.skip(!!process.env.CI, 'Skipped in CI due to unstable/deprecated target page URL.');

  test('Valid File', async ({
    formDragAndDropPage,

  }) => {
    const logger = createTestLogger('Upload File Scenarios');

    await logger.step('Step 1 - Navigate to Form page', async () => {
      logger.action('Navigate', 'form page');
      await formDragAndDropPage.navigateToFormPage();
    });

    await logger.step('Step 2 - Drag and drop a valid file', async () => {
      logger.action('Drag and Drop', 'valid file');
      await formDragAndDropPage.dragAndDropFile(DragAndDropData.testFilePath);
    });

    await logger.step('Step 3 - Verify file is uploaded successfully', async () => {
      logger.action('Verify', 'uploaded file name');
      const expectedFileName = path.basename(DragAndDropData.testFilePath);
      expect(await formDragAndDropPage.getUploadedFileName()).toContain(expectedFileName);
    });
  });
  test('Invalid File @invalid file', async ({
    formDragAndDropPage,

  }) => {
    const logger = createTestLogger('Upload File Scenarios');
    let alertText!: string;

    await logger.step('Step 1 - Navigate to Form page', async () => {
      logger.action('Navigate', 'form page');
      await formDragAndDropPage.navigateToFormPage();
    });

    await logger.step('Step 2 - Drag and drop a invalid file', async () => {
      logger.action('Drag and Drop', 'invalid file');
      await formDragAndDropPage.dragAndDropFile(DragAndDropData.csvFilePath);
    });

    await logger.step('Step 3 - Get text from alert', async () => {
      logger.action('Get', 'alert text');
      alertText = await formDragAndDropPage.getAlertText();
    });

    await logger.step('Step 4 - Accept alert', async () => {
      logger.action('Accept', 'alert');
      await formDragAndDropPage.acceptAlert();
    });

    await logger.step('Step 5 - Verify alert text contains expected message', async () => {
      logger.action('Accept', 'alert');
      expect(alertText).toContain(DragAndDropData.errorMessages.invalidFileType);
    });
  });
});