import { faker, fakerEN_AU, Faker, en, en_AU } from '@faker-js/faker';

export const fakerAU = fakerEN_AU;
export const fakerNZ = new Faker({ locale: [en_AU, en] });
export { faker };
