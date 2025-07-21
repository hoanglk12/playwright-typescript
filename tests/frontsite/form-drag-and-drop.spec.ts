import { test, expect } from '../../src/config/base-test';
import { DragAndDropData } from '../../src/data/drag-and-drop-data';
import { createTestLogger } from '../../src/utils/test-logger';
import path from 'path';

/**
 * Upload File Tests
 * @feature Upload File
 * @story Upload File
 */

  
test.describe('Form Drag And Drop Tests', () => {
   //Declare logger for test steps
  const logger = createTestLogger('Upload File Scenarios');
  test('Valid File', async ({
    formDragAndDropPage,

  }) => {
     
      
    logger.step('Step 1 - Navigate to Form page');
    logger.action('Navigate', 'form page');
    await formDragAndDropPage.navigateToFormPage();

    logger.step('Step 2 - Drag and drop a valid file');
    logger.action('Drag and Drop', 'valid file');
    await formDragAndDropPage.dragAndDropFile(DragAndDropData.testFilePath);

    logger.step('Step 3 - Verify file is uploaded successfully');
    logger.action('Verify', 'uploaded file name');
    const expectedFileName = path.basename(DragAndDropData.testFilePath);
    expect(await formDragAndDropPage.getUploadedFileName()).toContain(expectedFileName);
  });
  test('Invalid File @invalid file', async ({
    formDragAndDropPage,
     
  }) => {
    logger.step('Step 1 - Navigate to Form page');
    logger.action('Navigate', 'form page');
    await formDragAndDropPage.navigateToFormPage();

    logger.step('Step 2 - Drag and drop a invalid file');
    logger.action('Drag and Drop', 'invalid file');
    await formDragAndDropPage.dragAndDropFile(DragAndDropData.csvFilePath);

    logger.step('Step 3 - Get text from alert');
    logger.action('Get', 'alert text');
    const alertText = await formDragAndDropPage.getAlertText();

    logger.step('Step 4 - Accept alert');
    logger.action('Accept', 'alert');
    await formDragAndDropPage.acceptAlert();

    logger.step('Step 5 - Verify alert text contains expected message');
    logger.action('Accept', 'alert');
    expect(alertText).toContain(DragAndDropData.errorMessages.invalidFileType);
  });
});