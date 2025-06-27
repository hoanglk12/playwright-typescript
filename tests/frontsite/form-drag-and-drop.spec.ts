
import { test, expect } from '../../src/config/base-test';
import { DragAndDropData } from '../../src/data/drag-and-drop-data';

/**
 * Admin Login Tests
 * @feature Admin Authentication
 * @story Login Functionality
 */
test.describe('Admin Login Tests', () => {
  test('Valid File', async ({
    formDragAndDropPage,

  }) => {
    await formDragAndDropPage.navigateToFormPage();

    await formDragAndDropPage.dragAndDropFile(DragAndDropData.testFilePath);
    //await formDragAndDropPage.sleep(5000);
    console.log('Ten File:', await formDragAndDropPage.getUploadedFileName());
    expect(await formDragAndDropPage.getUploadedFileName()).toContain('NhacLy.txt');
  });
  test('Invalid File @invalid file', async ({
    formDragAndDropPage,
    page
  }) => {
     
    await formDragAndDropPage.navigateToFormPage();
    await formDragAndDropPage.dragAndDropFile(DragAndDropData.csvFilePath);
    const alertText = await formDragAndDropPage.getAlertText();
    await formDragAndDropPage.acceptAlert();
    expect(alertText).toContain("You cannot upload files with the '.csv' extension");
  });
});