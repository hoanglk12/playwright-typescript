import { getEnvironment } from '../config/environment';

const env = getEnvironment();
const baseUrl = env.frontSiteUrl.replace(/\/$/, '');

export interface ServicesAZDataShape {
  /** Homepage URL */
  homePageUrl: string;
  /** Direct URL for the Services A-Z List page */
  servicesAZListUrl: string;
  /** Selector-visible name for the A-Z letter nav links (e.g. "Letter A") */
  letterLinkPrefix: string;
  /** Expected page heading text */
  pageHeading: string;
}

export const ServicesAZData: ServicesAZDataShape = {
  homePageUrl: `${baseUrl}`,
  servicesAZListUrl: `${baseUrl}/services/services-a-z-list`,
  letterLinkPrefix: 'Letter',
  pageHeading: 'Services A-Z List',
} as const;
