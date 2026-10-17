/** Raised when the server is misconfigured. Messages never include secret values. */
export class ConfigurationError extends Error {
  readonly code = "configuration_error";

  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}
