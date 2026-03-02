import { getEnvironment } from '../config/environment';

const env = getEnvironment();
const baseUrl = env.frontSiteUrl.replace(/\/$/, '');

/**
 * Test data for the Services A-Z List page
 */
export const ServicesAZData = {
  /** Homepage URL */
  homePageUrl: `${baseUrl}`,

  /** Direct URL for the Services A-Z List page */
  servicesAZListUrl: `${baseUrl}/services/services-a-z-list`,

  /** Selector-visible name for the A-Z letter nav links (e.g. "Letter A") */
  letterLinkPrefix: 'Letter',

  /** Expected page heading text */
  pageHeading: 'Services A-Z List',
} as const;
