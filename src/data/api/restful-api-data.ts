import { DeviceData, ApiObject } from '../../api/services/restful-device/restful-api-models';

export class RestfulApiDataGenerator {
  
  /**
   * Generate test data for mobile devices
   */
  static generateMobileDevice(): DeviceData {
    const timestamp = Date.now();
    return {
      name: `Test Mobile Device ${timestamp}`,
      data: {
        color: 'Black',
        capacity: '256 GB',
        price: 1200,
        generation: '5G',
        year: 2024
      }
    };
  }

  /**
   * Generate test data for laptop/computer
   */
  static generateLaptopDevice(): DeviceData {
    const timestamp = Date.now();
    return {
      name: `Test Laptop ${timestamp}`,
      data: {
        color: 'Silver',
        'CPU model': 'Intel Core i7',
        'Hard disk size': '1 TB',
        price: 2500,
        year: 2024
      }
    };
  }

  /**
   * Generate test data for tablet
   */
  static generateTabletDevice(): DeviceData {
    const timestamp = Date.now();
    return {
      name: `Test Tablet ${timestamp}`,
      data: {
        color: 'White',
        'capacity GB': 128,
        price: 800,
        generation: 'Wi-Fi + Cellular',
        year: 2024
      }
    };
  }

  /**
   * Generate multiple test devices
   */
  static generateMultipleDevices(count: number): DeviceData[] {
    const devices: DeviceData[] = [];
    for (let i = 0; i < count; i++) {
      const deviceTypes = ['mobile', 'laptop', 'tablet'];
      const randomType = deviceTypes[Math.floor(Math.random() * deviceTypes.length)];
      
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

  /**
   * Generate update payload for existing device
   */
  static generateUpdatePayload(): Partial<DeviceData> {
    return {
      name: `Updated Device ${Date.now()}`,
      data: {
        color: 'Updated Color',
        price: 1500,
        year: 2024
      }
    };
  }
}