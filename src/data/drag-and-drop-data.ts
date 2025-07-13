import path from 'path';

const testFilePath = path.resolve(__dirname, 'upload files', 'NhacLy.txt');
const csvFilePath = path.resolve(__dirname, 'upload files', '2. Purchase Orders.csv');

// Export as an object (matching your original usage pattern)
export const DragAndDropData = {
  //url
  formPageUrl: 'https://ff-fieldfishercom-qa-web-ekfefjdmh6dbg3f7.uksouth-01.azurewebsites.net/en/services/service-test-form',
  
  testFilePath: testFilePath,
  csvFilePath: csvFilePath,
  // Additional test data
  validFiles: {
    csv: testFilePath,
    // Add other file types here
  },
  errorMessages: {
    invalidFileType: "You cannot upload files with the '.csv' extension",
  }
};

// Also export the individual path for direct usage
export { testFilePath };
