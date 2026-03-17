export class FailedToFetchUserProfileResponse extends Response {
  constructor() {
    super("Failed to fetch user profile", { status: 502 })
  }
}
