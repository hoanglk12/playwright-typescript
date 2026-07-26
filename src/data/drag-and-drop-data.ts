import path from 'path';

export interface ValidFiles {
  csv: string;
}

export interface DragDropErrorMessages {
  invalidFileType: string;
}

export interface DragAndDropDataShape {
  formPageUrl: string;
  testFilePath: string;
  csvFilePath: string;
  validFiles: ValidFiles;
  errorMessages: DragDropErrorMessages;
}

const testFilePath = path.resolve(__dirname, 'upload files', 'NhacLy.txt');
const csvFilePath = path.resolve(__dirname, 'upload files', '2. Purchase Orders.csv');

export const DragAndDropData: DragAndDropDataShape = {
  formPageUrl: 'https://ff-fieldfishercom-qa-web-ekfefjdmh6dbg3f7.uksouth-01.azurewebsites.net/en/services/service-test-form',
  
  testFilePath: testFilePath,
  csvFilePath: csvFilePath,
  validFiles: {
    csv: testFilePath,
  },
  errorMessages: {
    invalidFileType: "You cannot upload files with the '.csv' extension",
  }
};

export { testFilePath };
