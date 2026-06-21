import { DeviceData, ApiObject } from '../../api/services/restful-device/restful-api-models';
import { faker } from '../faker';

export class RestfulApiDataGenerator {
  static generateMobileDevice(): DeviceData {
    return {
      name: faker.commerce.productName(),
      data: {
        color: faker.color.human(),
        capacity: `${faker.helpers.arrayElement([128, 256, 512])} GB`,
        price: faker.number.float({ min: 10, max: 999, fractionDigits: 2 }),
        generation: '5G',
        year: faker.number.int({ min: 2015, max: 2025 }),
      },
    };
  }

  static generateLaptopDevice(): DeviceData {
    return {
      name: faker.commerce.productName(),
      data: {
        color: faker.color.human(),
        'CPU model': 'Intel Core i7',
        'Hard disk size': '1 TB',
        price: faker.number.float({ min: 10, max: 999, fractionDigits: 2 }),
        year: faker.number.int({ min: 2015, max: 2025 }),
      },
    };
  }

  static generateTabletDevice(): DeviceData {
    return {
      name: faker.commerce.productName(),
      data: {
        color: faker.color.human(),
        'capacity GB': faker.helpers.arrayElement([64, 128, 256]),
        price: faker.number.float({ min: 10, max: 999, fractionDigits: 2 }),
        generation: 'Wi-Fi + Cellular',
        year: faker.number.int({ min: 2015, max: 2025 }),
      },
    };
  }

  static generateMultipleDevices(count: number): DeviceData[] {
    const devices: DeviceData[] = [];
    for (let i = 0; i < count; i++) {
      const randomType = faker.helpers.arrayElement(['mobile', 'laptop', 'tablet']);
      switch (randomType) {
        case 'mobile':
          devices.push(this.generateMobileDevice());
          break;
        case 'laptop':
          devices.push(this.generateLaptopDevice());
          break;
        case 'tablet':
          devices.push(this.generateTabletDevice());
          break;
      }
    }
    return devices;
  }

  static generateUpdatePayload(): Partial<DeviceData> {
    return {
      name: faker.commerce.productName(),
      data: {
        color: faker.color.human(),
        price: faker.number.float({ min: 10, max: 999, fractionDigits: 2 }),
        year: faker.number.int({ min: 2015, max: 2025 }),
      },
    };
  }
}