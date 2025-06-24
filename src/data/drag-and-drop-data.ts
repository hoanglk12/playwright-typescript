import path from 'path';

const testFilePath = path.resolve(__dirname, 'upload files', 'NhacLy.txt');
const csvFilePath = path.resolve(__dirname, 'upload files', '2. Purchase Orders.csv');

// Export as an object (matching your original usage pattern)
export const DragAndDropData = {
  
  testFilePath: testFilePath,
  csvFilePath: csvFilePath,
  // Additional test data
  validFiles: {
    csv: testFilePath,
    // Add other file types here
  }
};

// Also export the individual path for direct usage
export { testFilePath };
