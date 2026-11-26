/** No post with that slug (or the slug isn't valid). */
export class NotFound extends Error {}

/** The action would change something it mustn't (eg deleting a published post). */
export class Refused extends Error {}
