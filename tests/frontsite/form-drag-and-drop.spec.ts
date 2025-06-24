
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
      console.log('Ten File:',await formDragAndDropPage.getUploadedFileName());
      expect(await formDragAndDropPage.getUploadedFileName()).toContain('NhacLy.txt');
   });
   test('Invalid File', async ({ 
    formDragAndDropPage,
    page
    }) => {
      await formDragAndDropPage.navigateToFormPage();
  
    //   await formDragAndDropPage.dragAndDropFile(DragAndDropData.csvFilePath);
    //   //await formDragAndDropPage.sleep(5000);
    //   console.log('ALert msg:', formDragAndDropPage.getAlertText());
    //   expect(formDragAndDropPage.getAlertText()).toContain('You cannot upload files');
     const fileChooserPromise = page.waitForEvent('filechooser');
  await page.click('div.file-upload-container svg');
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(DragAndDropData.csvFilePath);
  //await formDragAndDropPage.sleep(5000);
  console.log('ALert msg:', formDragAndDropPage.getAlertText());
expect(formDragAndDropPage.getAlertText()).toContain('You cannot upload files');
   });
});