export interface PlpRatingExpectations {
  /** Matches Bazaarvoice's accessible rating text, e.g. "(2)4.5 out of 5 stars. 2 reviews" */
  ratingLabelPattern: RegExp;
  minRating: number;
  maxRating: number;
}

export const PlpRatingData: PlpRatingExpectations = {
  ratingLabelPattern: /(\d(?:\.\d+)?) out of 5 stars/i,
  minRating: 0,
  maxRating: 5,
};
